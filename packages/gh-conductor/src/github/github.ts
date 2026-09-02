// All GitHub I/O. Shells out to `gh` so auth, hosts, and rate limits are gh's problem.

import { keyOf, summarizePrs } from "../core/graph.ts";
import {
  GraphQlResponse,
  type Blocker,
  type Graph,
  type Issue,
  type RawDep,
  type RawIssue,
  type RawRef,
} from "../core/schema.ts";

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
  const spec =
    flag ??
    process.env.GH_REPO ??
    (await gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])).trim();
  const [owner, name] = spec.split("/");
  if (!owner || !name) throw new Error(`cannot parse repo "${spec}" — expected owner/name`);
  return { owner, name };
}

// F is a tree node; X is an issue one blocked-by hop off the tree, fetched whole so it can be drawn.
// GitHub scores a query by the nodes it *could* return and rejects anything over 500,000, so X's own
// lists are the ones kept small: 100 sub-issues × 100 deps × X puts the multiplier here.
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
  number title url state updatedAt bodyHTML
  repository { nameWithOwner }
  assignees(first: 10) { nodes { login } }
  blockedBy(first: 50) { nodes { ...X } }
  blocking(first: 50) { nodes { ...X } }
  closedByPullRequestsReferences(first: 20, includeClosedPrs: true) { nodes { number url isDraft state } }
  subIssuesSummary { total }
}
fragment X on Issue {
  number title url state updatedAt bodyHTML
  repository { nameWithOwner }
  assignees(first: 10) { nodes { login } }
  closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { number url isDraft state } }
  blockedBy(first: 10) { nodes { number title url state repository { nameWithOwner } } }
}`;

async function fetchIssue(
  repo: Repo,
  number: number,
): Promise<{ issue: RawIssue; viewer: string | null }> {
  const out = await gh([
    "api",
    "graphql",
    "-f",
    `query=${QUERY}`,
    "-f",
    `owner=${repo.owner}`,
    "-f",
    `name=${repo.name}`,
    "-F",
    `number=${number}`,
  ]);
  const { data } = GraphQlResponse.parse(JSON.parse(out));
  const issue = data.repository?.issue;
  if (!issue) throw new Error(`issue #${number} not found in ${repo.owner}/${repo.name}`);
  return { issue, viewer: data.viewer?.login ?? null };
}

const lc = (s: "OPEN" | "CLOSED"): "open" | "closed" => (s === "OPEN" ? "open" : "closed");

const toBlocker = (b: RawRef): Blocker => ({
  repo: b.repository.nameWithOwner,
  number: b.number,
  title: b.title,
  url: b.url,
  state: lc(b.state),
});

/** A dependency-reached issue, as a node in its own right: no parent, and only its fetched blockers. */
function toRelated(d: RawDep): Issue {
  return {
    repo: d.repository.nameWithOwner,
    number: d.number,
    title: d.title,
    bodyHtml: d.bodyHTML,
    url: d.url,
    state: lc(d.state),
    assignees: d.assignees.nodes.map((a) => a.login),
    blockedBy: d.blockedBy.nodes.map(toBlocker),
    pr: summarizePrs(d.closedByPullRequestsReferences.nodes),
    parent: null,
    depth: 0,
    updatedAt: d.updatedAt,
  };
}

function toIssue(raw: RawIssue, parent: string | null, depth: number): Issue {
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    bodyHtml: raw.bodyHTML,
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
 * Load the root and every descendant, then the issues one blocked-by hop off that tree. One GraphQL
 * call per issue that has children — usually just the root. GitHub caps sub-issues at 100 per parent
 * and nesting at 8, so no pagination.
 *
 * The hop is symmetric and comes back in the same query: a tree node's `blockedBy` and its
 * `blocking`. Anything the tree doesn't already contain becomes a `related` node, carrying its own
 * one-level blockers so its category is honest. Those blockers are refs only — one hop, no further.
 */
export async function loadGraph(repo: Repo, rootNumber: number): Promise<Graph> {
  const nodes: Issue[] = [];
  const deps: RawDep[] = [];
  const visit = async (raw: RawIssue, parent: string | null, depth: number): Promise<Issue> => {
    const node = toIssue(raw, parent, depth);
    if (depth > 0) nodes.push(node);
    deps.push(...raw.blockedBy.nodes, ...raw.blocking.nodes);
    const children =
      raw.subIssues?.nodes ??
      (raw.subIssuesSummary.total > 0
        ? (await fetchIssue(repo, raw.number)).issue.subIssues!.nodes
        : []);
    for (const child of children) await visit(child, keyOf(node), depth + 1);
    return node;
  };
  const fetched = await fetchIssue(repo, rootNumber);
  const root = await visit(fetched.issue, null, 0);

  const treeKeys = new Set([root, ...nodes].map(keyOf));
  const related = new Map<string, Issue>();
  for (const d of deps) {
    const key = `${d.repository.nameWithOwner}#${d.number}`;
    if (!treeKeys.has(key) && !related.has(key)) related.set(key, toRelated(d));
  }
  return {
    repo: `${repo.owner}/${repo.name}`,
    viewer: fetched.viewer,
    root,
    nodes,
    related: [...related.keys()].sort().map((k) => related.get(k)!),
  };
}
