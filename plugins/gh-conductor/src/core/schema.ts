// Every model and wire shape as a zod schema. The schemas ARE the types (`z.infer`); nothing is
// declared twice. Parsed at the boundaries: GitHub's GraphQL payload (github/), a `--from` file
// (cli/), the browser's fetch (app/). Isomorphic — no Bun or node imports in this folder.

import { z } from "zod";

export const IssueState = z.enum(["open", "closed"]);
export type IssueState = z.infer<typeof IssueState>;

export const PrState = z.enum(["none", "draft", "review", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const Blocker = z.object({ number: z.number().int(), title: z.string(), url: z.string(), state: IssueState });
export type Blocker = z.infer<typeof Blocker>;

export const Pr = z.object({ number: z.number().int(), url: z.string(), state: PrState });
export type Pr = z.infer<typeof Pr>;

export const Issue = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  state: IssueState,
  assignees: z.array(z.string()),
  blockedBy: z.array(Blocker),
  pr: Pr.nullable(),
  parent: z.number().int().nullable(),
  /** 0 = epic */
  depth: z.number().int(),
  /** ISO 8601, from GitHub */
  updatedAt: z.string(),
});
export type Issue = z.infer<typeof Issue>;

export const Graph = z.object({
  /** "owner/name" */
  repo: z.string(),
  /** Login of the `gh` user the graph was loaded as, or null if unknown. */
  viewer: z.string().nullable(),
  epic: Issue,
  /** Every descendant of the epic, depth-first in GitHub's sub-issue order. Excludes the epic. */
  nodes: z.array(Issue),
});
export type Graph = z.infer<typeof Graph>;

/**
 * Why an issue is in the state it is. Checked in this order by `categorize`; first match wins.
 * - done:        closed.
 * - blocked:     open, at least one blocker still open — an explicit "blocked by", or an open
 *                sub-issue (a parent is done when its children are, so it is implicitly blocked by them).
 * - waiting:     open, unblocked, and a human has to act: assigned to someone, or a PR is up for review.
 * - in_progress: open, unblocked, work has started (draft PR).
 * - ready:       open, unblocked, nothing started, nobody assigned.
 */
export const Category = z.enum(["done", "blocked", "waiting", "in_progress", "ready"]);
export type Category = z.infer<typeof Category>;

// ---- GitHub GraphQL payload (what `gh api graphql` returns for the query in github/github.ts) ----

const GhState = z.enum(["OPEN", "CLOSED"]);

export const RawPr = z.object({ number: z.number().int(), url: z.string(), isDraft: z.boolean(), state: z.enum(["OPEN", "CLOSED", "MERGED"]) });
export type RawPr = z.infer<typeof RawPr>;

export const RawIssue = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  state: GhState,
  assignees: z.object({ nodes: z.array(z.object({ login: z.string() })) }),
  blockedBy: z.object({ nodes: z.array(z.object({ number: z.number().int(), title: z.string(), url: z.string(), state: GhState })) }),
  updatedAt: z.string(),
  closedByPullRequestsReferences: z.object({ nodes: z.array(RawPr) }),
  subIssuesSummary: z.object({ total: z.number().int() }),
  get subIssues() {
    return z.object({ nodes: z.array(RawIssue) }).optional();
  },
});
export type RawIssue = z.infer<typeof RawIssue>;

export const GraphQlResponse = z.object({
  data: z.object({
    viewer: z.object({ login: z.string() }).nullish(),
    repository: z.object({ issue: RawIssue.nullable() }).nullable(),
  }),
});

// ---- Server ↔ browser ----

/** GET /api/epics/:owner/:repo/:number — layout happens in the browser (core/layout.ts). */
export const ViewModel = z.object({ graph: Graph, generatedAt: z.string() });
export type ViewModel = z.infer<typeof ViewModel>;

/** GET /api/health */
export const Health = z.object({ pid: z.number().int(), port: z.number().int(), startedAt: z.string(), root: z.string() });
export type Health = z.infer<typeof Health>;
