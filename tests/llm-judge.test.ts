import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { runLlmJudge } from "../src/eval/llm-judge";
import { TraceStore } from "../src/eval/trace";
import { Workflow } from "../src/eval/config";
import * as ai from "ai";
import * as openaiSdk from "@ai-sdk/openai";

// Mock the dependencies
vi.mock("ai");
vi.mock("@ai-sdk/openai");

describe("LLM Judge", () => {
  let traceStore: TraceStore;
  let workflow: Workflow;
  let mockGenerateText: Mock;
  let mockCreateOpenAI: Mock;

  beforeEach(() => {
    // Setup mocks
    mockGenerateText = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        score: 0.85,
        reason: "The workflow successfully achieved its goal",
      }),
    });

    mockCreateOpenAI = vi.fn().mockReturnValue(() => ({}));

    // Apply mocks
    vi.mocked(ai).generateText = mockGenerateText;
    vi.mocked(openaiSdk).createOpenAI = mockCreateOpenAI;

    // Setup test data
    traceStore = new TraceStore();
    workflow = {
      name: "Test Workflow",
      steps: [
        {
          user: "What is 2 + 2?",
          expectedState: "4",
        },
      ],
    };

    // Add some messages to the trace store
    traceStore.addMessage({
      role: "user",
      content: "What is 2 + 2?",
      timestamp: new Date(),
    });

    traceStore.addMessage({
      role: "assistant",
      content: "The answer is 4",
      timestamp: new Date(),
      toolCalls: [
        {
          id: "call_123",
          name: "calculate",
          arguments: { a: 2, b: 2, operation: "add" },
          timestamp: new Date(),
        },
      ],
    });

    traceStore.addToolResult({
      id: "result_123",
      toolCallId: "call_123",
      result: { result: 4 },
      timestamp: new Date(),
    });
  });

  it("should evaluate workflow with LLM judge", async () => {
    const result = await runLlmJudge({
      model: "gpt-4o",
      apiKey: "test-key",
      workflow,
      traceStore,
    });

    expect(result).toEqual({
      score: 0.85,
      reason: "The workflow successfully achieved its goal",
    });

    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
      compatibility: "strict",
    });
  });

  it("should handle LLM errors gracefully", async () => {
    // Mock generateText to throw an error
    mockGenerateText.mockRejectedValueOnce(new Error("API error"));

    const result = await runLlmJudge({
      model: "gpt-4o",
      apiKey: "test-key",
      workflow,
      traceStore,
    });

    expect(result.score).toBe(0);
    expect(result.reason).toContain("LLM Judge failed");
  });

  it("should handle invalid LLM responses", async () => {
    // Mock generateText to return invalid JSON
    mockGenerateText.mockResolvedValueOnce({
      text: "Not valid JSON",
    });

    const result = await runLlmJudge({
      model: "gpt-4o",
      apiKey: "test-key",
      workflow,
      traceStore,
    });

    expect(result.score).toBe(0);
    expect(result.reason).toContain("Invalid LLM output");
  });
});
