import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConsoleReporter } from "../../../src/eval/reporters/console";
import { WorkflowEvaluation } from "../../../src/types/evaluation.js";
import { ToolHealthResult } from "../../../src/types/tool.js";

describe("ConsoleReporter", () => {
  let reporter: ConsoleReporter;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];

    mockConsoleLog = vi
      .spyOn(console, "log")
      .mockImplementation((message: string) => {
        logOutput.push(message);
      });

    mockConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation((message: string) => {
        logOutput.push(`ERROR: ${message}`);
      });

    reporter = new ConsoleReporter();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  function createMockWorkflowEvaluation(
    overrides: Partial<WorkflowEvaluation> = {},
  ): WorkflowEvaluation {
    return {
      workflowName: "test-workflow",
      results: [
        {
          metric: "End-to-End Success",
          passed: true,
          score: 1.0,
          details: "Successfully reached expected state",
        },
        {
          metric: "Tool Invocation Order",
          passed: true,
          score: 1.0,
          details: "All tools called in correct order",
        },
        {
          metric: "Tool Call Health",
          passed: true,
          score: 1.0,
          details: "All tool calls completed successfully",
        },
      ],
      overallScore: 1.0,
      passed: true,
      ...overrides,
    };
  }

  function createMockToolHealthResult(
    overrides: Partial<ToolHealthResult> = {},
  ): ToolHealthResult {
    return {
      suiteName: "math-suite",
      results: [
        {
          testName: "add test",
          toolName: "add",
          passed: true,
          score: 1.0,
          latency: 50,
          details: "Tool call successful",
          retryCount: 0,
        },
      ],
      overallScore: 1.0,
      passed: true,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      averageLatency: 50,
      ...overrides,
    };
  }

  describe("Workflow Evaluation Reporting", () => {
    it("should report successful workflow evaluation", () => {
      const evaluation = createMockWorkflowEvaluation();

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("MCP Server Evaluation Results");
      expect(output).toContain("test-workflow");
      expect(output).toContain("✓ PASSED");
      expect(output).toContain("Overall Score: 100.0%");
      expect(output).toContain("End-to-End Success: 100.0%");
      expect(output).toContain("Tool Invocation Order: 100.0%");
      expect(output).toContain("Tool Call Health: 100.0%");
    });

    it("should report failed workflow evaluation", () => {
      const evaluation = createMockWorkflowEvaluation({
        passed: false,
        overallScore: 0.33,
        results: [
          {
            metric: "End-to-End Success",
            passed: false,
            score: 0.0,
            details: "Failed to reach expected state",
          },
          {
            metric: "Tool Invocation Order",
            passed: true,
            score: 1.0,
            details: "Correct order",
          },
          {
            metric: "Tool Call Health",
            passed: false,
            score: 0.0,
            details: "Tool call failed with error",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("✗ FAILED");
      expect(output).toContain("Overall Score: 33.0%");
      expect(output).toContain("End-to-End Success: 0.0%");
      expect(output).toContain("Tool Invocation Order: 100.0%");
      expect(output).toContain("Tool Call Health: 0.0%");
    });

    it("should report multiple workflow evaluations", () => {
      const evaluations = [
        createMockWorkflowEvaluation({ workflowName: "workflow-1" }),
        createMockWorkflowEvaluation({
          workflowName: "workflow-2",
          passed: false,
          overallScore: 0.5,
        }),
      ];

      reporter.report(evaluations);

      const output = logOutput.join("\n");
      expect(output).toContain("workflow-1");
      expect(output).toContain("workflow-2");
      // Should contain both workflow names and their results
      expect(output).toContain("workflow-1");
      expect(output).toContain("workflow-2");
      // Check for at least one success and one failure
      expect(output.match(/✓/g)?.length || 0).toBeGreaterThan(0);
      expect(output.match(/✗/g)?.length || 0).toBeGreaterThan(0);
    });

    it("should display metric details", () => {
      const evaluation = createMockWorkflowEvaluation({
        results: [
          {
            metric: "End-to-End Success",
            passed: false,
            score: 0.0,
            details: "Expected 'success' but got 'failure'",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("Expected 'success' but got 'failure'");
    });

    it("should handle empty evaluations array", () => {
      reporter.report([]);

      const output = logOutput.join("\n");
      expect(output).toContain("MCP Server Evaluation Results");
      expect(output).toContain("✅ All Workflow Evaluations Passed!");
    });

    it("should format scores correctly", () => {
      const evaluation = createMockWorkflowEvaluation({
        overallScore: 0.8567,
        results: [
          {
            metric: "Test Metric",
            passed: true,
            score: 0.1234567,
            details: "Test details",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("Overall Score: 85.7%"); // Rounded to 1 decimal place
      expect(output).toContain("Test Metric: 12.3%"); // Score formatted as percentage
    });

    it("should handle workflows with LLM Judge results", () => {
      const evaluation = createMockWorkflowEvaluation({
        results: [
          {
            metric: "End-to-End Success",
            passed: true,
            score: 1.0,
            details: "Success",
          },
          {
            metric: "LLM Judge",
            passed: true,
            score: 0.85,
            details: "Excellent workflow execution with clear tool usage",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("LLM Judge: 85.0%");
      expect(output).toContain("Excellent workflow execution");
    });
  });

  describe("Tool Health Reporting", () => {
    it("should report successful tool health results", () => {
      const result = createMockToolHealthResult();

      reporter.reportToolHealth([result]);

      const output = logOutput.join("\n");
      expect(output).toContain("Tool Health Test Results");
      expect(output).toContain("math-suite");
      expect(output).toContain("✓ PASSED");
      expect(output).toContain("Overall Score: 100.0%");
      expect(output).toContain("(1/1 tests passed)");
      expect(output).toContain("Average Latency: 50.0ms");
      expect(output).toContain("add test (50ms) 100.0%");
    });

    it("should report failed tool health results", () => {
      const result = createMockToolHealthResult({
        passed: false,
        overallScore: 0.5,
        results: [
          {
            testName: "add test",
            toolName: "add",
            passed: true,
            score: 1.0,
            latency: 30,
            details: "Success",
            retryCount: 0,
          },
          {
            testName: "divide test",
            toolName: "divide",
            passed: false,
            score: 0.0,
            latency: 25,
            details: "Division by zero error",
            retryCount: 2,
          },
        ],
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        averageLatency: 27.5,
      });

      reporter.reportToolHealth([result]);

      const output = logOutput.join("\n");
      expect(output).toContain("✗ FAILED");
      expect(output).toContain("Overall Score: 50.0%");
      expect(output).toContain("(1/2 tests passed)");
      expect(output).toContain("Average Latency: 27.5ms");
      expect(output).toContain("add test (30ms) 100.0%");
      expect(output).toContain("divide test (25ms) 0.0%");
      expect(output).toContain("Division by zero error");
    });

    it("should display retry information", () => {
      const result = createMockToolHealthResult({
        results: [
          {
            testName: "flaky test",
            toolName: "flaky_tool",
            passed: true,
            score: 1.0,
            latency: 100,
            details: "Success after retries",
            retryCount: 3,
          },
        ],
      });

      reporter.reportToolHealth([result]);

      const output = logOutput.join("\n");
      expect(output).toContain("flaky test (100ms) 100.0%");
      expect(output).toContain("Retries: 3");
    });

    it("should handle multiple tool health suites", () => {
      const results = [
        createMockToolHealthResult({ suiteName: "math-suite" }),
        createMockToolHealthResult({
          suiteName: "string-suite",
          passed: false,
          overallScore: 0.0,
        }),
      ];

      reporter.reportToolHealth(results);

      const output = logOutput.join("\n");
      expect(output).toContain("math-suite");
      expect(output).toContain("string-suite");
    });

    it("should handle empty tool health results", () => {
      reporter.reportToolHealth([]);

      const output = logOutput.join("\n");
      expect(output).toContain("Tool Health Test Results");
      expect(output).toContain("✅ All Tool Health Tests Passed!");
    });

    it("should display suite description when available", () => {
      const result = createMockToolHealthResult({
        description: "Mathematical operation testing suite",
      });

      reporter.reportToolHealth([result]);

      const output = logOutput.join("\n");
      expect(output).toContain("Mathematical operation testing suite");
    });

    it("should handle high latency values", () => {
      const result = createMockToolHealthResult({
        results: [
          {
            testName: "slow test",
            toolName: "slow_tool",
            passed: true,
            score: 1.0,
            latency: 5432,
            details: "Success",
            retryCount: 0,
          },
        ],
        averageLatency: 5432,
      });

      reporter.reportToolHealth([result]);

      const output = logOutput.join("\n");
      expect(output).toContain("Average Latency: 5432.0ms");
      expect(output).toContain("slow test (5432ms) 100.0%");
    });
  });

  describe("Combined Reporting", () => {
    it("should report both workflows and tool health", () => {
      const evaluations = [createMockWorkflowEvaluation()];
      const toolHealthResults = [createMockToolHealthResult()];

      reporter.reportCombined(evaluations, toolHealthResults);

      const output = logOutput.join("\n");
      expect(output).toContain("MCP Server Evaluation Results");
      expect(output).toContain("Tool Health Test Results");
      expect(output).toContain("test-workflow");
      expect(output).toContain("math-suite");
    });

    it("should handle empty arrays in combined reporting", () => {
      reporter.reportCombined([], []);

      const output = logOutput.join("\n");
      // Should not output anything for empty arrays
      expect(output).toBe("");
    });

    it("should report workflows only when tool health is empty", () => {
      const evaluations = [createMockWorkflowEvaluation()];

      reporter.reportCombined(evaluations, []);

      const output = logOutput.join("\n");
      expect(output).toContain("MCP Server Evaluation Results");
      expect(output).not.toContain("Tool Health Test Results");
    });

    it("should report tool health only when workflows are empty", () => {
      const toolHealthResults = [createMockToolHealthResult()];

      reporter.reportCombined([], toolHealthResults);

      const output = logOutput.join("\n");
      expect(output).toContain("Tool Health Test Results");
      expect(output).not.toContain("MCP Server Evaluation Results");
    });
  });

  describe("Formatting and Display", () => {
    it("should use consistent formatting for headers", () => {
      const evaluation = createMockWorkflowEvaluation();
      const toolHealth = createMockToolHealthResult();

      reporter.reportCombined([evaluation], [toolHealth]);

      const output = logOutput.join("\n");

      // Check for section headers
      expect(output).toMatch(/MCP Server Evaluation Results/);
      expect(output).toMatch(/Tool Health Test Results/);
    });

    it("should handle very long workflow names", () => {
      const evaluation = createMockWorkflowEvaluation({
        workflowName:
          "very-long-workflow-name-that-exceeds-normal-length-expectations",
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain(
        "very-long-workflow-name-that-exceeds-normal-length-expectations",
      );
    });

    it("should handle special characters in names and details", () => {
      const evaluation = createMockWorkflowEvaluation({
        workflowName: "workflow-with-special-chars!@#$%",
        results: [
          {
            metric: "Test Metric",
            passed: false,
            score: 0.0,
            details:
              "Error: Expected 'success' but got 'failure' with message: \"Invalid input\"",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("workflow-with-special-chars!@#$%");
      expect(output).toContain("Expected 'success' but got 'failure'");
      expect(output).toContain('"Invalid input"');
    });

    it("should handle empty or undefined details", () => {
      const evaluation = createMockWorkflowEvaluation({
        results: [
          {
            metric: "Test Metric",
            passed: true,
            score: 1.0,
            details: "",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("Test Metric: 100.0%");
      // Should not show empty details
      expect(output).not.toContain("Test Metric: 100.0% ()");
    });

    it("should format boolean passed status correctly", () => {
      const evaluation = createMockWorkflowEvaluation({
        results: [
          {
            metric: "True Test",
            passed: true,
            score: 1.0,
            details: "Success",
          },
          {
            metric: "False Test",
            passed: false,
            score: 0.0,
            details: "Failure",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("True Test: 100.0%");
      expect(output).toContain("False Test: 0.0%");
    });

    it("should handle zero scores gracefully", () => {
      const evaluation = createMockWorkflowEvaluation({
        overallScore: 0.0,
        results: [
          {
            metric: "Zero Score Test",
            passed: false,
            score: 0.0,
            details: "Complete failure",
          },
        ],
      });

      reporter.report([evaluation]);

      const output = logOutput.join("\n");
      expect(output).toContain("Overall Score: 0.0%");
      expect(output).toContain("Zero Score Test: 0.0%");
    });
  });
});
