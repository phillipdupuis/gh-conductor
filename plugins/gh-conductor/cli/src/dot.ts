// Graph → Graphviz DOT. Pure; no I/O. `conductor graph --dot` prints this, `conductor view` renders it.
//
// Shape: the epic is the root node at the top and the sink of the graph — the last thing to
// complete. Every edge means "must finish before" and points upward (rankdir=BT): explicit blocking
// (blocker → blocked, bold) and containment (sub-issue → parent, muted — a parent is implicitly
// blocked by its children). Bottom-to-top reads as time; the final pieces of work point at the epic.
// Blockers outside the epic's tree are not drawn; the blocked node's tooltip names them.
//
// Styling rule: status is the fill color and nothing else. Every work node has the same border, every
// blocking edge the same stroke; the epic node is neutral because it is not a work item. A node is
// just "#N title": assignee, PR, and age live in the page's sidebar and in the node tooltip, never in
// shape or line style.

import { blockedByText, categorize, type Category, type Graph, type Node } from "./graph.ts";

/** GitHub Primer dark palette, so the page reads like github.com. */
export const PALETTE = {
  bg: "#0d1117",
  card: "#161b22",
  line: "#30363d",
  fg: "#e6edf3",
  mute: "#8b949e",
  edge: "#8b949e",
  accent: "#58a6ff",
  fill: {
    ready: "#238636", // green — open, workable by the agent
    in_progress: "#1f6feb", // blue — agent has a draft PR up
    waiting: "#9e6a03", // yellow — attention: a human has to act
    blocked: "#30363d", // neutral — nothing to do here, look upstream
    done: "#8957e5", // purple — closed / merged; the page dims it
  } satisfies Record<Category, string>,
} as const;

const FONT: Record<Category, string> = { ready: "#ffffff", in_progress: "#ffffff", waiting: "#ffffff", blocked: "#c9d1d9", done: "#ffffff" };

export const CATEGORY_LABEL: Record<Category, string> = {
  ready: "Awaiting agent",
  in_progress: "Agent in progress",
  waiting: "Awaiting human",
  blocked: "Blocked",
  done: "Done",
};

/** Escape for a DOT double-quoted string. */
export function dq(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}

/** Escape for text inside a Graphviz HTML-like label. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Greedy word wrap for HTML labels (Graphviz doesn't wrap). Returns escaped text joined with <br/>. */
export function wrap(s: string, width = 30): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > width) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines.map(esc).join("<br/>");
}

function tooltip(n: Node, cat: Category, g: Graph, inGraph: Set<number>): string {
  const parts = [CATEGORY_LABEL[cat]];
  // Blockers not drawn in this graph are marked "(outside epic)".
  const blocked = blockedByText(n, g, (b) => `#${b.number}${inGraph.has(b.number) ? "" : " (outside epic)"}`);
  if (blocked) parts.push(blocked);
  if (n.assignees.length) parts.push(`assigned ${n.assignees.map((a) => `@${a}`).join(", ")}`);
  if (n.pr) parts.push(`PR #${n.pr.number} ${n.pr.state}`);
  return parts.join(" · ");
}

function nodeStmt(n: Node, cat: Category, cls: string, g: Graph, inGraph: Set<number>): string {
  const fill = PALETTE.fill[cat];
  const attrs = [
    `id="issue-${n.number}"`,
    `class=${dq(cls)}`,
    `label=<#${n.number} ${wrap(n.title)}>`,
    `URL=${dq(n.url)}`,
    `target="_blank"`,
    `tooltip=${dq(tooltip(n, cat, g, inGraph))}`,
    `style="rounded,filled"`,
    `fillcolor=${dq(fill)}`,
    `color=${dq(fill)}`,
    `fontcolor=${dq(FONT[cat])}`,
  ];
  return `"i${n.number}" [${attrs.join(" ")}];`;
}

export function toDot(g: Graph): string {
  const inGraph = new Set(g.nodes.map((n) => n.number));
  const e = g.epic;

  const out: string[] = [];
  out.push(`digraph ${dq(`epic-${e.number}`)} {`);
  out.push(`  rankdir=BT; bgcolor="transparent"; pad=0.3; nodesep=0.3; ranksep=0.7;`);
  // Arial throughout: viz-js has no real font metrics, it estimates text width from a table for Arial,
  // and the page tells the browser to render the SVG in Arial so the estimate holds.
  out.push(`  node [shape=box fontname="Arial" fontsize=10 margin="0.2,0.1" penwidth=1];`);
  out.push(`  edge [fontname="Arial" arrowsize=1 color="${PALETTE.edge}" penwidth=1.8];`);

  const epicAttrs = [
    `id="issue-${e.number}"`,
    `class="node epic"`,
    `label=<#${e.number} ${wrap(e.title)}>`,
    `URL=${dq(e.url)}`,
    `target="_blank"`,
    `tooltip=${dq(`epic · ${e.state}`)}`,
    `style="rounded,filled"`,
    `fillcolor=${dq(PALETTE.card)}`,
    `color=${dq(PALETTE.mute)}`,
    `fontcolor=${dq(PALETTE.fg)}`,
    `fontsize=11`,
  ];
  out.push(`  "i${e.number}" [${epicAttrs.join(" ")}];`);
  for (const n of g.nodes) {
    const cat = categorize(n, g);
    out.push(`  ${nodeStmt(n, cat, `node ${cat}`, g, inGraph)}`);
  }

  // Containment: sub-issue → parent. A dependency like any other (the parent can't close first), drawn
  // muted so the explicit DAG stays readable. Dimmed once the sub-issue is closed, like a blocking edge.
  for (const n of g.nodes) {
    const p = n.parent ?? e.number;
    out.push(`  "i${n.number}" -> "i${p}" [id="tree-${n.number}-${p}" class=${dq(n.state === "closed" ? "tree done" : "tree")} color="${PALETTE.line}" penwidth=1.2 arrowsize=0.7 tooltip=${dq(`#${p} is blocked by sub-issue #${n.number}${n.state === "closed" ? " (closed)" : ""}`)}];`);
  }

  for (const n of g.nodes) {
    for (const b of n.blockedBy) {
      if (!inGraph.has(b.number)) continue;
      const done = b.state === "closed" || n.state === "closed";
      const attrs = [
        `id="edge-${b.number}-${n.number}"`,
        `class=${dq(done ? "edge done" : "edge")}`,
        `tooltip=${dq(`#${n.number} blocked by #${b.number}${b.state === "closed" ? " (closed)" : ""}`)}`,
      ];
      out.push(`  "i${b.number}" -> "i${n.number}" [${attrs.join(" ")}];`);
    }
  }
  out.push("}");
  return out.join("\n");
}
