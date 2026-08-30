// I/O for `conductor view`: run Graphviz (vendored WASM) under bun, write the page, open it.

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { instance } from "../vendor/viz.mjs";
import { toDot } from "./dot.ts";
import { type Graph } from "./graph.ts";
import { renderHtml } from "./html.ts";

/** DOT → SVG, without the XML prolog/DOCTYPE so it can be inlined into HTML. */
export async function renderSvg(dot: string): Promise<string> {
  const viz = await instance();
  const svg = viz.renderString(dot, { format: "svg" });
  return svg.slice(svg.indexOf("<svg"));
}

/** Stable per-epic path: re-running overwrites, so an open browser tab just reloads. */
export function defaultViewPath(g: Graph): string {
  return join(tmpdir(), "gh-conductor", `${g.repo.replace("/", "__")}__${g.epic.number}.html`);
}

export async function buildView(g: Graph): Promise<string> {
  return renderHtml(g, await renderSvg(toDot(g)));
}

export async function writeView(g: Graph, out?: string): Promise<string> {
  const path = out ?? defaultViewPath(g);
  await mkdir(join(path, ".."), { recursive: true });
  await Bun.write(path, await buildView(g));
  return path;
}

export async function openPath(path: string): Promise<void> {
  const cmd = process.platform === "darwin" ? ["open", path] : process.platform === "win32" ? ["cmd", "/c", "start", "", path] : ["xdg-open", path];
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed: ${(await new Response(proc.stderr).text()).trim()}`);
}
