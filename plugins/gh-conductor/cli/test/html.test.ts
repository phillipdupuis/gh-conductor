import { describe, expect, test } from "bun:test";
import { renderHtml } from "../src/html.ts";
import { blocker, graph, node } from "./graph.test.ts";

const now = new Date("2026-08-29T12:00:00Z");
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g id="issue-2" class="node ready"/></svg>';

describe("renderHtml", () => {
  const g = graph([
    node({ number: 2, title: "<script>alert(1)</script>" }),
    node({ number: 3, assignees: ["phillip"] }),
    node({ number: 4, assignees: ["someone"], blockedBy: [blocker(2)] }),
    node({ number: 5, pr: { number: 50, url: "https://example.test/pr/50", state: "review" } }),
    node({ number: 6, state: "closed" }),
  ]);
  const html = renderHtml(g, svg, { now });

  test("is self-contained and embeds the svg", () => {
    expect(html).toContain(svg);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toContain('<link rel="stylesheet"');
  });
  test("escapes titles", () => {
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  test("header: title, progress line, attribution", () => {
    expect(html).toContain('<a href="https://example.test/1" target="_blank">#1 issue 1</a> <small class="sub">open</small>');
    expect(html).toContain('1/5 done <b class="pct">20%</b>');
    expect(html).toMatch(/<header>[\s\S]*Generated 2026-08-29T12:00:00.000Z by <code>conductor view<\/code>[\s\S]*<\/header>/);
  });
  test("sidebar groups issues by status with a count; marks the viewer; links PR and blockers", () => {
    expect(html).toContain('<section class="group ready"><h2><i></i>Awaiting agent <span>1</span></h2>');
    expect(html).toContain('<section class="group done"><h2><i></i>Done <span>1</span></h2>');
    expect(html).toContain("@phillip (you)");
    expect(html).toContain('<a href="https://example.test/pr/50" target="_blank">PR #50</a> review');
    expect(html).toContain('blocked by <a href="https://example.test/2" target="_blank">#2</a>');
    expect(html.match(/<aside>[\s\S]*<\/aside>/)![0].match(/data-issue=/g)?.length).toBe(5);
  });
  test("categories with zero issues are not rendered", () => {
    expect(html).not.toContain('class="group in_progress"');
  });
  test("no chips, no waiting panel, no hint, no footer", () => {
    expect(html).not.toContain('class="chip');
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("Waiting on a human");
    expect(html).not.toContain("Hover a node");
    expect(html).not.toContain("<footer");
  });
  test("embedded data: in-graph blockers plus sub-issues; the epic is a node blocked by its children", () => {
    const m = html.match(/<script type="application\/json" id="data">(.*?)<\/script>/s)!;
    const data = JSON.parse(m[1]!);
    expect(data.viewer).toBe("phillip");
    expect(data.nodes.find((n: { number: number }) => n.number === 4).blockedBy).toEqual([2]);
    expect(data.nodes.find((n: { number: number }) => n.number === 2).category).toBe("ready");
    expect(data.nodes.find((n: { number: number }) => n.number === 1).blockedBy).toEqual([2, 3, 4, 5, 6]);
  });
  test("a parent lists its open sub-issues as blockers", () => {
    const g2 = graph([node({ number: 2 }), node({ number: 3, parent: 2, depth: 2 }), node({ number: 4, parent: 2, depth: 2 })]);
    expect(renderHtml(g2, svg, { now })).toContain("blocked by 2 open sub-issues");
  });
});
