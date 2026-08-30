// The local graph server. `conductor view` runs it detached; `conductor serve` runs it in the foreground.
// Read-only: it fetches from GitHub on request and hands the graph to the browser; it never writes anywhere.

import { parseArgs } from "node:util";
import { join } from "node:path";
import index from "../app/index.html";
import { type Health, type ViewModel } from "../core/schema.ts";
import { fileSource, githubSource, type Source } from "./source.ts";

export const DEFAULT_PORT = 4747;
/** Plugin package root (the directory holding package.json). */
export const ROOT = join(import.meta.dir, "..", "..");

const IDLE_MS = 10 * 60 * 1000;

export type ServeOptions = {
  port: number;
  /** Serve this saved graph for every epic instead of fetching from GitHub. */
  from?: string | undefined;
  /** Exit after IDLE_MS without a request (the detached daemon); false for the foreground dev server. */
  idle: boolean;
  /** Bun's development mode (HMR, unminified). Defaults to true unless NODE_ENV=production. */
  development?: boolean;
};

export async function serve(opts: ServeOptions) {
  const source: Source = opts.from ? fileSource(opts.from) : githubSource();
  const startedAt = new Date().toISOString();
  let lastRequest = Date.now();
  const touch = () => {
    lastRequest = Date.now();
  };

  const start = (port: number) =>
    Bun.serve({
      port,
      development: opts.development ?? process.env.NODE_ENV !== "production",
      routes: {
        "/": index,
        "/:owner/:repo/:number": index,
        "/api/health": () => {
          touch();
          const body: Health = { pid: process.pid, port: server.port ?? port, startedAt, root: ROOT };
          return Response.json(body);
        },
        "/api/epics/:owner/:repo/:number": async (req) => {
          touch();
          const { owner, repo, number } = req.params;
          const graph = await source.load({ owner, name: repo }, Number(number));
          const body: ViewModel = { graph, generatedAt: new Date().toISOString() };
          return Response.json(body);
        },
      },
      fetch: () => new Response("not found", { status: 404 }),
      error: (err) => Response.json({ error: err.message }, { status: 500 }),
    });

  let server: ReturnType<typeof start>;
  try {
    server = start(opts.port);
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "EADDRINUSE")) throw err;
    server = start(0);
  }

  if (opts.idle) {
    setInterval(() => {
      if (Date.now() - lastRequest > IDLE_MS) {
        server.stop(true);
        process.exit(0);
      }
    }, 30_000);
  }
  return server;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { port: { type: "string" }, from: { type: "string" }, idle: { type: "boolean", default: false } },
  });
  const server = await serve({
    port: values.port ? Number(values.port) : DEFAULT_PORT,
    from: values.from,
    idle: values.idle,
    development: !values.idle,
  });
  console.error(`conductor server: http://localhost:${server.port} (pid ${process.pid})`);
}
