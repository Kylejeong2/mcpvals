import { describe, it, expect } from "vitest";
import { ConfigSchema } from "../../src/eval/core/config";
import { TraceStore } from "../../src/eval/core/trace";
import { DeterministicEvaluator } from "../../src/eval/evaluators/deterministic";

describe("MCP Evaluation Library", () => {
  describe("ConfigSchema", () => {
    it("should validate a valid config", () => {
      const config = {
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
                user: "Test message",
              },
            ],
          },
        ],
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid server transport", () => {
      const config = {
        server: {
          transport: "invalid",
          command: "node",
        },
        workflows: [],
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe("TraceStore", () => {
    it("should store and retrieve messages", () => {
      const store = new TraceStore();

      store.addMessage({
        role: "user",
        content: "Hello",
        timestamp: new Date(),
      });

      const messages = store.getConversation();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("should store and retrieve tool calls", () => {
      const store = new TraceStore();

      store.addToolCall({
        id: "test-1",
        name: "calculate",
        arguments: { a: 1, b: 2 },
        timestamp: new Date(),
      });

      const toolCalls = store.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe("calculate");
    });
  });

  describe("DeterministicEvaluator", () => {
    it("should evaluate a successful workflow", () => {
      const store = new TraceStore();
      const evaluator = new DeterministicEvaluator(store);

      // Add test data
      store.addMessage({
        role: "user",
        content: "Calculate 2 + 2",
        timestamp: new Date(),
      });

      store.addToolCall({
        id: "calc-1",
        name: "calculate",
        arguments: { a: 2, b: 2 },
        timestamp: new Date(),
      });

      store.addToolResult({
        id: "result-1",
        toolCallId: "calc-1",
        result: { value: 4 },
        timestamp: new Date(),
      });

      store.addMessage({
        role: "assistant",
        content: "The result is 4",
        timestamp: new Date(),
      });

      const workflow = {
        name: "math-test",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectTools: ["calculate"],
            expectedState: "4",
          },
        ],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);

      expect(evaluation.passed).toBe(true);
      expect(evaluation.overallScore).toBe(1.0);
      expect(evaluation.results).toHaveLength(3);

      // Check individual metrics
      const endToEnd = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );
      expect(endToEnd?.passed).toBe(true);

      const toolOrder = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );
      expect(toolOrder?.passed).toBe(true);

      const toolHealth = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );
      expect(toolHealth?.passed).toBe(true);
    });

    it("should fail when expected state is not reached", () => {
      const store = new TraceStore();
      const evaluator = new DeterministicEvaluator(store);

      store.addMessage({
        role: "assistant",
        content: "The result is 5", // Wrong result
        timestamp: new Date(),
      });

      const workflow = {
        name: "math-test",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectedState: "4",
          },
        ],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);

      const endToEnd = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );
      expect(endToEnd?.passed).toBe(false);
    });
  });
});
