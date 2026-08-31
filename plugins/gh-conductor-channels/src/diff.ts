// Pure diff: the previous poll's snapshot plus a fresh fetch in, channel events out. No I/O.

export type IssueState = "open" | "closed";

export type SubIssue = { title: string; state: IssueState; url: string };

export type Snapshot = { subIssues: Map<number, SubIssue>; seenCommentIds: Set<number> };

/** The `content`/`meta` payload of one `notifications/claude/channel` notification. Meta keys must
 * be identifier-safe — Claude Code silently drops any key containing a hyphen. */
export type Event = { content: string; meta: Record<string, string> };

export type FetchedSubIssue = {
  number: number;
  title: string;
  state: IssueState;
  html_url: string;
};

export type FetchedComment = {
  id: number;
  body: string;
  html_url: string;
  user: { login: string } | null;
};

export type Fetched = { subIssues: FetchedSubIssue[]; comments: FetchedComment[] };

export type DiffConfig = { root: string; allowlist: Set<string> };

const MAX_BODY = 2000;

const truncate = (body: string): string =>
  body.length <= MAX_BODY ? body : `${body.slice(0, MAX_BODY)}… [truncated]`;

/**
 * A first poll (`prev === null`) only establishes the baseline: every fetched comment is marked
 * seen and nothing is emitted. Afterwards, sub-issues that changed state and unseen comments from
 * allowlisted authors become events; a newly appearing sub-issue and a comment from anyone else
 * are recorded silently.
 */
export function diff(
  prev: Snapshot | null,
  fetched: Fetched,
  config: DiffConfig,
): { next: Snapshot; events: Event[] } {
  const next: Snapshot = {
    subIssues: new Map(
      fetched.subIssues.map((s) => [s.number, { title: s.title, state: s.state, url: s.html_url }]),
    ),
    seenCommentIds: new Set([
      ...(prev?.seenCommentIds ?? []),
      ...fetched.comments.map((c) => c.id),
    ]),
  };
  if (prev === null) return { next, events: [] };

  const events: Event[] = [];

  for (const sub of fetched.subIssues) {
    const before = prev.subIssues.get(sub.number);
    if (!before || before.state === sub.state) continue;
    const verb = sub.state === "closed" ? "closed" : "reopened";
    events.push({
      content: `Sub-issue #${sub.number} "${sub.title}" was ${verb} (under ${config.root}).`,
      meta: {
        kind: "state_change",
        root: config.root,
        issue: String(sub.number),
        state: sub.state,
        url: sub.html_url,
      },
    });
  }

  for (const comment of fetched.comments) {
    const author = comment.user?.login;
    if (prev.seenCommentIds.has(comment.id) || !author || !config.allowlist.has(author)) continue;
    events.push({
      content: `Comment by ${author} on issue ${config.root}:\n${truncate(comment.body)}`,
      meta: { kind: "comment", root: config.root, author, url: comment.html_url },
    });
  }

  return { next, events };
}
