import { describe, it, expect } from "vitest";
import {
  ToolCallScorer,
  LatencyScorer,
  ContentScorer,
} from "../../src/vitest/index.js";

// Test the scorers without requiring server setup
describe("Vitest Integration - Scorers Only", () => {
  describe("ToolCallScorer", () => {
    it("should score tool calls correctly", async () => {
      const scorer = new ToolCallScorer({
        expectedTools: ["echo"],
        expectedOrder: true,
        allowExtraTools: false,
      });

      const output = {
        toolCalls: [{ name: "echo" }],
        result: "test",
      };

      const expected = { tools: ["echo"] };
      const mockContext = {
        server: null,
        tools: [{ name: "echo", description: "Echo tool" }], // Add the echo tool
        testCase: { input: {}, expected: {} },
        utils: {} as any,
      };

      const score = await scorer.score(output, expected, mockContext);
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe("LatencyScorer", () => {
    it("should score latency correctly", async () => {
      const scorer = new LatencyScorer({
        maxLatencyMs: 1000,
        penaltyThreshold: 500,
      });

      const output = { latency: 200 };
      const mockContext = {
        server: null,
        tools: [],
        testCase: { input: {}, expected: {}, name: "latency test" },
        utils: {} as any,
      };

      const score = await scorer.score(output, {}, mockContext);
      expect(score).toBe(1); // Should be perfect for fast response
    });
  });

  describe("ContentScorer", () => {
    it("should score content correctly", async () => {
      const scorer = new ContentScorer({
        requiredKeywords: ["hello", "world"],
        caseSensitive: false,
      });

      const output = "Hello World! This is a test.";
      const mockContext = {
        server: null,
        tools: [],
        testCase: { input: {}, expected: {}, name: "content test" },
        utils: {} as any,
      };

      const score = await scorer.score(output, {}, mockContext);
      expect(score).toBeGreaterThan(0.5);
    });
  });
});

// Test the custom matchers
describe("Custom Matchers", () => {
  it("should extend vitest expect with custom matchers", () => {
    // Test that the matchers are registered
    const testObject = {
      toolCalls: [{ name: "test" }],
      latency: 100,
      content: "Hello world",
    };

    // These should be available (though may fail on execution without proper setup)
    expect(typeof expect(testObject).toCallTool).toBe("function");
    expect(typeof expect(testObject).toHaveLatencyBelow).toBe("function");
    expect(typeof expect(testObject).toContainKeywords).toBe("function");
  });
});
