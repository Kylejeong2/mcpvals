# MCPVals

A comprehensive evaluation library for Model Context Protocol (MCP) servers. Test and validate your MCP servers with complete MCP specification coverage including Tools with deterministic metrics, security validation, and optional LLM-based evaluation.

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

MCPVals provides comprehensive testing for all MCP specification primitives:

1.  **Tool Health Testing**: Directly calls individual tools with specific arguments to verify their correctness, performance, and error handling. This is ideal for unit testing and regression checking.

2.  **Workflow Evaluation**: Uses a large language model (LLM) to interpret natural language prompts and execute a series of tool calls to achieve a goal. This tests the integration of your MCP primitives from an LLM's perspective.

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
  --tool-health-only       Run only tool health tests, skip others
  --workflows-only         Run only workflows, skip other test types
```

### 3.1 `eval`

Runs tests specified in the config file. It will run all configured test types (`toolHealthSuites` and `workflows`) by default. Use flags to run only specific types. Exits **0** on success or **1** on any failure – perfect for CI.

### 3.2 `list`

Static inspection – prints workflows without starting the server. Handy when iterating on test coverage.

---

## 4. Configuration

MCPVals loads **either** a `.json` file **or** a `.ts/.js` module that `export default` an object. Any string value in the config supports **Bash-style environment variable interpolation** `${VAR}`.

### 4.1 `server`

Defines how to connect to your MCP server.

- `transport`: `stdio`, `shttp` (Streaming HTTP), or `sse` (Server-Sent Events).
- `command`/`args`: (for `stdio`) The command to execute your server.
- `env`: (for `stdio`) Environment variables to set for the child process.
- `url`/`headers`: (for `shttp` and `sse`) The endpoint and headers for a remote server.
- `reconnect`/`reconnectInterval`/`maxReconnectAttempts`: (for `sse`) Reconnection settings for SSE connections.

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

**Example `sse` with Reconnection:**

```json
{
  "server": {
    "transport": "sse",
    "url": "https://api.example.com/mcp/sse",
    "headers": {
      "Accept": "text/event-stream",
      "Cache-Control": "no-cache",
      "Authorization": "Bearer ${API_TOKEN}"
    },
    "reconnect": true,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10
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

### 5.7 LLM Judge (Optional)

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

## 7. Vitest Integration

MCPVals provides a complete **Vitest integration** for writing MCP server tests using the popular Vitest testing framework. This integration offers both individual test utilities and comprehensive evaluation suites with built-in scoring and custom matchers.

### 7.1 Quick Start

```bash
# Install vitest alongside mcpvals
pnpm add -D mcpvals vitest
```

```typescript
// tests/calculator.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupMCPServer,
  teardownMCPServer,
  mcpTest,
  describeEval,
  ToolCallScorer,
  LatencyScorer,
  ContentScorer,
} from "mcpvals";

describe("Calculator MCP Server", () => {
  beforeAll(async () => {
    await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["./calculator-server.js"],
    });
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  // Individual test
  mcpTest("should add numbers", async (utils) => {
    const result = await utils.callTool("add", { a: 5, b: 3 });
    expect(result.content[0].text).toBe("8");

    // Custom matchers
    await expect(result).toCallTool("add");
    await expect(result).toHaveLatencyBelow(1000);
  });
});
```

### 7.2 Core Functions

#### **`setupMCPServer(config, options?)`**

Starts an MCP server and returns utilities for testing.

```typescript
const utils = await setupMCPServer(
  {
    transport: "stdio",
    command: "node",
    args: ["./server.js"],
  },
  {
    timeout: 30000, // Server startup timeout
    debug: false, // Enable debug logging
  },
);

// Returns utility functions:
utils.callTool(name, args); // Call MCP tools
utils.runWorkflow(steps); // Execute LLM workflows
```

#### **`teardownMCPServer()`**

Cleanly shuts down the MCP server (call in `afterAll`).

#### **`mcpTest(name, testFn, timeout?)`**

Convenient wrapper for individual MCP tests.

```typescript
mcpTest(
  "tool test",
  async (utils) => {
    const result = await utils.callTool("echo", { message: "hello" });
    expect(result).toBeDefined();
  },
  10000,
); // Optional timeout
```

#### **`describeEval(config)`**

Comprehensive evaluation suite with automated scoring.

```typescript
describeEval({
  name: "Calculator Evaluation",
  server: { transport: "stdio", command: "node", args: ["./calc.js"] },
  threshold: 0.8, // 80% score required to pass

  data: async () => [
    {
      input: { operation: "add", a: 5, b: 3 },
      expected: { result: "8", tools: ["add"] },
    },
  ],

  task: async (input, context) => {
    const result = await context.utils.callTool(input.operation, {
      a: input.a,
      b: input.b,
    });
    return {
      result: result.content[0].text,
      toolCalls: [{ name: input.operation }],
      latency: Date.now() - startTime,
    };
  },

  scorers: [
    new ToolCallScorer({ expectedOrder: true }),
    new LatencyScorer({ maxLatencyMs: 1000 }),
    new ContentScorer({ patterns: [/\d+/] }),
  ],
});
```

### 7.3 Built-in Scorers

Scorers automatically evaluate different aspects of MCP server behavior, returning scores from 0-1.

#### **`ToolCallScorer`** - Tool Usage Evaluation

```typescript
new ToolCallScorer({
  expectedTools: ["add", "multiply"], // Tools that should be called
  expectedOrder: true, // Whether order matters
  allowExtraTools: false, // Penalize unexpected tools
});
```

**Scoring Algorithm:**

- 70% for calling expected tools
- 20% for correct order (if enabled)
- 10% penalty for extra tools (if disabled)

#### **`LatencyScorer`** - Performance Evaluation

```typescript
new LatencyScorer({
  maxLatencyMs: 1000, // Maximum acceptable latency
  penaltyThreshold: 500, // Start penalizing after this
});
```

**Scoring Logic:**

- Perfect score (1.0) for latency ≤ threshold
- Linear penalty between threshold and max
- Severe penalty (0.1) for exceeding max
- Perfect score for 0ms latency

#### **`WorkflowScorer`** - Workflow Success Evaluation

```typescript
new WorkflowScorer({
  requireSuccess: true, // Must have success: true
  checkMessages: true, // Validate message structure
  minMessages: 2, // Minimum message count
});
```

#### **`ContentScorer`** - Output Quality Assessment

```typescript
new ContentScorer({
  exactMatch: false, // Exact content matching
  caseSensitive: false, // Case sensitivity
  patterns: [/\d+/, /success/], // RegExp patterns to match
  requiredKeywords: ["result"], // Must contain these
  forbiddenKeywords: ["error", "fail"], // Penalize these
});
```

**Multi-dimensional Scoring:**

- 40% pattern matching
- 40% required keywords
- -20% forbidden keywords penalty
- 20% content relevance

### 7.4 Custom Matchers

MCPVals extends Vitest with MCP-specific assertion matchers:

```typescript
// Tool call assertions
await expect(result).toCallTool("add");
await expect(result).toCallTools(["add", "multiply"]);
await expect(result).toHaveToolCallOrder(["add", "multiply"]);

// Workflow assertions
await expect(workflow).toHaveSuccessfulWorkflow();

// Performance assertions
await expect(result).toHaveLatencyBelow(1000);

// Content assertions
await expect(result).toContainKeywords(["success", "complete"]);
await expect(result).toMatchPattern(/result: \d+/);
```

**Smart Content Extraction**: Matchers automatically handle various output formats:

- MCP server responses (`content[0].text`)
- Custom result objects (`{ result, toolCalls, latency }`)
- String outputs
- Workflow results (`{ success, messages, toolCalls }`)

### 7.5 TypeScript Support

Complete type safety with concrete types for common use cases:

```typescript
import type {
  MCPTestConfig,
  MCPTestContext,
  ToolCallTestCase,
  MCPToolResult,
  MCPWorkflowResult,
  ToolCallScorerOptions,
  LatencyScorerOptions,
  ContentScorerOptions,
  WorkflowScorerOptions,
} from "mcpvals";

// Typed test case
const testCase: ToolCallTestCase = {
  input: { operation: "add", a: 5, b: 3 },
  expected: { result: "8", tools: ["add"] },
};

// Typed scorer options
const scorer = new ToolCallScorer({
  expectedOrder: true,
  allowExtraTools: false,
} satisfies ToolCallScorerOptions);

// Typed task function
task: async (input, context): Promise<MCPToolResult> => {
  const testCase = input as ToolCallTestCase["input"];
  const result = await context.utils.callTool(testCase.operation, {
    a: testCase.a,
    b: testCase.b,
  });
  return {
    result: result.content[0].text,
    toolCalls: [{ name: testCase.operation }],
    success: true,
    latency: Date.now() - startTime,
  };
};
```

### 7.6 Advanced Usage

#### **Dynamic Test Generation**

```typescript
describeEval({
  name: "Dynamic Calculator Tests",
  data: async () => {
    const operations = ["add", "subtract", "multiply", "divide"];
    return operations.map((op) => ({
      name: `Test ${op}`,
      input: { operation: op, a: 10, b: 2 },
      expected: { tools: [op] },
    }));
  },
});
```

#### **Debug Mode**

```bash
# Enable detailed logging
VITEST_MCP_DEBUG=true vitest run

# Shows:
# - Individual test scores and explanations
# - Performance metrics
# - Pass/fail reasons
# - Server lifecycle events
```

### 7.7 Integration Patterns

#### **Unit Testing Individual Tools**

```typescript
describe("Individual Tool Tests", () => {
  beforeAll(() => setupMCPServer(config));
  afterAll(() => teardownMCPServer());

  mcpTest("calculator addition", async (utils) => {
    const result = await utils.callTool("add", { a: 2, b: 3 });
    expect(result.content[0].text).toBe("5");
  });

  mcpTest("error handling", async (utils) => {
    try {
      await utils.callTool("divide", { a: 10, b: 0 });
      throw new Error("Should have failed");
    } catch (error) {
      expect(error.message).toContain("division by zero");
    }
  });
});
```

#### **Integration Testing with Workflows**

```typescript
mcpTest("complex workflow", async (utils) => {
  const workflow = await utils.runWorkflow([
    {
      user: "Calculate 2+3 then multiply by 4",
      expectTools: ["add", "multiply"],
    },
  ]);

  await expect(workflow).toHaveSuccessfulWorkflow();
  await expect(workflow).toCallTools(["add", "multiply"]);
  expect(workflow.messages).toHaveLength(2);
});
```

#### **Performance Benchmarking**

```typescript
describeEval({
  name: "Performance Benchmarks",
  threshold: 0.9, // High threshold for performance tests
  scorers: [
    new LatencyScorer({
      maxLatencyMs: 100, // Strict latency requirement
      penaltyThreshold: 50,
    }),
    new ToolCallScorer({ allowExtraTools: false }), // No unnecessary calls
    new ContentScorer({ patterns: [/^\d+$/] }), // Validate output format
  ],
});
```

#### **Multi-Server Testing**

```typescript
describe("Multi-Server Comparison", () => {
  const servers = [
    { name: "Server A", command: "./server-a.js" },
    { name: "Server B", command: "./server-b.js" },
  ];

  servers.forEach((server) => {
    describe(server.name, () => {
      beforeAll(() =>
        setupMCPServer({
          transport: "stdio",
          command: "node",
          args: [server.command],
        }),
      );
      afterAll(() => teardownMCPServer());

      mcpTest("standard test", async (utils) => {
        const result = await utils.callTool("test", {});
        expect(result).toBeDefined();
      });
    });
  });
});
```

### 7.8 Best Practices

1. **Use `beforeAll`/`afterAll`**: Always properly setup and teardown MCP servers
2. **Leverage TypeScript**: Use concrete types for better development experience
3. **Test individual tools first**: Use `mcpTest` for unit testing, `describeEval` for integration
4. **Set appropriate thresholds**: Start with 0.8, adjust based on your quality requirements
5. **Combine scorers**: Use multiple scorers to evaluate different aspects (functionality, performance, content)
6. **Enable debug mode**: Use `VITEST_MCP_DEBUG=true` when troubleshooting
7. **Write realistic test data**: Create test cases that reflect real-world usage
8. **Use custom matchers**: Leverage MCP-specific matchers for readable assertions

### 7.9 Example: Complete Test Suite

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupMCPServer,
  teardownMCPServer,
  mcpTest,
  describeEval,
  ToolCallScorer,
  WorkflowScorer,
  LatencyScorer,
  ContentScorer,
  type ToolCallTestCase,
  type MCPToolResult,
} from "mcpvals";

describe("Production Calculator Server", () => {
  beforeAll(async () => {
    await setupMCPServer(
      {
        transport: "stdio",
        command: "node",
        args: ["./dist/calculator-server.js"],
      },
      {
        timeout: 10000,
        debug: process.env.CI !== "true",
      },
    );
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  // Unit tests for individual operations
  mcpTest("addition works correctly", async (utils) => {
    const result = await utils.callTool("add", { a: 5, b: 3 });
    expect(result.content[0].text).toBe("8");
    await expect(result).toCallTool("add");
    await expect(result).toHaveLatencyBelow(100);
  });

  mcpTest("handles division by zero", async (utils) => {
    try {
      await utils.callTool("divide", { a: 10, b: 0 });
      throw new Error("Expected division by zero error");
    } catch (error) {
      expect(error.message).toContain("division by zero");
    }
  });

  // Comprehensive evaluation suite
  describeEval({
    name: "Calculator Performance Suite",
    server: {
      transport: "stdio",
      command: "node",
      args: ["./dist/calculator-server.js"],
    },
    threshold: 0.85,
    timeout: 30000,

    data: async (): Promise<ToolCallTestCase[]> => [
      {
        name: "Basic Addition",
        input: { operation: "add", a: 10, b: 5 },
        expected: { result: "15", tools: ["add"] },
      },
      {
        name: "Complex Multiplication",
        input: { operation: "multiply", a: 7, b: 8 },
        expected: { result: "56", tools: ["multiply"] },
      },
      {
        name: "Subtraction Test",
        input: { operation: "subtract", a: 20, b: 8 },
        expected: { result: "12", tools: ["subtract"] },
      },
    ],

    task: async (input, context): Promise<MCPToolResult> => {
      const testCase = input as ToolCallTestCase["input"];
      const startTime = Date.now();

      try {
        const result = await context.utils.callTool(testCase.operation, {
          a: testCase.a,
          b: testCase.b,
        });

        return {
          result: result.content[0].text,
          toolCalls: [{ name: testCase.operation }],
          success: true,
          latency: Date.now() - startTime,
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          result: null,
          toolCalls: [],
          success: false,
          error: error.message,
          latency: Date.now() - startTime,
          executionTime: Date.now() - startTime,
        };
      }
    },

    scorers: [
      new ToolCallScorer({
        expectedOrder: true,
        allowExtraTools: false,
      }),
      new WorkflowScorer({
        requireSuccess: true,
        checkMessages: false,
      }),
      new LatencyScorer({
        maxLatencyMs: 500,
        penaltyThreshold: 200,
      }),
      new ContentScorer({
        exactMatch: false,
        caseSensitive: false,
        patterns: [/^\d+$/], // Results should be numbers
      }),
    ],
  });

  // Integration test with workflows
  mcpTest("multi-step calculation workflow", async (utils) => {
    const workflow = await utils.runWorkflow([
      {
        user: "Calculate 5 plus 3, then multiply the result by 2",
        expectTools: ["add", "multiply"],
      },
    ]);

    await expect(workflow).toHaveSuccessfulWorkflow();
    await expect(workflow).toCallTools(["add", "multiply"]);
    await expect(workflow).toHaveToolCallOrder(["add", "multiply"]);

    // Verify final result
    const finalMessage = workflow.messages[workflow.messages.length - 1];
    expect(finalMessage.content).toContain("16");
  });
});
```

**Run the tests:**

```bash
# Run all tests
vitest run

# Run with debug output
VITEST_MCP_DEBUG=true vitest run

# Run in watch mode during development
vitest

# Generate coverage report
vitest run --coverage
```

This Vitest integration makes MCP server testing **accessible, automated, and reliable** - combining the speed and developer experience of Vitest with specialized tools for comprehensive MCP server evaluation.

---

## 8. Extensibility & Troubleshooting

- **Custom Reporters**: Import `ConsoleReporter` for reference and implement your own `.report()` method.
- **Server Hangs**: Increase the `timeout` value in your config. Ensure your server writes MCP messages to `stdout`.
- **LLM Judge Fails**: Use `--debug` to inspect the raw model output for malformed JSON.

---

## 9 Complete Example Configuration

Here's a comprehensive example showcasing all evaluation types:

```typescript
import type { Config } from "mcpvals";

export default {
  server: {
    transport: "stdio", // Also supports "shttp" and "sse"
    command: "node",
    args: ["./my-mcp-server.js"],
  },

  // Alternative SSE server configuration:
  // server: {
  //   transport: "sse",
  //   url: "https://api.example.com/mcp/sse",
  //   headers: {
  //     "Accept": "text/event-stream",
  //     "Cache-Control": "no-cache",
  //     "Authorization": "Bearer ${API_TOKEN}"
  //   },
  //   reconnect: true,
  //   reconnectInterval: 5000,
  //   maxReconnectAttempts: 10
  // },

  // Test tools
  toolHealthSuites: [
    {
      name: "Core Functions",
      tests: [
        { name: "add", args: { a: 5, b: 3 }, expectedResult: 8 },
        {
          name: "divide",
          args: { a: 10, b: 0 },
          expectedError: "division by zero",
        },
      ],
    },
  ],

  // Test workflows
  workflows: [
    {
      name: "Complete Workflow",
      steps: [{ user: "Process user data and generate a report" }],
      expectTools: ["fetch-data", "process", "generate-report"],
    },
  ],

  llmJudge: true,
  openaiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
} satisfies Config;
```

---

## 10. Acknowledgements

- [Model Context Protocol](https://modelcontextprotoco.lol) – for the SDK
- [Vercel AI SDK](https://sdk.vercel.ai) – for LLM integration
- [chalk](https://github.com/chalk/chalk) – for terminal colors

Enjoy testing your MCP servers – PRs, issues & feedback welcome! ✨
