// PreToolUse hook: force a permission prompt for every gh-conductor CLI invocation,
// even when a Bash allowlist or acceptEdits mode would otherwise let it through.
// Zero imports so it runs before the CLI's first-run `bun install`.

const CLI_PATTERNS = [
  // `gh-conductor <subcommand>` however the binary is reached
  /(^|[\s"'/\\])gh-conductor\s+(graph|ready|status|view|serve|config)\b/,
  // the entry point by path; deliberately broad — a false match only costs an extra prompt
  /src[/\\]cli[/\\]main\.ts/,
];

let command = "";
try {
  const input = JSON.parse(await Bun.stdin.text());
  if (typeof input?.tool_input?.command === "string") command = input.tool_input.command;
} catch {
  // unparseable input: stay silent, never block unrelated tool calls
}

if (CLI_PATTERNS.some((pattern) => pattern.test(command))) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          "gh-conductor CLI call — review the exact command before approving.",
      },
    }),
  );
}
