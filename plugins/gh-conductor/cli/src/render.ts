// Human-readable output. --json bypasses all of this.

import { blockedByText, categorize, groupByCategory, type Category, type Graph, type Node } from "./graph.ts";

function annotations(n: Node, g: Graph): string[] {
  const a: string[] = [];
  const blocked = blockedByText(n, g, (b) => `#${b.number}`);
  if (blocked) a.push(blocked);
  if (n.assignees.length) a.push(`assigned ${n.assignees.map((x) => `@${x}`).join(", ")}`);
  if (n.pr) a.push(`PR #${n.pr.number} ${n.pr.state}`);
  return a;
}

function line(n: Node, g: Graph, indent = "  "): string {
  const ann = annotations(n, g);
  return `${indent}#${n.number} ${n.title}${ann.length ? `  · ${ann.join(" · ")}` : ""}`;
}

function header(g: Graph): string {
  const done = g.nodes.filter((n) => n.state === "closed").length;
  return `#${g.epic.number} ${g.epic.title} — ${g.epic.state}, ${done}/${g.nodes.length} done`;
}

export function renderGraph(g: Graph): string {
  const out = [header(g)];
  for (const n of g.nodes) out.push(`${"  ".repeat(n.depth)}[${categorize(n, g)}] ${line(n, g, "")}`);
  return out.join("\n");
}

export function renderReady(nodes: Node[], g: Graph): string {
  if (!nodes.length) return "Nothing ready.";
  return nodes.map((n) => line(n, g, "")).join("\n");
}

const LABELS: Record<Category, string> = {
  ready: "READY",
  in_progress: "IN PROGRESS",
  waiting: "WAITING ON A HUMAN",
  blocked: "BLOCKED",
  done: "DONE",
};

export function renderStatus(g: Graph): string {
  const groups = groupByCategory(g);
  const out = [header(g), ""];
  for (const cat of ["ready", "in_progress", "waiting", "blocked", "done"] as Category[]) {
    const ns = groups[cat];
    out.push(`${LABELS[cat]} (${ns.length})`);
    for (const n of ns) out.push(line(n, g));
    out.push("");
  }
  return out.join("\n").trimEnd();
}
