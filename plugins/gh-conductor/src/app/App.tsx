import { useEffect, useMemo } from "react";
import { currentView, useAppStore } from "./store.ts";
import { categorize, keyOf } from "../core/graph.ts";
import { layersOf } from "../core/layers.ts";
import { layoutGraph } from "../core/layout.ts";
import type { Category, Issue } from "../core/schema.ts";
import { adjacency, trace, type Trace } from "../core/trace.ts";
import { GraphCanvas } from "./components/GraphCanvas.tsx";
import { Header } from "./components/Header.tsx";
import { IssueSheet } from "./components/IssueSheet.tsx";
import { Sidebar } from "./components/Sidebar.tsx";

type Layers = { layers: string[][]; error: null } | { layers: null; error: string };

export function App() {
  const issue = useAppStore((s) => s.issue);
  const load = useAppStore((s) => s.load);
  const hover = useAppStore((s) => s.hover);
  const selected = useAppStore((s) => s.selected);
  const expanded = useAppStore((s) => s.expanded);
  const view = useAppStore(currentView);

  const refresh = useAppStore((s) => s.refresh);
  const setHover = useAppStore((s) => s.setHover);
  const setSelected = useAppStore((s) => s.setSelected);
  const expand = useAppStore((s) => s.expand);
  const collapse = useAppStore((s) => s.collapse);
  const expandAll = useAppStore((s) => s.expandAll);
  const collapseAll = useAppStore((s) => s.collapseAll);

  useEffect(() => {
    if (view) document.title = `#${view.graph.root.number} ${view.graph.root.title} · gh-conductor`;
  }, [view]);

  const categories = useMemo(() => {
    const out = new Map<string, Category>();
    if (!view) return out;
    for (const n of [...view.graph.nodes, ...view.graph.related]) out.set(keyOf(n), categorize(n, view.graph));
    return out;
  }, [view]);

  const adj = useMemo(() => (view ? adjacency(view.graph) : null), [view]);
  const traced: Trace | null = useMemo(() => (hover !== null && adj ? trace(hover, adj) : null), [hover, adj]);

  const issues = useMemo(() => {
    const out = new Map<string, Issue>();
    if (!view) return out;
    for (const n of [view.graph.root, ...view.graph.nodes, ...view.graph.related]) out.set(keyOf(n), n);
    return out;
  }, [view]);

  // A blocked-by edge pointing at an ancestor makes a cycle with containment; GitHub allows it, so don't crash.
  const layered = useMemo<Layers | null>(() => {
    if (!view) return null;
    try {
      return { layers: layersOf(view.graph), error: null };
    } catch (err) {
      return { layers: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [view]);
  const layers = layered?.layers ?? null;
  const layout = useMemo(() => (view && layers ? layoutGraph(view.graph, layers, expanded) : null), [view, layers, expanded]);

  // The route loader sets the issue before this ever renders; the guard only narrows the type.
  if (!issue) return null;

  return (
    <div className="flex h-full flex-col">
      <Header
        issue={issue}
        view={view}
        layers={layers}
        expanded={expanded}
        loading={load.status === "loading"}
        error={load.status === "error" ? load.message : null}
        onRefresh={refresh}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
      <div className="flex min-h-0 flex-1">
        {view && (
          <>
            <Sidebar graph={view.graph} categories={categories} traced={traced} onHover={setHover} onSelect={setSelected} />
            {layout ? (
              <GraphCanvas graph={view.graph} layout={layout} categories={categories} traced={traced} onHover={setHover} onSelect={setSelected} onExpand={expand} onCollapse={collapse} />
            ) : (
              <p className="m-auto max-w-md text-sm text-destructive">Can't lay out this issue: {layered?.error}</p>
            )}
          </>
        )}
        {!view && load.status === "loading" && <p className="m-auto text-sm text-muted-foreground">Loading #{issue.number} from GitHub…</p>}
      </div>
      {view && <IssueSheet issue={selected !== null ? (issues.get(selected) ?? null) : null} graph={view.graph} onClose={() => setSelected(null)} onSelect={setSelected} />}
    </div>
  );
}
