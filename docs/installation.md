# Installation & Runtime Requirements

1.  **Node.js ≥ 18** – we rely on native `fetch`, `EventSource`, and `fs/promises`.
2.  **pnpm / npm / yarn** – whichever you prefer, MCPVals is published as an ESM‐only package.
3.  **MCP Server** – a local `stdio` binary **or** a remote Streaming-HTTP endpoint.
4.  **Anthropic API Key** – Required for workflow execution (uses Claude to drive tool calls). Set via `ANTHROPIC_API_KEY` environment variable.
5.  **(Optional) OpenAI key** – Only required if using the LLM judge feature. Set via `OPENAI_API_KEY`.

> **ESM-only**: You **cannot** `require("mcpvals")` from a CommonJS project. Either enable `"type": "module"` in your `package.json` or use dynamic `import()`.

---
