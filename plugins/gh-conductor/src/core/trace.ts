// Hover trace: what an issue is waiting on (upstream) and what it holds up (downstream), following
// explicit "blocked by" edges only. Containment edges light up when both ends are already lit.

import type { Graph } from "./schema.ts";

export type Adjacency = { up: Map<number, number[]>; down: Map<number, number[]> };

export function adjacency(g: Graph): Adjacency {
  const up = new Map<number, number[]>();
  const down = new Map<number, number[]>();
  const inGraph = new Set([g.epic.number, ...g.nodes.map((n) => n.number)]);
  for (const n of [g.epic, ...g.nodes]) {
    up.set(n.number, n.blockedBy.map((b) => b.number).filter((b) => inGraph.has(b)));
    if (!down.has(n.number)) down.set(n.number, []);
    for (const b of n.blockedBy) if (inGraph.has(b.number)) down.set(b.number, [...(down.get(b.number) ?? []), n.number]);
  }
  return { up, down };
}

function closure(start: number, adj: Map<number, number[]>): Set<number> {
  const seen = new Set<number>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(adj.get(x) ?? []));
  }
  return seen;
}

export type Trace = { focus: number; up: Set<number>; down: Set<number>; lit: Set<number> };

export function trace(focus: number, adj: Adjacency): Trace {
  const up = closure(focus, adj.up);
  const down = closure(focus, adj.down);
  return { focus, up, down, lit: new Set([focus, ...up, ...down]) };
}
