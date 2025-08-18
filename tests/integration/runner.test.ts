import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { ServerRunner } from "../../src/eval/core/runner";
import { TraceStore } from "../../src/eval/core/trace";
import { ServerConfig } from "../../src/eval/core/config";

// Mock external dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    close: vi.fn(),
  })),
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

describe("ServerRunner", () => {
  let traceStore: TraceStore;
  let mockClient: {
    connect: Mock;
    listTools: Mock;
    callTool: Mock;
    close: Mock;
  };
  let mockTransport: object;
  let mockExeca: Mock;

  beforeEach(async () => {
    traceStore = new TraceStore();

    mockClient = {
      connect: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    mockTransport = {};
    mockExeca = vi.fn();

    // Setup mocks using dynamic imports
    const clientModule = await import(
      "@modelcontextprotocol/sdk/client/index.js"
    );
    const stdioModule = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );
    const httpModule = await import(
      "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );
    const execaModule = await import("execa");

    vi.mocked(clientModule.Client).mockImplementation(() => mockClient as any);
    vi.mocked(stdioModule.StdioClientTransport).mockImplementation(
      () => mockTransport as any,
    );
    vi.mocked(httpModule.StreamableHTTPClientTransport).mockImplementation(
      () => mockTransport as any,
    );
    vi.mocked(execaModule.execa).mockImplementation(mockExeca);

    // Mock process for stdio
    mockExeca.mockReturnValue({
      stdout: "mock stdout",
      stderr: "mock stderr",
      kill: vi.fn(),
    });
  });

  describe("Stdio Server", () => {
    it("should start stdio server successfully", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: { NODE_ENV: "test" },
      };

      const runner = new ServerRunner(serverConfig, traceStore, {
        debug: true,
      });

      await runner.start();

      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    it("should handle node command specially", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      // Should use process.execPath instead of "node"
      expect(mockExeca).toHaveBeenCalledWith(
        process.execPath,
        ["server.js"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    });

    it("should merge environment variables", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "test-command",
        args: ["arg1"],
        env: { CUSTOM_VAR: "custom_value" },
      };

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      expect(mockExeca).toHaveBeenCalledWith(
        "test-command",
        ["arg1"],
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: "custom_value",
          }),
        }),
      );
    });

    it("should handle empty args array", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "test-command",
        args: [],
      };

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      expect(mockExeca).toHaveBeenCalledWith(
        "test-command",
        [],
        expect.any(Object),
      );
    });
  });

  describe("HTTP Server", () => {
    it("should start HTTP server successfully", async () => {
      const serverConfig: ServerConfig = {
        transport: "shttp",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
      };

      const runner = new ServerRunner(serverConfig, traceStore, {
        debug: true,
      });

      await runner.start();

      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    it("should create HTTP transport with correct options", async () => {
      const serverConfig: ServerConfig = {
        transport: "shttp",
        url: "https://api.example.com/mcp",
        headers: { "X-API-Key": "secret" },
      };

      const httpModule = await import(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
      );

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      expect(httpModule.StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL("https://api.example.com/mcp"),
        expect.objectContaining({
          requestInit: {
            headers: { "X-API-Key": "secret" },
          },
          reconnectionOptions: expect.any(Object),
        }),
      );
    });

    it("should handle HTTP server without headers", async () => {
      const serverConfig: ServerConfig = {
        transport: "shttp",
        url: "https://example.com/mcp",
      };

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      expect(mockClient.connect).toHaveBeenCalled();
    });
  });

  describe("Tool Operations", () => {
    let runner: ServerRunner;

    beforeEach(async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();
    });

    it("should list tools", async () => {
      const mockTools = [
        { name: "add", description: "Add two numbers" },
        { name: "multiply", description: "Multiply two numbers" },
      ];

      mockClient.listTools.mockResolvedValueOnce({ tools: mockTools });

      const tools = await runner.listTools();

      expect(tools).toEqual(mockTools);
      expect(mockClient.listTools).toHaveBeenCalledOnce();
    });

    it("should handle empty tools list", async () => {
      mockClient.listTools.mockResolvedValueOnce({});

      const tools = await runner.listTools();

      expect(tools).toEqual([]);
    });

    it("should call tool successfully", async () => {
      const mockResponse = { result: "success", value: 42 };
      mockClient.callTool.mockResolvedValueOnce(mockResponse);

      const result = await runner.callTool("test_tool", { param: "value" });

      expect(result).toEqual(mockResponse);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "test_tool",
        arguments: { param: "value" },
      });

      // Check that tool call was recorded in trace store
      const toolCalls = traceStore.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe("test_tool");
      expect(toolCalls[0].arguments).toEqual({ param: "value" });

      // Check that result was recorded
      const toolResults = traceStore.getToolResults();
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].result).toEqual(mockResponse);
    });

    it("should handle tool call errors", async () => {
      const error = new Error("Tool execution failed");
      mockClient.callTool.mockRejectedValueOnce(error);

      await expect(
        runner.callTool("failing_tool", { param: "value" }),
      ).rejects.toThrow("Tool execution failed");

      // Check that error was recorded in trace store
      const toolResults = traceStore.getToolResults();
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].error).toBe("Tool execution failed");
      expect(toolResults[0].result).toBeNull();
    });

    it("should handle string errors", async () => {
      mockClient.callTool.mockRejectedValueOnce("String error");

      await expect(runner.callTool("failing_tool", {})).rejects.toThrow();

      const toolResults = traceStore.getToolResults();
      expect(toolResults[0].error).toBe("String error");
    });

    it("should generate unique tool call IDs", async () => {
      mockClient.callTool.mockResolvedValue({ result: "success" });

      await runner.callTool("tool1", {});
      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));
      await runner.callTool("tool2", {});

      const toolCalls = traceStore.getToolCalls();
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].id).not.toBe(toolCalls[1].id);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when getting client before start", () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: [],
      };

      const runner = new ServerRunner(serverConfig, traceStore);

      expect(() => runner.getClient()).toThrow("Server not started");
    });

    it("should throw error for invalid stdio config", async () => {
      const serverConfig = {
        transport: "shttp",
        url: "https://example.com",
      } as ServerConfig;

      const runner = new ServerRunner(serverConfig, traceStore);

      // Force call to startStdioServer with wrong config
      await expect(async () => {
        // @ts-expect-error - accessing private method for testing
        await runner.startStdioServer();
      }).rejects.toThrow("Invalid server config for stdio");
    });

    it("should throw error for invalid HTTP config", async () => {
      const serverConfig = {
        transport: "stdio",
        command: "node",
        args: [],
      } as ServerConfig;

      const runner = new ServerRunner(serverConfig, traceStore);

      // Force call to startHttpServer with wrong config
      await expect(async () => {
        // @ts-expect-error - accessing private method for testing
        await runner.startHttpServer();
      }).rejects.toThrow("Invalid server config for HTTP");
    });
  });

  describe("Workflow Execution", () => {
    let runner: ServerRunner;

    beforeEach(async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      // Mock AI SDK
      const aiModule = await import("ai");
      const anthropicModule = await import("@ai-sdk/anthropic");

      // @ts-expect-error - Mock implementations don't need full interface
      vi.mocked(anthropicModule.createAnthropic).mockReturnValue(() => ({
        specificationVersion: "v1",
        provider: "anthropic",
        modelId: "mock-model",
        defaultObjectGenerationMode: "json",
        maxTokens: 4096,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      }));
      // @ts-expect-error - Mock implementations don't need full interface
      vi.mocked(aiModule.tool).mockReturnValue({});
      // @ts-expect-error - Mock implementations don't need full interface
      vi.mocked(aiModule.generateText).mockResolvedValue({
        text: "Test response",
        toolCalls: [],
        toolResults: [],
      });
    });

    it("should execute workflow with LLM", async () => {
      // Set up ANTHROPIC_API_KEY for the test
      process.env.ANTHROPIC_API_KEY = "test-api-key";

      const steps = [{ user: "Calculate 2 + 2", expectTools: ["add"] }];

      // Mock tools list
      mockClient.listTools.mockResolvedValueOnce({
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
            },
          },
        ],
      });

      const result = await runner.runWorkflowWithLLM(steps);

      expect(result.success).toBe(true);
      expect(result.messages).toBeDefined();
      expect(result.toolCalls).toBeDefined();
      expect(result.conversationText).toBeDefined();

      // Clean up
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("should handle workflow execution errors", async () => {
      const steps = [{ user: "Test step" }];

      // Mock generateText to throw error
      const aiModule = await import("ai");
      vi.mocked(aiModule.generateText).mockRejectedValueOnce(
        new Error("AI generation failed"),
      );

      mockClient.listTools.mockResolvedValueOnce({ tools: [] });

      const result = await runner.runWorkflowWithLLM(steps);

      expect(result.success).toBe(false);
      expect(result.messages).toBeDefined();
      expect(result.toolCalls).toBeDefined();
    });
  });

  describe("Cleanup", () => {
    it("should stop server and kill process", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const mockProcess = {
        kill: vi.fn(),
      };

      mockExeca.mockReturnValue(mockProcess);

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      await runner.stop();

      expect(mockClient.close).toHaveBeenCalled();
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should handle stop when no process exists", async () => {
      const serverConfig: ServerConfig = {
        transport: "shttp",
        url: "https://example.com/mcp",
      };

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      // Should not throw
      await expect(runner.stop()).resolves.not.toThrow();
    });

    it("should handle kill errors gracefully", async () => {
      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: [],
      };

      const mockProcess = {
        kill: vi.fn().mockImplementation(() => {
          throw new Error("Process already dead");
        }),
      };

      mockExeca.mockReturnValue(mockProcess);

      const runner = new ServerRunner(serverConfig, traceStore);
      await runner.start();

      // The error should propagate from kill()
      await expect(runner.stop()).rejects.toThrow("Process already dead");
      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe("Debug Mode", () => {
    it("should log debug information when enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const runner = new ServerRunner(serverConfig, traceStore, {
        debug: true,
      });
      await runner.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Connected to stdio MCP server"),
      );

      consoleSpy.mockRestore();
    });

    it("should not log debug information when disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const serverConfig: ServerConfig = {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const runner = new ServerRunner(serverConfig, traceStore, {
        debug: false,
      });
      await runner.start();

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Connected to stdio MCP server"),
      );

      consoleSpy.mockRestore();
    });
  });
});
