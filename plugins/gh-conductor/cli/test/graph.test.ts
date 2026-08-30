import { describe, expect, test } from "bun:test";
import { categorize, readyNodes, relativeTime, summarizePrs, type Blocker, type Graph, type Node } from "../src/graph.ts";

export const node = (over: Partial<Node> & { number: number }): Node => ({
  title: `issue ${over.number}`,
  url: `https://example.test/${over.number}`,
  state: "open",
  assignees: [],
  blockedBy: [],
  pr: null,
  parent: 1,
  depth: 1,
  updatedAt: "2026-08-01T00:00:00Z",
  ...over,
});
export const blocker = (number: number, state: Blocker["state"] = "open"): Blocker => ({ number, title: `issue ${number}`, url: `https://example.test/${number}`, state });
export const graph = (nodes: Node[], over: Partial<Graph> = {}): Graph => ({ repo: "o/r", viewer: "phillip", epic: node({ number: 1, depth: 0, parent: null }), nodes, ...over });

const g0 = graph([]);

describe("categorize", () => {
  test("closed → done, regardless of anything else", () => {
    expect(categorize(node({ number: 2, state: "closed", assignees: ["x"], blockedBy: [blocker(9)] }), g0)).toBe("done");
  });
  test("open blocker → blocked, even if assigned or has a PR", () => {
    expect(categorize(node({ number: 2, blockedBy: [blocker(9)], assignees: ["x"], pr: { number: 5, url: "", state: "draft" } }), g0)).toBe("blocked");
  });
  test("closed blockers don't block", () => {
    expect(categorize(node({ number: 2, blockedBy: [blocker(9, "closed")] }), g0)).toBe("ready");
  });
  test("assigned → waiting on a human", () => {
    expect(categorize(node({ number: 2, assignees: ["phillip"] }), g0)).toBe("waiting");
  });
  test("PR ready for review → waiting on a human", () => {
    expect(categorize(node({ number: 2, pr: { number: 5, url: "", state: "review" } }), g0)).toBe("waiting");
  });
  test("draft PR → in progress", () => {
    expect(categorize(node({ number: 2, pr: { number: 5, url: "", state: "draft" } }), g0)).toBe("in_progress");
  });
  test("nothing started, nobody assigned → ready", () => {
    expect(categorize(node({ number: 2 }), g0)).toBe("ready");
  });
  test("a parent is blocked by its open sub-issues; free once they are all closed", () => {
    const open = graph([node({ number: 2 }), node({ number: 3, parent: 2, depth: 2 }), node({ number: 4, parent: 2, depth: 2, state: "closed" })]);
    expect(categorize(open.nodes[0]!, open)).toBe("blocked");
    const closed = graph([node({ number: 2 }), node({ number: 3, parent: 2, depth: 2, state: "closed" })]);
    expect(categorize(closed.nodes[0]!, closed)).toBe("ready");
  });
});

describe("readyNodes", () => {
  const g = graph([
    node({ number: 2 }),
    node({ number: 3, blockedBy: [blocker(2)] }),
    node({ number: 4, assignees: ["phillip"] }),
    node({ number: 5, state: "closed" }),
    node({ number: 6, pr: { number: 7, url: "", state: "draft" } }),
    node({ number: 8, pr: { number: 9, url: "", state: "review" } }),
  ]);
  test("a PR awaiting review is waiting on a human, never ready", () => {
    expect(readyNodes(g, { includeAssigned: true }).map((n) => n.number)).not.toContain(8);
  });
  test("open + unblocked + unassigned; in-progress counts as ready", () => {
    expect(readyNodes(g).map((n) => n.number)).toEqual([2, 6]);
  });
  test("--include-assigned keeps human-assigned issues", () => {
    expect(readyNodes(g, { includeAssigned: true }).map((n) => n.number)).toEqual([2, 4, 6]);
  });
});

describe("summarizePrs", () => {
  const pr = (number: number, state: "OPEN" | "CLOSED" | "MERGED", isDraft = false) => ({ number, url: "", isDraft, state });
  test("none", () => expect(summarizePrs([])).toBeNull());
  test("merged beats everything", () => expect(summarizePrs([pr(1, "OPEN", true), pr(2, "MERGED")])?.state).toBe("merged"));
  test("open non-draft → review", () => expect(summarizePrs([pr(1, "OPEN", true), pr(2, "OPEN")])?.state).toBe("review"));
  test("only drafts → draft", () => expect(summarizePrs([pr(1, "OPEN", true)])?.state).toBe("draft"));
  test("only closed → closed (abandoned)", () => expect(summarizePrs([pr(1, "CLOSED")])?.state).toBe("closed"));
});

describe("relativeTime", () => {
  const now = new Date("2026-08-29T12:00:00Z");
  test("buckets", () => {
    expect(relativeTime("2026-08-29T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-08-29T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-08-29T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-08-26T12:00:00Z", now)).toBe("3d ago");
    expect(relativeTime("2026-08-08T12:00:00Z", now)).toBe("3w ago");
    expect(relativeTime("2026-04-29T12:00:00Z", now)).toBe("4mo ago");
    expect(relativeTime("2024-08-29T12:00:00Z", now)).toBe("2y ago");
  });
  test("future clamps to just now", () => expect(relativeTime("2027-01-01T00:00:00Z", now)).toBe("just now"));
});
