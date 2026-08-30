import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchView, parseEpicPath, ping } from "./api.ts";
import { categorize } from "../core/graph.ts";
import { layersOf } from "../core/layers.ts";
import { isCollapsible, layoutGraph } from "../core/layout.ts";
import type { Category, Issue, ViewModel } from "../core/schema.ts";
import { adjacency, trace, type Trace } from "../core/trace.ts";
import { GraphCanvas } from "./components/GraphCanvas.tsx";
import { Header } from "./components/Header.tsx";
import { IssueSheet } from "./components/IssueSheet.tsx";
import { Sidebar } from "./components/Sidebar.tsx";

type Load = { status: "idle" } | { status: "loading"; prev: ViewModel | null } | { status: "ready"; view: ViewModel } | { status: "error"; message: string; prev: ViewModel | null };

type Layers = { layers: number[][]; error: null } | { layers: null; error: string };

export function App() {
  const epic = useMemo(() => parseEpicPath(location.pathname), []);
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** Layer indices shown as columns instead of one list node. Survives Refresh. */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());

  const view = load.status === "ready" ? load.view : load.status === "loading" || load.status === "error" ? load.prev : null;

  const refresh = useCallback(async () => {
    if (!epic) return;
    setLoad((l) => ({ status: "loading", prev: l.status === "ready" ? l.view : l.status === "loading" || l.status === "error" ? l.prev : null }));
    try {
      setLoad({ status: "ready", view: await fetchView(epic) });
    } catch (err) {
      setLoad((l) => ({ status: "error", message: err instanceof Error ? err.message : String(err), prev: l.status === "loading" ? l.prev : null }));
    }
  }, [epic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => void ping(), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (view) document.title = `#${view.graph.epic.number} ${view.graph.epic.title} · gh-conductor`;
  }, [view]);

  const categories = useMemo(() => {
    const out = new Map<number, Category>();
    if (!view) return out;
    for (const n of view.graph.nodes) out.set(n.number, categorize(n, view.graph));
    return out;
  }, [view]);

  const adj = useMemo(() => (view ? adjacency(view.graph) : null), [view]);
  const traced: Trace | null = useMemo(() => (hover !== null && adj ? trace(hover, adj) : null), [hover, adj]);

  const issues = useMemo(() => {
    const out = new Map<number, Issue>();
    if (!view) return out;
    out.set(view.graph.epic.number, view.graph.epic);
    for (const n of view.graph.nodes) out.set(n.number, n);
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

  const expand = useCallback((i: number) => setExpanded((s) => new Set(s).add(i)), []);
  const collapse = useCallback(
    (i: number) =>
      setExpanded((s) => {
        const next = new Set(s);
        next.delete(i);
        return next;
      }),
    [],
  );
  const expandAll = useCallback(() => setExpanded(new Set((layers ?? []).flatMap((l, i) => (isCollapsible(l) ? [i] : [])))), [layers]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  if (!epic) {
    return (
      <main className="flex h-full items-center justify-center p-8">
        <div className="max-w-md space-y-3 text-sm text-muted-foreground">
          <h1 className="text-lg font-semibold text-foreground">gh-conductor</h1>
          <p>
            Open an epic with <code className="rounded bg-muted px-1 py-0.5">conductor view &lt;epic&gt;</code>, or visit{" "}
            <code className="rounded bg-muted px-1 py-0.5">/&lt;owner&gt;/&lt;repo&gt;/&lt;number&gt;</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        epic={epic}
        view={view}
        categories={categories}
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
              <p className="m-auto max-w-md text-sm text-destructive">Can't lay out this epic: {layered?.error}</p>
            )}
          </>
        )}
        {!view && load.status === "loading" && <p className="m-auto text-sm text-muted-foreground">Loading #{epic.number} from GitHub…</p>}
      </div>
      {view && <IssueSheet issue={selected !== null ? (issues.get(selected) ?? null) : null} graph={view.graph} categories={categories} onClose={() => setSelected(null)} onSelect={setSelected} />}
    </div>
  );
}
