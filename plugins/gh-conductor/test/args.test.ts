import { expect, test } from "bun:test";
import { parseIssueRef } from "../src/core/args.ts";

test("bare and #-prefixed numbers", () => {
  expect(parseIssueRef("4")).toEqual({ number: 4 });
  expect(parseIssueRef("#4")).toEqual({ number: 4 });
});
test("owner/repo#N", () => {
  expect(parseIssueRef("phillipdupuis/gh-conductor-tests#4")).toEqual({ repo: "phillipdupuis/gh-conductor-tests", number: 4 });
});
test("issue URLs, with trailing junk", () => {
  expect(parseIssueRef("https://github.com/phillipdupuis/gh-conductor-tests/issues/4")).toEqual({ repo: "phillipdupuis/gh-conductor-tests", number: 4 });
  expect(parseIssueRef("https://github.com/o/r/issues/12#issuecomment-1")).toEqual({ repo: "o/r", number: 12 });
  expect(parseIssueRef("https://ghe.example.com/o/r/issues/7/")).toEqual({ repo: "o/r", number: 7 });
});
test("rejects PR URLs and garbage", () => {
  expect(parseIssueRef("https://github.com/o/r/pull/4")).toBeNull();
  expect(parseIssueRef("abc")).toBeNull();
  expect(parseIssueRef(undefined)).toBeNull();
});
