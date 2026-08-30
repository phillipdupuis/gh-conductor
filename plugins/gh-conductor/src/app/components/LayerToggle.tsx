import type { Node, NodeProps } from "@xyflow/react";
import { FoldHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LayerToggleData = { layer: number; onToggle: (layer: number) => void };
export type LayerToggleFlowNode = Node<LayerToggleData, "layerToggle">;

/** The tab on the top edge of an expanded row's frame. */
export function LayerToggle({ data }: NodeProps<LayerToggleFlowNode>) {
  return (
    <Button variant="outline" size="xs" className="nodrag h-full w-full rounded-full bg-card" onClick={() => data.onToggle(data.layer)}>
      <FoldHorizontal /> Collapse
    </Button>
  );
}
