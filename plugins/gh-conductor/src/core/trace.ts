// Hover trace: what an issue is waiting on (upstream) and what it holds up (downstream), following
// explicit "blocked by" edges only. Containment edges light up when both ends are already lit.

import { keyOf } from "./graph.ts";
import type { Graph } from "./schema.ts";

export type Adjacency = { up: Map<string, string[]>; down: Map<string, string[]> };

export function adjacency(g: Graph): Adjacency {
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  const all = [g.root, ...g.nodes, ...g.related];
  const inGraph = new Set(all.map(keyOf));
  for (const n of all) {
    const k = keyOf(n);
    up.set(
      k,
      n.blockedBy.map(keyOf).filter((b) => inGraph.has(b)),
    );
    if (!down.has(k)) down.set(k, []);
    for (const b of n.blockedBy) {
      const bk = keyOf(b);
      if (inGraph.has(bk)) down.set(bk, [...(down.get(bk) ?? []), k]);
    }
  }
  return { up, down };
}

function closure(start: string, adj: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(adj.get(x) ?? []));
  }
  return seen;
}

export type Trace = { focus: string; up: Set<string>; down: Set<string>; lit: Set<string> };

export function trace(focus: string, adj: Adjacency): Trace {
  const up = closure(focus, adj.up);
  const down = closure(focus, adj.down);
  return { focus, up, down, lit: new Set([focus, ...up, ...down]) };
}
