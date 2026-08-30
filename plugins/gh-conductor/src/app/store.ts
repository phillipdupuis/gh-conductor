// All app state and every transition on it, outside React so it can be tested without a DOM.

import { create } from "zustand";
import { type EpicPath, fetchView } from "./api.ts";
import { layersOf } from "../core/layers.ts";
import { isCollapsible } from "../core/layout.ts";
import type { ViewModel } from "../core/schema.ts";

export type Load = { status: "idle" } | { status: "loading"; prev: ViewModel | null } | { status: "ready"; view: ViewModel } | { status: "error"; message: string; prev: ViewModel | null };

type State = {
  epic: EpicPath | null;
  load: Load;
  hover: string | null;
  selected: string | null;
  /** Layer indices shown as columns instead of one list node. Survives Refresh. */
  expanded: ReadonlySet<number>;
};

type Actions = {
  init: (epic: EpicPath | null) => void;
  refresh: () => Promise<void>;
  receiveView: (view: ViewModel) => void;
  setHover: (n: string | null) => void;
  setSelected: (n: string | null) => void;
  expand: (i: number) => void;
  collapse: (i: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
};

export type AppState = State & Actions;

export const initialState: State = { epic: null, load: { status: "idle" }, hover: null, selected: null, expanded: new Set() };

/** The graph on screen: the loaded one, or the one it is replacing. Never allocates — safe as a selector. */
export function currentView(s: State): ViewModel | null {
  return s.load.status === "ready" ? s.load.view : s.load.status === "loading" || s.load.status === "error" ? s.load.prev : null;
}

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState,

  init: (epic) => set({ epic }),

  refresh: async () => {
    const epic = get().epic;
    if (!epic) return;
    set((s) => ({ load: { status: "loading", prev: currentView(s) } }));
    try {
      get().receiveView(await fetchView(epic));
    } catch (err) {
      set((s) => ({ load: { status: "error", message: err instanceof Error ? err.message : String(err), prev: s.load.status === "loading" ? s.load.prev : null } }));
    }
  },

  /** Also the entry point for a pushed view once the server streams updates. */
  receiveView: (view) => set({ load: { status: "ready", view } }),

  setHover: (hover) => set({ hover }),
  setSelected: (selected) => set({ selected }),

  expand: (i) => set((s) => ({ expanded: new Set(s.expanded).add(i) })),
  collapse: (i) =>
    set((s) => {
      const next = new Set(s.expanded);
      next.delete(i);
      return { expanded: next };
    }),
  expandAll: () => {
    const view = currentView(get());
    if (!view) return;
    let layers: string[][];
    try {
      layers = layersOf(view.graph);
    } catch {
      return; // A cyclic graph has no layers to expand; the button is disabled in that case anyway.
    }
    set({ expanded: new Set(layers.flatMap((l, i) => (isCollapsible(l) ? [i] : []))) });
  },
  collapseAll: () => set({ expanded: new Set() }),
}));
