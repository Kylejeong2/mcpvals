import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { evaluate } from "../src/eval/index";
import { Config, createToolName } from "../src/eval/config";
import { WorkflowEvaluation } from "../src/eval/deterministic";
import { ToolHealthResult } from "../src/eval/tool-health";

// Mock all dependencies
vi.mock("../src/eval/config", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

vi.mock("../src/eval/runner", () => ({
  ServerRunner: vi.fn(),
}));

vi.mock("../src/eval/deterministic", () => ({
  DeterministicEvaluator: vi.fn(),
}));

vi.mock("../src/eval/tool-health", () => ({
  ToolTester: vi.fn(),
}));

vi.mock("../src/eval/llm-judge", () => ({
  runLlmJudge: vi.fn(),
}));

vi.mock("../src/eval/reporters/console", () => ({
  ConsoleReporter: vi.fn(),
}));

describe("evaluate", () => {
  let mockLoadConfig: Mock;
  let mockServerRunner: {
    start: Mock;
    stop: Mock;
    listTools: Mock;
    runWorkflowWithLLM: Mock;
  };
  let mockDeterministicEvaluator: {
    evaluateWorkflow: Mock;
  };
  let mockToolTester: {
    validateTestSuite: Mock;
    runToolHealthSuite: Mock;
  };
  let mockRunLlmJudge: Mock;
  let mockConsoleReporter: {
    report: Mock;
    reportToolHealth: Mock;
    reportCombined: Mock;
    reportCombinedAll: Mock;
  };

  beforeEach(async () => {
    // Setup mocks
    mockLoadConfig = vi.fn();
    mockServerRunner = {
      start: vi.fn(),
      stop: vi.fn(),
      listTools: vi.fn(),
      runWorkflowWithLLM: vi.fn(),
    };
    mockDeterministicEvaluator = {
      evaluateWorkflow: vi.fn(),
    };
    mockToolTester = {
      validateTestSuite: vi.fn(),
      runToolHealthSuite: vi.fn(),
    };
    mockRunLlmJudge = vi.fn();
    mockConsoleReporter = {
      report: vi.fn(),
      reportToolHealth: vi.fn(),
      reportCombined: vi.fn(),
      reportCombinedAll: vi.fn(),
    };

    // Apply mocks using vi.mocked
    const configModule = await import("../src/eval/config");
    const runnerModule = await import("../src/eval/runner");
    const deterministicModule = await import("../src/eval/deterministic");
    const toolHealthModule = await import("../src/eval/tool-health");
    const llmJudgeModule = await import("../src/eval/llm-judge");
    const consoleReporterModule = await import("../src/eval/reporters/console");

    vi.mocked(configModule.loadConfig).mockImplementation(mockLoadConfig);
    vi.mocked(runnerModule.ServerRunner).mockImplementation(
      () =>
        mockServerRunner as unknown as InstanceType<
          typeof runnerModule.ServerRunner
        >,
    );
    vi.mocked(deterministicModule.DeterministicEvaluator).mockImplementation(
      () =>
        mockDeterministicEvaluator as unknown as InstanceType<
          typeof deterministicModule.DeterministicEvaluator
        >,
    );
    vi.mocked(toolHealthModule.ToolTester).mockImplementation(
      () =>
        mockToolTester as unknown as InstanceType<
          typeof toolHealthModule.ToolTester
        >,
    );
    vi.mocked(llmJudgeModule.runLlmJudge).mockImplementation(mockRunLlmJudge);
    vi.mocked(consoleReporterModule.ConsoleReporter).mockImplementation(
      () =>
        mockConsoleReporter as unknown as InstanceType<
          typeof consoleReporterModule.ConsoleReporter
        >,
    );

    // Default mock implementations
    mockLoadConfig.mockResolvedValue(createMockConfig());
    mockServerRunner.start.mockResolvedValue(undefined);
    mockServerRunner.stop.mockResolvedValue(undefined);
    mockServerRunner.listTools.mockResolvedValue([
      { name: "add", description: "Add numbers" },
      { name: "multiply", description: "Multiply numbers" },
    ]);
    mockServerRunner.runWorkflowWithLLM.mockResolvedValue({
      success: true,
      messages: [
        { role: "user", content: "Test" },
        { role: "assistant", content: "Response" },
      ],
      toolCalls: [],
      conversationText: "Test conversation",
    });
    mockDeterministicEvaluator.evaluateWorkflow.mockReturnValue(
      createMockWorkflowEvaluation(),
    );
    mockToolTester.validateTestSuite.mockResolvedValue({
      valid: true,
      missingTools: [],
      availableTools: ["add", "multiply"],
    });
    mockToolTester.runToolHealthSuite.mockResolvedValue(
      createMockToolHealthResult(),
    );
  });

  function createMockConfig(): Config {
    return {
      server: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      },
      workflows: [
        {
          name: "test-workflow",
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
          name: "math-suite",
          parallel: false,
          tests: [
            {
              name: createToolName("add"),
              args: { a: 2, b: 3 },
              expectedResult: 5,
              retries: 0,
            },
          ],
        },
      ],
      resourceSuites: [],
      promptSuites: [],
      samplingSuites: [],
      oauth2Suites: [],
      timeout: 30000,
      llmJudge: false,
      judgeModel: "gpt-4o",
      passThreshold: 0.8,
    };
  }

  function createMockWorkflowEvaluation(): WorkflowEvaluation {
    return {
      workflowName: "test-workflow",
      results: [
        {
          metric: "End-to-End Success",
          passed: true,
          score: 1.0,
          details: "Success",
        },
        {
          metric: "Tool Invocation Order",
          passed: true,
          score: 1.0,
          details: "Correct order",
        },
        {
          metric: "Tool Call Health",
          passed: true,
          score: 1.0,
          details: "All healthy",
        },
      ],
      overallScore: 1.0,
      passed: true,
    };
  }

  function createMockToolHealthResult(): ToolHealthResult {
    return {
      suiteName: "math-suite",
      results: [
        {
          testName: "add test",
          toolName: "add",
          passed: true,
          score: 1.0,
          latency: 50,
          details: "Success",
          retryCount: 0,
        },
      ],
      overallScore: 1.0,
      passed: true,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      averageLatency: 50,
    };
  }

  describe("Basic Evaluation", () => {
    it("should evaluate workflows and tool health suites", async () => {
      const result = await evaluate("test-config.json");

      expect(result.passed).toBe(true);
      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(1);
      expect(result.config).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      expect(mockLoadConfig).toHaveBeenCalledWith("test-config.json");
      expect(mockServerRunner.start).toHaveBeenCalled();
      expect(mockServerRunner.stop).toHaveBeenCalled();
    });

    it("should handle successful evaluation", async () => {
      const result = await evaluate("test-config.json");

      expect(result.passed).toBe(true);
      expect(result.evaluations[0].passed).toBe(true);
      expect(result.toolHealthResults[0].passed).toBe(true);
    });

    it("should handle failed workflow evaluation", async () => {
      const failedEvaluation = {
        ...createMockWorkflowEvaluation(),
        passed: false,
        overallScore: 0.5,
      };

      mockDeterministicEvaluator.evaluateWorkflow.mockReturnValue(
        failedEvaluation,
      );

      const result = await evaluate("test-config.json");

      expect(result.passed).toBe(false);
      expect(result.evaluations[0].passed).toBe(false);
    });

    it("should handle failed tool health evaluation", async () => {
      const failedToolHealth = {
        ...createMockToolHealthResult(),
        passed: false,
        overallScore: 0.3,
      };

      mockToolTester.runToolHealthSuite.mockResolvedValue(failedToolHealth);

      const result = await evaluate("test-config.json");

      expect(result.passed).toBe(false);
      expect(result.toolHealthResults[0].passed).toBe(false);
    });

    it("should stop server even on error", async () => {
      mockServerRunner.runWorkflowWithLLM.mockRejectedValue(
        new Error("Workflow failed"),
      );

      await expect(evaluate("test-config.json")).rejects.toThrow(
        "Workflow failed",
      );
      expect(mockServerRunner.stop).toHaveBeenCalled();
    });
  });

  describe("Configuration Validation", () => {
    it("should throw error if no workflows or tool health suites", async () => {
      const emptyConfig = {
        ...createMockConfig(),
        workflows: [],
        toolHealthSuites: [],
      };

      mockLoadConfig.mockResolvedValue(emptyConfig);

      await expect(evaluate("empty-config.json")).rejects.toThrow(
        "Configuration must include workflows, toolHealthSuites, resourceSuites, promptSuites, samplingSuites, or oauth2Suites",
      );
    });

    it("should handle workflows only", async () => {
      const workflowOnlyConfig = {
        ...createMockConfig(),
        toolHealthSuites: [],
      };

      mockLoadConfig.mockResolvedValue(workflowOnlyConfig);

      const result = await evaluate("workflow-only.json");

      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it("should handle tool health suites only", async () => {
      const toolHealthOnlyConfig = {
        ...createMockConfig(),
        workflows: [],
      };

      mockLoadConfig.mockResolvedValue(toolHealthOnlyConfig);

      const result = await evaluate("tool-health-only.json");

      expect(result.evaluations).toHaveLength(0);
      expect(result.toolHealthResults).toHaveLength(1);
      expect(result.passed).toBe(true);
    });
  });

  describe("Evaluation Options", () => {
    it("should run only workflows when workflowsOnly is true", async () => {
      const result = await evaluate("test-config.json", {
        workflowsOnly: true,
      });

      expect(result.evaluations).toHaveLength(1);
      expect(result.toolHealthResults).toHaveLength(0);
      expect(mockToolTester.runToolHealthSuite).not.toHaveBeenCalled();
    });

    it("should run only tool health when toolHealthOnly is true", async () => {
      const result = await evaluate("test-config.json", {
        toolHealthOnly: true,
      });

      expect(result.evaluations).toHaveLength(0);
      expect(result.toolHealthResults).toHaveLength(1);
      expect(mockServerRunner.runWorkflowWithLLM).not.toHaveBeenCalled();
    });

    it("should enable debug mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await evaluate("test-config.json", { debug: true });

      expect(consoleSpy).toHaveBeenCalledWith("Starting MCP server...");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Available tools:"),
      );

      consoleSpy.mockRestore();
    });

    it("should use different reporters", async () => {
      await evaluate("test-config.json", { reporter: "console" });

      expect(mockConsoleReporter.reportCombinedAll).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
      );
    });
  });

  describe("LLM Judge Integration", () => {
    it("should run LLM judge when enabled", async () => {
      const configWithLLM = {
        ...createMockConfig(),
        llmJudge: true,
        openaiKey: "test-key",
      };

      mockLoadConfig.mockResolvedValue(configWithLLM);
      mockRunLlmJudge.mockResolvedValue({
        score: 0.9,
        reason: "Excellent workflow execution",
      });

      const result = await evaluate("test-config.json", { llmJudge: true });

      expect(mockRunLlmJudge).toHaveBeenCalledWith({
        model: "gpt-4o",
        apiKey: "test-key",
        workflow: expect.any(Object),
        traceStore: expect.any(Object),
        maxMessages: 20,
      });

      expect(result.evaluations[0].results).toHaveLength(4); // 3 deterministic + 1 LLM judge
      const llmResult = result.evaluations[0].results.find(
        (r) => r.metric === "LLM Judge",
      );
      expect(llmResult?.passed).toBe(true);
      expect(llmResult?.score).toBe(0.9);
    });

    it("should handle LLM judge failures", async () => {
      const configWithLLM = {
        ...createMockConfig(),
        llmJudge: true,
        openaiKey: "test-key",
      };

      mockLoadConfig.mockResolvedValue(configWithLLM);
      mockRunLlmJudge.mockRejectedValue(new Error("API error"));

      const result = await evaluate("test-config.json", { llmJudge: true });

      const llmResult = result.evaluations[0].results.find(
        (r) => r.metric === "LLM Judge",
      );
      expect(llmResult?.passed).toBe(false);
      expect(llmResult?.score).toBe(0);
      expect(llmResult?.details).toContain("Evaluation failed");
    });

    it("should skip LLM judge when not configured", async () => {
      const result = await evaluate("test-config.json", { llmJudge: true });

      expect(mockRunLlmJudge).not.toHaveBeenCalled();
      expect(result.evaluations[0].results).toHaveLength(3); // Only deterministic metrics
    });

    it("should apply pass threshold correctly", async () => {
      const configWithLLM = {
        ...createMockConfig(),
        llmJudge: true,
        openaiKey: "test-key",
        passThreshold: 0.9,
      };

      mockLoadConfig.mockResolvedValue(configWithLLM);
      mockRunLlmJudge.mockResolvedValue({
        score: 0.85, // Below threshold
        reason: "Good but not excellent",
      });

      const result = await evaluate("test-config.json", { llmJudge: true });

      const llmResult = result.evaluations[0].results.find(
        (r) => r.metric === "LLM Judge",
      );
      expect(llmResult?.passed).toBe(false);
      expect(llmResult?.score).toBe(0.85);
    });
  });

  describe("Tool Health Validation", () => {
    it("should warn about missing tools", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockToolTester.validateTestSuite.mockResolvedValue({
        valid: false,
        missingTools: ["subtract", "divide"],
        availableTools: ["add", "multiply"],
      });

      await evaluate("test-config.json");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing tools: subtract, divide"),
      );

      consoleSpy.mockRestore();
    });

    it("should log available tools in debug mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockToolTester.validateTestSuite.mockResolvedValue({
        valid: false,
        missingTools: ["subtract"],
        availableTools: ["add", "multiply"],
      });

      await evaluate("test-config.json", { debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Available tools: add, multiply"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Multiple Workflows and Suites", () => {
    it("should handle multiple workflows", async () => {
      const multiWorkflowConfig = {
        ...createMockConfig(),
        workflows: [
          {
            name: "workflow-1",
            steps: [{ user: "Test 1" }],
          },
          {
            name: "workflow-2",
            steps: [{ user: "Test 2" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(multiWorkflowConfig);

      const result = await evaluate("multi-workflow.json");

      expect(result.evaluations).toHaveLength(2);
      expect(mockServerRunner.runWorkflowWithLLM).toHaveBeenCalledTimes(2);
      expect(mockDeterministicEvaluator.evaluateWorkflow).toHaveBeenCalledTimes(
        2,
      );
    });

    it("should handle multiple tool health suites", async () => {
      const multiSuiteConfig = {
        ...createMockConfig(),
        toolHealthSuites: [
          {
            name: "suite-1",
            tests: [{ name: "test1", args: {} }],
          },
          {
            name: "suite-2",
            tests: [{ name: "test2", args: {} }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(multiSuiteConfig);

      const result = await evaluate("multi-suite.json");

      expect(result.toolHealthResults).toHaveLength(2);
      expect(mockToolTester.runToolHealthSuite).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle config loading errors", async () => {
      mockLoadConfig.mockRejectedValue(new Error("Config not found"));

      await expect(evaluate("missing-config.json")).rejects.toThrow(
        "Config not found",
      );
    });

    it("should handle server start errors", async () => {
      mockServerRunner.start.mockRejectedValue(
        new Error("Server start failed"),
      );

      await expect(evaluate("test-config.json")).rejects.toThrow(
        "Server start failed",
      );
    });

    it("should handle tool listing errors", async () => {
      mockServerRunner.listTools.mockRejectedValue(
        new Error("Tools list failed"),
      );

      await expect(evaluate("test-config.json")).rejects.toThrow(
        "Tools list failed",
      );
    });
  });

  describe("Reporter Selection", () => {
    it("should use console reporter for workflows only", async () => {
      const workflowOnlyConfig = {
        ...createMockConfig(),
        toolHealthSuites: [],
      };

      mockLoadConfig.mockResolvedValue(workflowOnlyConfig);

      await evaluate("workflow-only.json");

      expect(mockConsoleReporter.report).toHaveBeenCalledWith(
        expect.any(Array),
      );
    });

    it("should use console reporter for tool health only", async () => {
      const toolHealthOnlyConfig = {
        ...createMockConfig(),
        workflows: [],
      };

      mockLoadConfig.mockResolvedValue(toolHealthOnlyConfig);

      await evaluate("tool-health-only.json");

      expect(mockConsoleReporter.reportToolHealth).toHaveBeenCalledWith(
        expect.any(Array),
      );
    });

    it("should use combined reporter for both", async () => {
      await evaluate("test-config.json");

      expect(mockConsoleReporter.reportCombinedAll).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
      );
    });
  });
});
