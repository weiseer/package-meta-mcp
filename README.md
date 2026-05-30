# @weiseer/package-meta-mcp

> npm/PyPI/Cargo package metadata + downloads + maintainer health. stdio MCP server.

Part of [weiseer](https://github.com/weiseer) — AI-agent-native cached oracles.

## Install

```bash
npm install -g @weiseer/package-meta-mcp
```

## Use with Claude Desktop / Cursor / Cline / Continue / Windsurf

```json
{
  "mcpServers": {
    "package-meta": {
      "command": "npx",
      "args": ["-y", "@weiseer/package-meta-mcp"]
    }
  }
}
```

## Why use this instead of your agent doing it itself

The DIY cost in token-spend, latency, and rate-limit risk is 100-1500x our cost. See the [weiseer organization README](https://github.com/weiseer/.github) for the economic argument.

## Environment

- `PKG_META_URL` — override remote snapshot URL
- `PKG_META_LOCAL_ONLY=1` — skip remote fetch

## License

Apache-2.0
