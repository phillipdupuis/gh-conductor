// Accept an issue as a bare number, "#N", "owner/repo#N", or a GitHub issue URL.

export type IssueRef = { number: number; repo?: string };

export function parseIssueRef(arg: string | undefined): IssueRef | null {
  if (!arg) return null;
  const s = arg.trim();
  const url = s.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:[/?#].*)?$/);
  if (url) return { repo: `${url[1]}/${url[2]}`, number: Number(url[3]) };
  const short = s.match(/^([^/\s#]+\/[^/\s#]+)#(\d+)$/);
  if (short) return { repo: short[1], number: Number(short[2]) };
  const bare = s.match(/^#?(\d+)$/);
  if (bare) return { number: Number(bare[1]) };
  return null;
}
