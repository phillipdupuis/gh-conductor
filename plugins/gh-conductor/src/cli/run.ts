// conductor — read-only view of a gh-conductor epic. Never writes to GitHub.

import { parseArgs } from "node:util";
import { parseEpicRef } from "../core/args.ts";
import { categorize, readyNodes } from "../core/graph.ts";
import { Graph } from "../core/schema.ts";
import { loadGraph, resolveRepo, type Repo } from "../github/github.ts";
import { toDot } from "../layout/dot.ts";
import { DEFAULT_PORT, serve } from "../server/main.ts";
import { ensureServer, stopServer } from "./daemon.ts";
import { openPath } from "./open.ts";
import { renderGraph, renderReady, renderStatus } from "./render.ts";

const USAGE = `usage: conductor <command> <epic> [--repo owner/name] [--json]
       conductor <command> --from <graph.json>
       conductor serve [--port N] [--from <graph.json>] [--stop]

<epic> is an issue number, #N, owner/repo#N, or a GitHub issue URL. The URL and
owner/repo#N forms set the repo; otherwise --repo, $GH_REPO, or the current directory.
--from reads a graph saved by \`conductor graph <epic> --json\` (or a fixture) instead of GitHub.

commands:
  graph   <epic>   every sub-issue with state, assignees, blockers, linked PR (--dot for Graphviz source)
  ready   <epic>   open sub-issues whose blockers are all closed (add --include-assigned to keep human-assigned ones)
  status  <epic>   ready / in progress / waiting on a human / blocked / done
  view    <epic>   open the epic's graph in the browser (starts the local server if needed); prints the URL.
                   --no-open just prints.
  serve            run the graph server in the foreground (dev). --from serves a saved graph for any epic.
                   --stop stops the background server started by \`view\`.

Read-only. Requires gh (>= 2.94) authenticated for the repo.`;

async function resolveEpic(epicArg: string | undefined, repoFlag: string | undefined): Promise<{ repo: Repo; number: number } | null> {
  const ref = parseEpicRef(epicArg);
  if (!ref) {
    console.error(`error: expected an epic issue number or URL, got "${epicArg ?? ""}"\n\n${USAGE}`);
    return null;
  }
  return { repo: await resolveRepo(ref.repo ?? repoFlag), number: ref.number };
}

export async function readGraph(path: string): Promise<Graph> {
  return Graph.parse(JSON.parse(await Bun.file(path).text()));
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      repo: { type: "string" },
      from: { type: "string" },
      json: { type: "boolean", default: false },
      dot: { type: "boolean", default: false },
      port: { type: "string" },
      stop: { type: "boolean", default: false },
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

  if (cmd === "serve") {
    if (values.stop) {
      console.log((await stopServer()) ? "stopped" : "not running");
      return 0;
    }
    const port = values.port ? Number(values.port) : DEFAULT_PORT;
    const server = await serve({ port, from: values.from, idle: false });
    console.log(`conductor serve: http://localhost:${server.port}/${values.from ? "local/graph/0" : "<owner>/<repo>/<number>"}`);
    await new Promise(() => {}); // until Ctrl-C
    return 0;
  }

  if (cmd === "view") {
    const epic = await resolveEpic(epicArg, values.repo);
    if (!epic) return 2;
    const { port } = await ensureServer();
    const url = `http://localhost:${port}/${epic.repo.owner}/${epic.repo.name}/${epic.number}`;
    console.log(url);
    if (!values["no-open"]) await openPath(url);
    return 0;
  }

  let graph: Graph;
  if (values.from) graph = await readGraph(values.from);
  else {
    const epic = await resolveEpic(epicArg, values.repo);
    if (!epic) return 2;
    graph = await loadGraph(epic.repo, epic.number);
  }

  switch (cmd) {
    case "graph": {
      console.log(values.dot ? toDot(graph) : values.json ? JSON.stringify(graph, null, 2) : renderGraph(graph));
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
