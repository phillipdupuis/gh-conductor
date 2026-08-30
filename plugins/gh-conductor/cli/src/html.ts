// Graph + rendered SVG → a self-contained HTML page. Pure; no I/O.
// Layout: header (title, progress, attribution) across the top; a sidebar listing every issue grouped
// by status; the DAG fills the rest. Hovering an issue in either place traces what blocks it (left)
// and what it unblocks (right) in the graph. Everything is inline; no network needed to view it.

import { CATEGORY_LABEL } from "./dot.ts";
import { blockedByText, categorize, childrenOf, groupByCategory, relativeTime, type Category, type Graph, type Node } from "./graph.ts";

const ORDER: Category[] = ["ready", "in_progress", "waiting", "blocked", "done"];

const h = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function item(n: Node, g: Graph, now: Date): string {
  const meta: string[] = [];
  const blocked = blockedByText(n, g, (b) => `<a href="${h(b.url)}" target="_blank">#${b.number}</a>`);
  if (blocked) meta.push(blocked);
  if (n.assignees.length) meta.push(n.assignees.map((a) => (a === g.viewer ? `<b class="you">@${h(a)} (you)</b>` : `@${h(a)}`)).join(", "));
  if (n.pr) meta.push(`<a href="${h(n.pr.url)}" target="_blank">PR #${n.pr.number}</a> ${n.pr.state}`);
  meta.push(relativeTime(n.updatedAt, now));
  return `<li data-issue="${n.number}"><a class="t" href="${h(n.url)}" target="_blank">#${n.number} ${h(n.title)}</a><span class="m">${meta.join(" · ")}</span></li>`;
}

