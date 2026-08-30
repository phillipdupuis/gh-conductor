import { describe, expect, test } from "bun:test";
import { dq, esc, toDot, wrap } from "../src/dot.ts";
import { blocker, graph, node } from "./graph.test.ts";

describe("escaping", () => {
  test("dq escapes quotes, backslashes, newlines", () => {
    expect(dq('say "hi" \\ now\nthen')).toBe('"say \\"hi\\" \\\\ now then"');
  });
  test("esc escapes html", () => expect(esc('<b>&"x"</b>')).toBe("&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;"));
  test("wrap breaks long titles and escapes each line", () => {
    expect(wrap("aaa bbb ccc ddd", 7)).toBe("aaa bbb<br/>ccc ddd");
    expect(wrap("a <b> c", 100)).toBe("a &lt;b&gt; c");
  });
});

describe("toDot", () => {
  const g = graph([
    node({ number: 2, title: 'Fix "quotes" & <tags>' }),
    node({ number: 3, blockedBy: [blocker(2)], assignees: ["phillip"], pr: { number: 30, url: "https://example.test/pr/30", state: "draft" } }),
    node({ number: 4, blockedBy: [blocker(3), blocker(99)], state: "open" }),
    node({ number: 5, parent: 3, depth: 2, state: "closed" }),
  ]);
  const dot = toDot(g);

  test("bottom-up: epic is a neutral root node, no clusters, containment is a sub-issue → parent edge", () => {
    expect(dot).toContain("rankdir=BT");
    expect(dot).not.toContain("cluster");
    expect(dot).toContain('"i1" [id="issue-1" class="node epic" label=<#1 issue 1> URL="https://example.test/1"');
    expect(dot).toContain('"i2" -> "i1" [id="tree-2-1" class="tree"');
    expect(dot).toContain('"i5" -> "i3" [id="tree-5-3" class="tree done"'); // parent 3, not the epic; #5 is closed
    expect(dot.match(/class="tree( done)?"/g)?.length).toBe(4);
  });
  test("a parent with an open sub-issue is blocked, and says so", () => {
    const g3 = graph([node({ number: 2, blockedBy: [blocker(9)] }), node({ number: 3, parent: 2, depth: 2 }), node({ number: 4, parent: 2, depth: 2 })]);
    const d = toDot(g3);
    expect(d).toContain('"i2" [id="issue-2" class="node blocked"');
    expect(d).toContain('tooltip="Blocked · blocked by #9 (outside epic) and 2 open sub-issues"');
    expect(dot).toContain('tooltip="Blocked · blocked by #2 · assigned @phillip · PR #30 draft"'); // #3's only child is closed: no sub-issue blocker
  });
  test("nodes carry id, class, issue link, tooltip; titles are escaped", () => {
    expect(dot).toContain('id="issue-2"');
    expect(dot).toContain('class="node ready"');
    expect(dot).toContain('URL="https://example.test/2" target="_blank"');
    expect(dot).toContain("label=<#2 Fix &quot;quotes&quot; &amp; &lt;tags&gt;>");
    expect(dot).not.toContain('Fix "quotes"');
    expect(dot).toContain('class="node blocked"');
    expect(dot).toContain('class="node done"');
  });
  test("status is fill color only: same style on every node, no dashed, no per-blocking-edge colors", () => {
    expect(dot.match(/style="rounded,filled"/g)?.length).toBe(5); // 4 issues + the epic
    expect(dot).not.toContain("dashed");
    expect(dot).toContain('fillcolor="#238636" color="#238636"'); // ready = green
    expect(dot).toContain('fillcolor="#30363d"'); // blocked = neutral
    expect(dot).toContain('fillcolor="#8957e5"'); // done = purple
    expect(dot).not.toMatch(/\[id="edge-[^\]]*(color|penwidth)=/);
  });
  test("a node is just #N title; assignee, PR, age are in the tooltip only", () => {
    expect(dot).toContain('label=<#3 issue 3>');
    expect(dot).toContain('tooltip="Blocked · blocked by #2 · assigned @phillip · PR #30 draft"');
    expect(dot).not.toContain("https://example.test/pr/30");
    expect(dot).not.toContain("ago");
  });
  test("blocked-by edges point blocker → blocked, with ids", () => {
    expect(dot).toContain('"i2" -> "i3" [id="edge-2-3" class="edge"');
    expect(dot).toContain('"i3" -> "i4" [id="edge-3-4" class="edge"');
  });
  test("external blocker is named in the tooltip, not drawn as a node or edge", () => {
    expect(dot).not.toContain('"i99"');
    expect(dot).not.toContain("edge-99-4");
    expect(dot).toContain('tooltip="Blocked · blocked by #3, #99 (outside epic)"');
  });
  test("edges touching a closed issue are classed done (the page dims them)", () => {
    const g2 = graph([node({ number: 2, state: "closed" }), node({ number: 3, blockedBy: [blocker(2, "closed")] })]);
    expect(toDot(g2)).toContain('id="edge-2-3" class="edge done"');
  });
});
