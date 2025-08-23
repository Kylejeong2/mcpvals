3:I[9275,[],""]
5:I[1343,[],""]
6:I[231,["231","static/chunks/231-bea070b1ecddfbbc.js","998","static/chunks/app/docs/layout-b24984ce47656698.js"],""]
2:Tf6d,import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
4:["slug","vitest","c"]
0:["mtG3UlcSqFkfpBd0gWDhs",[[["",{"children":["docs",{"children":[["slug","vitest","c"],{"children":["__PAGE__?{\"slug\":[\"vitest\"]}",{}]}]}]},"$undefined","$undefined",true],["",{"children":["docs",{"children":[["slug","vitest","c"],{"children":["__PAGE__",{},[["$L1",["$","article",null,{"className":"prose prose-zinc max-w-none dark:prose-invert","children":[["$","h1","h1-0",{"id":"vitest-integration","children":["$","a","a-0",{"href":"#vitest-integration","children":"Vitest Integration"}]}],"\n",["$","p","p-0",{"children":["MCPVals provides a complete ",["$","strong","strong-0",{"children":"Vitest integration"}]," for writing MCP server tests using the popular Vitest testing framework. This integration offers both individual test utilities and comprehensive evaluation suites with built-in scoring and custom matchers."]}],"\n",["$","h3","h3-0",{"id":"71-quick-start","children":["$","a","a-0",{"href":"#71-quick-start","children":"7.1 Quick Start"}]}],"\n",["$","pre","pre-0",{"children":["$","code","code-0",{"className":"language-bash","children":"# Install vitest alongside mcpvals\npnpm add -D mcpvals vitest\n"}]}],"\n",["$","pre","pre-1",{"children":["$","code","code-0",{"className":"language-typescript","children":"// tests/calculator.test.ts\nimport { describe, it, expect, beforeAll, afterAll } from \"vitest\";\nimport {\n  setupMCPServer,\n  teardownMCPServer,\n  mcpTest,\n  describeEval,\n  ToolCallScorer,\n  LatencyScorer,\n  ContentScorer,\n} from \"mcpvals\";\n\ndescribe(\"Calculator MCP Server\", () => {\n  beforeAll(async () => {\n    await setupMCPServer({\n      transport: \"stdio\",\n      command: \"node\",\n      args: [\"./calculator-server.js\"],\n    });\n  });\n\n  afterAll(async () => {\n    await teardownMCPServer();\n  });\n\n  // Individual test\n  mcpTest(\"should add numbers\", async (utils) => {\n    const result = await utils.callTool(\"add\", { a: 5, b: 3 });\n    expect(result.content[0].text).toBe(\"8\");\n\n    // Custom matchers\n    await expect(result).toCallTool(\"add\");\n    await expect(result).toHaveLatencyBelow(1000);\n  });\n});\n"}]}],"\n",["$","h3","h3-1",{"id":"72-core-functions","children":["$","a","a-0",{"href":"#72-core-functions","children":"7.2 Core Functions"}]}],"\n",["$","h4","h4-0",{"id":"setupmcpserverconfig-options","children":["$","a","a-0",{"href":"#setupmcpserverconfig-options","children":["$","strong","strong-0",{"children":["$","code","code-0",{"children":"setupMCPServer(config, options?)"}]}]}]}],"\n",["$","p","p-1",{"children":"Starts an MCP server and returns utilities for testing."}],"\n",["$","pre","pre-2",{"children":["$","code","code-0",{"className":"language-typescript","children":"const utils = await setupMCPServer(\n  {\n    transport: \"stdio\",\n    command: \"node\",\n    args: [\"./server.js\"],\n  },\n  {\n    timeout: 30000, // Server startup timeout\n    debug: false, // Enable debug logging\n  },\n);\n\n// Returns utility functions:\nutils.callTool(name, args); // Call MCP tools\nutils.runWorkflow(steps); // Execute LLM workflows\nutils.listResources(); // Get available resources\nutils.getResource(uri); // Read resource content\nutils.listPrompts(); // Get available prompts\nutils.getPrompt(name, args); // Execute prompts\n"}]}],"\n",["$","h4","h4-1",{"id":"teardownmcpserver","children":["$","a","a-0",{"href":"#teardownmcpserver","children":["$","strong","strong-0",{"children":["$","code","code-0",{"children":"teardownMCPServer()"}]}]}]}],"\n",["$","p","p-2",{"children":["Cleanly shuts down the MCP server (call in ",["$","code","code-0",{"children":"afterAll"}],")."]}],"\n",["$","h4","h4-2",{"id":"mcptestname-testfn-timeout","children":["$","a","a-0",{"href":"#mcptestname-testfn-timeout","children":["$","strong","strong-0",{"children":["$","code","code-0",{"children":"mcpTest(name, testFn, timeout?)"}]}]}]}],"\n",["$","p","p-3",{"children":"Convenient wrapper for individual MCP tests."}],"\n",["$","pre","pre-3",{"children":["$","code","code-0",{"className":"language-typescript","children":"mcpTest(\n  \"tool test\",\n  async (utils) => {\n    const result = await utils.callTool(\"echo\", { message: \"hello\" });\n    expect(result).toBeDefined();\n  },\n  10000,\n); // Optional timeout\n"}]}],"\n",["$","h4","h4-3",{"id":"describeevalconfig","children":["$","a","a-0",{"href":"#describeevalconfig","children":["$","strong","strong-0",{"children":["$","code","code-0",{"children":"describeEval(config)"}]}]}]}],"\n",["$","p","p-4",{"children":"Comprehensive evaluation suite with automated scoring."}],"\n",["$","pre","pre-4",{"children":["$","code","code-0",{"className":"language-typescript","children":"describeEval({\n  name: \"Calculator Evaluation\",\n  server: { transport: \"stdio\", command: \"node\", args: [\"./calc.js\"] },\n  threshold: 0.8, // 80% score required to pass\n\n  data: async () => [\n    {\n      input: { operation: \"add\", a: 5, b: 3 },\n      expected: { result: \"8\", tools: [\"add\"] },\n    },\n  ],\n\n  task: async (input, context) => {\n    const result = await context.utils.callTool(input.operation, {\n      a: input.a,\n      b: input.b,\n    });\n    return {\n      result: result.content[0].text,\n      toolCalls: [{ name: input.operation }],\n      latency: Date.now() - startTime,\n    };\n  },\n\n  scorers: [\n    new ToolCallScorer({ expectedOrder: true }),\n    new LatencyScorer({ maxLatencyMs: 1000 }),\n    new ContentScorer({ patterns: [/\\d+/] }),\n  ],\n});\n"}]}],"\n",["$","h3","h3-2",{"id":"73-built-in-scorers","children":["$","a","a-0",{"href":"#73-built-in-scorers","children":"7.3 Built-in Scorers"}]}],"\n",["$","p","p-5",{"children":"Scorers automatically evaluate different aspects of MCP server behavior, returning scores from 0-1."}],"\n",["$","h4","h4-4",{"id":"toolcallscorer---tool-usage-evaluation","children":["$","a","a-0",{"href":"#toolcallscorer---tool-usage-evaluation","children":[["$","strong","strong-0",{"children":["$","code","code-0",{"children":"ToolCallScorer"}]}]," - Tool Usage Evaluation"]}]}],"\n",["$","pre","pre-5",{"children":["$","code","code-0",{"className":"language-typescript","children":"new ToolCallScorer({\n  expectedTools: [\"add\", \"multiply\"], // Tools that should be called\n  expectedOrder: true, // Whether order matters\n  allowExtraTools: false, // Penalize unexpected tools\n});\n"}]}],"\n",["$","p","p-6",{"children":["$","strong","strong-0",{"children":"Scoring Algorithm:"}]}],"\n",["$","ul","ul-0",{"children":["\n",["$","li","li-0",{"children":"70% for calling expected tools"}],"\n",["$","li","li-1",{"children":"20% for correct order (if enabled)"}],"\n",["$","li","li-2",{"children":"10% penalty for extra tools (if disabled)"}],"\n"]}],"\n",["$","h4","h4-5",{"id":"latencyscorer---performance-evaluation","children":["$","a","a-0",{"href":"#latencyscorer---performance-evaluation","children":[["$","strong","strong-0",{"children":["$","code","code-0",{"children":"LatencyScorer"}]}]," - Performance Evaluation"]}]}],"\n",["$","pre","pre-6",{"children":["$","code","code-0",{"className":"language-typescript","children":"new LatencyScorer({\n  maxLatencyMs: 1000, // Maximum acceptable latency\n  penaltyThreshold: 500, // Start penalizing after this\n});\n"}]}],"\n",["$","p","p-7",{"children":["$","strong","strong-0",{"children":"Scoring Logic:"}]}],"\n",["$","ul","ul-1",{"children":["\n",["$","li","li-0",{"children":"Perfect score (1.0) for latency ≤ threshold"}],"\n",["$","li","li-1",{"children":"Linear penalty between threshold and max"}],"\n",["$","li","li-2",{"children":"Severe penalty (0.1) for exceeding max"}],"\n",["$","li","li-3",{"children":"Perfect score for 0ms latency"}],"\n"]}],"\n",["$","h4","h4-6",{"id":"workflowscorer---workflow-success-evaluation","children":["$","a","a-0",{"href":"#workflowscorer---workflow-success-evaluation","children":[["$","strong","strong-0",{"children":["$","code","code-0",{"children":"WorkflowScorer"}]}]," - Workflow Success Evaluation"]}]}],"\n",["$","pre","pre-7",{"children":["$","code","code-0",{"className":"language-typescript","children":"new WorkflowScorer({\n  requireSuccess: true, // Must have success: true\n  checkMessages: true, // Validate message structure\n  minMessages: 2, // Minimum message count\n});\n"}]}],"\n",["$","h4","h4-7",{"id":"contentscorer---output-quality-assessment","children":["$","a","a-0",{"href":"#contentscorer---output-quality-assessment","children":[["$","strong","strong-0",{"children":["$","code","code-0",{"children":"ContentScorer"}]}]," - Output Quality Assessment"]}]}],"\n",["$","pre","pre-8",{"children":["$","code","code-0",{"className":"language-typescript","children":"new ContentScorer({\n  exactMatch: false, // Exact content matching\n  caseSensitive: false, // Case sensitivity\n  patterns: [/\\d+/, /success/], // RegExp patterns to match\n  requiredKeywords: [\"result\"], // Must contain these\n  forbiddenKeywords: [\"error\", \"fail\"], // Penalize these\n});\n"}]}],"\n",["$","p","p-8",{"children":["$","strong","strong-0",{"children":"Multi-dimensional Scoring:"}]}],"\n",["$","ul","ul-2",{"children":["\n",["$","li","li-0",{"children":"40% pattern matching"}],"\n",["$","li","li-1",{"children":"40% required keywords"}],"\n",["$","li","li-2",{"children":"-20% forbidden keywords penalty"}],"\n",["$","li","li-3",{"children":"20% content relevance"}],"\n"]}],"\n",["$","h3","h3-3",{"id":"74-custom-matchers","children":["$","a","a-0",{"href":"#74-custom-matchers","children":"7.4 Custom Matchers"}]}],"\n",["$","p","p-9",{"children":"MCPVals extends Vitest with MCP-specific assertion matchers:"}],"\n",["$","pre","pre-9",{"children":["$","code","code-0",{"className":"language-typescript","children":"// Tool call assertions\nawait expect(result).toCallTool(\"add\");\nawait expect(result).toCallTools([\"add\", \"multiply\"]);\nawait expect(result).toHaveToolCallOrder([\"add\", \"multiply\"]);\n\n// Workflow assertions\nawait expect(workflow).toHaveSuccessfulWorkflow();\n\n// Performance assertions\nawait expect(result).toHaveLatencyBelow(1000);\n\n// Content assertions\nawait expect(result).toContainKeywords([\"success\", \"complete\"]);\nawait expect(result).toMatchPattern(/result: \\d+/);\n"}]}],"\n",["$","p","p-10",{"children":[["$","strong","strong-0",{"children":"Smart Content Extraction"}],": Matchers automatically handle various output formats:"]}],"\n",["$","ul","ul-3",{"children":["\n",["$","li","li-0",{"children":["MCP server responses (",["$","code","code-0",{"children":"content[0].text"}],")"]}],"\n",["$","li","li-1",{"children":["Custom result objects (",["$","code","code-0",{"children":"{ result, toolCalls, latency }"}],")"]}],"\n",["$","li","li-2",{"children":"String outputs"}],"\n",["$","li","li-3",{"children":["Workflow results (",["$","code","code-0",{"children":"{ success, messages, toolCalls }"}],")"]}],"\n"]}],"\n",["$","h3","h3-4",{"id":"75-typescript-support","children":["$","a","a-0",{"href":"#75-typescript-support","children":"7.5 TypeScript Support"}]}],"\n",["$","p","p-11",{"children":"Complete type safety with concrete types for common use cases:"}],"\n",["$","pre","pre-10",{"children":["$","code","code-0",{"className":"language-typescript","children":"import type {\n  MCPTestConfig,\n  MCPTestContext,\n  ToolCallTestCase,\n  MCPToolResult,\n  MCPWorkflowResult,\n  ToolCallScorerOptions,\n  LatencyScorerOptions,\n  ContentScorerOptions,\n  WorkflowScorerOptions,\n} from \"mcpvals\";\n\n// Typed test case\nconst testCase: ToolCallTestCase = {\n  input: { operation: \"add\", a: 5, b: 3 },\n  expected: { result: \"8\", tools: [\"add\"] },\n};\n\n// Typed scorer options\nconst scorer = new ToolCallScorer({\n  expectedOrder: true,\n  allowExtraTools: false,\n} satisfies ToolCallScorerOptions);\n\n// Typed task function\ntask: async (input, context): Promise<MCPToolResult> => {\n  const testCase = input as ToolCallTestCase[\"input\"];\n  const result = await context.utils.callTool(testCase.operation, {\n    a: testCase.a,\n    b: testCase.b,\n  });\n  return {\n    result: result.content[0].text,\n    toolCalls: [{ name: testCase.operation }],\n    success: true,\n    latency: Date.now() - startTime,\n  };\n};\n"}]}],"\n",["$","h3","h3-5",{"id":"76-advanced-usage","children":["$","a","a-0",{"href":"#76-advanced-usage","children":"7.6 Advanced Usage"}]}],"\n",["$","h4","h4-8",{"id":"dynamic-test-generation","children":["$","a","a-0",{"href":"#dynamic-test-generation","children":["$","strong","strong-0",{"children":"Dynamic Test Generation"}]}]}],"\n",["$","pre","pre-11",{"children":["$","code","code-0",{"className":"language-typescript","children":"describeEval({\n  name: \"Dynamic Calculator Tests\",\n  data: async () => {\n    const operations = [\"add\", \"subtract\", \"multiply\", \"divide\"];\n    return operations.map((op) => ({\n      name: `Test ${op}`,\n      input: { operation: op, a: 10, b: 2 },\n      expected: { tools: [op] },\n    }));\n  },\n});\n"}]}],"\n",["$","h4","h4-9",{"id":"context-aware-testing","children":["$","a","a-0",{"href":"#context-aware-testing","children":["$","strong","strong-0",{"children":"Context-Aware Testing"}]}]}],"\n",["$","pre","pre-12",{"children":["$","code","code-0",{"className":"language-typescript","children":"task: async (input, context) => {\n  console.log(\n    \"Available tools:\",\n    context.tools.map((t) => t.name),\n  );\n  console.log(\"Running:\", context.testCase.name);\n\n  const resources = await context.utils.listResources();\n  const prompts = await context.utils.listPrompts();\n\n  return await context.utils.callTool(\"process\", {\n    ...input,\n    resources,\n    prompts,\n  });\n};\n"}]}],"\n",["$","h4","h4-10",{"id":"debug-mode","children":["$","a","a-0",{"href":"#debug-mode","children":["$","strong","strong-0",{"children":"Debug Mode"}]}]}],"\n",["$","pre","pre-13",{"children":["$","code","code-0",{"className":"language-bash","children":"# Enable detailed logging\nVITEST_MCP_DEBUG=true vitest run\n\n# Shows:\n# - Individual test scores and explanations\n# - Performance metrics\n# - Pass/fail reasons\n# - Server lifecycle events\n"}]}],"\n",["$","h3","h3-6",{"id":"77-integration-patterns","children":["$","a","a-0",{"href":"#77-integration-patterns","children":"7.7 Integration Patterns"}]}],"\n",["$","h4","h4-11",{"id":"unit-testing-individual-tools","children":["$","a","a-0",{"href":"#unit-testing-individual-tools","children":["$","strong","strong-0",{"children":"Unit Testing Individual Tools"}]}]}],"\n",["$","pre","pre-14",{"children":["$","code","code-0",{"className":"language-typescript","children":"describe(\"Individual Tool Tests\", () => {\n  beforeAll(() => setupMCPServer(config));\n  afterAll(() => teardownMCPServer());\n\n  mcpTest(\"calculator addition\", async (utils) => {\n    const result = await utils.callTool(\"add\", { a: 2, b: 3 });\n    expect(result.content[0].text).toBe(\"5\");\n  });\n\n  mcpTest(\"error handling\", async (utils) => {\n    try {\n      await utils.callTool(\"divide\", { a: 10, b: 0 });\n      throw new Error(\"Should have failed\");\n    } catch (error) {\n      expect(error.message).toContain(\"division by zero\");\n    }\n  });\n});\n"}]}],"\n",["$","h4","h4-12",{"id":"integration-testing-with-workflows","children":["$","a","a-0",{"href":"#integration-testing-with-workflows","children":["$","strong","strong-0",{"children":"Integration Testing with Workflows"}]}]}],"\n",["$","pre","pre-15",{"children":["$","code","code-0",{"className":"language-typescript","children":"mcpTest(\"complex workflow\", async (utils) => {\n  const workflow = await utils.runWorkflow([\n    {\n      user: \"Calculate 2+3 then multiply by 4\",\n      expectTools: [\"add\", \"multiply\"],\n    },\n  ]);\n\n  await expect(workflow).toHaveSuccessfulWorkflow();\n  await expect(workflow).toCallTools([\"add\", \"multiply\"]);\n  expect(workflow.messages).toHaveLength(2);\n});\n"}]}],"\n",["$","h4","h4-13",{"id":"performance-benchmarking","children":["$","a","a-0",{"href":"#performance-benchmarking","children":["$","strong","strong-0",{"children":"Performance Benchmarking"}]}]}],"\n",["$","pre","pre-16",{"children":["$","code","code-0",{"className":"language-typescript","children":"describeEval({\n  name: \"Performance Benchmarks\",\n  threshold: 0.9, // High threshold for performance tests\n  scorers: [\n    new LatencyScorer({\n      maxLatencyMs: 100, // Strict latency requirement\n      penaltyThreshold: 50,\n    }),\n    new ToolCallScorer({ allowExtraTools: false }), // No unnecessary calls\n    new ContentScorer({ patterns: [/^\\d+$/] }), // Validate output format\n  ],\n});\n"}]}],"\n",["$","h4","h4-14",{"id":"multi-server-testing","children":["$","a","a-0",{"href":"#multi-server-testing","children":["$","strong","strong-0",{"children":"Multi-Server Testing"}]}]}],"\n",["$","pre","pre-17",{"children":["$","code","code-0",{"className":"language-typescript","children":"describe(\"Multi-Server Comparison\", () => {\n  const servers = [\n    { name: \"Server A\", command: \"./server-a.js\" },\n    { name: \"Server B\", command: \"./server-b.js\" },\n  ];\n\n  servers.forEach((server) => {\n    describe(server.name, () => {\n      beforeAll(() =>\n        setupMCPServer({\n          transport: \"stdio\",\n          command: \"node\",\n          args: [server.command],\n        }),\n      );\n      afterAll(() => teardownMCPServer());\n\n      mcpTest(\"standard test\", async (utils) => {\n        const result = await utils.callTool(\"test\", {});\n        expect(result).toBeDefined();\n      });\n    });\n  });\n});\n"}]}],"\n",["$","h3","h3-7",{"id":"78-best-practices","children":["$","a","a-0",{"href":"#78-best-practices","children":"7.8 Best Practices"}]}],"\n",["$","ol","ol-0",{"children":["\n",["$","li","li-0",{"children":[["$","strong","strong-0",{"children":["Use ",["$","code","code-0",{"children":"beforeAll"}],"/",["$","code","code-1",{"children":"afterAll"}]]}],": Always properly setup and teardown MCP servers"]}],"\n",["$","li","li-1",{"children":[["$","strong","strong-0",{"children":"Leverage TypeScript"}],": Use concrete types for better development experience"]}],"\n",["$","li","li-2",{"children":[["$","strong","strong-0",{"children":"Test individual tools first"}],": Use ",["$","code","code-0",{"children":"mcpTest"}]," for unit testing, ",["$","code","code-1",{"children":"describeEval"}]," for integration"]}],"\n",["$","li","li-3",{"children":[["$","strong","strong-0",{"children":"Set appropriate thresholds"}],": Start with 0.8, adjust based on your quality requirements"]}],"\n",["$","li","li-4",{"children":[["$","strong","strong-0",{"children":"Combine scorers"}],": Use multiple scorers to evaluate different aspects (functionality, performance, content)"]}],"\n",["$","li","li-5",{"children":[["$","strong","strong-0",{"children":"Enable debug mode"}],": Use ",["$","code","code-0",{"children":"VITEST_MCP_DEBUG=true"}]," when troubleshooting"]}],"\n",["$","li","li-6",{"children":[["$","strong","strong-0",{"children":"Write realistic test data"}],": Create test cases that reflect real-world usage"]}],"\n",["$","li","li-7",{"children":[["$","strong","strong-0",{"children":"Use custom matchers"}],": Leverage MCP-specific matchers for readable assertions"]}],"\n"]}],"\n",["$","h3","h3-8",{"id":"79-example-complete-test-suite","children":["$","a","a-0",{"href":"#79-example-complete-test-suite","children":"7.9 Example: Complete Test Suite"}]}],"\n",["$","pre","pre-18",{"children":["$","code","code-0",{"className":"language-typescript","children":"$2"}]}],"\n",["$","p","p-12",{"children":["$","strong","strong-0",{"children":"Run the tests:"}]}],"\n",["$","pre","pre-19",{"children":["$","code","code-0",{"className":"language-bash","children":"# Run all tests\nvitest run\n\n# Run with debug output\nVITEST_MCP_DEBUG=true vitest run\n\n# Run in watch mode during development\nvitest\n\n# Generate coverage report\nvitest run --coverage\n"}]}],"\n",["$","p","p-13",{"children":["This Vitest integration makes MCP server testing ",["$","strong","strong-0",{"children":"accessible, automated, and reliable"}]," - combining the speed and developer experience of Vitest with specialized tools for comprehensive MCP server evaluation."]}],"\n",["$","hr","hr-0",{}]]}],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","docs","children","$4","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[null,["$","div",null,{"className":"flex","children":[["$","aside",null,{"className":"w-64 shrink-0 border-r border-zinc-200/60 dark:border-zinc-800/60 p-4 sticky top-0 h-screen overflow-y-auto","children":[["$","div",null,{"className":"text-lg font-semibold mb-4","children":"MCPVals Docs"}],["$","nav",null,{"className":"space-y-1","children":[["$","$L6","/workspace/website/content/index.md",{"href":"/docs/index","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Core Concepts"}],["$","$L6","/workspace/website/content/acknowledgements.md",{"href":"/docs/acknowledgements","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Acknowledgements"}],["$","$L6","/workspace/website/content/cli.md",{"href":"/docs/cli","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"CLI Reference"}],["$","$L6","/workspace/website/content/configuration.md",{"href":"/docs/configuration","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Configuration"}],["$","$L6","/workspace/website/content/evaluation.md",{"href":"/docs/evaluation","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Evaluation & Metrics"}],["$","$L6","/workspace/website/content/installation.md",{"href":"/docs/installation","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Installation & Runtime Requirements"}],["$","$L6","/workspace/website/content/library-api.md",{"href":"/docs/library-api","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Library API"}],["$","$L6","/workspace/website/content/quick-start.md",{"href":"/docs/quick-start","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Quick Start"}],["$","$L6","/workspace/website/content/roadmap.md",{"href":"/docs/roadmap","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Roadmap"}],["$","$L6","/workspace/website/content/vitest.md",{"href":"/docs/vitest","className":"block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900","children":"Vitest Integration"}]]}]]}],["$","main",null,{"className":"flex-1 p-6","children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","docs","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]}]]}]],null],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/f25260a5bd2b21c3.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","children":["$","body",null,{"className":"min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100","children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":"404"}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}]}]}]],null],null],["$L7",null]]]]
7:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"MCPVals Docs"}],["$","meta","3",{"name":"description","content":"Documentation for MCPVals"}]]
1:null
