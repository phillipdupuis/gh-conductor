import { ExternalLink, FoldHorizontal, RefreshCw, UnfoldHorizontal } from "lucide-react";
import type { EpicPath } from "../api.ts";
import { CATEGORY_LABEL, ORDER } from "../lib/categories.ts";
import { relativeTime } from "../../core/graph.ts";
import { isCollapsible } from "../../core/layout.ts";
import type { Category, ViewModel } from "../../core/schema.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  epic: EpicPath;
  view: ViewModel | null;
  categories: Map<number, Category>;
  layers: number[][] | null;
  expanded: ReadonlySet<number>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export function Header({ epic, view, categories, layers, expanded, loading, error, onRefresh, onExpandAll, onCollapseAll }: Props) {
  const counts = new Map<Category, number>();
  for (const c of categories.values()) counts.set(c, (counts.get(c) ?? 0) + 1);
  const total = view?.graph.nodes.length ?? 0;
  const done = counts.get("done") ?? 0;
  const collapsible = (layers ?? []).flatMap((l, i) => (isCollapsible(l) ? [i] : []));
  const allExpanded = collapsible.every((i) => expanded.has(i));
  const noneExpanded = !collapsible.some((i) => expanded.has(i));

  return (
    <header className="flex items-center gap-4 border-b bg-card px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">
          {view ? (
            <a href={view.graph.epic.url} target="_blank" rel="noreferrer" className="hover:underline">
              #{view.graph.epic.number} {view.graph.epic.title}
            </a>
          ) : (
            <>
              {epic.owner}/{epic.repo}#{epic.number}
            </>
          )}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {view ? (
            <>
              {view.graph.repo} · {view.graph.epic.state} · {done}/{total} done · loaded {relativeTime(view.generatedAt)}
            </>
          ) : (
            " "
          )}
          {error && <span className="ml-2 text-destructive">error: {error}</span>}
        </p>
      </div>
      <ul className="hidden items-center gap-1.5 text-xs md:flex">
        {ORDER.map((c) => (
          <li key={c} className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5", (counts.get(c) ?? 0) === 0 && "opacity-40")}>
            <StatusIcon category={c} />
            {CATEGORY_LABEL[c]} <span className="tabular-nums text-muted-foreground">{counts.get(c) ?? 0}</span>
          </li>
        ))}
      </ul>
      {collapsible.length > 0 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onExpandAll} disabled={allExpanded}>
            <UnfoldHorizontal /> Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={onCollapseAll} disabled={noneExpanded}>
            <FoldHorizontal /> Collapse all
          </Button>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
      </Button>
      {view && (
        <Button variant="ghost" size="icon-sm" asChild>
          <a href={view.graph.epic.url} target="_blank" rel="noreferrer" aria-label="Open epic on GitHub">
            <ExternalLink />
          </a>
        </Button>
      )}
    </header>
  );
}
