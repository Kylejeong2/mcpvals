# Getting Started with Vitest + mcpvals

This guide walks you through setting up and using mcpvals with Vitest for testing your MCP servers.

## Prerequisites

- Node.js 18+ with pnpm or npm
- An MCP server to test
- Vitest configured in your project

## Installation

```bash
pnpm install mcpvals vitest
```

## Basic Setup

### 1. Simple Tool Testing

Create a test file `mcp-server.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupMCPServer, teardownMCPServer, mcpTest } from "mcpvals/vitest";

describe("My MCP Server", () => {
  beforeAll(async () => {
    await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["./my-server.js"], // Path to your MCP server
    });
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  mcpTest("should have available tools", async (utils) => {
    // This automatically gives you access to server utilities
    const result = await utils.callTool("echo", { message: "hello" });
    expect(result).toEqual({ message: "hello" });
  });

  mcpTest("should run workflows", async (utils) => {
    const workflow = await utils.runWorkflow([
      {
        user: "Please echo the message 'test workflow'",
        expectTools: ["echo"],
      },
    ]);

    // Use custom matchers for clean assertions
    await expect(workflow).toHaveSuccessfulWorkflow();
    await expect(workflow).toCallTool("echo");
  });
});
```

### 2. Comprehensive Evaluation

For automated scoring and evaluation:

```typescript
import {
  describeEval,
  ToolCallScorer,
  LatencyScorer,
  ContentScorer,
} from "mcpvals/vitest";

describeEval({
  name: "Echo Server Evaluation",
  description: "Tests the echo server functionality and performance",

  server: {
    transport: "stdio",
    command: "node",
    args: ["./echo-server.js"],
  },

  threshold: 0.8, // Minimum score to pass (0-1)
  timeout: 30000, // 30 second timeout

  // Define test cases
  data: async () => [
    {
      name: "Simple Echo",
      input: { message: "hello world" },
      expected: { message: "hello world", latency: 100 },
    },
    {
      name: "Complex Workflow",
      input: {
        workflow: true,
        query: "Echo this message and tell me the length",
      },
      expected: {
        tools: ["echo", "count"],
        success: true,
      },
    },
  ],

  // Define how to run each test case
  task: async (input, context) => {
    if (input.workflow) {
      // Run a workflow for complex operations
      return await context.utils.runWorkflow([{ user: input.query }]);
    } else {
      // Direct tool call for simple tests
      const startTime = Date.now();
      const result = await context.utils.callTool("echo", input);
      return {
        ...result,
        latency: Date.now() - startTime,
      };
    }
  },

  // Define how to score the results
  scorers: [
    new ToolCallScorer({
      expectedOrder: true,
      allowExtraTools: false,
    }),
    new LatencyScorer({
      maxLatencyMs: 1000,
      penaltyThreshold: 500,
    }),
    new ContentScorer({
      requiredKeywords: ["hello"],
      caseSensitive: false,
    }),
  ],
});
```

## Custom Matchers

mcpvals provides custom Vitest matchers for MCP-specific assertions:

```typescript
// Tool call assertions
await expect(result).toCallTool("echo");
await expect(result).toCallTools(["echo", "count"]);
await expect(result).toHaveToolCallOrder(["first", "second"]);

// Workflow assertions
await expect(result).toHaveSuccessfulWorkflow();

// Performance assertions
await expect(result).toHaveLatencyBelow(1000);

// Content assertions
await expect(result).toContainKeywords(["success", "complete"]);
await expect(result).toMatchPattern(/result: \d+/);
```

## Environment Variables

Control test behavior with environment variables:

```bash
# Enable detailed debug output
VITEST_MCP_DEBUG=true vitest run

# Test with specific timeouts
VITEST_TIMEOUT=60000 vitest run
```

## File Organization

Recommended project structure:

```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── mcp/               # MCP server tests
    ├── tools.test.ts   # Tool functionality tests
    ├── workflows.test.ts # Workflow tests
    └── performance.test.ts # Performance evaluations
```

## Advanced Usage

### Custom Scorers

Create domain-specific evaluation logic:

```typescript
import { EvalScorer, MCPTestContext } from "mcpvals/vitest";

class BusinessLogicScorer implements EvalScorer {
  name = "Business Logic Validation";

  async score(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<number> {
    // Custom scoring logic
    const result = output as { businessValue?: number };
    return result.businessValue ? result.businessValue / 100 : 0;
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    const result = output as { businessValue?: number };
    return `Business value: ${result.businessValue || 0}/100`;
  }
}
```

### Multiple Server Testing

Test multiple servers in the same suite:

```typescript
describe("Multi-server Integration", () => {
  let serverA: ReturnType<typeof setupMCPServer>;
  let serverB: ReturnType<typeof setupMCPServer>;

  beforeAll(async () => {
    serverA = await setupMCPServer({
      /* config A */
    });
    serverB = await setupMCPServer({
      /* config B */
    });
  });

  afterAll(async () => {
    await teardownMCPServer();
    // Note: Multiple servers need individual cleanup
  });

  // Your tests here
});
```

### Resource and Prompt Testing

Test resource and prompt capabilities:

```typescript
mcpTest("should handle resources", async (utils) => {
  const resources = await utils.listResources();
  expect(resources).toContain("file://data.json");

  const resource = await utils.getResource("file://data.json");
  expect(resource).toBeDefined();
});

mcpTest("should handle prompts", async (utils) => {
  const prompts = await utils.listPrompts();
  expect(prompts).toContain("summarize");

  const prompt = await utils.getPrompt("summarize", {
    text: "This is a test document",
  });
  expect(prompt.messages).toBeDefined();
});
```

## Troubleshooting

### Common Issues

**Server doesn't start:**

```
Error: Server not initialized
```

- Check your server path and arguments
- Ensure server executable permissions
- Verify server starts independently

**Tests timeout:**

```
Error: Test timeout after 30000ms
```

- Increase timeout in test configuration
- Check server performance
- Add debug logging

**Tools not found:**

```
Expected tool "myTool" to be called, but only found: []
```

- Verify server exposes expected tools
- Check tool names match exactly
- Enable debug mode to see available tools

### Debug Mode

Enable comprehensive debugging:

```typescript
// In your test setup
beforeAll(async () => {
  await setupMCPServer(config, {
    debug: true, // Enable debug logging
    timeout: 60000, // Increase timeout for debugging
  });
});
```

Set environment variable:

```bash
VITEST_MCP_DEBUG=true vitest run --reporter=verbose
```

### Performance Tips

1. **Parallel Tests**: Avoid parallel execution of MCP tests

   ```typescript
   // vitest.config.ts
   export default {
     test: {
       pool: "forks",
       poolOptions: {
         forks: {
           singleFork: true, // Run MCP tests in single process
         },
       },
     },
   };
   ```

2. **Server Reuse**: Share server instances across tests in same file
3. **Cleanup**: Always use proper beforeAll/afterAll cleanup

## Next Steps

- Check out [VITEST_INTEGRATION.md](./VITEST_INTEGRATION.md) for complete API reference
- See [examples/vitest-examples/](../examples/vitest-examples/) for working examples
- Read about [custom scorers and evaluation patterns](./ADVANCED_EVALUATION.md)
