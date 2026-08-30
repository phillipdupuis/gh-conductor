import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { blockedByText, keyOf, refLabel } from "../../core/graph.ts";
import type { Category, Graph, Issue } from "../../core/schema.ts";
import type { Trace } from "../../core/trace.ts";
import { StatusIcon } from "./StatusIcon.tsx";
import { cn } from "@/lib/utils";

type Props = {
  graph: Graph;
  categories: Map<string, Category>;
  traced: Trace | null;
  onHover: (n: string | null) => void;
  onSelect: (n: string) => void;
};

/**
 * One sidebar section per native GitHub fact. The "waiting" category lumps two unrelated facts —
 * a pull request awaiting review, and an issue simply assigned to someone — so it is split here
 * rather than shown under an invented label. A section list, not a core concept.
 */
type Section = { key: string; label: string; category: Category; match?: (issue: Issue) => boolean };

const SECTIONS: Section[] = [
  { key: "ready", label: "Ready", category: "ready" },
  { key: "in_progress", label: "In progress", category: "in_progress" },
  { key: "in_review", label: "In review", category: "waiting", match: (n) => n.pr?.state === "review" },
  { key: "assigned", label: "Assigned", category: "waiting", match: (n) => n.pr?.state !== "review" },
  { key: "blocked", label: "Blocked", category: "blocked" },
  { key: "done", label: "Done", category: "done" },
];

export function Sidebar({ graph, categories, traced, onHover, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(["done"]));
  const toggle = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const groups = new Map<string, Issue[]>(SECTIONS.map((s) => [s.key, []]));
  for (const n of graph.nodes) {
    const c = categories.get(keyOf(n)) ?? "blocked";
    const section = SECTIONS.find((s) => s.category === c && (s.match?.(n) ?? true));
    if (section) groups.get(section.key)!.push(n);
  }

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r bg-card text-sm">
      {SECTIONS.map((s) => {
        const items = groups.get(s.key)!;
        if (!items.length) return null;
        const open = !collapsed.has(s.key);
        const Chevron = open ? ChevronDown : ChevronRight;
        return (
          <section key={s.key} className="border-b py-2 last:border-b-0">
            <h2>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
              >
                {/* Sections only render non-empty, so the first issue refines the icon for free:
                    a pull-request icon for "In review", a person for "Assigned". */}
                <StatusIcon category={s.category} issue={items[0]} size={12} />
                {s.label} <span className="tabular-nums">{items.length}</span>
                <Chevron aria-hidden size={14} className="ml-auto shrink-0 text-muted-foreground" />
              </button>
            </h2>
            {open && (
              <ul>
                {items.map((n) => (
                  <Row key={keyOf(n)} issue={n} graph={graph} traced={traced} onHover={onHover} onSelect={onSelect} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}

function Row({ issue: n, graph, traced, onHover, onSelect }: { issue: Issue } & Omit<Props, "categories">) {
  const key = keyOf(n);
  const meta: string[] = [];
  const blocked = blockedByText(n, graph, (b) => refLabel(b, graph.repo));
  if (blocked) meta.push(blocked);
  if (n.assignees.length) meta.push(n.assignees.map((a) => (a === graph.viewer ? `@${a} (you)` : `@${a}`)).join(", "));
  if (n.pr) meta.push(`PR #${n.pr.number} ${n.pr.state}`);
  const dim = traced !== null && !traced.lit.has(key);
  const hot = traced?.focus === key;

  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => onHover(key)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(key)}
        className={cn("block w-full px-3 py-1.5 text-left transition-opacity hover:bg-accent", dim && "opacity-40", hot && "bg-accent")}
      >
        <span className={cn("block truncate", n.state === "closed" && "text-muted-foreground")}>
          <span className="text-muted-foreground">{refLabel(n, graph.repo)}</span> {n.title}
        </span>
        {meta.length > 0 && <span className="block truncate text-xs text-muted-foreground">{meta.join(" · ")}</span>}
      </button>
    </li>
  );
}
