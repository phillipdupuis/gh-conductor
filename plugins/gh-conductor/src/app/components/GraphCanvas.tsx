import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useMemo, useRef } from "react";
import { keyOf } from "../../core/graph.ts";
import { boundsOf, layerId, type Box, type Layout } from "../../core/layout.ts";
import type { Category, Graph, Issue } from "../../core/schema.ts";
import type { Trace } from "../../core/trace.ts";
import { IssueNode, type IssueFlowNode } from "./IssueNode.tsx";
import { LayerFrame, type LayerFrameFlowNode } from "./LayerFrame.tsx";
import { LayerNode, type LayerFlowNode } from "./LayerNode.tsx";
import { LayerToggle, type LayerToggleFlowNode } from "./LayerToggle.tsx";

const nodeTypes: NodeTypes = {
  issue: IssueNode,
  layer: LayerNode,
  layerFrame: LayerFrame,
  layerToggle: LayerToggle,
};

/** Margin around the graph in the initial viewport, px. */
const PAD = 24;

/**
 * The first viewport: horizontally centred, anchored to the top so the root row is what you see,
 * and never zoomed below 0.75 (9px text) even when the graph is far wider than the pane. Wide
 * graphs are meant to be scrolled, not shrunk until unreadable.
 */
function initialViewport(width: number, layout: Layout) {
  const b = boundsOf(layout);
  const graphW = b.maxX - b.minX;
  if (width <= 0 || graphW <= 0) return { x: 0, y: 0, zoom: 1 };
  const zoom = Math.min(1, Math.max(0.75, (width - 2 * PAD) / graphW));
  return { x: (width - graphW * zoom) / 2 - b.minX * zoom, y: PAD - b.minY * zoom, zoom };
}

type FlowNode = IssueFlowNode | LayerFlowNode | LayerFrameFlowNode | LayerToggleFlowNode;

type Props = {
  graph: Graph;
  layout: Layout;
  categories: Map<string, Category>;
  traced: Trace | null;
  onHover: (n: string | null) => void;
  onSelect: (n: string) => void;
  onExpand: (layer: number) => void;
  onCollapse: (layer: number) => void;
};

/** Primer dark state colors, for the minimap only (nodes use the CSS vars). */
const STATUS_COLOR: Record<Category | "root", string> = {
  ready: "#3fb950",
  in_progress: "#8b949e",
  waiting: "#d29922",
  blocked: "#6e7681",
  done: "#a371f7",
  root: "#161b22",
};

/**
 * Fixed geometry for a node. React Flow drops its measured handle bounds whenever a node object
 * arrives without `measured` (we never feed dimension changes back), so hand it the size and the
 * handle positions ourselves. Then edges never depend on DOM measurement at all.
 */
function placed(b: Box, withHandles: boolean) {
  return {
    position: { x: b.x, y: b.y },
    width: b.width,
    height: b.height,
    measured: { width: b.width, height: b.height },
    handles: withHandles
      ? [
          {
            type: "source" as const,
            position: Position.Top,
            x: b.width / 2,
            y: 0,
            width: 1,
            height: 1,
          },
          {
            type: "target" as const,
            position: Position.Bottom,
            x: b.width / 2,
            y: b.height,
            width: 1,
            height: 1,
          },
        ]
      : [],
    draggable: false,
    connectable: false,
  };
}

export function GraphCanvas({
  graph,
  layout,
  categories,
  traced,
  onHover,
  onSelect,
  onExpand,
  onCollapse,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const issues = useMemo(
    () =>
      new Map<string, Issue>(
        [graph.root, ...graph.nodes, ...graph.related].map((n) => [keyOf(n), n]),
      ),
    [graph],
  );

  const nodes = useMemo<FlowNode[]>(() => {
    const out: FlowNode[] = [];
    // Frames first: nodes paint in array order, so columns and toggles draw over them.
    for (const l of layout.layers)
      if (l.frame)
        out.push({
          id: `frame-${l.layer}`,
          type: "layerFrame",
          ...placed(l.frame, false),
          selectable: false,
          data: { layer: l.layer },
        });
    for (const p of layout.issues) {
      const issue = issues.get(p.key);
      if (!issue) continue;
      const category: Category | "root" =
        p.key === keyOf(graph.root) ? "root" : (categories.get(p.key) ?? "blocked");
      out.push({
        id: p.key,
        type: "issue",
        ...placed(p, true),
        data: {
          issue,
          category,
          rootRepo: graph.repo,
          dim: traced !== null && !traced.lit.has(p.key),
          focus: traced?.focus === p.key,
        },
      });
    }
    for (const l of layout.layers) {
      if (l.node) {
        out.push({
          id: layerId(l.layer),
          type: "layer",
          ...placed(l.node, true),
          data: {
            layer: l.layer,
            issues: l.issues.flatMap((n) => issues.get(n) ?? []),
            rootRepo: graph.repo,
            categories,
            traced,
            onHover,
            onSelect,
            onExpand,
          },
        });
      }
      if (l.toggle)
        out.push({
          id: `toggle-${l.layer}`,
          type: "layerToggle",
          ...placed(l.toggle, false),
          data: { layer: l.layer, onToggle: onCollapse },
        });
    }
    return out;
  }, [graph, layout, issues, categories, traced, onHover, onSelect, onExpand, onCollapse]);

  const edges = useMemo<Edge[]>(() => {
    const lit = (a: string, b: string) =>
      traced === null || (traced.lit.has(a) && traced.lit.has(b));
    const closed = (n: string) => issues.get(n)?.state === "closed";
    return layout.edges.map((e) => {
      // An aggregated edge is lit if any of the issue-level edges behind it is; done if all are.
      const on = e.pairs.some(([a, b]) => lit(a, b));
      const done = e.pairs.every(([a, b]) => closed(a) || closed(b));
      // Containment: sub-issue → parent, muted. Blocking: blocker → blocked, with an arrow.
      return e.kind === "tree"
        ? {
            id: e.id,
            source: e.source,
            target: e.target,
            style: {
              stroke: "var(--tree)",
              strokeWidth: 1.5,
              opacity: on ? (done ? 0.5 : 1) : 0.15,
            },
          }
        : {
            id: e.id,
            source: e.source,
            target: e.target,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--edge)",
              width: 16,
              height: 16,
            },
            style: {
              stroke: "var(--edge)",
              strokeWidth: 2,
              opacity: on ? (done ? 0.45 : 1) : 0.15,
            },
          };
    });
  }, [layout, issues, traced]);

  return (
    <div ref={wrap} className="min-w-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        // Fires once per mount, so Refresh and expand/collapse leave the viewport where the user put it.
        onInit={(instance: ReactFlowInstance<FlowNode, Edge>) =>
          instance.setViewport(initialViewport(wrap.current?.clientWidth ?? 0, layout))
        }
        // Figma's input model: scroll pans (a trackpad's two fingers), pinch and Meta/Ctrl+scroll zoom.
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        // Layer nodes report hover/click per row from inside; toggles are buttons.
        onNodeMouseEnter={(_, n) => n.type === "issue" && onHover(n.id)}
        onNodeMouseLeave={() => onHover(null)}
        onNodeClick={(_, n) => n.type === "issue" && onSelect(n.id)}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            n.type === "issue"
              ? STATUS_COLOR[(n as IssueFlowNode).data.category]
              : n.type === "layer"
                ? "#21262d"
                : "transparent"
          }
          nodeStrokeWidth={0}
        />
      </ReactFlow>
    </div>
  );
}
