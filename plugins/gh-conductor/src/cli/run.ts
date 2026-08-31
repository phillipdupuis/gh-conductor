// gh-conductor — read-only view of an issue. Never writes to GitHub.

import { parseArgs } from "node:util";
import { parseIssueRef } from "../core/args.ts";
import { PRECEDENCE_NOTE, type SettingKey, effectiveConfig, settingKeys } from "../core/config.ts";
import { findConfigPath, loadConfigFile, setSetting } from "./config.ts";
import { categorize, readyNodes } from "../core/graph.ts";
import { Graph, type Issue } from "../core/schema.ts";
import { loadGraph, resolveRepo, type Repo } from "../github/github.ts";
import { toDot } from "../layout/dot.ts";
import { DEFAULT_PORT, serve } from "../server/main.ts";
import { ensureServer, stopServer } from "./daemon.ts";
import { openPath } from "./open.ts";
import { renderGraph, renderReady, renderStatus } from "./render.ts";

const USAGE = `usage: gh-conductor <command> <issue> [--repo owner/name] [--json]
       gh-conductor <command> --from <graph.json>
       gh-conductor serve [--port N] [--from <graph.json>] [--stop]
       gh-conductor config [set <key> <value> [--confirmed]]

<issue> is an issue number, #N, owner/repo#N, or a GitHub issue URL. The URL and
owner/repo#N forms set the repo; otherwise --repo, $GH_REPO, or the current directory.
--from reads a graph saved by \`gh-conductor graph <issue> --json\` (or a fixture) instead of GitHub.

commands:
  graph   <issue>  every sub-issue, plus the issues one blocked-by hop away, with state, assignees,
                   blockers and linked PR (--dot for Graphviz source)
  ready   <issue>  open sub-issues whose blockers are all closed (add --include-assigned to keep human-assigned ones)
  status  <issue>  ready / in progress / in review / assigned / blocked / done
  view    <issue>  open the issue's graph in the browser (starts the local server if needed); prints the URL.
                   --no-open just prints.
  serve            run the graph server in the foreground (dev). --from serves a saved graph for any issue.
                   --stop stops the background server started by \`view\`.
  config           effective preferences and where each came from (--json for machines)
  config set <key> <value>
                   record a preference in the workspace .gh-conductor.toml. --confirmed marks it as
                   agent-inferred and user-confirmed rather than stated outright by the user.

Never writes to GitHub (\`config set\` writes only the local .gh-conductor.toml).
Requires gh (>= 2.94) authenticated for the repo.`;

async function resolveIssue(issueArg: string | undefined, repoFlag: string | undefined): Promise<{ repo: Repo; number: number } | null> {
  const ref = parseIssueRef(issueArg);
  if (!ref) {
    console.error(`error: expected an issue number or URL, got "${issueArg ?? ""}"\n\n${USAGE}`);
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
      confirmed: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [cmd, issueArg] = positionals;
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
    console.log(`gh-conductor serve: http://localhost:${server.port}/${values.from ? "local/graph/0" : "<owner>/<repo>/<number>"}`);
    await new Promise(() => {}); // until Ctrl-C
    return 0;
  }

  if (cmd === "view") {
    const issue = await resolveIssue(issueArg, values.repo);
    if (!issue) return 2;
    const { port } = await ensureServer();
    const url = `http://localhost:${port}/${issue.repo.owner}/${issue.repo.name}/${issue.number}`;
    console.log(url);
    if (!values["no-open"]) await openPath(url);
    return 0;
  }

  if (cmd === "config") {
    const [, sub, key, value] = positionals;
    if (sub === "set") {
      if (!key || value === undefined || !settingKeys.includes(key as SettingKey)) {
        console.error(`error: expected \`config set <key> <value>\` with key one of: ${settingKeys.join(", ")}\n\n${USAGE}`);
        return 2;
      }
      const result = await setSetting(key as SettingKey, value, values.confirmed ? "confirmed" : "stated");
      if ("error" in result) {
        console.error(`error: ${result.error}`);
        return 2;
      }
      console.log(`${key} = ${JSON.stringify(result.value)} (${result.path})`);
      return 0;
    }
    if (sub !== undefined) {
      console.error(`error: unknown config subcommand "${sub}"\n\n${USAGE}`);
      return 2;
    }
    const path = await findConfigPath();
    const settings = effectiveConfig(path ? await loadConfigFile(path) : null);
    if (values.json) {
      console.log(JSON.stringify({ path, settings, note: PRECEDENCE_NOTE }, null, 2));
    } else {
      console.log(path ?? "no .gh-conductor.toml found — defaults in effect");
      for (const s of settings) {
        const origin = s.source === "default" ? "default" : `workspace, ${s.provenance}`;
        console.log(`  ${s.key} = ${JSON.stringify(s.value)}  (${origin})  ${s.description}`);
      }
    }
    return 0;
  }

  let graph: Graph;
  if (values.from) graph = await readGraph(values.from);
  else {
    const issue = await resolveIssue(issueArg, values.repo);
    if (!issue) return 2;
    graph = await loadGraph(issue.repo, issue.number);
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
        const withCategory = (ns: Issue[]) => ns.map((n) => ({ ...n, category: categorize(n, graph) }));
        console.log(JSON.stringify({ root: graph.root, nodes: withCategory(graph.nodes), related: withCategory(graph.related) }, null, 2));
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
