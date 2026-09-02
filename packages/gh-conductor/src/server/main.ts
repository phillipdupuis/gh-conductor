// The local graph server. `gh-conductor view` runs it detached; `gh-conductor serve` runs it in the foreground.
// Read-only: it fetches from GitHub on request and hands the graph to the browser; it never writes anywhere.

import { resolve } from "node:path";
import index from "../app/index.html";
import { BUNDLE_DIR, ROOT } from "../cli/paths.ts";
import { type Health, type ViewModel } from "../core/schema.ts";
import { fileSource, githubSource, type Source } from "./source.ts";

const IDLE_MS = 10 * 60 * 1000;

export type ServeOptions = {
  port: number;
  /** Serve this saved graph for every issue instead of fetching from GitHub. */
  from?: string | undefined;
  /** Exit after IDLE_MS without a request (the detached daemon); false for the foreground dev server. */
  idle: boolean;
  /** Bun's development mode (HMR, browser console forwarding). Off unless `serve --dev`. */
  development?: boolean | { hmr?: boolean; console?: boolean };
};

export async function serve(opts: ServeOptions) {
  const from = opts.from ? resolve(opts.from) : undefined;
  // Bun's bundled-HTML manifest names its assets relative to the process cwd, so run from dist/.
  // `from` is resolved first, while the caller's cwd still applies.
  if (BUNDLE_DIR) process.chdir(BUNDLE_DIR);

  const source: Source = from ? fileSource(from) : githubSource();
  const startedAt = new Date().toISOString();
  let lastRequest = Date.now();
  const touch = () => {
    lastRequest = Date.now();
  };

  const start = (port: number) =>
    Bun.serve({
      port,
      development: opts.development ?? false,
      routes: {
        "/": index,
        "/:owner/:repo/:number": index,
        "/api/health": () => {
          touch();
          const body: Health = {
            pid: process.pid,
            port: server.port ?? port,
            startedAt,
            root: ROOT,
          };
          return Response.json(body);
        },
        "/api/issues/:owner/:repo/:number": async (req) => {
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
