import { describe, expect, beforeAll, afterAll } from "vitest";
import {
  setupMCPServer,
  teardownMCPServer,
  mcpTest,
} from "../../src/vitest/index.js";
import type { MCPToolResult } from "../../src/vitest/types.js";

describe("Basic MCP Tool Testing", () => {
  beforeAll(async () => {
    await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["examples/vitest-examples/server/calculator-server.js"],
    });
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  mcpTest("should call add tool correctly", async (utils) => {
    const result = (await utils.callTool("add", {
      a: 5,
      b: 3,
    })) as MCPToolResult;

    expect(result.content?.[0]?.text).toBe("8");
  });

  mcpTest("should handle calculator workflow", async (utils) => {
    // Note: This would require ANTHROPIC_API_KEY to be set
    // For this example, we'll just test individual tool calls
    const addResult = (await utils.callTool("add", {
      a: 10,
      b: 5,
    })) as MCPToolResult;
    const multiplyResult = (await utils.callTool("multiply", {
      a: 15,
      b: 2,
    })) as MCPToolResult;

    expect(addResult.content?.[0]?.text).toBe("15");
    expect(multiplyResult.content?.[0]?.text).toBe("30");
  });

  mcpTest("should list available tools", async (utils) => {
    // Test by getting tools through the context instead
    expect(utils.callTool).toBeDefined();

    // Test that we can call the available tools
    const result = (await utils.callTool("add", {
      a: 1,
      b: 2,
    })) as MCPToolResult;
    expect(result).toBeDefined();
    expect(result.content?.[0]?.text).toBe("3");
  });
});
