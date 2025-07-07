# MCPVals – Comprehensive Usage & Reference Guide

> **Status**: MVP – API **stable**, minor breaking changes possible before 1.0.0
>
> This document supersedes `docs/usage-guide.md` and aggregates information that was previously scattered across the spec, summary, and plan documents.

---

## 0. Quick Start (TL;DR)

```bash
# Install – pick your favourite package manager
pnpm add -D mcpvals            # dev-dependency is typical

# Generate an example config (helper coming soon)
cp example/simple-server-eval.config.json mcp-eval.config.json

# Run deterministic evaluation
npx mcpvals eval mcp-eval.config.json --debug
```

Need human-style grading? Add the `--llm` flag **and** an `openaiKey` in the config (or `OPENAI_API_KEY` env-var).

```bash
npx mcpvals eval mcp-eval.config.json --llm --reporter json > report.json
```

---

## 1. Installation & Runtime Requirements

1. **Node.js ≥ 18** – we rely on native `fetch`, `EventSource`, and `fs/promises`.
2. **pnpm / npm / yarn** – whichever you prefer, MCPVals is published as an ESM‐only package.
3. **MCP Server** – local `stdio` binary **or** remote Streaming-HTTP endpoint.
4. **Anthropic API Key** – Required for workflow execution (uses Claude to drive tool calls). Set via `ANTHROPIC_API_KEY` environment variable.
5. **(Optional) OpenAI key** – Only required if using the LLM judge feature.

> Caveat: ESM-only means you **cannot** `require("mcpvals")` from a CommonJS project. Either enable `"type": "module"` or use dynamic `import()`.

### Setting up API Keys

```bash
# Required for basic evaluation
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional for LLM judge
export OPENAI_API_KEY="sk-..."
```

---

## 2. CLI Reference

```
Usage: mcpvals <command>

Commands:
  eval <config>   Evaluate MCP servers against test workflows
  list <config>   List workflows in a config file
  help [command]  Show help                                [default]

Evaluation options:
  -d, --debug           Verbose logging (child-process stdout/stderr is piped)
  -r, --reporter <fmt>  console | json | junit (JUnit coming soon)
  --llm                 Enable LLM judge (requires llmJudge:true + key)
```

### 2.1 `eval`

Runs one or more workflows and exits **0** on success or **1** on any failure – perfect for CI.

### 2.2 `list`

Static inspection – prints workflows without starting the server. Handy when iterating on test coverage.

---

## 3. Configuration Schema (JSON/TOML/TS)

MCPVals loads **either** a `.json` file **or** a `.ts/.js` module that `export default` an object. Any string value supports **Bash-style env interpolation** `${VAR}`.

```ts
// Minimal example (TypeScript syntax shown)
export default {
  server: {
    transport: "stdio", // "stdio" | "shttp"
    command: "node", // replaced with process.execPath for portability
    args: ["./server.js"],
    env: { DEBUG: "true" }, // merged with parent process.env
  },
  workflows: [
    {
      name: "happy-path",
      steps: [
        {
          user: "What is 2 + 2?",
          expectTools: ["calculate"],
          expectedState: "4",
        },
      ],
    },
  ],
  // Optional section
  timeout: 30000, // ms – applies to server startup & tool calls
  llmJudge: false,
  openaiKey: process.env.OPENAI_API_KEY,
  judgeModel: "gpt-4o", // any model string your provider accepts
  passThreshold: 0.8,
} satisfies import("mcpvals").Config;
```

### 3.1 `server`

- `transport`: `stdio` or `shttp` (Streaming HTTP). Future: `ws`.
- `command`/`args`: only for `stdio`. If `command === "node"` we auto-swap in `process.execPath` so that nvm/npm wrappers don't break when the lib is executed under a different Node version.
- `env`: merged into the child process. **Undefined** values are filtered – keeps shells happy.
- `url`/`headers`: only for `shttp`. Headers support environment variable interpolation (e.g., `"Authorization": "Bearer ${API_TOKEN}"`).

#### Authentication Headers Example:

```json
{
  "server": {
    "transport": "shttp",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}",
      "X-API-Key": "${API_KEY}",
      "Content-Type": "application/json",
      "Accept": "text/event-stream, application/json"
    }
  }
}
```

### 3.2 `workflows[]`

Each workflow contains:

- `name`: Identifier for the workflow
- `description`: Optional description
- `steps`: Array of user interactions
- `expectTools`: Optional array of expected tools for the entire workflow

#### Step Schema

| Field           | Type        | Description                                                                                  |
| --------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `user`          | `string`    | High-level user intent - the LLM will plan how to accomplish this                            |
| `expectTools`   | `string[]`? | (Deprecated) Use workflow-level `expectTools` instead                                        |
| `expectedState` | `string`?   | Sub-string the evaluator looks for in the **last assistant message** OR **last tool result** |

#### Best Practices

1. **Write natural prompts**: Instead of micro-managing each tool call, give the LLM a complete task
2. **Use workflow-level `expectTools`**: List all tools you expect to be used across the entire workflow
3. **One step per user intent**: Each step should represent a complete user request, not individual actions

**Before (micro-managed):**

```json
{
  "steps": [
    { "user": "Add 5 and 3", "expectTools": ["add"] },
    { "user": "Multiply by 2", "expectTools": ["multiply"] }
  ]
}
```

**After (LLM-driven):**

```json
{
  "steps": [{ "user": "Calculate (5 + 3) * 2" }],
  "expectTools": ["add", "multiply"]
}
```

### 3.3 Timeouts

