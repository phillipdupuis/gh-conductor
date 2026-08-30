// Where the server gets a graph from: GitHub (normal) or a saved graph file (`serve --from`, UI dev).

import { Graph } from "../core/schema.ts";
import { loadGraph, type Repo } from "../github/github.ts";

export type Source = { load(repo: Repo, number: number): Promise<Graph> };

export function githubSource(): Source {
  return { load: (repo, number) => loadGraph(repo, number) };
}

/** Serves the same saved graph for every epic path, re-reading the file on each request so edits show up. */
export function fileSource(path: string): Source {
  return { load: async () => Graph.parse(JSON.parse(await Bun.file(path).text())) };
}
