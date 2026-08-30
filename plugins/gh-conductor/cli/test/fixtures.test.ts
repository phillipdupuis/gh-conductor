import { describe, expect, test } from "bun:test";
import { toDot } from "../src/dot.ts";
import { groupByCategory } from "../src/graph.ts";
import { renderHtml } from "../src/html.ts";
import { renderSvg } from "../src/view.ts";
import { fixturePath, STAGES, upgradePython } from "./fixtures/upgrade-python.ts";

const counts = (stage: Parameters<typeof upgradePython>[0]) => Object.fromEntries(Object.entries(groupByCategory(upgradePython(stage))).map(([k, v]) => [k, v.length]));

describe("upgrade-python fixtures", () => {
  test.each(STAGES)("%s: JSON on disk matches the builder (else run `bun run fixtures`)", async (stage) => {
    expect(JSON.parse(await Bun.file(fixturePath(stage)).text())).toEqual(upgradePython(stage));
  });
  test("21 issues, depth-first, external blocker #57 is not a node", () => {
    const g = upgradePython("early");
    expect(g.nodes.length).toBe(21);
    expect(g.nodes.map((n) => n.number).slice(0, 5)).toEqual([121, 122, 123, 124, 125]);
    expect(g.nodes.some((n) => n.number === 57)).toBe(false);
    expect(g.nodes.find((n) => n.number === 129)!.blockedBy.map((b) => `${b.number}:${b.state}`)).toEqual(["125:open", "57:open"]);
  });
  test("stage state: early", () => {
    expect(counts("early")).toEqual({ ready: 0, in_progress: 1, waiting: 0, blocked: 19, done: 1 }); // parents are blocked by their open sub-issues
  });
  test("stage state: mid", () => {
    expect(counts("mid")).toEqual({ ready: 0, in_progress: 0, waiting: 1, blocked: 12, done: 8 });
    expect(upgradePython("mid").nodes.find((n) => n.number === 129)!.blockedBy.every((b) => b.state === "closed")).toBe(true);
  });
  test("stage state: late", () => {
    expect(counts("late")).toEqual({ ready: 3, in_progress: 2, waiting: 2, blocked: 2, done: 12 }); // blocked = #141 and the customer-migrations parent
  });
  test.each(STAGES)("%s renders: epic root, tree edges, outside-epic blocker, 21 sidebar items", async (stage) => {
    const g = upgradePython(stage);
    const dot = toDot(g);
    expect(dot).toContain('id="issue-120" class="node epic"');
    expect(dot).toContain('"i140" -> "i130" [id="tree-140-130"');
    expect(dot.match(/class="tree( done)?"/g)?.length).toBe(21);
    if (stage === "early") expect(dot).toContain("blocked by #125, #57 (outside epic)");
    const html = renderHtml(g, await renderSvg(dot));
    expect(html.match(/<aside>[\s\S]*<\/aside>/)![0].match(/data-issue=/g)?.length).toBe(21);
    // The sidebar names open blockers only; #57 is closed after early.
    expect(html.includes('<a href="https://github.com/northbeam/platform/issues/57" target="_blank">#57</a>')).toBe(stage === "early");
  });
});
