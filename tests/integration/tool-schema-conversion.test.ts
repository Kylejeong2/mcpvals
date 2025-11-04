import { describe, it, expect, afterEach, vi } from "vitest";
import { ServerRunner } from "../../src/eval/core/runner.js";
import { TraceStore } from "../../src/eval/core/trace.js";
import { ServerConfig } from "../../src/eval/core/config.js";

// Mock AI SDK - must be done at module level for ESM
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({
    modelId,
    provider: "anthropic",
  })),
}));

vi.mock("ai", () => ({
  tool: vi.fn(({ execute, parameters, description }) => ({
    parameters: parameters || {},
    description: description || "",
    execute,
  })),
  generateText: vi.fn(),
}));

describe("Tool Schema Conversion Integration", () => {
  let runner: ServerRunner;
  let traceStore: TraceStore;

  afterEach(async () => {
    if (runner) {
      await runner.stop();
      runner = undefined as any;
    }
  });

  describe("complex nested object schemas", () => {
    it("should convert nested object schemas correctly", async () => {
      // Create a mock server config that will provide complex tool schemas
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/complex-schema-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      // Mock the listTools response with complex nested schema
      const mockComplexTools = [
        {
          name: "create_session",
          description: "Create a browser session with complex configuration",
          inputSchema: {
            type: "object",
            properties: {
              projectId: {
                type: "string",
                description: "Project identifier",
                minLength: 1,
              },
              options: {
                type: "object",
                properties: {
                  timeout: {
                    type: "number",
                    minimum: 0,
                    maximum: 300000,
                    default: 30000,
                  },
                  viewport: {
                    type: "object",
                    properties: {
                      width: {
                        type: "integer",
                        minimum: 100,
                        maximum: 3840,
                      },
                      height: {
                        type: "integer",
                        minimum: 100,
                        maximum: 2160,
                      },
                    },
                    required: ["width", "height"],
                  },
                  browserSettings: {
                    type: "object",
                    properties: {
                      cookies: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            value: { type: "string" },
                            domain: { type: "string" },
                            path: { type: "string", default: "/" },
                            secure: { type: "boolean", default: false },
                          },
                          required: ["name", "value"],
                        },
                        minItems: 0,
                        maxItems: 50,
                      },
                      headers: {
                        type: "object",
                        additionalProperties: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
            required: ["projectId"],
            additionalProperties: false,
          },
        },
      ];

      // Mock listTools to return our complex schema
      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockComplexTools);

      // Get the AI tools - this triggers the conversion
      const aiTools = await (runner as any).getMcpToolsForAI();

      // Verify tool was registered
      expect(aiTools).toHaveProperty("create_session");
      expect(aiTools.create_session).toBeDefined();
      expect(aiTools.create_session.description).toBe(
        "Create a browser session with complex configuration",
      );

      // Verify parameters schema was converted correctly by testing validation
      const toolExecute = aiTools.create_session.execute;
      expect(toolExecute).toBeDefined();

      // Mock callTool to test parameter validation
      const mockCallTool = vi.spyOn(runner, "callTool").mockResolvedValue({
        content: [{ type: "text", text: "Session created" }],
      });

      // Test valid minimal input
      await toolExecute({ projectId: "proj-123" });
      expect(mockCallTool).toHaveBeenCalledWith("create_session", {
        projectId: "proj-123",
      });

      // Test valid complex input
      const complexInput = {
        projectId: "proj-456",
        options: {
          timeout: 60000,
          viewport: { width: 1920, height: 1080 },
          browserSettings: {
            cookies: [
              {
                name: "session",
                value: "abc123",
                domain: "example.com",
                secure: true,
              },
            ],
            headers: {
              "User-Agent": "Test/1.0",
            },
          },
        },
      };

      await toolExecute(complexInput);
      expect(mockCallTool).toHaveBeenCalledWith("create_session", complexInput);
    });
  });

  describe("enum and union type schemas", () => {
    it("should convert enum schemas correctly", async () => {
      const mockEnumTools = [
        {
          name: "set_status",
          description: "Set status with enum",
          inputSchema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["pending", "active", "completed", "cancelled"],
                description: "Status value",
              },
            },
            required: ["status"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/enum-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockEnumTools);

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("set_status");
      expect(aiTools.set_status.parameters).toBeDefined();
    });

    it("should convert anyOf/oneOf unions correctly", async () => {
      const mockUnionTools = [
        {
          name: "process_input",
          description: "Process string or number input",
          inputSchema: {
            type: "object",
            properties: {
              value: {
                anyOf: [{ type: "string" }, { type: "number" }],
                description: "String or number value",
              },
            },
            required: ["value"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/union-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockUnionTools);

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("process_input");

      const mockCallTool = vi.spyOn(runner, "callTool").mockResolvedValue({
        content: [{ type: "text", text: "Processed" }],
      });

      // Should accept both string and number
      await aiTools.process_input.execute({ value: "test" });
      await aiTools.process_input.execute({ value: 123 });

      expect(mockCallTool).toHaveBeenCalledTimes(2);
    });
  });

  describe("array and tuple schemas", () => {
    it("should convert typed array schemas correctly", async () => {
      const mockArrayTools = [
        {
          name: "batch_process",
          description: "Process multiple items",
          inputSchema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["id", "value"],
                },
                minItems: 1,
                maxItems: 100,
              },
            },
            required: ["items"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/array-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockArrayTools);

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("batch_process");

      const mockCallTool = vi.spyOn(runner, "callTool").mockResolvedValue({
        content: [{ type: "text", text: "Processed" }],
      });

      await aiTools.batch_process.execute({
        items: [
          { id: "1", value: 100 },
          { id: "2", value: 200 },
        ],
      });

      expect(mockCallTool).toHaveBeenCalledWith("batch_process", {
        items: [
          { id: "1", value: 100 },
          { id: "2", value: 200 },
        ],
      });
    });
  });

  describe("string and number constraints", () => {
    it("should convert string constraints (pattern, minLength, maxLength)", async () => {
      const mockConstraintTools = [
        {
          name: "validate_email",
          description: "Validate email with constraints",
          inputSchema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email",
                description: "Email address",
              },
              username: {
                type: "string",
                pattern: "^[a-z0-9_]+$",
                minLength: 3,
                maxLength: 20,
              },
            },
            required: ["email", "username"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/constraint-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(
        mockConstraintTools,
      );

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("validate_email");
      expect(aiTools.validate_email.parameters).toBeDefined();
    });

    it("should convert number constraints (min, max, exclusive)", async () => {
      const mockNumberTools = [
        {
          name: "set_range",
          description: "Set numeric range",
          inputSchema: {
            type: "object",
            properties: {
              percentage: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              count: {
                type: "integer",
                exclusiveMinimum: 0,
                exclusiveMaximum: 1000,
              },
            },
            required: ["percentage", "count"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/number-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockNumberTools);

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("set_range");
      expect(aiTools.set_range.parameters).toBeDefined();
    });
  });

  describe("debug mode output", () => {
    it("should log comprehensive debug information", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const mockTools = [
        {
          name: "test_tool",
          description: "Test tool with schema",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/debug-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: true });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockTools);

      await (runner as any).getMcpToolsForAI();

      // Verify debug logs were created
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);

      // Check for key debug messages
      expect(calls.some((call) => call.includes("[DEBUG:AI_TOOLS]"))).toBe(
        true,
      );
      expect(calls.some((call) => call.includes("[DEBUG:TOOL_SCHEMA]"))).toBe(
        true,
      );
      expect(calls.some((call) => call.includes("[DEBUG:CONVERSION]"))).toBe(
        true,
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe("real-world schema examples", () => {
    it("should handle GitHub API-style schema", async () => {
      const mockGitHubTools = [
        {
          name: "create_issue",
          description: "Create a GitHub issue",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", minLength: 1 },
              repo: { type: "string", minLength: 1 },
              title: { type: "string", minLength: 1, maxLength: 256 },
              body: { type: "string" },
              assignees: {
                type: "array",
                items: { type: "string" },
              },
              labels: {
                type: "array",
                items: { type: "string" },
              },
              milestone: { type: "integer", minimum: 1 },
            },
            required: ["owner", "repo", "title"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/github-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(mockGitHubTools);

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("create_issue");

      const mockCallTool = vi.spyOn(runner, "callTool").mockResolvedValue({
        content: [{ type: "text", text: "Issue created" }],
      });

      // Test minimal valid input
      await aiTools.create_issue.execute({
        owner: "octocat",
        repo: "hello-world",
        title: "Bug report",
      });

      // Test with optional fields
      await aiTools.create_issue.execute({
        owner: "octocat",
        repo: "hello-world",
        title: "Feature request",
        body: "Please add feature X",
        labels: ["enhancement", "help wanted"],
        assignees: ["octocat"],
      });

      expect(mockCallTool).toHaveBeenCalledTimes(2);
    });

    it("should handle Browserbase-style nested schema", async () => {
      const mockBrowserbaseTools = [
        {
          name: "browserbase_session_create",
          description: "Create a Browserbase session",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              browserSettings: {
                type: "object",
                properties: {
                  viewport: {
                    type: "object",
                    properties: {
                      width: { type: "integer" },
                      height: { type: "integer" },
                    },
                  },
                  context: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                    },
                  },
                },
              },
              proxies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["http", "https", "socks4", "socks5"],
                    },
                    server: { type: "string" },
                  },
                },
              },
            },
            required: ["projectId"],
          },
        },
      ];

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["./tests/fixtures/browserbase-server.js"],
      };

      traceStore = new TraceStore();
      runner = new ServerRunner(serverConfig, traceStore, { debug: false });

      vi.spyOn(runner as any, "listTools").mockResolvedValue(
        mockBrowserbaseTools,
      );

      const aiTools = await (runner as any).getMcpToolsForAI();

      expect(aiTools).toHaveProperty("browserbase_session_create");

      const mockCallTool = vi.spyOn(runner, "callTool").mockResolvedValue({
        content: [{ type: "text", text: "Session created: sess-123" }],
      });

      // Test with nested options
      await aiTools.browserbase_session_create.execute({
        projectId: "proj-xyz",
        browserSettings: {
          viewport: { width: 1920, height: 1080 },
          context: { id: "ctx-abc" },
        },
        proxies: [{ type: "https", server: "proxy.example.com:8080" }],
      });

      expect(mockCallTool).toHaveBeenCalledWith("browserbase_session_create", {
        projectId: "proj-xyz",
        browserSettings: {
          viewport: { width: 1920, height: 1080 },
          context: { id: "ctx-abc" },
        },
        proxies: [{ type: "https", server: "proxy.example.com:8080" }],
      });
    });
  });
});
