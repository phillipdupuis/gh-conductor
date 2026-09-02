// The browser side of the server's API. Every response is parsed with the shared schema, so a
// server/client mismatch fails loudly here instead of somewhere in a component.

import { Health, ViewModel } from "../core/schema.ts";

export type IssuePath = { owner: string; repo: string; number: number };

/** Raw route params → IssuePath; `false` rejects the match (router falls through to not-found). */
export function parseIssueParams(p: {
  owner: string;
  repo: string;
  number: string;
}): IssuePath | false {
  if (!/^\d+$/.test(p.number)) return false;
  return { owner: p.owner, repo: p.repo, number: Number(p.number) };
}

export async function fetchView(p: IssuePath): Promise<ViewModel> {
  const res = await fetch(
    `/api/issues/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.repo)}/${p.number}`,
  );
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
