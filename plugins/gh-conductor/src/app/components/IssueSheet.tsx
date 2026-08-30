import { IssueClosedIcon, IssueOpenedIcon } from "@primer/octicons-react";
import { ExternalLink } from "lucide-react";
import { childrenOf, keyOf, refLabel, relativeTime } from "../../core/graph.ts";
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
  onSelect: (n: string) => void;
};

export function IssueSheet({ issue, graph, onClose, onSelect }: Props) {
  const isEpic = issue !== null && keyOf(issue) === keyOf(graph.epic);
  const inGraph = new Set([graph.epic, ...graph.nodes, ...graph.related].map(keyOf));
  const blocks = issue ? [...graph.nodes, ...graph.related].filter((n) => n.blockedBy.some((b) => keyOf(b) === keyOf(issue))) : [];
  const children = issue ? (childrenOf(graph).get(keyOf(issue)) ?? []) : [];

  /** A reference to another issue: a jump when it is on the canvas, a github.com link when it is not. */
  const ref = (n: { repo: string; number: number; title: string; url: string; state: "open" | "closed" }) => {
    const key = keyOf(n);
    const label = (
      <>
        <span className="text-muted-foreground">{refLabel(n, graph.repo)}</span> {n.title}
      </>
    );
    return (
      <li key={key} className="flex min-w-0 items-baseline gap-2">
        {inGraph.has(key) ? (
          <button type="button" onClick={() => onSelect(key)} className={cn("min-w-0 truncate text-left hover:underline", n.state === "closed" && "text-muted-foreground line-through")}>
            {label}
          </button>
        ) : (
          <a href={n.url} target="_blank" rel="noreferrer" className={cn("min-w-0 truncate hover:underline", n.state === "closed" && "text-muted-foreground line-through")}>
            {label}
          </a>
        )}
      </li>
    );
  };

  return (
    <Sheet open={issue !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <SheetContent side="right" className="w-[420px] overflow-y-auto sm:max-w-[420px]">
        {issue && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-snug break-words">
                <span className="text-muted-foreground">{refLabel(issue, graph.repo)}</span> {issue.title}
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
              <Field label="Blocked by">{issue.blockedBy.length ? <ul className="space-y-1">{issue.blockedBy.map((b) => ref(b))}</ul> : <Empty>nothing</Empty>}</Field>
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
