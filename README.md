# gh-conductor

A project manager for coding agents, backed by GitHub Issues. Breaks a large feature into a DAG of issues (native sub-issues + "blocked by" dependencies) and keeps agents and humans pointed at the next ready step.

**Status:** alpha — expect rough edges and breaking changes.

## Install

```
/plugin marketplace add phillipdupuis/gh-conductor
/plugin install gh-conductor@gh-conductor
```

See [plugins/gh-conductor](plugins/gh-conductor/) for what the plugin provides and requires.

This marketplace also hosts [gh-conductor-channels](plugins/gh-conductor-channels/), an experimental research preview that pushes issue events into a running Claude Code session.

## License

[MIT](LICENSE)
