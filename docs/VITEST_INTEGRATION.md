# Vitest Integration for MCP Testing

This document describes how to use mcpvals with Vitest for testing Model Context Protocol (MCP) servers using familiar testing syntax.

## Overview

The vitest integration allows you to write MCP server tests using standard Vitest syntax while leveraging mcpvals' powerful evaluation capabilities. This provides:

- **Familiar syntax**: Use `describe`, `it`, and `expect` patterns you already know
- **Powerful evaluation**: Built-in scorers for common MCP testing patterns
- **Flexible assertions**: Custom matchers for MCP-specific testing needs
- **Easy setup**: Simple server configuration and lifecycle management

## Quick Start

### 1. Basic Tool Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupMCPServer, teardownMCPServer, mcpTest } from "mcpvals/vitest";

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

  mcpTest("should add two numbers", async (utils) => {
    const result = await utils.callTool("add", { a: 5, b: 3 });
    expect(result).toBe(8);
  });

  mcpTest("should handle complex workflow", async (utils) => {
    const workflow = await utils.runWorkflow([
      {
        user: "Calculate 10 + 5 and then multiply by 2",
        expectTools: ["add", "multiply"],
      },
    ]);

    await expect(workflow).toHaveSuccessfulWorkflow();
    await expect(workflow).toCallTools(["add", "multiply"]);
  });
});
```

### 2. Evaluation Suites

For comprehensive evaluation with scoring:

```typescript
import { describeEval, ToolCallScorer, LatencyScorer } from "mcpvals/vitest";

describeEval({
  name: "Math Calculator Evaluation",
  server: {
    transport: "stdio",
    command: "node",
    args: ["./calculator-server.js"],
  },
  threshold: 0.8,

  data: async () => [
    {
      name: "Basic Addition",
      input: { operation: "add", a: 5, b: 3 },
      expected: { result: 8, tools: ["add"] },
    },
    {
      name: "Complex Calculation",
      input: { query: "Calculate (10 + 5) * 2" },
      expected: { result: 30, tools: ["add", "multiply"] },
    },
  ],

  task: async (input, context) => {
    if (input.query) {
      return await context.utils.runWorkflow([{ user: input.query }]);
    } else {
      return await context.utils.callTool(input.operation, {
        a: input.a,
        b: input.b,
      });
    }
  },

  scorers: [
    new ToolCallScorer({
      expectedOrder: true,
      allowExtraTools: false,
    }),
    new LatencyScorer({
      maxLatencyMs: 2000,
    }),
  ],
});
```

## API Reference

### Core Functions

#### `setupMCPServer(server, options?)`

Initializes an MCP server for testing.

```typescript
await setupMCPServer({
  transport: "stdio" | "shttp" | "sse",
  command: "node",
  args: ["server.js"],
  env?: Record<string, string>,
}, {
  timeout?: number,
  debug?: boolean,
});
```

#### `teardownMCPServer()`

Cleanly shuts down the MCP server.

#### `mcpTest(name, testFn, timeout?)`

Runs a single MCP test with server utilities.

```typescript
mcpTest(
  "test name",
  async (utils) => {
    // Test implementation using utils
  },
  30000,
);
```

#### `describeEval(config)`

Creates a comprehensive evaluation suite.

```typescript
interface MCPTestConfig {
  name: string;
  description?: string;
  server: ServerConfig;
  data: () => Promise<MCPTestCase[]> | MCPTestCase[];
  task: (input: any, context: MCPTestContext) => Promise<any>;
  scorers: EvalScorer[];
  threshold?: number; // Default: 0.8
  timeout?: number;
}
```

### Test Utilities

The `utils` object provided to test functions contains:

```typescript
interface MCPTestContext["utils"] {
  // Tool operations
  callTool(name: string, args: Record<string, any>): Promise<any>;

  // Workflow operations
  runWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult>;

  // Resource operations
  listResources(): Promise<string[]>;
  getResource(uri: string): Promise<any>;

