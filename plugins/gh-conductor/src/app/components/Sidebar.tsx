import { blockedByText } from "../../core/graph.ts";
import type { Category, Graph, Issue } from "../../core/schema.ts";
import type { Trace } from "../../core/trace.ts";
import { CATEGORY_LABEL, ORDER } from "../lib/categories.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { cn } from "@/lib/utils";

type Props = {
  graph: Graph;
  categories: Map<number, Category>;
  traced: Trace | null;
  onHover: (n: number | null) => void;
  onSelect: (n: number) => void;
};

export function Sidebar({ graph, categories, traced, onHover, onSelect }: Props) {
  const groups = new Map<Category, Issue[]>(ORDER.map((c) => [c, []]));
  for (const n of graph.nodes) groups.get(categories.get(n.number) ?? "blocked")!.push(n);

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r bg-card text-sm">
      {ORDER.map((c) => {
        const items = groups.get(c)!;
        if (!items.length) return null;
        return (
          <section key={c} className="border-b py-2 last:border-b-0">
            <h2 className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <StatusIcon category={c} />
              {CATEGORY_LABEL[c]} <span className="tabular-nums">{items.length}</span>
            </h2>
            <ul>
              {items.map((n) => (
                <Row key={n.number} issue={n} graph={graph} traced={traced} onHover={onHover} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

function Row({ issue: n, graph, traced, onHover, onSelect }: { issue: Issue } & Omit<Props, "categories">) {
  const meta: string[] = [];
  const blocked = blockedByText(n, graph, (b) => `#${b.number}`);
  if (blocked) meta.push(blocked);
  if (n.assignees.length) meta.push(n.assignees.map((a) => (a === graph.viewer ? `@${a} (you)` : `@${a}`)).join(", "));
  if (n.pr) meta.push(`PR #${n.pr.number} ${n.pr.state}`);
  const dim = traced !== null && !traced.lit.has(n.number);
  const hot = traced?.focus === n.number;

  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => onHover(n.number)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(n.number)}
        className={cn("block w-full px-3 py-1.5 text-left transition-opacity hover:bg-accent", dim && "opacity-40", hot && "bg-accent")}
      >
        <span className={cn("block truncate", n.state === "closed" && "text-muted-foreground")}>
          <span className="text-muted-foreground">#{n.number}</span> {n.title}
        </span>
        {meta.length > 0 && <span className="block truncate text-xs text-muted-foreground">{meta.join(" · ")}</span>}
      </button>
    </li>
  );
}
