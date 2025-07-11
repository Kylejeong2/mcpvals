import { describe, it, expect, beforeEach } from "vitest";
import { DeterministicEvaluator } from "../src/eval/deterministic";
import { TraceStore } from "../src/eval/trace";
import { Workflow } from "../src/eval/config";

describe("DeterministicEvaluator", () => {
  let traceStore: TraceStore;
  let evaluator: DeterministicEvaluator;

  beforeEach(() => {
    traceStore = new TraceStore();
    evaluator = new DeterministicEvaluator(traceStore);
  });

  describe("End-to-End Success Evaluation", () => {
    it("should pass when message contains expected state", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectedState: "4",
          },
        ],
      };

      // Add final message containing expected state
      traceStore.addMessage({
        role: "assistant",
        content: "The result is 4",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(true);
      expect(endToEndResult?.score).toBe(1.0);
      expect(endToEndResult?.details).toContain(
        "Successfully reached expected state",
      );
    });

    it("should pass when tool result matches expected state", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectedState: "4",
          },
        ],
      };

      // Add tool call and result
      traceStore.addToolCall({
        id: "calc_1",
        name: "calculate",
        arguments: { a: 2, b: 2 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "calc_1",
        result: { value: 4 },
        timestamp: new Date(),
      });

      // Add message without expected state
      traceStore.addMessage({
        role: "assistant",
        content: "The calculation is complete",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(true);
      expect(endToEndResult?.score).toBe(1.0);
    });

    it("should fail when neither message nor tool result matches expected state", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectedState: "4",
          },
        ],
      };

      // Add message with wrong result
      traceStore.addMessage({
        role: "assistant",
        content: "The result is 5",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(false);
      expect(endToEndResult?.score).toBe(0.0);
      expect(endToEndResult?.details).toContain(
        "Failed to reach expected state",
      );
    });

    it("should pass when no expected state is defined", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Hello",
            // No expectedState
          },
        ],
      };

      traceStore.addMessage({
        role: "assistant",
        content: "Hello there!",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(true);
      expect(endToEndResult?.score).toBe(1.0);
      expect(endToEndResult?.details).toContain("No expected state defined");
    });

    it("should pass when no messages are recorded", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Hello",
            expectedState: "greeting",
          },
        ],
      };

      // No messages added to traceStore

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(true);
      expect(endToEndResult?.score).toBe(1.0);
      expect(endToEndResult?.details).toContain("no messages recorded");
    });

    it("should be case insensitive", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectedState: "FOUR",
          },
        ],
      };

      traceStore.addMessage({
        role: "assistant",
        content: "The result is four",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const endToEndResult = evaluation.results.find(
        (r) => r.metric === "End-to-End Success",
      );

      expect(endToEndResult?.passed).toBe(true);
    });
  });

  describe("Tool Invocation Order Evaluation", () => {
    it("should pass when tools are called in correct order", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Do math",
            expectTools: ["add", "multiply"],
          },
        ],
      };

      // Add tool calls in correct order
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "multiply",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(true);
      expect(toolOrderResult?.score).toBe(1.0);
      expect(toolOrderResult?.details).toContain(
        "All 2 tools called in correct order",
      );
    });

    it("should use workflow-level expectTools when present", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        expectTools: ["calculate", "format"],
        steps: [
          {
            user: "Do calculation",
            expectTools: ["add"], // This should be ignored
          },
        ],
      };

      traceStore.addToolCall({
        id: "call_1",
        name: "calculate",
        arguments: { expr: "2+2" },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "format",
        arguments: { result: 4 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(true);
      expect(toolOrderResult?.score).toBe(1.0);
    });

    it("should fail when tools are called in wrong order", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Do math",
            expectTools: ["add", "multiply"],
          },
        ],
      };

      // Add tool calls in wrong order
      traceStore.addToolCall({
        id: "call_1",
        name: "multiply",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "add",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(false);
      expect(toolOrderResult?.score).toBe(0.0);
      expect(toolOrderResult?.details).toContain("Matched 0/2 tools");
    });

    it("should give partial score for partial match", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Do math",
            expectTools: ["add", "multiply", "divide"],
          },
        ],
      };

      // First two tools correct, third wrong
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "multiply",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_3",
        name: "subtract", // Wrong tool
        arguments: { a: 10, b: 5 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(false);
      expect(toolOrderResult?.score).toBe(2 / 3); // 2 out of 3 correct
      expect(toolOrderResult?.details).toContain("Matched 2/3 tools");
    });

    it("should ignore extra tool calls after expected sequence", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Do math",
            expectTools: ["add", "multiply"],
          },
        ],
      };

      // Expected tools plus extra
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "multiply",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_3",
        name: "divide", // Extra tool
        arguments: { a: 10, b: 2 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(true);
      expect(toolOrderResult?.score).toBe(1.0);
    });

    it("should pass when no expected tools are defined", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Hello",
            // No expectTools
          },
        ],
      };

      traceStore.addToolCall({
        id: "call_1",
        name: "greet",
        arguments: {},
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(true);
      expect(toolOrderResult?.score).toBe(1.0);
      expect(toolOrderResult?.details).toContain(
        "No expected tool order defined",
      );
    });

    it("should collect tools from multiple steps", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "First step",
            expectTools: ["add"],
          },
          {
            user: "Second step",
            expectTools: ["multiply"],
          },
        ],
      };

      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "multiply",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolOrderResult = evaluation.results.find(
        (r) => r.metric === "Tool Invocation Order",
      );

      expect(toolOrderResult?.passed).toBe(true);
      expect(toolOrderResult?.score).toBe(1.0);
    });
  });

  describe("Tool Call Health Evaluation", () => {
    it("should pass when all tool calls succeed", () => {
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "multiply",
        arguments: { a: 5, b: 2 },
        timestamp: new Date(),
      });

      // Add successful results
      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: { value: 5 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_2",
        toolCallId: "call_2",
        result: { value: 10 },
        timestamp: new Date(),
      });

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(true);
      expect(toolHealthResult?.score).toBe(1.0);
      expect(toolHealthResult?.details).toContain(
        "All 2 tool calls completed successfully",
      );
    });

    it("should pass when no tool calls are made", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(true);
      expect(toolHealthResult?.score).toBe(1.0);
      expect(toolHealthResult?.details).toContain("No tool calls made");
    });

    it("should fail when tool call has no result", () => {
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      // No result added for call_1

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(false);
      expect(toolHealthResult?.score).toBe(0.0);
      expect(toolHealthResult?.details).toContain("0/1 tool calls succeeded");
      expect(toolHealthResult?.details).toContain("add: No result recorded");
    });

    it("should fail when tool call has error", () => {
      traceStore.addToolCall({
        id: "call_1",
        name: "divide",
        arguments: { a: 10, b: 0 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: null,
        error: "Division by zero",
        timestamp: new Date(),
      });

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(false);
      expect(toolHealthResult?.score).toBe(0.0);
      expect(toolHealthResult?.details).toContain("divide: Division by zero");
    });

    it("should fail when tool call has bad HTTP status", () => {
      traceStore.addToolCall({
        id: "call_1",
        name: "api_call",
        arguments: { endpoint: "/test" },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: null,
        httpStatus: 404,
        timestamp: new Date(),
      });

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(false);
      expect(toolHealthResult?.score).toBe(0.0);
      expect(toolHealthResult?.details).toContain("api_call: HTTP 404");
    });

    it("should give partial score for mixed results", () => {
      // Add two tool calls
      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "divide",
        arguments: { a: 10, b: 0 },
        timestamp: new Date(),
      });

      // One succeeds, one fails
      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: { value: 5 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_2",
        toolCallId: "call_2",
        result: null,
        error: "Division by zero",
        timestamp: new Date(),
      });

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(false);
      expect(toolHealthResult?.score).toBe(0.5); // 1 out of 2 succeeded
      expect(toolHealthResult?.details).toContain("1/2 tool calls succeeded");
    });

    it("should accept 2xx HTTP status codes", () => {
      traceStore.addToolCall({
        id: "call_1",
        name: "api_call",
        arguments: { endpoint: "/test" },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: { success: true },
        httpStatus: 201, // Created
        timestamp: new Date(),
      });

      const workflow: Workflow = {
        name: "test-workflow",
        steps: [{ user: "Test" }],
      };

      const evaluation = evaluator.evaluateWorkflow(workflow);
      const toolHealthResult = evaluation.results.find(
        (r) => r.metric === "Tool Call Health",
      );

      expect(toolHealthResult?.passed).toBe(true);
      expect(toolHealthResult?.score).toBe(1.0);
    });
  });

  describe("Overall Workflow Evaluation", () => {
    it("should calculate overall score as average of all metrics", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectTools: ["add"],
            expectedState: "4",
          },
        ],
      };

      // Set up for partial success
      traceStore.addMessage({
        role: "assistant",
        content: "The result is 4", // End-to-end success
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_1",
        name: "add",
        arguments: { a: 2, b: 2 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: { value: 4 },
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);

      expect(evaluation.results).toHaveLength(3);
      expect(evaluation.overallScore).toBe(1.0); // All metrics should pass
      expect(evaluation.passed).toBe(true);
      expect(evaluation.workflowName).toBe("test-workflow");
    });

    it("should fail overall when any metric fails", () => {
      const workflow: Workflow = {
        name: "test-workflow",
        steps: [
          {
            user: "Calculate 2 + 2",
            expectTools: ["add"],
            expectedState: "4",
          },
        ],
      };

      // Set up for failure
      traceStore.addMessage({
        role: "assistant",
        content: "The result is 5", // Wrong result
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_1",
        name: "multiply", // Wrong tool
        arguments: { a: 2, b: 2 },
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "call_1",
        result: null,
        error: "Invalid operation",
        timestamp: new Date(),
      });

      const evaluation = evaluator.evaluateWorkflow(workflow);

      expect(evaluation.passed).toBe(false);
      expect(evaluation.overallScore).toBeLessThan(1.0);
    });
  });

  describe("getSummary", () => {
    it("should provide evaluation summary", () => {
      traceStore.addMessage({
        role: "user",
        content: "Hello",
        timestamp: new Date(),
      });

      traceStore.addMessage({
        role: "assistant",
        content: "Hi there!",
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_1",
        name: "greet",
        arguments: {},
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "call_2",
        name: "farewell",
        arguments: {},
        timestamp: new Date(),
      });

      const summary = evaluator.getSummary();

      expect(summary).toContain("Messages exchanged: 2");
      expect(summary).toContain("Tool calls made: 2");
      expect(summary).toContain("Tools used: greet, farewell");
    });

    it("should handle empty trace store", () => {
      const summary = evaluator.getSummary();

      expect(summary).toContain("Messages exchanged: 0");
      expect(summary).toContain("Tool calls made: 0");
      expect(summary).toContain("Tools used: none");
    });
  });
});
