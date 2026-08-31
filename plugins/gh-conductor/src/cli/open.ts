// Open a URL or file in the user's default browser / handler.

export async function openPath(target: string): Promise<void> {
  const cmd =
    process.platform === "darwin"
      ? ["open", target]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", target]
        : ["xdg-open", target];
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  if ((await proc.exited) !== 0)
    throw new Error(`${cmd[0]} failed: ${(await new Response(proc.stderr).text()).trim()}`);
}
