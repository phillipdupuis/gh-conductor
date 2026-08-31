# gh-conductor-channels

**Experimental — research preview.** Claude Code channels are a research preview; the protocol and flags can change under this plugin.

A Claude Code channel that watches issue trees and pushes their changes into a running session:

- a sub-issue was closed or reopened
- someone on the allowlist commented on a watched issue

Events are one-way. Each carries a `url` attribute with the GitHub permalink and a `root` attribute naming the tree it came from; `kind="state_change"` events are the cue to run `gh-conductor status <root>`.

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

## Subscribing

Nothing is watched until you say so. The server exposes one tool:

| Tool | Argument | Effect |
| --- | --- | --- |
| `subscribe` | `issues`: list of `owner/repo#number` | Replaces the watched set; an empty list stops watching everything |

The list is all-or-nothing: if any reference is malformed the call is rejected and the watched set is unchanged. Trees that stay keep their history, so nothing re-fires; a newly added tree establishes its baseline on its next poll and emits only what changes afterwards.

Until `subscribe` is called (or `GH_CONDUCTOR_CHANNEL_ISSUE` seeds a tree at startup) the server sits idle and emits nothing.

## Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `GH_CONDUCTOR_CHANNEL_ISSUE` | none | Optional initial subscription, as `owner/repo#number`. A malformed value exits with an error |
| `GH_CONDUCTOR_CHANNEL_INTERVAL` | `30` | Seconds between polls; values below `5` are raised to `5` |
| `GH_CONDUCTOR_CHANNEL_ALLOW` | the `gh`-authenticated user | Comma-separated GitHub logins whose comments become events |

Comments from anyone outside the allowlist are ignored. When `GH_CONDUCTOR_CHANNEL_ALLOW` is unset the login comes from `gh api user`; if that call fails the server retries on each poll and drops comments meanwhile, while sub-issue state changes keep flowing.

## Development

```
bun install
bun test
bun run check
```