export function renderHtml(g: Graph, svg: string, opts: { now?: Date } = {}): string {
  const now = opts.now ?? new Date();
  const groups = groupByCategory(g);
  const total = g.nodes.length;
  const done = groups.done.length;
  const pct = total ? Math.round((100 * done) / total) : 0;
  const inGraph = new Set(g.nodes.map((n) => n.number));
  const children = childrenOf(g);

  // Adjacency for the hover trace: "blocked by" is explicit blockers drawn in this graph plus
  // sub-issues (containment is a dependency). The epic is included so hovering it traces everything.
  const data = {
    generatedAt: now.toISOString(),
    repo: g.repo,
    viewer: g.viewer,
    epic: { number: g.epic.number, title: g.epic.title, url: g.epic.url },
    nodes: [g.epic, ...g.nodes].map((n) => ({
      number: n.number,
      category: n === g.epic ? null : categorize(n, g),
      blockedBy: [...n.blockedBy.map((b) => b.number).filter((b) => inGraph.has(b)), ...(children.get(n.number) ?? []).map((c) => c.number)],
    })),
  };

  // Nothing is rendered for a category with no issues — a zero is noise.
  const sidebar = ORDER.filter((c) => groups[c].length > 0)
    .map((c) => `<section class="group ${c}"><h2><i></i>${CATEGORY_LABEL[c]} <span>${groups[c].length}</span></h2><ul class="list">${groups[c].map((n) => item(n, g, now)).join("")}</ul></section>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>#${g.epic.number} ${h(g.epic.title)} · conductor</title>
<style>
:root { color-scheme: dark; --bg:#0d1117; --fg:#e6edf3; --mute:#8b949e; --line:#30363d; --card:#161b22; --accent:#58a6ff; --attention:#d29922;
  --ready:#238636; --in_progress:#1f6feb; --waiting:#9e6a03; --blocked:#30363d; --done:#8957e5; }
* { box-sizing: border-box; }
html, body { height:100%; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; display:flex; flex-direction:column; overflow:hidden; }
a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
header { flex:none; padding:14px 20px 12px; border-bottom:1px solid var(--line); }
header h1 { font-size:20px; margin:0 0 4px; } header h1 a { color:inherit; }
header p { margin:0; color:var(--mute); } header .gen { font-size:12.5px; margin-top:6px; }
.pct { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:var(--done); color:#fff; font-weight:700; font-size:13px; }
code { font-size:12px; background:var(--line); padding:1px 5px; border-radius:4px; }
.body { flex:1; display:flex; min-height:0; }
aside { flex:none; width:320px; overflow-y:auto; padding:12px 10px 24px; border-right:1px solid var(--line); background:var(--card); }
.group { margin-bottom:16px; }
.group h2 { font-size:13.5px; margin:0 0 4px; padding:0 6px; display:flex; align-items:center; gap:6px; } .group h2 span { color:var(--mute); font-weight:400; }
.group h2 i { width:12px; height:12px; border-radius:3px; display:inline-block; }
.ready h2 i { background:var(--ready); } .in_progress h2 i { background:var(--in_progress); } .waiting h2 i { background:var(--waiting); }
.blocked h2 i { background:var(--blocked); box-shadow: inset 0 0 0 1px var(--mute); } .done h2 i { background:var(--done); }
.list { list-style:none; margin:0; padding:0; } .list li { padding:5px 6px; border-radius:6px; display:flex; flex-direction:column; gap:1px; }
.list li:hover, .list li.hot { background:var(--bg); } .list .t { color:inherit; font-weight:500; } .list .m { color:var(--mute); font-size:12.5px; } .you { color:var(--attention); }
.graph { flex:1; overflow:auto; padding:16px; }
.graph svg { display:block; max-width:none; font-family: Arial, Helvetica, sans-serif; } .graph svg text { font-family: Arial, Helvetica, sans-serif; }
/* SVG: colors come from the DOT; the page only adds done-dimming and trace states. .edge = blocking, .tree = containment; both are dependencies and both trace. */
svg .node, svg .edge, svg .tree { transition: opacity .12s; } svg a:hover text { text-decoration: underline; }
svg .node.done { opacity:.45; } svg .edge.done, svg .tree.done { opacity:.35; }
body.tracing svg .node:not(.sel):not(.up):not(.down), body.tracing svg .edge:not(.lit), body.tracing svg .tree:not(.lit) { opacity:.18; }
svg .node.sel polygon, svg .node.sel path { stroke: var(--fg); stroke-width:2; }
svg .edge.lit path, svg .tree.lit path { stroke-width:2.6; stroke: var(--accent); } svg .edge.lit polygon, svg .tree.lit polygon { fill: var(--accent); stroke: var(--accent); }
</style>
</head>
<body>
<header>
  <h1><a href="${h(g.epic.url)}" target="_blank">#${g.epic.number} ${h(g.epic.title)}</a> <small class="sub">${g.epic.state}</small></h1>
  <p class="sub">${h(g.repo)} · ${done}/${total} done <b class="pct">${pct}%</b></p>
  <p class="gen">Generated ${now.toISOString()} by <code>conductor view</code>. Re-run <code>conductor view ${g.epic.number} --repo ${h(g.repo)}</code> and reload to refresh.</p>
</header>
<div class="body">
<aside>${sidebar}</aside>
<div class="graph">${svg}</div>
</div>
<script type="application/json" id="data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById("data").textContent);
  const up = new Map(data.nodes.map(n => [n.number, n.blockedBy]));
  const down = new Map(data.nodes.map(n => [n.number, []]));
  for (const n of data.nodes) for (const b of n.blockedBy) down.get(b)?.push(n.number);
  const closure = (start, adj) => { const seen = new Set(); const stack = [...(adj.get(start) ?? [])]; while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); stack.push(...(adj.get(x) ?? [])); } return seen; };
  const svg = document.querySelector(".graph svg");
  const nodeEl = (num) => document.getElementById("issue-" + num);
  const clear = () => { document.body.classList.remove("tracing"); svg.querySelectorAll(".sel,.up,.down,.lit").forEach(e => e.classList.remove("sel", "up", "down", "lit")); document.querySelectorAll(".list li.hot").forEach(e => e.classList.remove("hot")); };
  const trace = (num) => {
    clear();
    if (!up.has(num)) return;
    document.body.classList.add("tracing");
    const ups = closure(num, up), downs = closure(num, down);
    nodeEl(num)?.classList.add("sel");
    for (const x of ups) nodeEl(x)?.classList.add("up");
    for (const x of downs) nodeEl(x)?.classList.add("down");
    const lit = new Set([num, ...ups, ...downs]);
    for (const e of svg.querySelectorAll("g.edge, g.tree")) { const m = e.id.match(/^(?:edge|tree)-(\\d+)-(\\d+)$/); if (m && lit.has(+m[1]) && lit.has(+m[2])) e.classList.add("lit"); }
    document.querySelectorAll(\`.list li[data-issue="\${num}"]\`).forEach(e => e.classList.add("hot"));
  };
  for (const el of svg.querySelectorAll("g.node")) { const num = +el.id.slice(6); el.addEventListener("mouseenter", () => trace(num)); el.addEventListener("mouseleave", clear); }
  for (const el of document.querySelectorAll("[data-issue]")) { const num = +el.dataset.issue; el.addEventListener("mouseenter", () => trace(num)); el.addEventListener("mouseleave", clear); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") clear(); });
  // Wide graphs center the epic far from the left edge; start with it in view.
  const pane = document.querySelector(".graph"), root = nodeEl(data.epic.number);
  if (root) { const r = root.getBoundingClientRect(), p = pane.getBoundingClientRect(); pane.scrollLeft = r.left - p.left - (p.width - r.width) / 2; }
})();
</script>
</body>
</html>
`;
}
