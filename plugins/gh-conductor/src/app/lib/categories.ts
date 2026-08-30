import type { Category } from "../../core/schema.ts";

export const ORDER: Category[] = ["ready", "in_progress", "waiting", "blocked", "done"];

export const CATEGORY_LABEL: Record<Category, string> = {
  ready: "Awaiting agent",
  in_progress: "Agent in progress",
  waiting: "Awaiting human",
  blocked: "Blocked",
  done: "Done",
};

/** Tailwind only generates classes it can see whole, so no `bg-status-${c}` interpolation. */
export const STATUS_BG: Record<Category, string> = {
  ready: "bg-status-ready",
  in_progress: "bg-status-in_progress",
  waiting: "bg-status-waiting",
  blocked: "bg-status-blocked",
  done: "bg-status-done",
};
