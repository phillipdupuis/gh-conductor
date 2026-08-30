// Graph → Graphviz DOT. Pure; no I/O. `conductor graph --dot` prints this for humans and external
// tools; the app lays itself out (src/core/layout.ts) and does not use it.
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

import { NODE_HEIGHT, NODE_WIDTH } from "../core/constants.ts";
import { blockedByText, categorize, keyOf, refLabel, type Category, type Graph, type Issue } from "../core/graph.ts";

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

/**
 * Plain GitHub/PM words, same vocabulary as the page's sidebar. "waiting" covers two sidebar
 * sections ("In review" and "Assigned"), so the category-only label names both; per-issue callers
 * should use issueLabel() to get the specific one.
 */
export const CATEGORY_LABEL: Record<Category, string> = {
  ready: "Ready",
  in_progress: "In progress",
  waiting: "Waiting on review or assigned",
  blocked: "Blocked",
  done: "Done",
};

/** Category label refined for one issue: "waiting" splits into "In review" / "Assigned". */
export function issueLabel(n: Issue, cat: Category): string {
  if (cat === "waiting") return n.pr?.state === "review" ? "In review" : "Assigned";
  return CATEGORY_LABEL[cat];
}

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

/** SVG ids have to survive CSS selectors, so "/" and "#" come out as "-". */
const domId = (key: string) => key.replace(/[/#]/g, "-");

/** refLabel for a key, where the Issue itself isn't at hand. */
const keyLabel = (key: string, rootRepo: string) => (key.startsWith(`${rootRepo}#`) ? key.slice(rootRepo.length) : key);

function tooltip(n: Issue, cat: Category, g: Graph, inGraph: Set<string>): string {
  const parts = [issueLabel(n, cat)];
  // Blockers this graph does not draw are marked "(not shown)".
  const blocked = blockedByText(n, g, (b) => `${refLabel(b, g.repo)}${inGraph.has(keyOf(b)) ? "" : " (not shown)"}`);
  if (blocked) parts.push(blocked);
  if (n.assignees.length) parts.push(`assigned ${n.assignees.map((a) => `@${a}`).join(", ")}`);
  if (n.pr) parts.push(`PR #${n.pr.number} ${n.pr.state}`);
  return parts.join(" · ");
}

function nodeStmt(n: Issue, cat: Category, cls: string, g: Graph, inGraph: Set<string>): string {
  const fill = PALETTE.fill[cat];
  const attrs = [
    `id="issue-${domId(keyOf(n))}"`,
    `class=${dq(cls)}`,
    `label=<${esc(refLabel(n, g.repo))} ${wrap(n.title)}>`,
    `URL=${dq(n.url)}`,
    `target="_blank"`,
    `tooltip=${dq(tooltip(n, cat, g, inGraph))}`,
    `style="rounded,filled"`,
    `fillcolor=${dq(fill)}`,
    `color=${dq(fill)}`,
    `fontcolor=${dq(FONT[cat])}`,
  ];
  return `${dq(keyOf(n))} [${attrs.join(" ")}];`;
}

export function toDot(g: Graph): string {
  const drawn = [g.epic, ...g.nodes, ...g.related];
  const inGraph = new Set(drawn.map(keyOf));
  const e = g.epic;

  const out: string[] = [];
  out.push(`digraph ${dq(`epic-${e.number}`)} {`);
  out.push(`  rankdir=BT; bgcolor="transparent"; pad=0.3; nodesep=0.3; ranksep=0.7;`);
  // Fixed-size boxes (1 pt = 1 px in the app), so dot never has to guess text width and the
  // positions it emits match the React nodes exactly. Labels are still there for `graph --dot`.
  out.push(`  node [shape=box fixedsize=true width=${(NODE_WIDTH / 72).toFixed(4)} height=${(NODE_HEIGHT / 72).toFixed(4)} fontname="Arial" fontsize=10 penwidth=1];`)
  out.push(`  edge [fontname="Arial" arrowsize=1 color="${PALETTE.edge}" penwidth=1.8];`);

  const epicAttrs = [
    `id="issue-${domId(keyOf(e))}"`,
    `class="node epic"`,
    `label=<${esc(refLabel(e, g.repo))} ${wrap(e.title)}>`,
    `URL=${dq(e.url)}`,
    `target="_blank"`,
    `tooltip=${dq(`epic · ${e.state}`)}`,
    `style="rounded,filled"`,
    `fillcolor=${dq(PALETTE.card)}`,
    `color=${dq(PALETTE.mute)}`,
    `fontcolor=${dq(PALETTE.fg)}`,
    `fontsize=11`,
  ];
  out.push(`  ${dq(keyOf(e))} [${epicAttrs.join(" ")}];`);
  for (const n of [...g.nodes, ...g.related]) {
    const cat = categorize(n, g);
    out.push(`  ${nodeStmt(n, cat, `node ${cat}`, g, inGraph)}`);
  }

  // Containment: sub-issue → parent. A dependency like any other (the parent can't close first), drawn
  // muted so the explicit DAG stays readable. Dimmed once the sub-issue is closed, like a blocking edge.
  for (const n of g.nodes) {
    const k = keyOf(n);
    const p = n.parent ?? keyOf(e);
    out.push(`  ${dq(k)} -> ${dq(p)} [id="tree-${domId(k)}-${domId(p)}" class=${dq(n.state === "closed" ? "tree done" : "tree")} color="${PALETTE.line}" penwidth=1.2 arrowsize=0.7 tooltip=${dq(`${keyLabel(p, g.repo)} is blocked by sub-issue ${refLabel(n, g.repo)}${n.state === "closed" ? " (closed)" : ""}`)}];`);
  }

  for (const n of drawn) {
    for (const b of n.blockedBy) {
      const bk = keyOf(b);
      if (!inGraph.has(bk)) continue;
      const k = keyOf(n);
      const done = b.state === "closed" || n.state === "closed";
      const attrs = [
        `id="edge-${domId(bk)}-${domId(k)}"`,
        `class=${dq(done ? "edge done" : "edge")}`,
        `tooltip=${dq(`${refLabel(n, g.repo)} blocked by ${refLabel(b, g.repo)}${b.state === "closed" ? " (closed)" : ""}`)}`,
      ];
      out.push(`  ${dq(bk)} -> ${dq(k)} [${attrs.join(" ")}];`);
    }
  }
  out.push("}");
  return out.join("\n");
}
