// The browser side of the server's API. Every response is parsed with the shared schema, so a
// server/client mismatch fails loudly here instead of somewhere in a component.

import { Health, ViewModel } from "../core/schema.ts";

export type EpicPath = { owner: string; repo: string; number: number };

/** `/owner/repo/123` → parts; anything else → null. */
export function parseEpicPath(pathname: string): EpicPath | null {
  const m = pathname.match(/^\/([^/]+)\/([^/]+)\/(\d+)\/?$/);
  return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]) } : null;
}

export async function fetchView(p: EpicPath): Promise<ViewModel> {
  const res = await fetch(`/api/epics/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.repo)}/${p.number}`);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return ViewModel.parse(await res.json());
}

/** Keeps the background server alive while a tab is open (it exits after ten idle minutes). */
export async function ping(): Promise<Health | null> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? Health.parse(await res.json()) : null;
  } catch {
    return null;
  }
}
