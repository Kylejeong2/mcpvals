import type { EvalScorer, MCPTestContext } from "../types.js";

/**
 * Scorer that evaluates response latency
 */
export class LatencyScorer implements EvalScorer {
  name = "Latency Evaluation";

  constructor(
    private options: {
      maxLatencyMs: number;
      penaltyThreshold?: number;
    },
  ) {}

  async score(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<number> {
    // Try to get latency from various sources, including context
    let latency = 0;
    const outputObj = output as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    // Primary: output latency fields
    if (typeof outputObj?.latency === "number") {
      latency = outputObj.latency;
    } else if (typeof outputObj?.executionTime === "number") {
      latency = outputObj.executionTime;
    } else if (typeof outputObj?.duration === "number") {
      latency = outputObj.duration;
    }

    // Fallback: check if context provides timing information
    if (latency === 0 && context.testCase) {
      const testCaseObj = context.testCase as unknown as Record<
        string,
        unknown
      >;
      if (typeof testCaseObj.executionTime === "number") {
        latency = testCaseObj.executionTime;
      }
    }

    // Use expected latency thresholds if provided
    const expectedMaxLatency =
      typeof expectedObj?.maxLatency === "number"
        ? expectedObj.maxLatency
        : this.options.maxLatencyMs;
    const expectedOptimalLatency =
      typeof expectedObj?.optimalLatency === "number"
        ? expectedObj.optimalLatency
        : expectedMaxLatency * 0.5;

    // If latency is 0 but we found a latency field, treat as very fast (good)
    if (
      latency === 0 &&
      (typeof outputObj?.latency === "number" ||
        typeof outputObj?.executionTime === "number" ||
        typeof outputObj?.duration === "number")
    ) {
      return 1.0; // Perfect score for 0ms latency
    } else if (latency === 0) {
      return 0.5; // Neutral score if we couldn't find latency info
    }

    const maxLatency = expectedMaxLatency;
    const penaltyThreshold =
      this.options.penaltyThreshold || expectedOptimalLatency;

    let score = 0;

    // Optimal performance range
    if (latency <= penaltyThreshold) {
      score = 1; // Perfect score for optimal latency
    } else if (latency <= maxLatency) {
      // Gradual penalty between optimal and max
      const penaltyRange = maxLatency - penaltyThreshold;
      const overOptimal = latency - penaltyThreshold;
      score = 1 - (overOptimal / penaltyRange) * 0.7;
    } else {
      // Severe penalty for exceeding max latency, but not zero
      const overMax = latency - maxLatency;
      score = Math.max(0.1, 0.3 - (overMax / maxLatency) * 0.2);
    }

    // Context-aware bonuses and penalties
    const testCaseName = (context.testCase.name || "").toLowerCase();

    // Bonus for performance-critical test cases that meet expectations
    if (
      testCaseName.includes("performance") ||
      testCaseName.includes("fast") ||
      testCaseName.includes("speed")
    ) {
      if (latency <= penaltyThreshold * 0.8) {
        score = Math.min(1, score + 0.1); // Extra bonus for exceptional performance
      }
    }

    // Consider tool complexity - more tools used may justify higher latency
    if (Array.isArray(outputObj?.toolCalls)) {
      const toolCallCount = (outputObj.toolCalls as unknown[]).length;
      const complexityAllowance = Math.min(
        toolCallCount * 50,
        maxLatency * 0.2,
      ); // 50ms per tool, capped
      const adjustedLatency = Math.max(0, latency - complexityAllowance);

      if (adjustedLatency < latency) {
        // Recalculate score with complexity-adjusted latency
        if (adjustedLatency <= penaltyThreshold) {
          score = Math.max(score, 0.9); // Near perfect for complex but efficient operations
        }
      }
    }

    return Math.min(1, Math.max(0, score));
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    let latency = 0;
    const outputObj = output as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    // Get latency from various sources
    if (typeof outputObj?.latency === "number") {
      latency = outputObj.latency;
    } else if (typeof outputObj?.executionTime === "number") {
      latency = outputObj.executionTime;
    } else if (typeof outputObj?.duration === "number") {
      latency = outputObj.duration;
    } else if (context.testCase) {
      const testCaseObj = context.testCase as unknown as Record<
        string,
        unknown
      >;
      if (typeof testCaseObj.executionTime === "number") {
        latency = testCaseObj.executionTime;
      }
    }

    if (latency === 0) {
      return "Could not measure latency from output or context";
    }

    const expectedMaxLatency =
      typeof expectedObj?.maxLatency === "number"
        ? expectedObj.maxLatency
        : this.options.maxLatencyMs;
    const expectedOptimalLatency =
      typeof expectedObj?.optimalLatency === "number"
        ? expectedObj.optimalLatency
        : expectedMaxLatency * 0.5;

    const toolCallCount = Array.isArray(outputObj?.toolCalls)
      ? (outputObj.toolCalls as unknown[]).length
      : 0;
    const testType = (context.testCase.name || "").toLowerCase();

    let status = "acceptable";
    if (latency <= expectedOptimalLatency) {
      status = "excellent";
    } else if (latency <= expectedMaxLatency) {
      status = "acceptable";
    } else {
      status = "too slow";
    }

    let explanation = `Latency: ${latency}ms (optimal: ≤${expectedOptimalLatency}ms, max: ${expectedMaxLatency}ms) - ${status}`;

    if (toolCallCount > 0) {
      explanation += `. Tool calls: ${toolCallCount} (complexity factor applied)`;
    }

    if (testType.includes("performance") || testType.includes("fast")) {
      explanation += `. Performance-critical test case`;
    }

    return explanation;
  }
}
