import type { Node, NodeProps } from "@xyflow/react";

export type LayerFrameData = { layer: number };
export type LayerFrameFlowNode = Node<LayerFrameData, "layerFrame">;

/** The border around an expanded row's columns. Decorative: sits under everything and ignores the mouse. */
export function LayerFrame(_: NodeProps<LayerFrameFlowNode>) {
  return (
    <div className="pointer-events-none h-full w-full rounded-xl border border-muted-foreground/30 bg-card/60" />
  );
}
