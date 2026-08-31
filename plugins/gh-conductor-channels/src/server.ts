// The channel itself: polls one issue tree through `gh` and pushes each change into the running Claude
// Code session as a one-way `notifications/claude/channel` notification.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { diff, type FetchedComment, type FetchedSubIssue, type Snapshot } from "./diff.ts";

type RootIssue = { owner: string; repo: string; number: number; label: string };

const DEFAULT_ISSUE = "phillipdupuis/gh-conductor-tests#4";
const DEFAULT_ALLOW = "phillipdupuis";
const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;

function parseRootIssue(spec: string): RootIssue {
  const match = /^([^/\s]+)\/([^#\s]+)#(\d+)$/.exec(spec.trim());
  const [owner, repo, number] = [match?.[1], match?.[2], match?.[3]];
  if (!owner || !repo || !number) {
    console.error(`gh-conductor-channels: cannot parse GH_CONDUCTOR_CHANNEL_ISSUE "${spec}" — expected owner/repo#number`);
    process.exit(1);
  }
  return { owner, repo, number: Number(number), label: `${owner}/${repo}#${number}` };
}

function parseInterval(raw: string | undefined): number {
  const seconds = raw === undefined ? DEFAULT_INTERVAL_SECONDS : Number(raw);
  return Math.max(MIN_INTERVAL_SECONDS, Number.isFinite(seconds) ? seconds : DEFAULT_INTERVAL_SECONDS);
}

async function gh(args: string[]): Promise<unknown> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} exited ${code}: ${err.trim()}`);
  return JSON.parse(out);
}

function asArray<T>(value: unknown, what: string): T[] {
  if (!Array.isArray(value)) throw new Error(`expected a JSON array of ${what} from gh`);
  return value as T[];
}

const root = parseRootIssue(process.env.GH_CONDUCTOR_CHANNEL_ISSUE ?? DEFAULT_ISSUE);
const intervalMs = parseInterval(process.env.GH_CONDUCTOR_CHANNEL_INTERVAL) * 1000;
const allowlist = new Set(
  (process.env.GH_CONDUCTOR_CHANNEL_ALLOW ?? DEFAULT_ALLOW)
    .split(",")
    .map((login) => login.trim())
    .filter((login) => login.length > 0),
);

const instructions = [
  'Events from this channel arrive as <channel source="gh-conductor-channels" ...>.',
  `They describe changes under issue ${root.label}: one of its sub-issues was closed or reopened,`,
  "or someone commented on the issue itself.",
  "Every event carries a url attribute with the GitHub permalink for what changed.",
  "The channel is one-way — read the event and act; there is no reply tool and no reply is expected.",
  `On kind="state_change", run \`gh-conductor status ${root.label}\` to see the updated board before acting.`,
].join(" ");

const mcp = new Server(
  { name: "gh-conductor-channels", version: "0.0.1" },
  { capabilities: { experimental: { "claude/channel": {} } }, instructions },
);

await mcp.connect(new StdioServerTransport());
// The poll chain keeps the event loop alive, so stdin closing must end the process explicitly
// or the poller outlives the session.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));

let snapshot: Snapshot | null = null;
let lastSuccessAt: number | null = null;

// `since` matches updated_at, so an edited comment comes back after it was seen; the snapshot's
// seen ids are what actually keeps events from repeating. Anchored to the last successful poll so
// a stretch of failed ticks (offline, gh errors) cannot open a gap the window never covers.
async function poll(): Promise<void> {
  const startedAt = Date.now();
  try {
    const base = `repos/${root.owner}/${root.repo}/issues/${root.number}`;
    const since = lastSuccessAt === null ? "" : `&since=${new Date(lastSuccessAt - intervalMs).toISOString()}`;
    const subIssues = asArray<FetchedSubIssue>(await gh(["api", `${base}/sub_issues?per_page=100`]), "sub-issues");
    const comments = asArray<FetchedComment>(await gh(["api", `${base}/comments?per_page=100${since}`]), "comments");
    const { next, events } = diff(snapshot, { subIssues, comments }, { root: root.label, allowlist });
    snapshot = next;
    lastSuccessAt = startedAt;
    for (const event of events) {
      await mcp.notification({
        method: "notifications/claude/channel",
        params: { content: event.content, meta: event.meta },
      });
    }
  } catch (err) {
    console.error(`gh-conductor-channels: poll failed — ${err instanceof Error ? err.message : String(err)}`);
  }
  setTimeout(poll, intervalMs);
}

void poll();
