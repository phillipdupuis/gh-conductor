import { ExternalLink, FoldHorizontal, RefreshCw, UnfoldHorizontal } from "lucide-react";
import type { IssuePath } from "../api.ts";
import { relativeTime } from "../../core/graph.ts";
import { isCollapsible } from "../../core/layout.ts";
import type { ViewModel } from "../../core/schema.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  issue: IssuePath;
  view: ViewModel | null;
  layers: string[][] | null;
  expanded: ReadonlySet<number>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export function Header({ issue, view, layers, expanded, loading, error, onRefresh, onExpandAll, onCollapseAll }: Props) {
  const collapsible = (layers ?? []).flatMap((l, i) => (isCollapsible(l) ? [i] : []));
  const allExpanded = collapsible.every((i) => expanded.has(i));
  const noneExpanded = !collapsible.some((i) => expanded.has(i));

  return (
    <header className="flex items-center gap-4 border-b bg-card px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">
          {view ? (
            <a href={view.graph.root.url} target="_blank" rel="noreferrer" className="hover:underline">
              #{view.graph.root.number} {view.graph.root.title}
            </a>
          ) : (
            <>
              {issue.owner}/{issue.repo}#{issue.number}
            </>
          )}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {view ? (
            <>
              {view.graph.repo} · {view.graph.root.state} · loaded {relativeTime(view.generatedAt)}
            </>
          ) : (
            " "
          )}
          {error && <span className="ml-2 text-destructive">error: {error}</span>}
        </p>
      </div>
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
          <a href={view.graph.root.url} target="_blank" rel="noreferrer" aria-label="Open issue on GitHub">
            <ExternalLink />
          </a>
        </Button>
      )}
    </header>
  );
}
