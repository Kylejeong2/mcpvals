# MCPVals – Comprehensive Usage & Reference Guide

An evaluation library for Model Context Protocol (MCP) servers. Test and validate your MCP servers with deterministic metrics, tool health suites, and optional LLM-based evaluation.

> **Status**: MVP – API **stable**, minor breaking changes possible before 1.0.0

---

## 0. Quick Start

### 1. Installation

```bash
# Install – pick your favourite package manager
pnpm add -D mcpvals            # dev-dependency is typical
```

### 2. Create a config file

Create a config file (e.g., `mcp-eval.config.ts`):

```typescript
import type { Config } from "mcpvals";

export default {
  server: {
    transport: "stdio",
    command: "node",
    args: ["./example/simple-mcp-server.js"],
  },

  // Test individual tools directly
  toolHealthSuites: [
    {
      name: "Calculator Health Tests",
      tests: [
        {
          name: "add",
          args: { a: 5, b: 3 },
          expectedResult: 8,
          maxLatency: 500,
        },
        {
          name: "divide",
          args: { a: 10, b: 0 },
          expectedError: "division by zero",
        },
      ],
    },
  ],

  // Test multi-step, LLM-driven workflows
  workflows: [
    {
      name: "Multi-step Calculation",
      steps: [
        {
          user: "Calculate (5 + 3) * 2, then divide by 4",
          expectedState: "4",
        },
      ],
      expectTools: ["add", "multiply", "divide"],
    },
  ],

  // Optional LLM judge
  llmJudge: true,
  openaiKey: process.env.OPENAI_API_KEY,
  passThreshold: 0.8,
} satisfies Config;
```

### 3. Run Evaluation

```bash
# Required for workflow execution
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional for LLM judge
export OPENAI_API_KEY="sk-..."

# Run everything
npx mcpvals eval mcp-eval.config.ts

# Run only tool health tests
npx mcpvals eval mcp-eval.config.ts --tool-health-only

# Run with LLM judge and save report
npx mcpvals eval mcp-eval.config.ts --llm-judge --reporter json > report.json
```

---

## 1. Core Concepts

MCPVals is designed to test MCP servers in two primary ways:

1.  **Tool Health Testing**: Directly calls individual tools with specific arguments to verify their correctness, performance, and error handling. This is ideal for unit testing and regression checking.
2.  **Workflow Evaluation**: Uses a large language model (LLM) to interpret natural language prompts and execute a series of tool calls to achieve a goal. This tests the integration of your tools and their usability from an LLM's perspective.

---

## 2. Installation & Runtime Requirements

1.  **Node.js ≥ 18** – we rely on native `fetch`, `EventSource`, and `fs/promises`.
2.  **pnpm / npm / yarn** – whichever you prefer, MCPVals is published as an ESM‐only package.
3.  **MCP Server** – a local `stdio` binary **or** a remote Streaming-HTTP endpoint.
4.  **Anthropic API Key** – Required for workflow execution (uses Claude to drive tool calls). Set via `ANTHROPIC_API_KEY` environment variable.
5.  **(Optional) OpenAI key** – Only required if using the LLM judge feature. Set via `OPENAI_API_KEY`.

> **ESM-only**: You **cannot** `require("mcpvals")` from a CommonJS project. Either enable `"type": "module"` in your `package.json` or use dynamic `import()`.

---

## 3. CLI Reference

```
Usage: mcpvals <command>

Commands:
  eval <config>   Evaluate MCP servers using workflows and/or tool health tests
  list <config>   List workflows in a config file
  help [command]  Show help                                [default]

Evaluation options:
  -d, --debug              Verbose logging (child-process stdout/stderr is piped)
  -r, --reporter <fmt>     console | json | junit (JUnit coming soon)
  --llm-judge              Enable LLM judge (requires llmJudge:true + key)
  --tool-health-only       Run only tool health tests, skip workflows
  --workflows-only         Run only workflows, skip tool health tests
```

### 3.1 `eval`

Runs tests specified in the config file. It will run both `toolHealthSuites` and `workflows` by default. Use flags to run only one type. Exits **0** on success or **1** on any failure – perfect for CI.

### 3.2 `list`

Static inspection – prints workflows without starting the server. Handy when iterating on test coverage.

---

## 4. Configuration

MCPVals loads **either** a `.json` file **or** a `.ts/.js` module that `export default` an object. Any string value in the config supports **Bash-style environment variable interpolation** `${VAR}`.

### 4.1 `server`

Defines how to connect to your MCP server.

- `transport`: `stdio` or `shttp` (Streaming HTTP).
- `command`/`args`: (for `stdio`) The command to execute your server.
- `env`: (for `stdio`) Environment variables to set for the child process.
- `url`/`headers`: (for `shttp`) The endpoint and headers for a remote server.

**Example `shttp` with Authentication:**

```json
{
  "server": {
    "transport": "shttp",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}",
      "X-API-Key": "${API_KEY}"
    }
  }
}
```

### 4.2 `toolHealthSuites[]`

An array of suites for testing tools directly. Each suite contains:

- `name`: Identifier for the test suite.
- `tests`: An array of individual tool tests.
- `parallel`: (boolean) Whether to run tests in the suite in parallel (default: `false`).
- `timeout`: (number) Override the global timeout for this suite.

