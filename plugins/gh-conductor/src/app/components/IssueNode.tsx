import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Category, Issue } from "../../core/schema.ts";
import { statusColor } from "../lib/categories.ts";
import { AvatarStack, PrChip, StatusIcon } from "./StatusIcon.tsx";
import { cn } from "@/lib/utils";

export type IssueNodeData = { issue: Issue; category: Category | "epic"; dim: boolean; focus: boolean };
export type IssueFlowNode = Node<IssueNodeData, "issue">;

/** Status is the border color (+ octicon), never a fill: the interior stays high-contrast card. */
export function IssueNode({ data }: NodeProps<IssueFlowNode>) {
  const { issue, category, dim, focus } = data;
  const ready = category === "ready";
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center gap-2 overflow-hidden rounded-lg border-2 bg-card px-2.5 text-xs leading-snug text-foreground transition-opacity",
        category === "done" && "opacity-55",
        dim && "opacity-20",
        focus && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      style={{ borderColor: category === "epic" ? "var(--muted-foreground)" : ready ? "transparent" : statusColor(category, issue) }}
    >
      {ready && <AntsBorder />}
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      {category !== "epic" && <StatusIcon category={category} issue={issue} />}
      <span className="line-clamp-2 min-w-0 flex-1 break-words">
        <span className="font-semibold text-muted-foreground">#{issue.number}</span> {issue.title}
      </span>
      {(issue.assignees.length > 0 || issue.pr) && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {issue.assignees.length > 0 && <AvatarStack logins={issue.assignees} />}
          {issue.pr && <PrChip pr={issue.pr} />}
        </span>
      )}
    </div>
  );
}

/**
 * Ready = motion = "this can move": a slow marching-ants border, the one piece of plugin vocabulary
 * on screen. Freezes to a static dashed border under prefers-reduced-motion (index.css).
 */
function AntsBorder() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
      <rect
        x="1"
        y="1"
        rx="7"
        fill="none"
        stroke="var(--status-ready)"
        strokeWidth="2"
        strokeDasharray="6 4"
        className="ants"
        style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
      />
    </svg>
  );
}
