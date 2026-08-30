import { describe, expect, test } from "bun:test";
import { parseEpicParams } from "../src/app/api.ts";

describe("parseEpicParams", () => {
  test("parses a numeric issue number", () => {
    expect(parseEpicParams({ owner: "phillipdupuis", repo: "gh-conductor", number: "123" })).toEqual({ owner: "phillipdupuis", repo: "gh-conductor", number: 123 });
  });

  /** `conductor serve --from` prints /local/graph/0, so zero has to keep matching. */
  test("accepts 0", () => {
    expect(parseEpicParams({ owner: "local", repo: "graph", number: "0" })).toEqual({ owner: "local", repo: "graph", number: 0 });
  });

  test.each(["xyz", "12x", "-1", "1.5", ""])("rejects %p", (number) => {
    expect(parseEpicParams({ owner: "o", repo: "r", number })).toBe(false);
  });
});
