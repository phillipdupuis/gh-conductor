import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { UnfoldHorizontal } from "lucide-react";
import { FOOTER_HEIGHT, MAX_VISIBLE_ROWS, ROW_HEIGHT } from "../../core/constants.ts";
import type { Category, Issue } from "../../core/schema.ts";
import type { Trace } from "../../core/trace.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LayerNodeData = {
  layer: number;
  issues: Issue[];
  categories: Map<number, Category>;
  traced: Trace | null;
  onHover: (n: number | null) => void;
  onSelect: (n: number) => void;
  onExpand: (layer: number) => void;
};
export type LayerFlowNode = Node<LayerNodeData, "layer">;

/** A collapsed layer: one row per issue, scrolling past MAX_VISIBLE_ROWS, with an Expand footer. */
export function LayerNode({ data }: NodeProps<LayerFlowNode>) {
  const { layer, issues, categories, traced, onHover, onSelect, onExpand } = data;
  const hidden = issues.length - MAX_VISIBLE_ROWS;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-xs text-foreground">
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      <ul className="nowheel nodrag min-h-0 flex-1 overflow-y-auto">
        {issues.map((n) => {
          const dim = traced !== null && !traced.lit.has(n.number);
          const hot = traced?.focus === n.number;
          return (
            <li key={n.number}>
              <button
                type="button"
                onMouseEnter={() => onHover(n.number)}
                onClick={() => onSelect(n.number)}
                style={{ height: ROW_HEIGHT }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 text-left transition-opacity hover:bg-accent",
                  n.state === "closed" && "text-muted-foreground",
                  dim && "opacity-25",
                  hot && "bg-accent",
                )}
              >
                <StatusIcon category={categories.get(n.number) ?? "blocked"} />
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">#{n.number}</span> {n.title}
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
