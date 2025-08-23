# Vitest Integration

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
utils.listResources(); // Get available resources
utils.getResource(uri); // Read resource content
utils.listPrompts(); // Get available prompts
utils.getPrompt(name, args); // Execute prompts
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

#### **Context-Aware Testing**

```typescript
task: async (input, context) => {
  console.log(
    "Available tools:",
    context.tools.map((t) => t.name),
  );
  console.log("Running:", context.testCase.name);

  const resources = await context.utils.listResources();
  const prompts = await context.utils.listPrompts();

  return await context.utils.callTool("process", {
    ...input,
    resources,
    prompts,
  });
};
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
