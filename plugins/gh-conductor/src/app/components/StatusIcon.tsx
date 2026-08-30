import {
  BlockedIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  IssueClosedIcon,
  IssueOpenedIcon,
  PersonIcon,
} from "@primer/octicons-react";
import type { Category, Issue, Pr } from "../../core/schema.ts";
import { statusColor } from "../lib/categories.ts";
import { cn } from "@/lib/utils";

/**
 * GitHub's own vocabulary for an issue's dominant fact: octicon shape + Primer state color, exactly
 * as github.com draws them. Used in graph nodes, list rows, sidebar titles, and the detail sheet —
 * shape carries state redundantly with color. Pass `issue` where one exists so the icon can refine
 * (merged vs. plain closed, PR-in-review vs. assigned person).
 */
export function StatusIcon({ category, issue, size = 14, className }: { category: Category; issue?: Issue; size?: number; className?: string }) {
  const Icon = iconOf(category, issue);
  return <Icon aria-hidden size={size} className={cn("shrink-0", className)} fill={statusColor(category, issue)} />;
}

function iconOf(category: Category, issue?: Issue) {
  switch (category) {
    case "done":
      return issue?.pr?.state === "merged" ? GitMergeIcon : IssueClosedIcon;
    case "blocked":
      return BlockedIcon;
    case "waiting":
      return issue?.pr?.state === "review" ? GitPullRequestIcon : PersonIcon;
    case "in_progress":
      return GitPullRequestDraftIcon;
    case "ready":
      return IssueOpenedIcon;
  }
}

const PR_ICON: Record<Pr["state"], typeof GitPullRequestIcon> = {
  draft: GitPullRequestDraftIcon,
  review: GitPullRequestIcon,
  merged: GitMergeIcon,
  closed: GitPullRequestClosedIcon,
  none: GitPullRequestIcon,
};

const PR_COLOR: Record<Pr["state"], string> = {
  draft: "var(--status-in_progress)",
  review: "var(--status-ready)",
  merged: "var(--status-done)",
  closed: "var(--pr-closed)",
  none: "var(--muted-foreground)",
};

/** A linked pull request in GitHub's icon and color, with its number. */
export function PrChip({ pr, size = 12, className }: { pr: Pr; size?: number; className?: string }) {
  const Icon = PR_ICON[pr.state];
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground", className)}>
      <Icon aria-label={`pull request ${pr.state}`} size={size} fill={PR_COLOR[pr.state]} />
      #{pr.number}
    </span>
  );
}

/** GitHub avatars, up to `max`, then a "+N" overflow count. */
export function AvatarStack({ logins, max = 2, size = 16, className }: { logins: string[]; max?: number; size?: number; className?: string }) {
  const shown = logins.slice(0, max);
  const extra = logins.length - shown.length;
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {shown.map((l) => (
        <img key={l} src={`https://github.com/${l}.png?size=${size * 2}`} alt={`@${l}`} title={`@${l}`} width={size} height={size} className="rounded-full" loading="lazy" />
      ))}
      {extra > 0 && <span className="text-[10px] leading-none text-muted-foreground">+{extra}</span>}
    </span>
  );
}
