import { expect, test } from "bun:test";
import { parseEpicRef } from "../src/core/args.ts";

test("bare and #-prefixed numbers", () => {
  expect(parseEpicRef("4")).toEqual({ number: 4 });
  expect(parseEpicRef("#4")).toEqual({ number: 4 });
});
test("owner/repo#N", () => {
  expect(parseEpicRef("phillipdupuis/gh-conductor-tests#4")).toEqual({ repo: "phillipdupuis/gh-conductor-tests", number: 4 });
});
test("issue URLs, with trailing junk", () => {
  expect(parseEpicRef("https://github.com/phillipdupuis/gh-conductor-tests/issues/4")).toEqual({ repo: "phillipdupuis/gh-conductor-tests", number: 4 });
  expect(parseEpicRef("https://github.com/o/r/issues/12#issuecomment-1")).toEqual({ repo: "o/r", number: 12 });
  expect(parseEpicRef("https://ghe.example.com/o/r/issues/7/")).toEqual({ repo: "o/r", number: 7 });
});
test("rejects PR URLs and garbage", () => {
  expect(parseEpicRef("https://github.com/o/r/pull/4")).toBeNull();
  expect(parseEpicRef("abc")).toBeNull();
  expect(parseEpicRef(undefined)).toBeNull();
});
