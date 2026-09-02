import { describe, expect, test } from "bun:test";
import { parseIssueParams } from "../src/app/api.ts";

describe("parseIssueParams", () => {
  test("parses a numeric issue number", () => {
    expect(
      parseIssueParams({ owner: "phillipdupuis", repo: "gh-conductor", number: "123" }),
    ).toEqual({ owner: "phillipdupuis", repo: "gh-conductor", number: 123 });
  });

  /** `gh-conductor serve --from` prints /local/graph/0, so zero has to keep matching. */
  test("accepts 0", () => {
    expect(parseIssueParams({ owner: "local", repo: "graph", number: "0" })).toEqual({
      owner: "local",
      repo: "graph",
      number: 0,
    });
  });

  test.each(["xyz", "12x", "-1", "1.5", ""])("rejects %p", (number) => {
    expect(parseIssueParams({ owner: "o", repo: "r", number })).toBe(false);
  });
});
