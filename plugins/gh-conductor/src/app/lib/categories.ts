import type { Category, Issue } from "../../core/schema.ts";

/**
 * The Primer state color for an issue's dominant native fact. The category picks the default; the
 * issue refines it — an open PR awaiting review is GitHub's open-green even though a human must act.
 */
export function statusColor(category: Category, issue?: Issue): string {
  if (category === "waiting" && issue?.pr?.state === "review") return "var(--status-ready)";
  return `var(--status-${category})`;
}
