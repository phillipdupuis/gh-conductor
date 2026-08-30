// Pure graph model and computations. No I/O here — everything is testable with fixtures.

export type IssueState = "open" | "closed";
export type PrState = "none" | "draft" | "review" | "merged" | "closed";

export type Blocker = { number: number; title: string; url: string; state: IssueState };
export type Pr = { number: number; url: string; state: PrState };

export type Node = {
  number: number;
  title: string;
  url: string;
  state: IssueState;
  assignees: string[];
  blockedBy: Blocker[];
  pr: Pr | null;
  parent: number | null;
  depth: number; // 0 = epic
  updatedAt: string; // ISO 8601, from GitHub
};

export type Graph = {
  /** "owner/name" */
  repo: string;
  /** Login of the `gh` user the graph was loaded as, or null if unknown. */
  viewer: string | null;
  epic: Node;
  /** Every descendant of the epic, depth-first in GitHub's sub-issue order. Excludes the epic. */
  nodes: Node[];
};

/**
 * Why an issue is in the state it is. Checked in this order; first match wins.
 * - done:        closed.
 * - blocked:     open, at least one blocker still open — an explicit "blocked by", or an open
 *                sub-issue (a parent is done when its children are, so it is implicitly blocked by them).
 * - waiting:     open, unblocked, and a human has to act: assigned to someone, or a PR is up for review.
 * - in_progress: open, unblocked, work has started (draft PR).
 * - ready:       open, unblocked, nothing started, nobody assigned.
 */
export type Category = "done" | "blocked" | "waiting" | "in_progress" | "ready";

/** "blocked by #3, #9 and 2 open sub-issues" — the `#N` are formatted by the caller. */
export function blockedByText(n: Node, g: Graph, ref: (b: Blocker) => string): string | null {
  const open = openBlockers(n).map(ref);
  const kids = openChildren(n, g).length;
  if (!open.length && !kids) return null;
  const parts = [open.join(", "), kids ? `${kids} open sub-issue${kids === 1 ? "" : "s"}` : ""].filter(Boolean);
  return `blocked by ${parts.join(" and ")}`;
}

export function openBlockers(n: Node): Blocker[] {
  return n.blockedBy.filter((b) => b.state === "open");
}

/** Direct sub-issues of every issue (the epic included), in graph order. */
export function childrenOf(g: Graph): Map<number, Node[]> {
  const out = new Map<number, Node[]>();
  for (const n of g.nodes) {
    const key = n.parent ?? g.epic.number;
    out.set(key, [...(out.get(key) ?? []), n]);
  }
  return out;
}

export function openChildren(n: Node, g: Graph): Node[] {
  return (childrenOf(g).get(n.number) ?? []).filter((c) => c.state === "open");
}

export function isUnblocked(n: Node, g: Graph): boolean {
  return n.state === "open" && openBlockers(n).length === 0 && openChildren(n, g).length === 0;
}

export function categorize(n: Node, g: Graph): Category {
  if (n.state === "closed") return "done";
  if (openBlockers(n).length > 0 || openChildren(n, g).length > 0) return "blocked";
  if (n.assignees.length > 0 || n.pr?.state === "review") return "waiting";
  if (n.pr?.state === "draft") return "in_progress";
  return "ready";
}

/**
 * Ready work for the agent: unblocked and not waiting on a human — i.e. category "ready" or
 * "in_progress". `includeAssigned` adds human-assigned issues back (still never blocked ones, and
 * never PRs awaiting review).
 */
export function readyNodes(g: Graph, opts: { includeAssigned?: boolean } = {}): Node[] {
  return g.nodes.filter((n) => {
    const c = categorize(n, g);
    if (c === "ready" || c === "in_progress") return true;
    return Boolean(opts.includeAssigned) && c === "waiting" && n.pr?.state !== "review";
  });
}

export function groupByCategory(g: Graph): Record<Category, Node[]> {
  const out: Record<Category, Node[]> = { ready: [], in_progress: [], waiting: [], blocked: [], done: [] };
  for (const n of g.nodes) out[categorize(n, g)].push(n);
  return out;
}

export type RawPr = { number: number; url: string; isDraft: boolean; state: "OPEN" | "CLOSED" | "MERGED" };

/** Collapse an issue's linked PRs into one state. Merged wins; then open-for-review; then draft; then closed. */
export function summarizePrs(prs: RawPr[]): Pr | null {
  const pick = (pred: (p: RawPr) => boolean) => prs.find(pred);
  const merged = pick((p) => p.state === "MERGED");
  if (merged) return { number: merged.number, url: merged.url, state: "merged" };
  const review = pick((p) => p.state === "OPEN" && !p.isDraft);
  if (review) return { number: review.number, url: review.url, state: "review" };
  const draft = pick((p) => p.state === "OPEN" && p.isDraft);
  if (draft) return { number: draft.number, url: draft.url, state: "draft" };
  const closed = pick((p) => p.state === "CLOSED");
  if (closed) return { number: closed.number, url: closed.url, state: "closed" };
  return null;
}

/** "just now", "5m ago", "3h ago", "2d ago", "3w ago", "4mo ago", "1y ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)}w ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}