#### Tool Test Schema

| Field            | Type      | Description                                                            |
| ---------------- | --------- | ---------------------------------------------------------------------- |
| `name`           | `string`  | Tool name to test (must match an available MCP tool).                  |
| `description`    | `string`? | What this test validates.                                              |
| `args`           | `object`  | Arguments to pass to the tool.                                         |
| `expectedResult` | `any`?    | Expected result. Uses deep equality for objects, contains for strings. |
| `expectedError`  | `string`? | Expected error message if the tool should fail.                        |
| `maxLatency`     | `number`? | Maximum acceptable latency in milliseconds.                            |
| `retries`        | `number`? | Retries on failure (0-5, default: 0).                                  |

### 4.3 `workflows[]`

An array of LLM-driven test workflows. Each workflow contains:

- `name`: Identifier for the workflow.
- `steps`: An array of user interactions (usually just one for a high-level goal).
- `expectTools`: An array of tool names expected to be called during the workflow.

#### Workflow Step Schema

| Field           | Type      | Description                                                                         |
| --------------- | --------- | ----------------------------------------------------------------------------------- |
| `user`          | `string`  | High-level user intent. The LLM will plan how to accomplish this.                   |
| `expectedState` | `string`? | A sub-string the evaluator looks for in the final assistant message or tool result. |

#### Workflow Best Practices

1.  **Write natural prompts**: Instead of micro-managing tool calls, give the LLM a complete task (e.g., "Book a flight from SF to NY for next Tuesday and then find a hotel near the airport.").
2.  **Use workflow-level `expectTools`**: List all tools you expect to be used across the entire workflow to verify the LLM's plan.

### 4.4 Global Options

- `timeout`: (number) Global timeout in ms for server startup and individual tool calls. Default: `30000`.
- `llmJudge`: (boolean) Enables the LLM Judge feature. Default: `false`.
- `openaiKey`: (string) OpenAI API key for the LLM Judge.
- `judgeModel`: (string) The model to use for judging. Default: `"gpt-4o"`.
- `passThreshold`: (number) The minimum score (0-1) from the LLM Judge to pass. Default: `0.8`.

---

## 5. Evaluation & Metrics

### 5.1 Tool Health Metrics

When running tool health tests, the following is assessed for each test:

- **Result Correctness**: Does the output match `expectedResult`?
- **Error Correctness**: If `expectedError` is set, did the tool fail with a matching error?
- **Latency**: Did the tool respond within `maxLatency`?
- **Success**: Did the tool call complete without unexpected errors?

### 5.2 Workflow Metrics (Deterministic)

For each workflow, a trace of the LLM interaction is recorded and evaluated against 3 metrics:

| #   | Metric                | Pass Criteria                                                               |
| --- | --------------------- | --------------------------------------------------------------------------- |
| 1   | End-to-End Success    | `expectedState` is found in the final response.                             |
| 2   | Tool Invocation Order | The tools listed in `expectTools` were called in the exact order specified. |
| 3   | Tool Call Health      | All tool calls completed successfully (no errors, HTTP 2xx, etc.).          |

The overall score is an arithmetic mean. The **evaluation fails** if _any_ metric fails.

### 5.3 LLM Judge (Optional)

Add subjective grading when deterministic checks are not enough (e.g., checking tone, or conversational quality).

- Set `"llmJudge": true` in the config and provide an OpenAI key.
- Use the `--llm-judge` CLI flag.

The judge asks the specified `judgeModel` for a score and a reason. A 4th metric, _LLM Judge_, is added to the workflow results, which passes if `score >= passThreshold`.

---

## 6. Library API

You can run evaluations programmatically.

```ts
import { evaluate } from "mcpvals";

const report = await evaluate("./mcp-eval.config.ts", {
  debug: process.env.CI === undefined,
  reporter: "json",
  llmJudge: true,
});

if (!report.passed) {
  process.exit(1);
}
```

### 7.1 Re-exported Types

The library exports all configuration and result types for use in TypeScript projects:

- `Config`, `Workflow`, `WorkflowStep`, `ToolTest`, `ToolHealthSuite`
- `EvaluationReport`, `WorkflowEvaluation`, `EvaluationResult`
- `ToolHealthResult`, `ToolTestResult`
- `runLlmJudge`, `LlmJudgeResult`

---

## 8. Extensibility & Troubleshooting

- **Custom Reporters**: Import `ConsoleReporter` for reference and implement your own `.report()` method.
- **Server Hangs**: Increase the `timeout` value in your config. Ensure your server writes MCP messages to `stdout`.
- **LLM Judge Fails**: Use `--debug` to inspect the raw model output for malformed JSON.

---

## 9. Roadmap

- [ ] JUnit reporter
- [ ] Output-schema validation for tool calls
- [ ] Parallel workflow execution
- [ ] Web dashboard for replaying traces
- [ ] Configurable `expectTools` strictness (e.g., allow extra or unordered calls)

---

## 10. Acknowledgements

- [Model Context Protocol](https://modelcontextprotoco.lol) – for the SDK
- [Vercel AI SDK](https://sdk.vercel.ai) – for LLM integration
- [chalk](https://github.com/chalk/chalk) – for terminal colors

Enjoy testing your MCP servers – PRs, issues & feedback welcome! ✨
