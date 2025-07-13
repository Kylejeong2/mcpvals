import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { evaluate } from "../src/eval/index";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock external dependencies for integration tests
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn(),
}));

describe("Integration Tests", () => {
  let tempDir: string;
  let configPath: string;

  let mockClient: any;

  let mockExeca: any;

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = mkdtempSync(join(tmpdir(), "mcpvals-test-"));
    configPath = join(tempDir, "test-config.json");

    // Set up mock environment for Anthropic API
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Setup mocks
    mockClient = {
      connect: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    mockExeca = vi.fn().mockReturnValue({
      stdout: "mock stdout",
      stderr: "mock stderr",
      kill: vi.fn(),
    });

    // Setup mocks using dynamic imports
    const clientModule = await import(
      "@modelcontextprotocol/sdk/client/index.js"
    );
    const stdioModule = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );
    const streamableHttpModule = await import(
      "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );
    const execaModule = await import("execa");
    const aiModule = await import("ai");
    const anthropicModule = await import("@ai-sdk/anthropic");

    vi.mocked(clientModule.Client).mockImplementation(() => mockClient);
    vi.mocked(stdioModule.StdioClientTransport).mockImplementation(
      () => ({}) as any,
    );
    vi.mocked(
      streamableHttpModule.StreamableHTTPClientTransport,
    ).mockImplementation(() => ({}) as any);
    vi.mocked(execaModule.execa).mockImplementation(mockExeca);

    // Set up AI SDK mocks properly - createAnthropic should return a function
    vi.mocked(anthropicModule.createAnthropic).mockReturnValue(((
      modelId: string,
    ) => ({
      specificationVersion: "v1",
      provider: "anthropic",
      modelId,
      defaultObjectGenerationMode: "json",
      maxTokens: 4096,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    })) as any);

    // Mock the tool function to return a proper tool object
    vi.mocked(aiModule.tool).mockImplementation(
      ({ execute, parameters, description }) => ({
        parameters: parameters || {},
        description: description || "",
        execute,
      }),
    );

    // Mock generateText to simulate proper LLM tool calling behavior
    (vi.mocked(aiModule.generateText) as any).mockImplementation(
      async (config: any) => {
        const userMessage =
          config.messages?.[config.messages.length - 1]?.content || "";

        // Check if this is a math calculation request and we have tools available
        if (
          (userMessage.includes("Calculate 2 + 2") ||
            userMessage.includes("2 + 2")) &&
          config.tools?.add
        ) {
          // Simulate calling the add tool
          const toolResult = await config.tools.add.execute({ a: 2, b: 2 });

          return {
            text: `I'll calculate 2 + 2 for you using the add tool. The result is ${toolResult}.`,
            toolCalls: [
              {
                type: "tool-call",
                toolCallId: "call_1",
                toolName: "add",
                args: { a: 2, b: 2 },
              },
            ],
            toolResults: [toolResult],
          };
        }

        // Multi-step workflow handling
        if (userMessage.includes("calculate 5 + 3") && config.tools?.add) {
          const toolResult = await config.tools.add.execute({ a: 5, b: 3 });
          return {
            text: `I calculated 5 + 3 = ${toolResult}`,
            toolCalls: [
              { toolCallId: "1", toolName: "add", args: { a: 5, b: 3 } },
            ],
            toolResults: [toolResult],
          };
        }

        if (
          userMessage.includes("multiply") &&
          userMessage.includes("by 2") &&
          config.tools?.multiply
        ) {
          const toolResult = await config.tools.multiply.execute({
            a: 8,
            b: 2,
          });
          return {
            text: `I multiplied 8 by 2 = ${toolResult}`,
            toolCalls: [
              { toolCallId: "2", toolName: "multiply", args: { a: 8, b: 2 } },
            ],
            toolResults: [toolResult],
          };
        }

        if (userMessage.includes("confirm") && userMessage.includes("16")) {
          return {
            text: "Yes, the final result is 16.",
            toolCalls: [],
            toolResults: [],
          };
        }

        // Tool validation scenario - deliberately use wrong tool
        if (
          userMessage.includes("Use the add tool") &&
          config.tools?.multiply
        ) {
          const toolResult = await config.tools.multiply.execute({
            a: 2,
            b: 2,
          });
          return {
            text: "I'll use multiply instead of add.",
            toolCalls: [
              { toolCallId: "1", toolName: "multiply", args: { a: 2, b: 2 } },
            ],
            toolResults: [{ toolCallId: "1", result: toolResult }],
          };
        }

        // Default response for other requests
        return {
          text: "I'll help you with that.",
          toolCalls: [],
          toolResults: [],
        };
      },
    );

    // Mock successful tool operations
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
            required: ["a", "b"],
          },
        },
        {
          name: "multiply",
          description: "Multiply two numbers",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
            required: ["a", "b"],
          },
        },
      ],
    });

    // Default tool call responses - return the calculated values directly (MCP format)
    mockClient.callTool.mockImplementation(
      async ({
        name,
        arguments: args,
      }: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        if (name === "add") {
          return {
            content: [
              {
                type: "text",
                text: String((args.a as number) + (args.b as number)),
              },
            ],
          };
        }
        if (name === "multiply") {
          return {
            content: [
              {
                type: "text",
                text: String((args.a as number) * (args.b as number)),
              },
            ],
          };
        }
        return { content: [{ type: "text", text: "unknown" }] };
      },
    );
  });

  afterEach(() => {
    // Cleanup temp files and env
    try {
      unlinkSync(configPath);
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.ANTHROPIC_API_KEY;
  });

  function createTestConfig(overrides: any = {}) {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
        args: ["example/simple-mcp-server.js"],
      },
      workflows: [
        {
          name: "basic-math",
          description: "Test basic mathematical operations",
          steps: [
            {
              user: "Calculate 2 + 2",
              expectTools: ["add"],
              expectedState: "4",
            },
          ],
        },
      ],
      toolHealthSuites: [
        {
          name: "math-operations",
          description: "Test mathematical tool operations",
          tests: [
            {
              name: "add",
              description: "Test addition",
              args: { a: 2, b: 3 },
              expectedResult: { content: [{ type: "text", text: "5" }] },
            },
            {
              name: "multiply",
              description: "Test multiplication",
              args: { a: 3, b: 4 },
              expectedResult: { content: [{ type: "text", text: "12" }] },
            },
          ],
        },
      ],
      timeout: 30000,
      ...overrides,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  describe("Full Evaluation Pipeline", () => {
    it("should successfully evaluate a complete configuration", async () => {
      createTestConfig();

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(1);

      // Check workflow evaluation
      const workflowEval = result.evaluations[0];
      expect(workflowEval.workflowName).toBe("basic-math");
      expect(workflowEval.passed).toBe(true);
      expect(workflowEval.results).toHaveLength(3); // 3 deterministic metrics

      // Check tool health results
      const toolHealth = result.toolHealthResults[0];
      expect(toolHealth.suiteName).toBe("math-operations");
      expect(toolHealth.passed).toBe(true);
      expect(toolHealth.totalTests).toBe(2);
      expect(toolHealth.passedTests).toBe(2);
      expect(toolHealth.failedTests).toBe(0);
    });

    it("should handle workflow failures gracefully", async () => {
      createTestConfig({
        workflows: [
          {
            name: "failing-workflow",
            steps: [
              {
                user: "Calculate something complex",
                expectTools: ["nonexistent_tool"],
                expectedState: "impossible_result",
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(false);
      expect(result.evaluations).toHaveLength(1);

      const workflowEval = result.evaluations[0];
      expect(workflowEval.passed).toBe(false);
      expect(workflowEval.overallScore).toBeLessThan(1.0);
    });

    it("should handle tool health test failures", async () => {
      createTestConfig({
        toolHealthSuites: [
          {
            name: "math-operations",
            description: "Test mathematical tool operations",
            tests: [
              {
                name: "add",
                description: "Test addition",
                args: { a: 2, b: 3 },
                expectedResult: { content: [{ type: "text", text: "5" }] },
              },
              {
                name: "multiply",
                description: "Test multiplication",
                args: { a: 3, b: 4 },
                expectedResult: { content: [{ type: "text", text: "100" }] }, // Wrong expected result
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(false);
      expect(result.toolHealthResults).toHaveLength(1);

      const toolHealth = result.toolHealthResults[0];
      expect(toolHealth.passed).toBe(false);
      expect(toolHealth.passedTests).toBe(1);
      expect(toolHealth.failedTests).toBe(1);
    });

    it("should handle mixed success and failure", async () => {
      createTestConfig({
        workflows: [
          {
            name: "successful-workflow",
            steps: [
              {
                user: "Calculate 2 + 2",
                expectTools: ["add"],
                expectedState: "4",
              },
            ],
          },
          {
            name: "failing-workflow",
            steps: [
              {
                user: "Do something impossible",
                expectTools: ["nonexistent"],
                expectedState: "impossible",
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(false); // Overall should fail due to one failing workflow
      expect(result.evaluations).toHaveLength(2);
      expect(result.toolHealthResults).toHaveLength(1);

      // Check individual results
      const successfulWorkflow = result.evaluations.find(
        (e) => e.workflowName === "successful-workflow",
      );
      const failingWorkflow = result.evaluations.find(
        (e) => e.workflowName === "failing-workflow",
      );

      expect(successfulWorkflow?.passed).toBe(true);
      expect(failingWorkflow?.passed).toBe(false);
      expect(result.toolHealthResults[0].passed).toBe(true);
    });
  });

  describe("Configuration Variations", () => {
    it("should handle workflows-only configuration", async () => {
      createTestConfig({
        toolHealthSuites: [], // Remove tool health suites
      });

      const result = await evaluate(configPath, { workflowsOnly: true });

      expect(result.passed).toBe(true);
      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(0);
    });

    it("should handle tool-health-only configuration", async () => {
      createTestConfig({
        workflows: [], // Remove workflows
      });

      const result = await evaluate(configPath, { toolHealthOnly: true });

      expect(result.passed).toBe(true);
      expect(result.evaluations).toHaveLength(0);
      expect(result.toolHealthResults).toHaveLength(1);
    });

    it("should handle HTTP server configuration", async () => {
      createTestConfig({
        server: {
          transport: "shttp",
          url: "https://api.example.com/mcp",
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(1);
    });

    it("should handle environment variable substitution", async () => {
      process.env.TEST_SERVER_PORT = "3000";
      process.env.TEST_API_KEY = "secret-key";

      createTestConfig({
        server: {
          transport: "stdio",
          command: "node",
          args: ["server.js", "--port", "${TEST_SERVER_PORT}"],
          env: {
            API_KEY: "${TEST_API_KEY}",
          },
        },
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      // Note: "node" command gets resolved to process.execPath in the real implementation
      expect(mockExeca).toHaveBeenCalledWith(
        process.execPath, // Use process.execPath since that's what the real code does
        ["server.js", "--port", "3000"],
        expect.objectContaining({
          env: expect.objectContaining({
            API_KEY: "secret-key",
          }),
        }),
      );

      delete process.env.TEST_SERVER_PORT;
      delete process.env.TEST_API_KEY;
    });
  });

  describe("Error Handling", () => {
    it("should handle server connection failures", async () => {
      createTestConfig();

      mockClient.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(evaluate(configPath)).rejects.toThrow("Connection failed");
    });

    it("should handle tool listing failures", async () => {
      createTestConfig();

      mockClient.listTools.mockRejectedValue(new Error("Failed to list tools"));

      await expect(evaluate(configPath)).rejects.toThrow(
        "Failed to list tools",
      );
    });

    it("should handle tool call timeouts", async () => {
      createTestConfig({
        workflows: [], // Remove workflows to focus only on tool health
        toolHealthSuites: [
          {
            name: "timeout-suite",
            timeout: 100, // Very short timeout
            tests: [
              {
                name: "slow_tool",
                args: { delay: 1000 },
              },
            ],
          },
        ],
      });

      // Mock slow tool call that takes longer than the timeout
      mockClient.callTool.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ content: [{ type: "text", text: "too late" }] }),
              200,
            ),
          ),
      );

      const result = await evaluate(configPath);

      expect(result.passed).toBe(false);
      expect(result.toolHealthResults[0].passedTests).toBe(0);
      expect(result.toolHealthResults[0].failedTests).toBe(1);
    });

    it("should handle malformed configuration files", async () => {
      writeFileSync(configPath, "{ invalid json");

      await expect(evaluate(configPath)).rejects.toThrow();
    });

    it("should handle missing required fields", async () => {
      createTestConfig({
        server: undefined, // Missing required server config
      });

      await expect(evaluate(configPath)).rejects.toThrow();
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle multiple parallel tool health tests", async () => {
      createTestConfig({
        toolHealthSuites: [
          {
            name: "parallel-suite",
            parallel: true,
            tests: [
              {
                name: "add",
                args: { a: 1, b: 2 },
                expectedResult: { content: [{ type: "text", text: "3" }] },
              },
              {
                name: "add",
                args: { a: 3, b: 4 },
                expectedResult: { content: [{ type: "text", text: "7" }] },
              },
              {
                name: "multiply",
                args: { a: 2, b: 3 },
                expectedResult: { content: [{ type: "text", text: "6" }] },
              },
              {
                name: "multiply",
                args: { a: 4, b: 5 },
                expectedResult: { content: [{ type: "text", text: "20" }] },
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.toolHealthResults[0].totalTests).toBe(4);
      expect(result.toolHealthResults[0].passedTests).toBe(4);
    });

    it("should handle retries correctly", async () => {
      createTestConfig({
        workflows: [], // Remove workflows to avoid interference with call counting
        toolHealthSuites: [
          {
            name: "retry-suite",
            tests: [
              {
                name: "flaky_tool",
                args: { attempt: 1 },
                retries: 2,
                expectedResult: {
                  content: [{ type: "text", text: "success" }],
                },
              },
            ],
          },
        ],
      });

      // Reset mock call count before this test
      mockClient.callTool.mockClear();

      // Mock to fail twice, then succeed
      mockClient.callTool
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Another failure"))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "success" }],
        });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.toolHealthResults[0].passedTests).toBe(1);
      expect(result.toolHealthResults[0].results[0].retryCount).toBe(1);
      // Only check flaky_tool calls, not the workflow tool calls
      expect(mockClient.callTool).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should measure latency accurately", async () => {
      createTestConfig({
        workflows: [], // Remove workflows to focus on tool health only
        toolHealthSuites: [
          {
            name: "latency-suite",
            tests: [
              {
                name: "add",
                args: { a: 1, b: 2 },
                maxLatency: 1000, // 1 second max
                expectedResult: { content: [{ type: "text", text: "3" }] },
              },
            ],
          },
        ],
      });

      // Mock tool call with delay
      mockClient.callTool.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ content: [{ type: "text", text: "3" }] }),
              50,
            ),
          ),
      );

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.toolHealthResults[0].results[0].latency).toBeGreaterThan(
        40,
      );
      expect(result.toolHealthResults[0].results[0].latency).toBeLessThan(200);
      expect(result.toolHealthResults[0].averageLatency).toBeGreaterThan(40);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle complex multi-step workflow", async () => {
      createTestConfig({
        workflows: [
          {
            name: "complex-calculation",
            description: "Multi-step mathematical calculation",
            steps: [
              {
                user: "First, calculate 5 + 3",
                expectTools: ["add"],
              },
              {
                user: "Then multiply the result by 2",
                expectTools: ["multiply"],
              },
              {
                user: "Finally, confirm the result is 16",
                expectedState: "16",
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.passed).toBe(true);
      expect(result.evaluations[0].workflowName).toBe("complex-calculation");
      expect(result.evaluations[0].passed).toBe(true);
    });

    it("should validate tool expectations correctly", async () => {
      createTestConfig({
        workflows: [
          {
            name: "tool-validation",
            steps: [
              {
                user: "Use the add tool to calculate 2 + 2",
                expectTools: ["add"],
                expectedState: "4",
              },
            ],
          },
        ],
      });

      const result = await evaluate(configPath);

      expect(result.evaluations[0].passed).toBe(true);

      // Find the tool invocation order metric
      const toolOrderMetric = result.evaluations[0].results.find(
        (r) => r.metric === "Tool Invocation Order",
      );
      expect(toolOrderMetric?.passed).toBe(true);
    });
  });
});
