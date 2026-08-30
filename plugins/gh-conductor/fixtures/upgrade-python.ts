// Mock epic for stress-testing the renderers: "Upgrade Python version" at a fictional data-pipeline
// SaaS (core infra + 10 customers), captured at three moments. Nothing here is real except the
// viewer's login; links go nowhere. `bun run fixtures` writes the JSON files next to this module.

import type { Blocker, Graph, IssueState, Issue, Pr } from "../src/core/schema.ts";

export type Stage = "early" | "mid" | "late";
export const STAGES: Stage[] = ["early", "mid", "late"];

const REPO = "northbeam/platform";
const VIEWER = "phillipdupuis";
const EPIC = 120;
/** Devops-sprint issue outside the epic's tree: the upgrade switches pip → uv, so no code starts until it ships. */
const UV = 57;
const UV_REPO = REPO;

const repoOf = (n: number): string => (n === UV ? UV_REPO : REPO);
const key = (n: number): string => `${repoOf(n)}#${n}`;

const CUSTOMERS = ["Halcyon Freight", "Bluefin Grocers", "Orrin Health", "Tidewater Energy", "Kestrel Media", "Marlowe Insurance", "Sable Logistics", "Pinecrest Retail", "Vantage Telecom", "Lumen Labs"];

type Spec = { number: number; title: string; parent: number; blockedBy?: number[] };

const SPECS: Spec[] = [
  { number: 121, title: "Target versions", parent: EPIC },
  { number: 122, title: "Decide: Python target version", parent: 121 },
  { number: 123, title: "Audit dependencies for compatibility with the target", parent: 121, blockedBy: [122] },
  { number: 124, title: "Decide: dependency target versions (pandas, numpy, SQLAlchemy, pyarrow)", parent: 121, blockedBy: [123] },
  { number: 125, title: "Risk & regression plan", parent: EPIC },
  { number: 126, title: "Enumerate breaking changes and risks", parent: 125, blockedBy: [121] },
  { number: 127, title: "Regression test plan: core infra", parent: 125, blockedBy: [126] },
  { number: 128, title: "Regression test plan: customer code", parent: 125, blockedBy: [126] },
  { number: 129, title: "Upgrade core infra to target versions", parent: EPIC, blockedBy: [125, UV] },
  { number: 130, title: "Customer migrations", parent: EPIC },
  ...CUSTOMERS.map((c, i) => ({ number: 131 + i, title: `Migrate ${c} to target versions`, parent: 130, blockedBy: [129] })),
  { number: 141, title: "Retire old Python runtime (base images, CI matrix, compat shims)", parent: EPIC, blockedBy: [130] },
];

const TITLES: Record<number, string> = { [EPIC]: "Upgrade Python version", [UV]: "Add uv to platform", ...Object.fromEntries(SPECS.map((s) => [s.number, s.title])) };

/** Per-issue state at each stage. Anything not listed is open, unassigned, no PR. */
type Status = { state?: IssueState; assignees?: string[]; pr?: Pr };
const me = { assignees: [VIEWER] };
const done = { state: "closed" as const };
const pr = (number: number, state: Pr["state"]): Pr => ({ number, url: `https://github.com/${REPO}/pull/${number}`, state });
const merged = (n: number) => ({ ...done, pr: pr(n, "merged") });

const STATUS: Record<Stage, Record<number, Status>> = {
  early: {
    122: { ...done, ...me },
    123: { pr: pr(310, "draft") },
    124: me,
  },
  mid: {
    [UV]: done,
    121: done,
    122: { ...done, ...me },
    123: merged(310),
    124: { ...done, ...me },
    125: done,
    126: done,
    127: merged(322),
    128: merged(323),
    129: { pr: pr(340, "review") },
  },
  late: {
    [UV]: done,
    121: done,
    122: { ...done, ...me },
    123: merged(310),
    124: { ...done, ...me },
    125: done,
    126: done,
    127: merged(322),
    128: merged(323),
    129: merged(340),
    131: merged(351),
    132: merged(352),
    133: merged(353),
    134: { pr: pr(354, "draft") },
    135: { pr: pr(355, "draft") },
    136: { pr: pr(356, "review") },
    137: me,
  },
};

/** Fixed, spread-out timestamps so the sidebar shows a mix of ages; the stage shifts them so later stages look more recent. */
const STAGE_DAY: Record<Stage, number> = { early: 3, mid: 12, late: 24 };
const updatedAt = (number: number, stage: Stage): string => {
  const day = STAGE_DAY[stage] - ((number * 7) % 5);
  return new Date(Date.UTC(2026, 7, 1 + day, (number * 13) % 24, (number * 29) % 60)).toISOString();
};

export function upgradePython(stage: Stage): Graph {
  const status = STATUS[stage];
  const stateOf = (n: number): IssueState => status[n]?.state ?? "open";
  const url = (n: number) => `https://github.com/${repoOf(n)}/issues/${n}`;
  const blocker = (n: number): Blocker => ({ repo: repoOf(n), number: n, title: TITLES[n]!, url: url(n), state: stateOf(n) });
  const depth = (s: Spec): number => (s.parent === EPIC ? 1 : 2);
  const node = (s: Spec): Issue => ({
    repo: REPO,
    number: s.number,
    title: s.title,
    url: url(s.number),
    state: stateOf(s.number),
    assignees: status[s.number]?.assignees ?? [],
    blockedBy: (s.blockedBy ?? []).map(blocker),
    pr: status[s.number]?.pr ?? null,
    parent: key(s.parent),
    depth: depth(s),
    updatedAt: updatedAt(s.number, stage),
  });
  // Depth-first in sub-issue order, as loadGraph would return it.
  const byParent = new Map<number, Spec[]>();
  for (const s of SPECS) byParent.set(s.parent, [...(byParent.get(s.parent) ?? []), s]);
  const walk = (parent: number): Issue[] => (byParent.get(parent) ?? []).flatMap((s) => [node(s), ...walk(s.number)]);
  return {
    repo: REPO,
    viewer: VIEWER,
    epic: { repo: REPO, number: EPIC, title: TITLES[EPIC]!, url: url(EPIC), state: "open", assignees: [], blockedBy: [], pr: null, parent: null, depth: 0, updatedAt: updatedAt(EPIC, stage) },
    nodes: walk(EPIC),
    related: [],
  };
}

export const fixturePath = (stage: Stage): string => `${import.meta.dir}/upgrade-python-${stage}.json`;
