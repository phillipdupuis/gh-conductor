// All GitHub I/O. Shells out to `gh` so auth, hosts, and rate limits are gh's problem.

import { keyOf, summarizePrs } from "../core/graph.ts";
import { GraphQlResponse, type Blocker, type Graph, type Issue, type RawIssue, type RawRef } from "../core/schema.ts";

export type Repo = { owner: string; name: string };

async function gh(args: string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} exited ${code}: ${err.trim()}`);
  return out;
}

export async function resolveRepo(flag?: string): Promise<Repo> {
  const spec = flag ?? process.env.GH_REPO ?? (await gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])).trim();
  const [owner, name] = spec.split("/");
  if (!owner || !name) throw new Error(`cannot parse repo "${spec}" — expected owner/name`);
  return { owner, name };
}

const QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      ...F
      subIssues(first: 100) { nodes { ...F } }
    }
  }
}
fragment F on Issue {
  number title url state updatedAt
  repository { nameWithOwner }
  assignees(first: 10) { nodes { login } }
  blockedBy(first: 50) { nodes { number title url state repository { nameWithOwner } } }
  closedByPullRequestsReferences(first: 20, includeClosedPrs: true) { nodes { number url isDraft state } }
  subIssuesSummary { total }
}`;

async function fetchIssue(repo: Repo, number: number): Promise<{ issue: RawIssue; viewer: string | null }> {
  const out = await gh([
    "api", "graphql",
    "-f", `query=${QUERY}`,
    "-f", `owner=${repo.owner}`,
    "-f", `name=${repo.name}`,
    "-F", `number=${number}`,
  ]);
  const { data } = GraphQlResponse.parse(JSON.parse(out));
  const issue = data.repository?.issue;
  if (!issue) throw new Error(`issue #${number} not found in ${repo.owner}/${repo.name}`);
  return { issue, viewer: data.viewer?.login ?? null };
}

const lc = (s: "OPEN" | "CLOSED"): "open" | "closed" => (s === "OPEN" ? "open" : "closed");

const toBlocker = (b: RawRef): Blocker => ({ repo: b.repository.nameWithOwner, number: b.number, title: b.title, url: b.url, state: lc(b.state) });

function toIssue(raw: RawIssue, parent: string | null, depth: number): Issue {
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    state: lc(raw.state),
    assignees: raw.assignees.nodes.map((a) => a.login),
    blockedBy: raw.blockedBy.nodes.map(toBlocker),
    pr: summarizePrs(raw.closedByPullRequestsReferences.nodes),
    parent,
    depth,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Load the epic and every descendant. One GraphQL call per issue that has children —
 * usually just the epic. GitHub caps sub-issues at 100 per parent and nesting at 8, so no pagination.
 */
export async function loadGraph(repo: Repo, epicNumber: number): Promise<Graph> {
  const nodes: Issue[] = [];
  const visit = async (raw: RawIssue, parent: string | null, depth: number): Promise<Issue> => {
    const node = toIssue(raw, parent, depth);
    if (depth > 0) nodes.push(node);
    const children = raw.subIssues?.nodes ?? (raw.subIssuesSummary.total > 0 ? (await fetchIssue(repo, raw.number)).issue.subIssues!.nodes : []);
    for (const child of children) await visit(child, keyOf(node), depth + 1);
    return node;
  };
  const root = await fetchIssue(repo, epicNumber);
  const epic = await visit(root.issue, null, 0);
  return { repo: `${repo.owner}/${repo.name}`, viewer: root.viewer, epic, nodes, related: [] };
}