The `timeout` field cascades to:

1. Server startup
2. Each individual tool call via MCP SDK (future – fine-grain per-tool override)

---

## 4. How MCPVals Works

### Execution Flow

1. **Configuration Loading**: Parses your test config (JSON/TS)
2. **Server Startup**: Launches MCP server (stdio process or connects to HTTP endpoint)
3. **LLM-Driven Execution**:
   - Claude receives high-level user prompts from your config
   - Claude examines available MCP tools
   - Claude autonomously plans and executes tool calls
   - All interactions are recorded in TraceStore
4. **Deterministic Evaluation**: The recorded trace is evaluated against your expectations
5. **Optional LLM Judge**: GPT-4 can provide qualitative assessment
6. **Reporting**: Results are formatted and output

### Why LLM-Driven?

Traditional test frameworks require scripting exact tool sequences. MCPVals instead:

- **Tests real-world usage**: LLMs will be the primary consumers of MCP servers
- **Discovers edge cases**: The LLM might find unexpected ways to accomplish tasks
- **Reduces test maintenance**: Natural language prompts are more stable than rigid scripts
- **Validates tool descriptions**: Tests whether your tools are discoverable and usable

## 5. Deterministic Metrics (0-1 scale)

| #   | Metric                | Pass Criteria                                                  |
| --- | --------------------- | -------------------------------------------------------------- |
| 1   | End-to-End Success    | `expectedState` satisfied                                      |
| 2   | Tool Invocation Order | `expectTools` matched _exactly_                                |
| 3   | Tool Call Health      | All tool calls return ➜ no exception, `HTTP 2xx`, schema-valid |

Overall score = arithmetic mean. The **evaluation fails** if _any_ metric fails.

### 4.1 Tool Result Validation

We don't yet validate against the server-declared _output_ schema – PRs welcome. We **do** record HTTP status codes and surfaced errors, so you still get decent coverage.

---

## 6. LLM Judge (Optional)

Add subjective grading when deterministic checks are not enough (e.g. tone, completeness).

```jsonc
{
  "llmJudge": true,
  "openaiKey": "${OPENAI_API_KEY}",
  "judgeModel": "gpt-4o",
  "passThreshold": 0.75,
}
```

CLI flag `--llm` must also be supplied. The judge:

1. Serialises the last **N=20** messages (configurable soon) + tool calls.
2. Asks the model for `{ score: 0-1, reason: string }`.
3. Adds a 4th metric _LLM Judge_ with `passed = score ≥ passThreshold`.

> Caveat: If the model returns invalid JSON we treat it as **0 score** but _do not_ crash the run – deterministic metrics still report.

> **Cost control**: limit messages, set low `maxTokens (512)`, and `temperature 0.1` for reproducibility.

---

## 7. Library API

```ts
import { evaluate } from "mcpvals";

const { passed, evaluations } = await evaluate("./mcp-eval.config.json", {
  debug: process.env.CI === undefined,
  reporter: "json",
  llmJudge: true,
});

if (!passed) process.exit(1);
```

### 7.1 Types

Re-exported for convenience:

- `Config`, `Workflow`, `WorkflowStep`
- `WorkflowEvaluation`, `EvaluationResult`
- `runLlmJudge`, `LlmJudgeResult`

---

## 8. Reporter Outputs

1. **console** – coloured, human-friendly (see screenshot below).
2. **json** – full `EvaluationReport` object.
3. **junit** – _planned_. 👍 PRs welcome!

---

## 9. Extensibility

| Surface            | How                                                                            |
| ------------------ | ------------------------------------------------------------------------------ |
| Custom reporter    | import `ConsoleReporter` for reference; implement `.report(evaluations)`.      |
| Additional metrics | Extend `DeterministicEvaluator` or plug a post-processor.                      |
| New transports     | `ServerRunner.start*` is discriminated on `server.transport`. Add a `ws` case. |
| Fine-grained args  | The LLM now determines tool arguments based on the user prompt                 |

---

## 10. Security Checklist

MCPVals itself is "just" an evaluator, but you still spawn arbitrary child processes or hit remote URLs. We therefore:

1. **Merge** but never override _existing_ env vars with `undefined`.
2. **No secret logging** – we redact `openaiKey` in debug output.
3. Child processes inherit **no TTY** and can be sandboxed by your CI.
4. When `transport === "stdio"` you can pass `--env NETWORK=0` to your server to disable outbound traffic.

---

## 11. Troubleshooting

| Symptom                            | Fix                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `Expected tool "foo" not found`    | Check `list` output – spelling matters (case-sensitive).                         |
| Server starts then evaluator hangs | Increase `timeout`; ensure server writes to **stdout** for MCP messages.         |
| LLM judge always 0                 | Invalid JSON – print `--debug` to inspect raw model output.                      |
| CLI exits 1 but console shows ✓    | JSON reporter enabled in CI? Ensure you parse `overallScore` not just metric #1. |

---

## 12. Roadmap

- [ ] JUnit reporter
- [ ] Output-schema validation
- [ ] Parallel workflow execution
- [ ] Web dashboard (replay traces)
- [ ] Configurable `expectTools` strictness (allow extra / unordered)

---

## 13. Acknowledgements

- [Model Context Protocol](https://modelcontextprotoco.lol) – for the SDK
- [Vercel AI SDK](https://sdk.vercel.ai) – for LLM integration
- [chalk](https://github.com/chalk/chalk) – pretty colours

Enjoy testing your MCP servers – PRs, issues & feedback welcome! ✨
