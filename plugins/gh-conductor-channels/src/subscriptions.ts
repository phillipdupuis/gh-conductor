// Pure subscription bookkeeping: which issue trees are watched and the per-root state carried
// between polls. No I/O.

import type { Snapshot } from "./diff.ts";

export type RootIssue = { owner: string; repo: string; number: number; label: string };

export type Subscription = {
  root: RootIssue;
  snapshot: Snapshot | null;
  lastSuccessAt: number | null;
};

export function parseIssueRef(spec: string): RootIssue | null {
  const match = /^([^/\s]+)\/([^#\s]+)#(\d+)$/.exec(spec.trim());
  const [owner, repo, number] = [match?.[1], match?.[2], match?.[3]];
  if (!owner || !repo || !number) return null;
  return { owner, repo, number: Number(number), label: `${owner}/${repo}#${number}` };
}

/** Parses every spec before any of them is applied, so a caller can reject a request whole. */
export function parseIssueRefs(specs: string[]): { roots: RootIssue[]; invalid: string[] } {
  const roots: RootIssue[] = [];
  const invalid: string[] = [];
  for (const spec of specs) {
    const root = parseIssueRef(spec);
    if (root === null) invalid.push(spec);
    else roots.push(root);
  }
  return { roots, invalid };
}

/**
 * Replaces the watched set. A root that survives keeps its snapshot and poll anchor, a root that is
 * gone is dropped, and a new root starts empty — so it baselines silently on its first poll.
 */
export function reconcile(
  current: Map<string, Subscription>,
  requested: RootIssue[],
): Map<string, Subscription> {
  const next = new Map<string, Subscription>();
  for (const root of requested) {
    next.set(root.label, current.get(root.label) ?? { root, snapshot: null, lastSuccessAt: null });
  }
  return next;
}

export function describeWatching(labels: string[]): string {
  return labels.length === 0 ? "Watching nothing." : `Watching ${labels.join(", ")}`;
}
