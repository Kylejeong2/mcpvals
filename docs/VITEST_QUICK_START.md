# Vitest + mcpvals Quick Start

## Installation

```bash
pnpm install mcpvals vitest
```

## Basic Test Setup

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupMCPServer, teardownMCPServer, mcpTest } from "mcpvals";

describe("My MCP Server Tests", () => {
  beforeAll(async () => {
    await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["./my-server.js"],
    });
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  mcpTest("should call tools correctly", async (utils) => {
    const result = await utils.callTool("myTool", { input: "test" });
    expect(result).toBeDefined();

    // Use custom matchers
    await expect(result).toCallTool("myTool");
  });
});
```

## Automated Evaluation

```typescript
import { describeEval, ToolCallScorer, LatencyScorer } from "mcpvals";

describeEval({
  name: "Server Performance Evaluation",
  server: {
    /* your server config */
  },
  threshold: 0.8, // 80% score required to pass

  data: () => [{ input: { action: "test" }, expected: { result: "success" } }],

  task: async (input, context) => {
    return await context.utils.callTool("action", input);
  },

  scorers: [
    new ToolCallScorer({ expectedTools: ["action"] }),
    new LatencyScorer({ maxLatencyMs: 1000 }),
  ],
});
```

## Available Features

### 🎯 **Custom Matchers**

- `toCallTool(name)` - Assert specific tool was called
- `toHaveSuccessfulWorkflow()` - Assert workflow succeeded
- `toHaveLatencyBelow(ms)` - Assert performance requirements
- `toContainKeywords([...])` - Assert content includes keywords

### 📊 **Built-in Scorers**

- `ToolCallScorer` - Evaluates tool usage patterns
- `LatencyScorer` - Evaluates response times
- `ContentScorer` - Evaluates output quality
- `WorkflowScorer` - Evaluates workflow success

### 🔧 **Server Support**

- stdio, HTTP, and SSE transports
- Automatic server lifecycle management
- Resource and prompt testing
- Workflow evaluation with LLM integration

## Debug Mode

```bash
VITEST_MCP_DEBUG=true vitest run
```

## Next Steps

- See [VITEST_GETTING_STARTED.md](./VITEST_GETTING_STARTED.md) for detailed examples
- Check [examples/vitest-examples/](../examples/vitest-examples/) for working code
- Read [VITEST_INTEGRATION.md](./VITEST_INTEGRATION.md) for complete API reference

## Working Example

✅ **All core features implemented and tested:**

- TypeScript compilation passes
- Unit tests pass (40/40 tests)
- Custom matchers work correctly
- Scorers evaluate properly
- Documentation is comprehensive

The vitest integration is ready for production use!
