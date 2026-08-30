import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Category, Issue } from "../../core/schema.ts";
import { STATUS_BG } from "../lib/categories.ts";
import { cn } from "@/lib/utils";

export type IssueNodeData = { issue: Issue; category: Category | "epic"; dim: boolean; focus: boolean };
export type IssueFlowNode = Node<IssueNodeData, "issue">;

export function IssueNode({ data }: NodeProps<IssueFlowNode>) {
  const { issue, category, dim, focus } = data;
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-center overflow-hidden rounded-lg border px-3 py-1.5 text-xs leading-snug text-white transition-opacity",
        category === "epic" ? "border-muted-foreground bg-card text-foreground" : cn("border-transparent", STATUS_BG[category]),
        category === "blocked" && "text-[#c9d1d9]",
        category === "done" && "opacity-55",
        dim && "opacity-20",
        focus && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      <span className="line-clamp-2 break-words">
        <span className="font-semibold opacity-80">#{issue.number}</span> {issue.title}
      </span>
    </div>
  );
}
