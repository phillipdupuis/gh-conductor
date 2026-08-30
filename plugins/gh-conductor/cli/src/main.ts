#!/usr/bin/env bun
// conductor — read-only view of a gh-conductor epic. Never writes to GitHub.

import { parseArgs } from "node:util";
import { parseEpicRef } from "./args.ts";
import { toDot } from "./dot.ts";
import { categorize, readyNodes, type Graph } from "./graph.ts";
import { loadGraph, resolveRepo } from "./github.ts";
import { renderGraph, renderReady, renderStatus } from "./render.ts";
import { openPath, writeView } from "./view.ts";

const USAGE = `usage: conductor <command> <epic> [--repo owner/name] [--json]
       conductor <command> --from <graph.json>

<epic> is an issue number, #N, owner/repo#N, or a GitHub issue URL. The URL and
owner/repo#N forms set the repo; otherwise --repo, $GH_REPO, or the current directory.
--from reads a graph saved by \`conductor graph <epic> --json\` (or a fixture) instead of GitHub.

commands:
  graph   <epic>   every sub-issue with state, assignees, blockers, linked PR (--dot for Graphviz source)
  ready   <epic>   open sub-issues whose blockers are all closed (add --include-assigned to keep human-assigned ones)
  status  <epic>   ready / in progress / waiting on a human / blocked / done
  view    <epic>   write a self-contained HTML page (graph, links, what's waiting on you) and open it
                   in the browser; prints the path. --out <file> writes elsewhere, --no-open just prints.

Read-only. Requires gh (>= 2.94) authenticated for the repo.`;

async function fetchGraph(epicArg: string | undefined, repoFlag: string | undefined): Promise<Graph | null> {
  const ref = parseEpicRef(epicArg);
  if (!ref) {
    console.error(`error: expected an epic issue number or URL, got "${epicArg ?? ""}"\n\n${USAGE}`);
    return null;
  }
  const repo = await resolveRepo(ref.repo ?? repoFlag);
  return loadGraph(repo, ref.number);
}

async function readGraph(path: string): Promise<Graph> {
  const g: unknown = JSON.parse(await Bun.file(path).text());
  if (!g || typeof g !== "object" || !("epic" in g) || !Array.isArray((g as { nodes?: unknown }).nodes)) throw new Error(`${path}: not a conductor graph (expected {repo, viewer, epic, nodes})`);
  return g as Graph;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      repo: { type: "string" },
      from: { type: "string" },
      json: { type: "boolean", default: false },
      dot: { type: "boolean", default: false },
      out: { type: "string" },
      "no-open": { type: "boolean", default: false },
      "include-assigned": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [cmd, epicArg] = positionals;
  if (values.help || !cmd) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const graph = values.from ? await readGraph(values.from) : await fetchGraph(epicArg, values.repo);
  if (!graph) return 2;

  switch (cmd) {
    case "graph": {
      console.log(values.dot ? toDot(graph) : values.json ? JSON.stringify(graph, null, 2) : renderGraph(graph));
      return 0;
    }
    case "view": {
      const path = await writeView(graph, values.out);
      console.log(path);
      if (!values.out && !values["no-open"]) await openPath(path);
      return 0;
    }
    case "ready": {
      const ready = readyNodes(graph, { includeAssigned: values["include-assigned"] });
      console.log(values.json ? JSON.stringify(ready, null, 2) : renderReady(ready, graph));
      return 0;
    }
    case "status": {
      if (values.json) {
        const nodes = graph.nodes.map((n) => ({ ...n, category: categorize(n, graph) }));
        console.log(JSON.stringify({ epic: graph.epic, nodes }, null, 2));
      } else {
        console.log(renderStatus(graph));
      }
      return 0;
    }
    default:
      console.error(`error: unknown command "${cmd}"\n\n${USAGE}`);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
