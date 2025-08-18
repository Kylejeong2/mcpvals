import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { ToolTester } from "../../src/eval/evaluators/tool-health";
import { ServerRunner } from "../../src/eval/core/runner";
import {
  ToolTest,
  ToolHealthSuite,
  createToolName,
} from "../../src/eval/core/config";

// Mock ServerRunner
vi.mock("../../src/eval/core/runner");

describe("ToolTester", () => {
  let toolTester: ToolTester;
  let mockRunner: {
    callTool: Mock;
    listTools: Mock;
  };

  beforeEach(() => {
    mockRunner = {
      callTool: vi.fn(),
      listTools: vi.fn(),
    };

    toolTester = new ToolTester(mockRunner as unknown as ServerRunner, 5000);
  });

  describe("runToolTest", () => {
    it("should pass when tool call succeeds", async () => {
      const test: ToolTest = {
        name: createToolName("add"),
        description: "Test addition",
        args: { a: 2, b: 3 },
        expectedResult: 5,
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce(5);

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.toolName).toBe("add");
      expect(result.testName).toBe("Test addition");
      expect(result.retryCount).toBe(0);
      expect(result.details).toContain("Tool call successful");
      expect(mockRunner.callTool).toHaveBeenCalledWith("add", { a: 2, b: 3 });
    });

    it("should use tool name as test name when description is missing", async () => {
      const test: ToolTest = {
        name: createToolName("multiply"),
        args: { a: 4, b: 5 },
        expectedResult: 20,
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce(20);

      const result = await toolTester.runToolTest(test);

      expect(result.testName).toBe("multiply test");
    });

    it("should fail when expected result doesn't match", async () => {
      const test: ToolTest = {
        name: createToolName("add"),
        args: { a: 2, b: 3 },
        expectedResult: 6, // Wrong expected result
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce(5);

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Result mismatch");
      expect(result.details).toContain("Expected: 6");
      expect(result.details).toContain("Got: 5");
      expect(result.metadata?.expectedResult).toBe(6);
      expect(result.metadata?.actualResult).toBe(5);
    });

    it("should pass when no expected result is specified", async () => {
      const test: ToolTest = {
        name: createToolName("log"),
        args: { message: "test" },
        retries: 0,
        // No expectedResult
      };

      mockRunner.callTool.mockResolvedValueOnce({ logged: true });

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should fail when maxLatency is exceeded", async () => {
      const test: ToolTest = {
        name: createToolName("slow_operation"),
        args: { delay: 100 },
        maxLatency: 50,
        retries: 0,
      };

      // Simulate slow operation
      mockRunner.callTool.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("done"), 100)),
      );

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("exceeded maximum latency");
      expect(result.latency).toBeGreaterThan(50);
    });

    it("should pass when expected error occurs", async () => {
      const test: ToolTest = {
        name: createToolName("divide"),
        args: { a: 10, b: 0 },
        expectedError: "Division by zero",
        retries: 0,
      };

      mockRunner.callTool.mockRejectedValueOnce(
        new Error("Division by zero is not allowed"),
      );

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.details).toContain(
        "Tool correctly failed with expected error",
      );
      expect(result.metadata?.expectedError).toBe("Division by zero");
    });

    it("should fail when expected error doesn't occur", async () => {
      const test: ToolTest = {
        name: createToolName("divide"),
        args: { a: 10, b: 2 },
        expectedError: "Division by zero",
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce(5);

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Expected error");
      expect(result.details).toContain("but tool call succeeded");
    });

    it("should fail when unexpected error occurs", async () => {
      const test: ToolTest = {
        name: createToolName("add"),
        args: { a: 2, b: 3 },
        expectedResult: 5,
        retries: 0,
      };

      mockRunner.callTool.mockRejectedValueOnce(new Error("Network error"));

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Tool call failed: Network error");
      expect(result.error).toBe("Network error");
    });

    it("should handle timeout", async () => {
      const test: ToolTest = {
        name: createToolName("timeout_test"),
        args: { delay: 1000 },
        retries: 0,
      };

      // Simulate operation that never resolves
      mockRunner.callTool.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const result = await toolTester.runToolTest(test, 100); // 100ms timeout

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Tool call timeout");
    });

    it("should retry on failure", async () => {
      const test: ToolTest = {
        name: createToolName("flaky_tool"),
        args: { attempt: 1 },
        retries: 2,
      };

      // Fail twice, then succeed
      mockRunner.callTool
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Another failure"))
        .mockResolvedValueOnce("success");

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.retryCount).toBe(2);
      expect(mockRunner.callTool).toHaveBeenCalledTimes(3);
    });

    it("should fail after exhausting retries", async () => {
      const test: ToolTest = {
        name: createToolName("always_fails"),
        args: { test: true },
        retries: 2,
      };

      mockRunner.callTool.mockRejectedValue(new Error("Persistent failure"));

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.retryCount).toBe(2);
      expect(result.details).toContain("Tool call failed: Persistent failure");
      expect(mockRunner.callTool).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should handle complex result validation", async () => {
      const test: ToolTest = {
        name: createToolName("complex_operation"),
        args: { operation: "analyze" },
        expectedResult: {
          status: "success",
          data: { count: 5, items: ["a", "b", "c"] },
        },
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce({
        status: "success",
        data: { count: 5, items: ["a", "b", "c"] },
      });

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should handle string contains validation", async () => {
      const test: ToolTest = {
        name: createToolName("format_text"),
        args: { text: "hello world" },
        expectedResult: "HELLO",
        retries: 0,
      };

      mockRunner.callTool.mockResolvedValueOnce("HELLO WORLD");

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should record latency correctly", async () => {
      const test: ToolTest = {
        name: createToolName("timed_operation"),
        args: { delay: 50 },
        retries: 0,
      };

      mockRunner.callTool.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("done"), 50)),
      );

      const result = await toolTester.runToolTest(test);

      expect(result.passed).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(50);
      expect(result.latency).toBeLessThan(200); // Should be reasonable
    });
  });

  describe("runToolHealthSuite", () => {
    it("should run tests sequentially by default", async () => {
      const suite: ToolHealthSuite = {
        name: "sequential-tests",
        parallel: false,
        tests: [
          {
            name: createToolName("add"),
            args: { a: 1, b: 2 },
            expectedResult: 3,
            retries: 0,
          },
          {
            name: createToolName("multiply"),
            args: { a: 2, b: 3 },
            expectedResult: 6,
            retries: 0,
          },
        ],
      };

      mockRunner.callTool.mockResolvedValueOnce(3).mockResolvedValueOnce(6);

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.suiteName).toBe("sequential-tests");
      expect(result.totalTests).toBe(2);
      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.results).toHaveLength(2);
    });

    it("should run tests in parallel when specified", async () => {
      const suite: ToolHealthSuite = {
        name: "parallel-tests",
        parallel: true,
        tests: [
          {
            name: createToolName("add"),
            args: { a: 1, b: 2 },
            expectedResult: 3,
            retries: 0,
          },
          {
            name: createToolName("multiply"),
            args: { a: 2, b: 3 },
            expectedResult: 6,
            retries: 0,
          },
        ],
      };

      mockRunner.callTool.mockResolvedValueOnce(3).mockResolvedValueOnce(6);

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.totalTests).toBe(2);
      expect(result.passedTests).toBe(2);
    });

    it("should calculate metrics correctly with mixed results", async () => {
      const suite: ToolHealthSuite = {
        name: "mixed-results",
        parallel: false,
        tests: [
          {
            name: createToolName("add"),
            args: { a: 1, b: 2 },
            expectedResult: 3,
            retries: 0,
          },
          {
            name: createToolName("subtract"),
            args: { a: 5, b: 3 },
            expectedResult: 2,
            retries: 0,
          },
          {
            name: createToolName("multiply"),
            args: { a: 2, b: 3 },
            expectedResult: 7,
            retries: 0,
          }, // Wrong expected result
        ],
      };

      mockRunner.callTool
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(6); // Correct result, but expected 7

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.totalTests).toBe(3);
      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(1);
      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(2 / 3);
    });

    it("should calculate average latency", async () => {
      const suite: ToolHealthSuite = {
        name: "latency-test",
        parallel: false,
        tests: [
          { name: createToolName("fast"), args: {}, retries: 0 },
          { name: createToolName("slow"), args: {}, retries: 0 },
        ],
      };

      mockRunner.callTool
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve("fast"), 10)),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => setTimeout(() => resolve("slow"), 100)),
        );

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.averageLatency).toBeGreaterThan(0);
      expect(result.averageLatency).toBeLessThan(200);
    });

    it("should use suite timeout override", async () => {
      const suite: ToolHealthSuite = {
        name: "timeout-override",
        parallel: false,
        timeout: 100,
        tests: [
          {
            name: createToolName("slow_operation"),
            args: { delay: 200 },
            retries: 0,
          },
        ],
      };

      mockRunner.callTool.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.passedTests).toBe(0);
      expect(result.failedTests).toBe(1);
      expect(result.results[0].details).toContain("Tool call timeout");
    });

    it("should handle empty test suite", async () => {
      const suite: ToolHealthSuite = {
        name: "empty-suite",
        parallel: false,
        tests: [],
      };

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.totalTests).toBe(0);
      expect(result.passedTests).toBe(0);
      expect(result.failedTests).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.averageLatency).toBe(0);
    });

    it("should include suite description", async () => {
      const suite: ToolHealthSuite = {
        name: "described-suite",
        parallel: false,
        description: "A test suite with description",
        tests: [{ name: createToolName("test1"), args: {}, retries: 0 }],
      };

      mockRunner.callTool.mockResolvedValueOnce("result");

      const result = await toolTester.runToolHealthSuite(suite);

      expect(result.description).toBe("A test suite with description");
    });
  });

  describe("getAvailableTools", () => {
    it("should return list of available tools", async () => {
      mockRunner.listTools.mockResolvedValueOnce([
        { name: "add", description: "Add two numbers" },
        { name: "multiply", description: "Multiply two numbers" },
      ]);

      const tools = await toolTester.getAvailableTools();

      expect(tools).toEqual(["add", "multiply"]);
      expect(mockRunner.listTools).toHaveBeenCalledOnce();
    });

    it("should handle empty tools list", async () => {
      mockRunner.listTools.mockResolvedValueOnce([]);

      const tools = await toolTester.getAvailableTools();

      expect(tools).toEqual([]);
    });
  });

  describe("validateTestSuite", () => {
    it("should validate that all test tools are available", async () => {
      const suite: ToolHealthSuite = {
        name: "validation-test",
        parallel: false,
        tests: [
          { name: createToolName("add"), args: { a: 1, b: 2 }, retries: 0 },
          {
            name: createToolName("multiply"),
            args: { a: 2, b: 3 },
            retries: 0,
          },
        ],
      };

      mockRunner.listTools.mockResolvedValueOnce([
        { name: "add", description: "Add" },
        { name: "multiply", description: "Multiply" },
        { name: "divide", description: "Divide" },
      ]);

      const validation = await toolTester.validateTestSuite(suite);

      expect(validation.valid).toBe(true);
      expect(validation.missingTools).toEqual([]);
      expect(validation.availableTools).toEqual(["add", "multiply", "divide"]);
    });

    it("should detect missing tools", async () => {
      const suite: ToolHealthSuite = {
        name: "invalid-suite",
        parallel: false,
        tests: [
          { name: createToolName("add"), args: { a: 1, b: 2 }, retries: 0 },
          {
            name: createToolName("subtract"),
            args: { a: 5, b: 3 },
            retries: 0,
          },
          { name: createToolName("nonexistent"), args: {}, retries: 0 },
        ],
      };

      mockRunner.listTools.mockResolvedValueOnce([
        { name: "add", description: "Add" },
        { name: "multiply", description: "Multiply" },
      ]);

      const validation = await toolTester.validateTestSuite(suite);

      expect(validation.valid).toBe(false);
      expect(validation.missingTools).toEqual(["subtract", "nonexistent"]);
      expect(validation.availableTools).toEqual(["add", "multiply"]);
    });

    it("should handle duplicate tool names in tests", async () => {
      const suite: ToolHealthSuite = {
        name: "duplicate-test",
        parallel: false,
        tests: [
          { name: createToolName("add"), args: { a: 1, b: 2 }, retries: 0 },
          { name: createToolName("add"), args: { a: 3, b: 4 }, retries: 0 }, // Duplicate
        ],
      };

      mockRunner.listTools.mockResolvedValueOnce([
        { name: "add", description: "Add" },
      ]);

      const validation = await toolTester.validateTestSuite(suite);

      expect(validation.valid).toBe(true);
      expect(validation.missingTools).toEqual([]);
    });
  });
});
