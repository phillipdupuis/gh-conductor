import { describe, expect, test } from "bun:test";
import { diff, type Fetched, type FetchedComment, type FetchedSubIssue, type Snapshot } from "../src/diff.ts";

const ROOT = "phillipdupuis/gh-conductor-tests#4";
const config = { root: ROOT, allowlist: new Set(["phillipdupuis"]) };

const sub = (number: number, state: "open" | "closed", title = `sub ${number}`): FetchedSubIssue => ({
  number,
  title,
  state,
  html_url: `https://github.com/phillipdupuis/gh-conductor-tests/issues/${number}`,
});

const comment = (id: number, login: string | null, body = "hello"): FetchedComment => ({
  id,
  body,
  html_url: `https://github.com/phillipdupuis/gh-conductor-tests/issues/4#issuecomment-${id}`,
  user: login === null ? null : { login },
});

const baseline = (fetched: Fetched): Snapshot => diff(null, fetched, config).next;

describe("baseline", () => {
  test("first poll emits nothing and marks every comment seen", () => {
    const fetched = { subIssues: [sub(5, "open")], comments: [comment(11, "phillipdupuis"), comment(12, "someone")] };
    const { next, events } = diff(null, fetched, config);
    expect(events).toEqual([]);
    expect([...next.seenCommentIds]).toEqual([11, 12]);
    expect(next.subIssues.get(5)).toEqual({
      title: "sub 5",
      state: "open",
      url: "https://github.com/phillipdupuis/gh-conductor-tests/issues/5",
    });
  });
});

describe("sub-issue state", () => {
  test("open → closed emits a state_change with the issue url", () => {
    const prev = baseline({ subIssues: [sub(5, "open", "wire up the poller")], comments: [] });
    const { events } = diff(prev, { subIssues: [sub(5, "closed", "wire up the poller")], comments: [] }, config);
    expect(events).toEqual([
      {
        content: `Sub-issue #5 "wire up the poller" was closed (under ${ROOT}).`,
        meta: {
          kind: "state_change",
          root: ROOT,
          issue: "5",
          state: "closed",
          url: "https://github.com/phillipdupuis/gh-conductor-tests/issues/5",
        },
      },
    ]);
  });

  test("closed → open emits a reopened state_change", () => {
    const prev = baseline({ subIssues: [sub(5, "closed")], comments: [] });
    const { events, next } = diff(prev, { subIssues: [sub(5, "open")], comments: [] }, config);
    expect(events).toHaveLength(1);
    expect(events[0]?.content).toBe(`Sub-issue #5 "sub 5" was reopened (under ${ROOT}).`);
    expect(events[0]?.meta.state).toBe("open");
    expect(next.subIssues.get(5)?.state).toBe("open");
  });

  test("unchanged state emits nothing", () => {
    const prev = baseline({ subIssues: [sub(5, "open")], comments: [] });
    expect(diff(prev, { subIssues: [sub(5, "open")], comments: [] }, config).events).toEqual([]);
  });

  test("a newly appearing sub-issue is recorded but emits nothing", () => {
    const prev = baseline({ subIssues: [sub(5, "open")], comments: [] });
    const { events, next } = diff(prev, { subIssues: [sub(5, "open"), sub(6, "open")], comments: [] }, config);
    expect(events).toEqual([]);
    expect(next.subIssues.has(6)).toBe(true);
  });
});

describe("comments", () => {
  test("an unseen allowlisted comment emits with author and url meta", () => {
    const prev = baseline({ subIssues: [], comments: [comment(11, "phillipdupuis")] });
    const { events } = diff(prev, { subIssues: [], comments: [comment(12, "phillipdupuis", "ship it")] }, config);
    expect(events).toEqual([
      {
        content: `Comment by phillipdupuis on issue ${ROOT}:\nship it`,
        meta: {
          kind: "comment",
          root: ROOT,
          author: "phillipdupuis",
          url: "https://github.com/phillipdupuis/gh-conductor-tests/issues/4#issuecomment-12",
        },
      },
    ]);
  });

  test("a comment from outside the allowlist emits nothing but is marked seen", () => {
    const prev = baseline({ subIssues: [], comments: [] });
    const { events, next } = diff(prev, { subIssues: [], comments: [comment(12, "drive-by")] }, config);
    expect(events).toEqual([]);
    expect(next.seenCommentIds.has(12)).toBe(true);
  });

  test("a seen comment does not re-emit when the fetch returns it again", () => {
    const prev = baseline({ subIssues: [], comments: [comment(11, "phillipdupuis")] });
    expect(diff(prev, { subIssues: [], comments: [comment(11, "phillipdupuis", "edited")] }, config).events).toEqual([]);
  });

  test("seen ids survive a fetch window that no longer returns them", () => {
    const prev = baseline({ subIssues: [], comments: [comment(11, "phillipdupuis")] });
    const { next } = diff(prev, { subIssues: [], comments: [] }, config);
    expect(next.seenCommentIds.has(11)).toBe(true);
  });

  test("a body over 2000 chars is truncated with a suffix", () => {
    const prev = baseline({ subIssues: [], comments: [] });
    const body = "x".repeat(2500);
    const { events } = diff(prev, { subIssues: [], comments: [comment(12, "phillipdupuis", body)] }, config);
    const content = events[0]?.content ?? "";
    expect(content).toEndWith("… [truncated]");
    expect(content).toContain("x".repeat(2000));
    expect(content).not.toContain("x".repeat(2001));
  });

  test("a body of exactly 2000 chars is left alone", () => {
    const prev = baseline({ subIssues: [], comments: [] });
    const body = "x".repeat(2000);
    const { events } = diff(prev, { subIssues: [], comments: [comment(12, "phillipdupuis", body)] }, config);
    expect(events[0]?.content).toBe(`Comment by phillipdupuis on issue ${ROOT}:\n${body}`);
  });
});

describe("meta", () => {
  test("every emitted event carries a url and identifier-safe meta keys", () => {
    const prev = baseline({ subIssues: [sub(5, "open")], comments: [] });
    const { events } = diff(
      prev,
      { subIssues: [sub(5, "closed")], comments: [comment(12, "phillipdupuis")] },
      config,
    );
    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.meta.url).toBeTruthy();
      for (const key of Object.keys(event.meta)) expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
  });
});
