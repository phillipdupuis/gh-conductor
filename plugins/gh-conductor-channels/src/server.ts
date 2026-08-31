// The channel itself: polls the subscribed issue trees through `gh` and pushes each change into the
// running Claude Code session as a one-way `notifications/claude/channel` notification.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { diff, type FetchedComment, type FetchedSubIssue } from "./diff.ts";
import { describeWatching, parseIssueRef, parseIssueRefs, reconcile, type Subscription } from "./subscriptions.ts";

const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;

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

const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const intervalMs = parseInterval(process.env.GH_CONDUCTOR_CHANNEL_INTERVAL) * 1000;

let subscriptions = new Map<string, Subscription>();

const initialIssue = process.env.GH_CONDUCTOR_CHANNEL_ISSUE?.trim();
if (initialIssue) {
  const root = parseIssueRef(initialIssue);
  if (root === null) {
    console.error(
      `gh-conductor-channels: cannot parse GH_CONDUCTOR_CHANNEL_ISSUE "${initialIssue}" — expected owner/repo#number`,
    );
    process.exit(1);
  }
  subscriptions = reconcile(subscriptions, [root]);
}

// Null until the allowlist is known. With GH_CONDUCTOR_CHANNEL_ALLOW unset it is the gh-authenticated
// login, which needs a `gh` call that can fail; comments are dropped until it resolves.
const configuredAllow = process.env.GH_CONDUCTOR_CHANNEL_ALLOW;
let allowlist: Set<string> | null =
  configuredAllow === undefined
    ? null
    : new Set(
        configuredAllow
          .split(",")
          .map((login) => login.trim())
          .filter((login) => login.length > 0),
      );

async function ensureAllowlist(): Promise<void> {
  if (allowlist !== null) return;
  try {
    const login = (await gh(["api", "user"]) as { login?: unknown } | null)?.login;
    if (typeof login !== "string" || login.length === 0) throw new Error("gh api user returned no login");
    allowlist = new Set([login]);
  } catch (err) {
    console.error(`gh-conductor-channels: cannot resolve the comment allowlist — ${reason(err)}`);
  }
}

const instructions = [
  'Events from this channel arrive as <channel source="gh-conductor-channels" ...>.',
  "They describe changes under a watched issue tree: one of its sub-issues was closed or reopened,",
  "or someone commented on a watched issue.",
  "Every event carries a url attribute with the GitHub permalink for what changed, and a root attribute",
  "naming the issue tree it belongs to.",
  "The channel is one-way — read the event and act; there is no reply tool and no reply is expected.",
  'On kind="state_change", run `gh-conductor status <root>` with the event\'s root attribute to see the',
  "updated board before acting.",
  "Use the subscribe tool to set which issue trees are watched — nothing is watched until it is called,",
  "unless GH_CONDUCTOR_CHANNEL_ISSUE seeded a tree at startup.",
].join(" ");

const mcp = new Server(
  { name: "gh-conductor-channels", version: "0.0.2" },
  { capabilities: { experimental: { "claude/channel": {} }, tools: {} }, instructions },
);

const SUBSCRIBE_TOOL = {
  name: "subscribe",
  description: "Replace the set of issue trees this channel watches. Pass an empty list to stop watching everything.",
  inputSchema: {
    type: "object",
    properties: {
      issues: { type: "array", items: { type: "string", description: "owner/repo#number" } },
    },
    required: ["issues"],
  },
} as const;

const say = (text: string, isError = false) => ({ content: [{ type: "text" as const, text }], isError });

mcp.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [SUBSCRIBE_TOOL] }));

mcp.setRequestHandler(CallToolRequestSchema, (request) => {
  if (request.params.name !== SUBSCRIBE_TOOL.name) return say(`Unknown tool "${request.params.name}".`, true);
  const issues = request.params.arguments?.issues;
  if (!Array.isArray(issues) || issues.some((issue) => typeof issue !== "string")) {
    return say("subscribe expects issues to be an array of owner/repo#number strings.", true);
  }
  const { roots, invalid } = parseIssueRefs(issues as string[]);
  if (invalid.length > 0) {
    const bad = invalid.map((spec) => `"${spec}"`).join(", ");
    return say(
      `Not an issue reference: ${bad}. Expected owner/repo#number. Nothing changed — ${describeWatching([...subscriptions.keys()])}`,
      true,
    );
  }
  subscriptions = reconcile(subscriptions, roots);
  return say(describeWatching([...subscriptions.keys()]));
});

await mcp.connect(new StdioServerTransport());
// The poll chain keeps the event loop alive, so stdin closing must end the process explicitly
// or the poller outlives the session.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));

// `since` matches updated_at, so an edited comment comes back after it was seen; the snapshot's
// seen ids are what actually keeps events from repeating. Anchored to the last successful poll so
// a stretch of failed ticks (offline, gh errors) cannot open a gap the window never covers.
async function pollRoot(sub: Subscription): Promise<void> {
  const startedAt = Date.now();
  const base = `repos/${sub.root.owner}/${sub.root.repo}/issues/${sub.root.number}`;
  const since = sub.lastSuccessAt === null ? "" : `&since=${new Date(sub.lastSuccessAt - intervalMs).toISOString()}`;
  const subIssues = asArray<FetchedSubIssue>(await gh(["api", `${base}/sub_issues?per_page=100`]), "sub-issues");
  const comments = asArray<FetchedComment>(await gh(["api", `${base}/comments?per_page=100${since}`]), "comments");
  const config = { root: sub.root.label, allowlist: allowlist ?? new Set<string>() };
  const { next, events } = diff(sub.snapshot, { subIssues, comments }, config);
  sub.snapshot = next;
  sub.lastSuccessAt = startedAt;
  for (const event of events) {
    await mcp.notification({
      method: "notifications/claude/channel",
      params: { content: event.content, meta: event.meta },
    });
  }
}

async function poll(): Promise<void> {
  await ensureAllowlist();
  // Polling with the allowlist unresolved would mark comments seen while dropping them; the same
  // gh auth serves both, so a tick that cannot resolve the login could not poll anyway.
  if (allowlist === null) {
    setTimeout(poll, intervalMs);
    return;
  }
  // `subscribe` can run between roots, so each one is looked up again rather than held from the start.
  for (const label of [...subscriptions.keys()]) {
    const sub = subscriptions.get(label);
    if (sub === undefined) continue;
    try {
      await pollRoot(sub);
    } catch (err) {
      console.error(`gh-conductor-channels: poll of ${label} failed — ${reason(err)}`);
    }
  }
  setTimeout(poll, intervalMs);
}

void poll();
