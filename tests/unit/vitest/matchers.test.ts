import { describe, it, expect } from "vitest";
import {
  expectToolCall,
  expectToolCalls,
  expectWorkflowSuccess,
  expectLatency,
  expectError,
} from "../../../src/vitest/matchers.js";

describe("MCP Vitest Matchers", () => {
  describe("expectToolCall", () => {
    it("should pass when tool is called", async () => {
      const output = {
        toolCalls: [{ name: "add" }, { name: "multiply" }],
      };

      await expect(expectToolCall(output, "add")).resolves.toBeUndefined();
    });

    it("should fail when tool is not called", async () => {
      const output = {
        toolCalls: [{ name: "add" }],
      };

      await expect(expectToolCall(output, "subtract")).rejects.toThrow(
        'Expected tool "subtract" to be called',
      );
    });

    it("should handle different output formats", async () => {
      const outputs = [
        { toolCalls: [{ name: "add" }] },
        { toolCalls: [{ tool: "add" }] },
        { toolCalls: ["add"] },
        ["add", "multiply"],
        { tools: [{ name: "add" }] },
      ];

      for (const output of outputs) {
        await expect(expectToolCall(output, "add")).resolves.toBeUndefined();
      }
    });
  });

  describe("expectToolCalls", () => {
    it("should pass when all tools are called", async () => {
      const output = {
        toolCalls: [
          { name: "add" },
          { name: "multiply" },
          { name: "subtract" },
        ],
      };

      await expect(
        expectToolCalls(output, ["add", "multiply"]),
      ).resolves.toBeUndefined();
    });

    it("should fail when some tools are missing", async () => {
      const output = {
        toolCalls: [{ name: "add" }],
      };

      await expect(
        expectToolCalls(output, ["add", "multiply", "subtract"]),
      ).rejects.toThrow("but missing: [multiply, subtract]");
    });
  });

  describe("expectWorkflowSuccess", () => {
    it("should pass for successful workflows", async () => {
      const output = {
        success: true,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
        toolCalls: [],
      };

      await expect(expectWorkflowSuccess(output)).resolves.toBeUndefined();
    });

    it("should fail for unsuccessful workflows", async () => {
      const output = {
        success: false,
        messages: [],
      };

      await expect(expectWorkflowSuccess(output)).rejects.toThrow(
        "Expected workflow to succeed",
      );
    });

    it("should fail when output is not an object", async () => {
      await expect(expectWorkflowSuccess("invalid")).rejects.toThrow(
        "Expected output to be an object",
      );
    });

    it("should fail when messages are missing", async () => {
      const output = {
        success: true,
      };

      await expect(expectWorkflowSuccess(output)).rejects.toThrow(
        "Expected workflow output to contain messages array",
      );
    });

    it("should fail when no messages exist", async () => {
      const output = {
        success: true,
        messages: [],
      };

      await expect(expectWorkflowSuccess(output)).rejects.toThrow(
        "Expected workflow to have at least one message",
      );
    });
  });

  describe("expectLatency", () => {
    it("should pass when latency is acceptable", async () => {
      const outputs = [
        { latency: 500 },
        { executionTime: 800 },
        { duration: 300 },
        { responseTime: 600 },
      ];

      for (const output of outputs) {
        await expect(expectLatency(output, 1000)).resolves.toBeUndefined();
      }
    });

    it("should fail when latency is too high", async () => {
      const output = { latency: 2000 };

      await expect(expectLatency(output, 1000)).rejects.toThrow(
        "Expected latency to be <= 1000ms, but got 2000ms",
      );
    });

    it("should fail when latency info is missing", async () => {
      const output = { result: "success" };

      await expect(expectLatency(output, 1000)).rejects.toThrow(
        "Could not find latency information in output",
      );
    });
  });

  describe("expectError", () => {
    it("should pass when error exists", async () => {
      const outputs = [
        { error: new Error("Something went wrong") },
        { success: false },
        new Error("Direct error"),
      ];

      for (const output of outputs) {
        await expect(expectError(output)).resolves.toBeUndefined();
      }
    });

    it("should fail when no error exists", async () => {
      const output = { success: true, result: "All good" };

      await expect(expectError(output)).rejects.toThrow(
        "Expected an error to occur, but operation succeeded",
      );
    });

    it("should check error messages when specified", async () => {
      const output = {
        error: { message: "Division by zero not allowed" },
      };

      await expect(
        expectError(output, "Division by zero"),
      ).resolves.toBeUndefined();

      await expect(expectError(output, "Network error")).rejects.toThrow(
        "Expected error message to contain",
      );
    });
  });

  describe("Custom Vitest Matchers", () => {
    it("should extend expect with toCallTool", async () => {
      const output = {
        toolCalls: [{ name: "add" }, { name: "multiply" }],
      };

      await expect(output).toCallTool("add");

      // Test negative case
      await expect(async () => {
        await expect({ toolCalls: [] }).toCallTool("add");
      }).rejects.toThrow();
    });

    it("should extend expect with toCallTools", async () => {
      const output = {
        toolCalls: [{ name: "add" }, { name: "multiply" }],
      };

      await expect(output).toCallTools(["add", "multiply"]);
    });

    it("should extend expect with toHaveSuccessfulWorkflow", async () => {
      const output = {
        success: true,
        messages: [{ role: "user", content: "test" }],
        toolCalls: [],
      };

      await expect(output).toHaveSuccessfulWorkflow();
    });

    it("should extend expect with toHaveLatencyBelow", async () => {
      const output = { latency: 500 };

      await expect(output).toHaveLatencyBelow(1000);
    });

    it("should extend expect with toContainKeywords", async () => {
      const output = "Hello world, this is a test";

      await expect(output).toContainKeywords(["hello", "test"]);
    });

    it("should extend expect with toMatchPattern", async () => {
      const output = "The result is 42";

      await expect(output).toMatchPattern(/result is \d+/);
    });

    it("should extend expect with toHaveToolCallOrder", async () => {
      const output = {
        toolCalls: [
          { name: "add" },
          { name: "multiply" },
          { name: "subtract" },
        ],
      };

      await expect(output).toHaveToolCallOrder(["add", "multiply"]);
      await expect(output).toHaveToolCallOrder(["add", "subtract"]);

      // Test negative case
      await expect(async () => {
        await expect(output).toHaveToolCallOrder(["multiply", "add"]);
      }).rejects.toThrow();
    });
  });
});
