# gh-conductor-channels

**Experimental — research preview.** Claude Code channels are a research preview; the protocol and flags can change under this plugin.

A Claude Code channel that watches one issue tree and pushes its changes into a running session:

- a sub-issue was closed or reopened
- someone on the allowlist commented on the issue itself

Events are one-way. Each carries a `url` attribute with the GitHub permalink; `kind="state_change"` events are the cue to run `gh-conductor status <issue>`.

Requires `bun` and `gh` on PATH, with `gh` already authenticated.

## Install

```
/plugin marketplace add phillipdupuis/gh-conductor
/plugin install gh-conductor-channels@gh-conductor
```

The plugin is not enabled by default — enable it in `/plugin`, then start Claude Code with the development-channels flag:

```
claude --dangerously-load-development-channels plugin:gh-conductor-channels@gh-conductor
```

Without that flag the server still starts, and Claude Code silently drops its notifications. Third-party channels load only behind the flag during the research preview.

## Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `GH_CONDUCTOR_CHANNEL_ISSUE` | `phillipdupuis/gh-conductor-tests#4` | Issue whose tree to watch, as `owner/repo#number` |
| `GH_CONDUCTOR_CHANNEL_INTERVAL` | `30` | Seconds between polls; values below `5` are raised to `5` |
| `GH_CONDUCTOR_CHANNEL_ALLOW` | `phillipdupuis` | Comma-separated GitHub logins whose comments become events |

Comments from anyone outside the allowlist are ignored.

## Development

```
bun install
bun test
bun run check
```
