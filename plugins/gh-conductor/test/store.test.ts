import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { currentView, initialState, useAppStore, type Load } from "../src/app/store.ts";
import { layersOf } from "../src/core/layers.ts";
import { isCollapsible } from "../src/core/layout.ts";
import { ViewModel } from "../src/core/schema.ts";
import mid from "../fixtures/upgrade-python-mid.json";
import early from "../fixtures/upgrade-python-early.json";

const view = ViewModel.parse({ graph: mid, generatedAt: "2026-08-30T12:00:00.000Z" });
const older = ViewModel.parse({ graph: early, generatedAt: "2026-08-29T12:00:00.000Z" });

const store = () => useAppStore.getState();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => useAppStore.setState(initialState));

describe("expanded", () => {
  test("expand/collapse add and remove one index", () => {
    store().expand(2);
    store().expand(5);
    expect([...store().expanded].sort()).toEqual([2, 5]);
    store().collapse(2);
    expect([...store().expanded]).toEqual([5]);
  });
  test("expand replaces the set instead of mutating it", () => {
    const before = store().expanded;
    store().expand(1);
    expect(store().expanded).not.toBe(before);
    expect(before.size).toBe(0);
  });
  test("collapseAll empties it", () => {
    store().expand(1);
    store().collapseAll();
    expect(store().expanded.size).toBe(0);
  });
});

describe("expandAll", () => {
  test("expands exactly the collapsible layers of the current view", () => {
    store().receiveView(view);
    store().expandAll();
    const expected = layersOf(view.graph).flatMap((l, i) => (isCollapsible(l) ? [i] : []));
    expect(expected.length).toBeGreaterThan(0);
    expect([...store().expanded].sort((a, b) => a - b)).toEqual(expected);
  });
  test("no view → no-op", () => {
    store().expandAll();
    expect(store().expanded.size).toBe(0);
  });
});

describe("receiveView", () => {
  test("sets ready", () => {
    store().receiveView(view);
    expect(store().load).toEqual({ status: "ready", view });
    expect(currentView(store())).toBe(view);
  });
});

describe("refresh", () => {
  const original = globalThis.fetch;
  /** Bun's fetch carries extra properties (preconnect); keep them so the stub still types as `fetch`. */
  const stub = (impl: () => Promise<Response>) => {
    globalThis.fetch = Object.assign(impl, { preconnect: original.preconnect });
  };
  afterEach(() => {
    globalThis.fetch = original;
  });

  test("no epic → no fetch, no state change", async () => {
    stub(() => {
      throw new Error("should not fetch");
    });
    await store().refresh();
    expect(store().load).toEqual({ status: "idle" });
  });

  test("success keeps the previous view while loading, then goes ready", async () => {
    const seen: Load[] = [];
    const unsubscribe = useAppStore.subscribe((s) => seen.push(s.load));
    stub(async () => json(view));
    store().init({ owner: "o", repo: "r", number: 120 });
    store().receiveView(older);
    await store().refresh();
    unsubscribe();
    expect(seen.some((l) => l.status === "loading" && l.prev === older)).toBe(true);
    expect(store().load).toEqual({ status: "ready", view });
  });

  test("failure reports the server's message and keeps the previous view", async () => {
    stub(async () => json({ error: "boom" }, 500));
    store().init({ owner: "o", repo: "r", number: 120 });
    store().receiveView(older);
    await store().refresh();
    expect(store().load).toEqual({ status: "error", message: "boom", prev: older });
    expect(currentView(store())).toBe(older);
  });
});
