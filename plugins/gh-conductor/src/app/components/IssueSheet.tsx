import { IssueClosedIcon, IssueOpenedIcon } from "@primer/octicons-react";
import { ExternalLink } from "lucide-react";
import { childrenOf, relativeTime } from "../../core/graph.ts";
import type { Graph, Issue } from "../../core/schema.ts";
import { AvatarStack, PrChip } from "./StatusIcon.tsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  issue: Issue | null;
  graph: Graph;
  onClose: () => void;
  onSelect: (n: number) => void;
};

export function IssueSheet({ issue, graph, onClose, onSelect }: Props) {
  const isEpic = issue?.number === graph.epic.number;
  const inGraph = new Set([graph.epic.number, ...graph.nodes.map((n) => n.number)]);
  const blocks = issue ? graph.nodes.filter((n) => n.blockedBy.some((b) => b.number === issue.number)) : [];
  const children = issue ? (childrenOf(graph).get(issue.number) ?? []) : [];

  const ref = (n: { number: number; title: string; url: string; state: "open" | "closed" }, outside = false) => (
    <li key={n.number} className="flex min-w-0 items-baseline gap-2">
      {inGraph.has(n.number) ? (
        <button type="button" onClick={() => onSelect(n.number)} className={cn("min-w-0 truncate text-left hover:underline", n.state === "closed" && "text-muted-foreground line-through")}>
          <span className="text-muted-foreground">#{n.number}</span> {n.title}
        </button>
      ) : (
        <a href={n.url} target="_blank" rel="noreferrer" className={cn("min-w-0 truncate hover:underline", n.state === "closed" && "text-muted-foreground line-through")}>
          <span className="text-muted-foreground">#{n.number}</span> {n.title}
        </a>
      )}
      {outside && <span className="shrink-0 text-xs text-muted-foreground">outside epic</span>}
    </li>
  );

  return (
    <Sheet open={issue !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <SheetContent side="right" className="w-[420px] overflow-y-auto sm:max-w-[420px]">
        {issue && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-snug break-words">
                <span className="text-muted-foreground">#{issue.number}</span> {issue.title}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <StatePill state={issue.state} />
                {isEpic && <Badge variant="outline">epic</Badge>}
                <span>updated {relativeTime(issue.updatedAt)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="min-w-0 space-y-5 px-4 text-sm">
              <Field label="Assignees">
                {issue.assignees.length ? (
                  <span className="flex items-center gap-2">
                    <AvatarStack logins={issue.assignees} max={5} />
                    <span>{issue.assignees.map((a) => (a === graph.viewer ? `@${a} (you)` : `@${a}`)).join(", ")}</span>
                  </span>
                ) : (
                  <Empty>nobody</Empty>
                )}
              </Field>
              <Field label="Pull request">
                {issue.pr ? (
                  <a href={issue.pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                    <PrChip pr={issue.pr} size={14} className="text-sm text-foreground" /> <span className="text-muted-foreground">{issue.pr.state}</span>
                  </a>
                ) : (
                  <Empty>none</Empty>
                )}
              </Field>
              <Field label="Blocked by">{issue.blockedBy.length ? <ul className="space-y-1">{issue.blockedBy.map((b) => ref(b, !inGraph.has(b.number)))}</ul> : <Empty>nothing</Empty>}</Field>
              <Field label="Blocks">{blocks.length ? <ul className="space-y-1">{blocks.map((n) => ref(n))}</ul> : <Empty>nothing</Empty>}</Field>
              {children.length > 0 && (
                <Field label="Sub-issues">
                  <ul className="space-y-1">{children.map((n) => ref(n))}</ul>
                </Field>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href={issue.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open on GitHub
                </a>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The filled Open/Closed pill github.com puts at the top of an issue page, in Primer's own colors. */
function StatePill({ state }: { state: Issue["state"] }) {
  const open = state === "open";
  const Icon = open ? IssueOpenedIcon : IssueClosedIcon;
  return (
    <Badge className="text-white" style={{ backgroundColor: open ? "#238636" : "#8957e5" }}>
      <Icon aria-hidden size={12} fill="currentColor" /> {open ? "Open" : "Closed"}
    </Badge>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
