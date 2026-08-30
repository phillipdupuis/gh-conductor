// Human-readable output. --json bypasses all of this.

import { blockedByText, categorize, groupByCategory, refLabel, type Category, type Graph, type Issue } from "../core/graph.ts";

function annotations(n: Issue, g: Graph): string[] {
  const a: string[] = [];
  const blocked = blockedByText(n, g, (b) => refLabel(b, g.repo));
  if (blocked) a.push(blocked);
  if (n.assignees.length) a.push(`assigned ${n.assignees.map((x) => `@${x}`).join(", ")}`);
  if (n.pr) a.push(`PR #${n.pr.number} ${n.pr.state}`);
  return a;
}

function line(n: Issue, g: Graph, indent = "  "): string {
  const ann = annotations(n, g);
  return `${indent}${refLabel(n, g.repo)} ${n.title}${ann.length ? `  · ${ann.join(" · ")}` : ""}`;
}

function header(g: Graph): string {
  return `#${g.epic.number} ${g.epic.title} — ${g.epic.state}`;
}

export function renderGraph(g: Graph): string {
  const out = [header(g)];
  for (const n of g.nodes) out.push(`${"  ".repeat(n.depth)}[${categorize(n, g)}] ${line(n, g, "")}`);
  return out.join("\n");
}

export function renderReady(nodes: Issue[], g: Graph): string {
  if (!nodes.length) return "Nothing ready.";
  return nodes.map((n) => line(n, g, "")).join("\n");
}

/**
 * The page's sidebar sections, in plain GitHub/PM words. "waiting" covers two of them — a PR
 * awaiting review and an issue simply assigned to someone — so it is split by `match`, exactly as
 * src/app/components/Sidebar.tsx does.
 */
type Section = { key: string; label: string; category: Category; match?: (issue: Issue) => boolean };

const SECTIONS: Section[] = [
  { key: "ready", label: "READY", category: "ready" },
  { key: "in_progress", label: "IN PROGRESS", category: "in_progress" },
  { key: "in_review", label: "IN REVIEW", category: "waiting", match: (n) => n.pr?.state === "review" },
  { key: "assigned", label: "ASSIGNED", category: "waiting", match: (n) => n.pr?.state !== "review" },
  { key: "blocked", label: "BLOCKED", category: "blocked" },
  { key: "done", label: "DONE", category: "done" },
];

export function renderStatus(g: Graph): string {
  const groups = groupByCategory(g);
  const out = [header(g), ""];
  for (const s of SECTIONS) {
    const ns = s.match ? groups[s.category].filter(s.match) : groups[s.category];
    out.push(`${s.label} (${ns.length})`);
    for (const n of ns) out.push(line(n, g));
    out.push("");
  }
  return out.join("\n").trimEnd();
}
