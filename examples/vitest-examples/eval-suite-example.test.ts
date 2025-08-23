import {
  describeEval,
  ToolCallScorer,
  WorkflowScorer,
  LatencyScorer,
  ContentScorer,
} from "../../src/vitest/index.js";

// Example: Math Calculator Evaluation
describeEval({
  name: "Math Calculator MCP Server",
  description: "Evaluates basic math operations and workflows",
  server: {
    transport: "stdio",
    command: "node",
    args: ["examples/vitest-examples/server/calculator-server.js"],
  },
  threshold: 0.8,
  timeout: 30000,

  data: async () => [
    {
      name: "Simple Addition",
      input: { operation: "add", a: 5, b: 3 },
      expected: { result: "8", tools: ["add"] },
    },
    {
      name: "Simple Multiplication",
      input: { operation: "multiply", a: 4, b: 6 },
      expected: { result: "24", tools: ["multiply"] },
    },
    {
      name: "Simple Subtraction",
      input: { operation: "subtract", a: 10, b: 3 },
      expected: { result: "7", tools: ["subtract"] },
    },
  ],

  task: async (input, context) => {
    const testCase = input as { operation: string; a: number; b: number };
    const startTime = Date.now();

    try {
      // Direct tool call
      const result = await context.utils.callTool(testCase.operation, {
        a: testCase.a,
        b: testCase.b,
      });
      return {
        result: (result as any).content?.[0]?.text,
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
        error: error instanceof Error ? error.message : String(error),
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
      checkMessages: false, // Don't require messages for simple tool calls
      minMessages: 0,
    }),
    new LatencyScorer({
      maxLatencyMs: 5000,
      penaltyThreshold: 2000,
    }),
    new ContentScorer({
      caseSensitive: false,
      exactMatch: false, // Don't require exact match
      // Remove patterns and forbidden keywords that cause failures
    }),
  ],
});

// Example: Resource Server Evaluation (skipped - requires more complex setup)
// This example demonstrates how to test resource servers, but is disabled for simplicity
/*
describeEval({
  name: "File System Resource Server",
  description: "Tests file system resource capabilities",
  server: {
    transport: "stdio",
    command: "node", 
    args: ["examples/filesystem-server.js"],
  },
  threshold: 0.9,
  
  data: () => [
    {
      name: "List Files",
      input: { action: "list", path: "/tmp" },
      expected: { resources: true },
    },
    {
      name: "Read File",
      input: { action: "read", uri: "file:///tmp/test.txt" },
      expected: { content: "Hello World" },
    },
  ],

  task: async (input, context) => {
    if (input.action === "list") {
      const resources = await context.utils.listResources();
      return { resources: resources.length > 0 };
    } else if (input.action === "read") {
      const content = await context.utils.getResource(input.uri);
      return { content };
    }
    return null;
  },

  scorers: [
    new ContentScorer({
      exactMatch: false,
      requiredKeywords: ["file"],
    }),
    new LatencyScorer({
      maxLatencyMs: 1000,
    }),
  ],
});
*/
