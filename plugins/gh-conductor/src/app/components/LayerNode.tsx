import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { UnfoldHorizontal } from "lucide-react";
import { FOOTER_HEIGHT, MAX_VISIBLE_ROWS, ROW_HEIGHT } from "../../core/constants.ts";
import { keyOf, refLabel } from "../../core/graph.ts";
import type { Category, Issue } from "../../core/schema.ts";
import type { Trace } from "../../core/trace.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LayerNodeData = {
  layer: number;
  issues: Issue[];
  rootRepo: string;
  categories: Map<string, Category>;
  traced: Trace | null;
  onHover: (n: string | null) => void;
  onSelect: (n: string) => void;
  onExpand: (layer: number) => void;
};
export type LayerFlowNode = Node<LayerNodeData, "layer">;

/** A collapsed layer: one row per issue, scrolling past MAX_VISIBLE_ROWS, with an Expand footer. */
export function LayerNode({ data }: NodeProps<LayerFlowNode>) {
  const { layer, issues, rootRepo, categories, traced, onHover, onSelect, onExpand } = data;
  const hidden = issues.length - MAX_VISIBLE_ROWS;
  const done = issues.every((n) => categories.get(keyOf(n)) === "done");
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-xs text-foreground",
        done && "border-2 opacity-55",
      )}
      style={done ? { borderColor: "var(--status-done)" } : undefined}
    >
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      <ul className="nowheel nodrag min-h-0 flex-1 overflow-y-auto">
        {issues.map((n) => {
          const key = keyOf(n);
          const dim = traced !== null && !traced.lit.has(key);
          const hot = traced?.focus === key;
          return (
            <li key={key}>
              <button
                type="button"
                onMouseEnter={() => onHover(key)}
                onClick={() => onSelect(key)}
                style={{ height: ROW_HEIGHT }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 text-left transition-opacity hover:bg-accent",
                  n.state === "closed" && "text-muted-foreground",
                  dim && "opacity-25",
                  hot && "bg-accent",
                )}
              >
                <StatusIcon category={categories.get(key) ?? "blocked"} issue={n} size={12} />
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{refLabel(n, rootRepo)}</span> {n.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex shrink-0 items-center justify-between border-t px-3 text-muted-foreground" style={{ height: FOOTER_HEIGHT }} onMouseEnter={() => onHover(null)}>
        <span>{hidden > 0 ? `+${hidden} more` : ""}</span>
        <Button variant="ghost" size="xs" className="nodrag" onClick={() => onExpand(layer)}>
          <UnfoldHorizontal /> Expand
        </Button>
      </div>
    </div>
  );
}
