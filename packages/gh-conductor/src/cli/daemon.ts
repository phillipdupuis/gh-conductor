// Lifecycle of the background server that `gh-conductor view` uses. One server per machine, on a fixed
// port when it's free; state in $TMPDIR so a second `view` reuses it. Restarted when the plugin's
// source is newer than the running process, and it exits by itself after ten idle minutes.

import { existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Health } from "../core/schema.ts";
import { DEFAULT_PORT, ROOT } from "./paths.ts";

const DIR = join(tmpdir(), "gh-conductor");
const STATE = join(DIR, "server.json");
const LOG = join(DIR, "server.log");

type State = { pid: number; port: number };

async function readState(): Promise<State | null> {
  try {
    const s = (await Bun.file(STATE).json()) as State;
    return typeof s.pid === "number" && typeof s.port === "number" ? s : null;
  } catch {
    return null;
  }
}

async function health(port: number): Promise<Health | null> {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok ? Health.parse(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Newest mtime of what the server is built from — the daemon is stale if it started before this. */
function sourceMtime(): number {
  // From source, every file under src/ counts; from the bundle there is only the one file.
  if (!existsSync(join(ROOT, "src"))) return statSync(Bun.main).mtimeMs;
  let newest = 0;
  for (const rel of new Bun.Glob("src/**/*.{ts,tsx,css,html}").scanSync({ cwd: ROOT })) {
    newest = Math.max(newest, statSync(join(ROOT, rel)).mtimeMs);
  }
  return newest;
}

function kill(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
}

export async function ensureServer(): Promise<{ port: number; started: boolean }> {
  const st = await readState();
  if (st) {
    const h = await health(st.port);
    if (h && h.pid === st.pid && h.root === ROOT && Date.parse(h.startedAt) >= sourceMtime())
      return { port: st.port, started: false };
    if (h) kill(h.pid);
    else kill(st.pid);
  }

  mkdirSync(DIR, { recursive: true });
  await Bun.write(LOG, ""); // Bun.file() as stdio needs the file to exist
  const log = Bun.file(LOG);
  const proc = Bun.spawn(
    [process.execPath, Bun.main, "serve", "--idle", "--port", String(DEFAULT_PORT)],
    {
      cwd: ROOT,
      stdin: "ignore",
      stdout: log,
      stderr: log,
      detached: true,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "production" },
    },
  );
  proc.unref();

  // The server may have fallen back to a random port; the health endpoint tells us which.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const port of [DEFAULT_PORT]) {
      const h = await health(port);
      if (h && h.pid === proc.pid) {
        await Bun.write(STATE, JSON.stringify({ pid: h.pid, port: h.port }));
        return { port: h.port, started: true };
      }
    }
    const logged = existsSync(LOG)
      ? (await log.text()).match(/http:\/\/localhost:(\d+) \(pid (\d+)\)/g)?.at(-1)
      : undefined;
    const m = logged?.match(/localhost:(\d+) \(pid (\d+)\)/);
    if (m && Number(m[2]) === proc.pid) {
      const port = Number(m[1]);
      const h = await health(port);
      if (h) {
        await Bun.write(STATE, JSON.stringify({ pid: h.pid, port: h.port }));
        return { port: h.port, started: true };
      }
    }
    await Bun.sleep(200);
  }
  throw new Error(`server did not come up within 15s — see ${LOG}`);
}

export async function stopServer(): Promise<boolean> {
  const st = await readState();
  if (!st) return false;
  const h = await health(st.port);
  kill(h?.pid ?? st.pid);
  try {
    await Bun.file(STATE).delete();
  } catch {
    // fine
  }
  return h !== null;
}
