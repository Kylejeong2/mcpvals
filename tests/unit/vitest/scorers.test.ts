import { describe, it, expect } from "vitest";
import {
  ToolCallScorer,
  WorkflowScorer,
  LatencyScorer,
  ContentScorer,
} from "../../../src/vitest/scorers/index";
import type { MCPTestContext } from "../../../src/vitest/types.js";

// Mock context for testing
const mockContext: MCPTestContext = {
  server: {} as any,
  tools: [{ name: "add" }, { name: "multiply" }],
  testCase: { input: {}, expected: {} },
  utils: {} as any,
};

describe("ToolCallScorer", () => {
  it("should score perfect tool calls", async () => {
    const scorer = new ToolCallScorer({
      expectedTools: ["add", "multiply"],
      expectedOrder: true,
    });

    const output = {
      toolCalls: [{ name: "add" }, { name: "multiply" }],
    };

    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeCloseTo(0.9, 2);
  });

  it("should penalize missing tools", async () => {
    const scorer = new ToolCallScorer({
      expectedTools: ["add", "multiply", "subtract"],
    });

    const output = {
      toolCalls: [{ name: "add" }],
    };

    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0);
  });

  it("should penalize incorrect order", async () => {
    const scorer = new ToolCallScorer({
      expectedTools: ["add", "multiply"],
      expectedOrder: true,
    });

    const output = {
      toolCalls: [{ name: "multiply" }, { name: "add" }],
    };

    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeLessThan(1);
  });

  it("should explain the scoring", async () => {
    const scorer = new ToolCallScorer({
      expectedTools: ["add", "multiply"],
    });

    const output = {
      toolCalls: [{ name: "add" }],
    };

    const explanation = await scorer.explain(output, {}, mockContext);
    expect(explanation).toContain("Expected: [add, multiply]");
    expect(explanation).toContain("Called: [add]");
    expect(explanation).toContain("Missing: [multiply]");
  });
});

describe("WorkflowScorer", () => {
  it("should score successful workflows", async () => {
    const scorer = new WorkflowScorer({
      requireSuccess: true,
      checkMessages: true,
      minMessages: 2,
    });

    const output = {
      success: true,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
      toolCalls: [{ name: "greet" }],
    };

    const score = await scorer.score(output, {});
    expect(score).toBe(1);
  });

  it("should penalize failed workflows", async () => {
    const scorer = new WorkflowScorer({
      requireSuccess: true,
    });

    const output = {
      success: false,
      messages: [],
      toolCalls: [],
    };

    const score = await scorer.score(output, {});
    expect(score).toBeLessThan(0.5);
  });

  it("should handle insufficient messages", async () => {
    const scorer = new WorkflowScorer({
      checkMessages: true,
      minMessages: 3,
    });

    const output = {
      success: true,
      messages: [{ role: "user", content: "Hi" }],
      toolCalls: [],
    };

    const score = await scorer.score(output, {});
    expect(score).toBeLessThan(1);
  });
});

describe("LatencyScorer", () => {
  it("should score fast operations perfectly", async () => {
    const scorer = new LatencyScorer({
      maxLatencyMs: 1000,
      penaltyThreshold: 500,
    });

    const output = { latency: 200 };
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBe(1);
  });

  it("should penalize slow operations", async () => {
    const scorer = new LatencyScorer({
      maxLatencyMs: 1000,
      penaltyThreshold: 500,
    });

    const output = { latency: 800 };
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0.5);
  });

  it("should severely penalize very slow operations", async () => {
    const scorer = new LatencyScorer({
      maxLatencyMs: 1000,
    });

    const output = { latency: 2000 };
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBe(0.1);
  });

  it("should handle missing latency data", async () => {
    const scorer = new LatencyScorer({
      maxLatencyMs: 1000,
    });

    const output = { result: "success" };
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBe(0.5);
  });
});

describe("ContentScorer", () => {
  it("should score exact matches perfectly", async () => {
    const scorer = new ContentScorer({
      exactMatch: true,
    });

    const output = "Hello World";
    const expected = "Hello World";
    const score = await scorer.score(output, expected, mockContext);
    expect(score).toBe(1);
  });

  it("should handle case insensitive matching", async () => {
    const scorer = new ContentScorer({
      exactMatch: true,
      caseSensitive: false,
    });

    const output = "hello world";
    const expected = "HELLO WORLD";
    const score = await scorer.score(output, expected, mockContext);
    expect(score).toBe(1);
  });

  it("should score based on required keywords", async () => {
    const scorer = new ContentScorer({
      requiredKeywords: ["hello", "world"],
    });

    const output = "Hello there, world!";
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeGreaterThan(0.4);
  });

  it("should penalize forbidden keywords", async () => {
    const scorer = new ContentScorer({
      forbiddenKeywords: ["error", "failed"],
    });

    const output = "Operation failed with error";
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeLessThan(1);
  });

  it("should score pattern matches", async () => {
    const scorer = new ContentScorer({
      patterns: [/\d+/, /test/i],
    });

    const output = "Test result: 42";
    const score = await scorer.score(output, {}, mockContext);
    expect(score).toBeGreaterThan(0.4);
  });

  it("should extract content from various formats", async () => {
    const scorer = new ContentScorer({
      requiredKeywords: ["success"],
    });

    const outputs = [
      "success",
      { content: "success" },
      { text: "success" },
      {
        messages: [{ content: "operation success" }],
      },
    ];

    for (const output of outputs) {
      const score = await scorer.score(output, {}, mockContext);
      expect(score).toBeGreaterThan(0);
    }
  });
});