  // Prompt operations
  listPrompts(): Promise<string[]>;
  getPrompt(name: string, args?: Record<string, any>): Promise<any>;
}
```

### Custom Matchers

Extended `expect` matchers for MCP-specific assertions:

```typescript
// Tool call assertions
await expect(result).toCallTool("toolName");
await expect(result).toCallTools(["tool1", "tool2"]);
await expect(result).toHaveToolCallOrder(["first", "second"]);

// Workflow assertions
await expect(result).toHaveSuccessfulWorkflow();

// Performance assertions
await expect(result).toHaveLatencyBelow(1000);

// Content assertions
await expect(result).toContainKeywords(["keyword1", "keyword2"]);
await expect(result).toMatchPattern(/regex pattern/);
```

### Built-in Scorers

#### `ToolCallScorer`

Evaluates tool call patterns and order.

```typescript
new ToolCallScorer({
  expectedTools?: string[];
  expectedOrder?: boolean;
  allowExtraTools?: boolean;
})
```

#### `WorkflowScorer`

Evaluates workflow execution success.

```typescript
new WorkflowScorer({
  requireSuccess?: boolean;
  checkMessages?: boolean;
  minMessages?: number;
})
```

#### `LatencyScorer`

Evaluates response performance.

```typescript
new LatencyScorer({
  maxLatencyMs: number;
  penaltyThreshold?: number;
})
```

#### `ContentScorer`

Evaluates content quality and correctness.

```typescript
new ContentScorer({
  exactMatch?: boolean;
  caseSensitive?: boolean;
  patterns?: RegExp[];
  requiredKeywords?: string[];
  forbiddenKeywords?: string[];
})
```

## Advanced Usage

### Custom Scorers

Create your own evaluation logic:

```typescript
class CustomScorer implements EvalScorer {
  name = "Custom Evaluation";

  async score(
    output: any,
    expected: any,
    context: MCPTestContext,
  ): Promise<number> {
    // Return score between 0-1
    return output.customMetric > 0.5 ? 1 : 0;
  }

  async explain(
    output: any,
    expected: any,
    context: MCPTestContext,
  ): Promise<string> {
    return `Custom metric: ${output.customMetric}`;
  }
}
```

### Environment Configuration

Set debug mode and other options:

```bash
# Enable detailed test output
VITEST_MCP_DEBUG=true vitest run

# Run specific test patterns
vitest run --reporter=verbose mcp-tests/
```

### Integration with Existing Tests

Mix MCP tests with regular unit tests:

```typescript
describe("My Application", () => {
  describe("Unit Tests", () => {
    it("should validate input", () => {
      expect(validateInput("test")).toBe(true);
    });
  });

  describe("MCP Integration", () => {
    beforeAll(async () => {
      await setupMCPServer(/* config */);
    });

    afterAll(async () => {
      await teardownMCPServer();
    });

    mcpTest("should integrate with MCP server", async (utils) => {
      // MCP-specific test logic
    });
  });
});
```

## Best Practices

1. **Server Lifecycle**: Always use `beforeAll`/`afterAll` for server setup/teardown
2. **Test Isolation**: Each test should be independent and not rely on previous test state
3. **Meaningful Assertions**: Use specific custom matchers rather than generic `expect()` calls
4. **Appropriate Timeouts**: Set realistic timeouts for your server's performance characteristics
5. **Debug Mode**: Use `VITEST_MCP_DEBUG=true` when developing tests to see detailed output

## Migration from Config-based Testing

If you have existing mcpvals config files, you can gradually migrate:

```typescript
// Before: config-based
export default {
  server: {
    /* config */
  },
  workflows: [
    /* workflows */
  ],
  toolHealthSuites: [
    /* suites */
  ],
};

// After: vitest-based
describeEval({
  name: "Migrated Test Suite",
  server: {
    /* same config */
  },
  data: () => [
    /* convert workflows to test cases */
  ],
  task: async (input, context) => {
    // Convert workflow logic to task function
  },
  scorers: [
    /* convert expectations to scorers */
  ],
});
```

Both approaches can coexist, allowing incremental migration of your test suites.
