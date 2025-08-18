import { describe, it, expect, beforeEach } from "vitest";
import {
  TraceStore,
  TraceEntry,
  ToolCall,
  ToolResult,
  ConversationMessage,
} from "../../../src/eval/core/trace";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

describe("TraceStore", () => {
  let traceStore: TraceStore;

  beforeEach(() => {
    traceStore = new TraceStore();
  });

  describe("Trace Operations", () => {
    it("should add and retrieve traces", () => {
      const trace: TraceEntry = {
        timestamp: new Date(),
        direction: "client->server",
        message: { jsonrpc: "2.0", method: "test", id: 1 } as JSONRPCMessage,
        metadata: { test: "data" },
      };

      traceStore.addTrace(trace);
      const traces = traceStore.getTraces();

      expect(traces).toHaveLength(1);
      expect(traces[0]).toEqual(trace);
      expect(traces[0].metadata?.test).toBe("data");
    });

    it("should handle multiple traces", () => {
      const trace1: TraceEntry = {
        timestamp: new Date(),
        direction: "client->server",
        message: { jsonrpc: "2.0", method: "test1", id: 1 } as JSONRPCMessage,
      };

      const trace2: TraceEntry = {
        timestamp: new Date(),
        direction: "server->client",
        message: {
          jsonrpc: "2.0",
          result: { success: true },
          id: 1,
        } as JSONRPCMessage,
      };

      traceStore.addTrace(trace1);
      traceStore.addTrace(trace2);

      const traces = traceStore.getTraces();
      expect(traces).toHaveLength(2);
      expect(traces[0].direction).toBe("client->server");
      expect(traces[1].direction).toBe("server->client");
    });
  });

  describe("Conversation Operations", () => {
    it("should add and retrieve conversation messages", () => {
      const message: ConversationMessage = {
        role: "user",
        content: "Hello, world!",
        timestamp: new Date(),
      };

      traceStore.addMessage(message);
      const conversation = traceStore.getConversation();

      expect(conversation).toHaveLength(1);
      expect(conversation[0]).toEqual(message);
    });

    it("should handle messages with tool calls", () => {
      const toolCall: ToolCall = {
        id: "call_123",
        name: "calculate",
        arguments: { a: 2, b: 3 },
        timestamp: new Date(),
      };

      const message: ConversationMessage = {
        role: "assistant",
        content: "I'll calculate that for you.",
        toolCalls: [toolCall],
        timestamp: new Date(),
      };

      traceStore.addMessage(message);
      const conversation = traceStore.getConversation();

      expect(conversation[0].toolCalls).toHaveLength(1);
      expect(conversation[0].toolCalls![0].name).toBe("calculate");
    });

    it("should get last message correctly", () => {
      const message1: ConversationMessage = {
        role: "user",
        content: "First message",
        timestamp: new Date(),
      };

      const message2: ConversationMessage = {
        role: "assistant",
        content: "Second message",
        timestamp: new Date(),
      };

      traceStore.addMessage(message1);
      traceStore.addMessage(message2);

      const lastMessage = traceStore.getLastMessage();
      expect(lastMessage).toEqual(message2);
      expect(lastMessage?.content).toBe("Second message");
    });

    it("should return undefined for last message when empty", () => {
      const lastMessage = traceStore.getLastMessage();
      expect(lastMessage).toBeUndefined();
    });
  });

  describe("Tool Call Operations", () => {
    it("should add and retrieve tool calls", () => {
      const toolCall: ToolCall = {
        id: "tool_456",
        name: "multiply",
        arguments: { x: 4, y: 5 },
        timestamp: new Date(),
      };

      traceStore.addToolCall(toolCall);
      const toolCalls = traceStore.getToolCalls();

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual(toolCall);
    });

    it("should preserve tool call order", () => {
      const toolCall1: ToolCall = {
        id: "tool_1",
        name: "add",
        arguments: { a: 1, b: 2 },
        timestamp: new Date(),
      };

      const toolCall2: ToolCall = {
        id: "tool_2",
        name: "multiply",
        arguments: { a: 3, b: 4 },
        timestamp: new Date(),
      };

      traceStore.addToolCall(toolCall1);
      traceStore.addToolCall(toolCall2);

      const toolCalls = traceStore.getToolCalls();
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].id).toBe("tool_1");
      expect(toolCalls[1].id).toBe("tool_2");
    });
  });

  describe("Tool Result Operations", () => {
    it("should add and retrieve tool results", () => {
      const toolResult: ToolResult = {
        id: "result_789",
        toolCallId: "tool_456",
        result: { value: 20 },
        timestamp: new Date(),
      };

      traceStore.addToolResult(toolResult);
      const toolResults = traceStore.getToolResults();

      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]).toEqual(toolResult);
    });

    it("should handle tool results with errors", () => {
      const toolResult: ToolResult = {
        id: "result_error",
        toolCallId: "tool_failed",
        result: null,
        error: "Division by zero",
        httpStatus: 400,
        timestamp: new Date(),
      };

      traceStore.addToolResult(toolResult);
      const toolResults = traceStore.getToolResults();

      expect(toolResults[0].error).toBe("Division by zero");
      expect(toolResults[0].httpStatus).toBe(400);
    });

    it("should get tool result by tool call ID", () => {
      const toolResult1: ToolResult = {
        id: "result_1",
        toolCallId: "tool_call_1",
        result: { value: 10 },
        timestamp: new Date(),
      };

      const toolResult2: ToolResult = {
        id: "result_2",
        toolCallId: "tool_call_2",
        result: { value: 20 },
        timestamp: new Date(),
      };

      traceStore.addToolResult(toolResult1);
      traceStore.addToolResult(toolResult2);

      const found = traceStore.getToolResult("tool_call_1");
      expect(found).toEqual(toolResult1);
      expect(found?.result).toEqual({ value: 10 });
    });

    it("should return undefined for non-existent tool call ID", () => {
      const result = traceStore.getToolResult("non_existent");
      expect(result).toBeUndefined();
    });
  });

  describe("Export and Clear Operations", () => {
    it("should export all data correctly", () => {
      const trace: TraceEntry = {
        timestamp: new Date(),
        direction: "client->server",
        message: { jsonrpc: "2.0", method: "test", id: 1 } as JSONRPCMessage,
      };

      const message: ConversationMessage = {
        role: "user",
        content: "Test message",
        timestamp: new Date(),
      };

      const toolCall: ToolCall = {
        id: "tool_1",
        name: "test_tool",
        arguments: { param: "value" },
        timestamp: new Date(),
      };

      const toolResult: ToolResult = {
        id: "result_1",
        toolCallId: "tool_1",
        result: { success: true },
        timestamp: new Date(),
      };

      traceStore.addTrace(trace);
      traceStore.addMessage(message);
      traceStore.addToolCall(toolCall);
      traceStore.addToolResult(toolResult);

      const exported = traceStore.export();

      expect(exported.traces).toHaveLength(1);
      expect(exported.conversation).toHaveLength(1);
      expect(exported.toolCalls).toHaveLength(1);
      expect(exported.toolResults).toHaveLength(1);

      expect(exported.traces[0]).toEqual(trace);
      expect(exported.conversation[0]).toEqual(message);
      expect(exported.toolCalls[0]).toEqual(toolCall);
      expect(exported.toolResults[0]).toEqual(toolResult);
    });

    it("should clear all data", () => {
      // Add some data
      traceStore.addTrace({
        timestamp: new Date(),
        direction: "client->server",
        message: { jsonrpc: "2.0", method: "test", id: 1 } as JSONRPCMessage,
      });

      traceStore.addMessage({
        role: "user",
        content: "Test",
        timestamp: new Date(),
      });

      traceStore.addToolCall({
        id: "tool_1",
        name: "test",
        arguments: {},
        timestamp: new Date(),
      });

      traceStore.addToolResult({
        id: "result_1",
        toolCallId: "tool_1",
        result: {},
        timestamp: new Date(),
      });

      // Verify data exists
      expect(traceStore.getTraces()).toHaveLength(1);
      expect(traceStore.getConversation()).toHaveLength(1);
      expect(traceStore.getToolCalls()).toHaveLength(1);
      expect(traceStore.getToolResults()).toHaveLength(1);

      // Clear and verify empty
      traceStore.clear();

      expect(traceStore.getTraces()).toHaveLength(0);
      expect(traceStore.getConversation()).toHaveLength(0);
      expect(traceStore.getToolCalls()).toHaveLength(0);
      expect(traceStore.getToolResults()).toHaveLength(0);
      expect(traceStore.getLastMessage()).toBeUndefined();
    });
  });

  describe("Data Immutability", () => {
    it("should return copies of arrays to prevent mutation", () => {
      const toolCall: ToolCall = {
        id: "tool_1",
        name: "test",
        arguments: {},
        timestamp: new Date(),
      };

      traceStore.addToolCall(toolCall);

      const toolCalls1 = traceStore.getToolCalls();
      const toolCalls2 = traceStore.getToolCalls();

      // Should be different array instances
      expect(toolCalls1).not.toBe(toolCalls2);

      // But have same content
      expect(toolCalls1).toEqual(toolCalls2);

      // Mutating returned array shouldn't affect store
      toolCalls1.pop();
      expect(traceStore.getToolCalls()).toHaveLength(1);
    });

    it("should handle complex argument types", () => {
      const complexArgs = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        date: new Date(),
        null_value: null,
        undefined_value: undefined,
      };

      const toolCall: ToolCall = {
        id: "complex_tool",
        name: "complex_operation",
        arguments: complexArgs,
        timestamp: new Date(),
      };

      traceStore.addToolCall(toolCall);
      const retrieved = traceStore.getToolCalls()[0];

      expect(retrieved.arguments).toEqual(complexArgs);
    });
  });
});
