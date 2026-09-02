// Pure graph model and computations. No I/O here — everything is testable with fixtures.

import type { Blocker, Category, Graph, Issue, Pr, RawPr } from "./schema.ts";

export type { Blocker, Category, Graph, Issue, Pr, RawPr } from "./schema.ts";

/**
 * The one identity for an issue everywhere in this codebase: "owner/repo#123". Node ids, map keys,
 * parent links and layer members are all this string, so two repos' #7 can never collide.
 */
export const keyOf = (n: { repo: string; number: number }): string => `${n.repo}#${n.number}`;

/** How GitHub writes a reference: "#7" in its own repo, "owner/repo#7" from anywhere else. */
export const refLabel = (n: { repo: string; number: number }, rootRepo: string): string =>
  n.repo === rootRepo ? `#${n.number}` : `${n.repo}#${n.number}`;

/** "blocked by #3, #9 and 2 open sub-issues" — the refs are formatted by the caller. */
export function blockedByText(n: Issue, g: Graph, ref: (b: Blocker) => string): string | null {
  const open = openBlockers(n).map(ref);
  const kids = openChildren(n, g).length;
  if (!open.length && !kids) return null;
  const parts = [
    open.join(", "),
    kids ? `${kids} open sub-issue${kids === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return `blocked by ${parts.join(" and ")}`;
}

export function openBlockers(n: Issue): Blocker[] {
  return n.blockedBy.filter((b) => b.state === "open");
}

/** Direct sub-issues of every issue (the root included), keyed by parent, in graph order. */
export function childrenOf(g: Graph): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  for (const n of g.nodes) {
    const key = n.parent ?? keyOf(g.root);
    out.set(key, [...(out.get(key) ?? []), n]);
  }
  return out;
}

export function openChildren(n: Issue, g: Graph): Issue[] {
  return (childrenOf(g).get(keyOf(n)) ?? []).filter((c) => c.state === "open");
}

export function isUnblocked(n: Issue, g: Graph): boolean {
  return n.state === "open" && openBlockers(n).length === 0 && openChildren(n, g).length === 0;
}

export function categorize(n: Issue, g: Graph): Category {
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
export function readyNodes(g: Graph, opts: { includeAssigned?: boolean } = {}): Issue[] {
  return g.nodes.filter((n) => {
    const c = categorize(n, g);
    if (c === "ready" || c === "in_progress") return true;
    return Boolean(opts.includeAssigned) && c === "waiting" && n.pr?.state !== "review";
  });
}

export function groupByCategory(g: Graph): Record<Category, Issue[]> {
  const out: Record<Category, Issue[]> = {
    ready: [],
    in_progress: [],
    waiting: [],
    blocked: [],
    done: [],
  };
  for (const n of g.nodes) out[categorize(n, g)].push(n);
  return out;
}

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
