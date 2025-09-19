import type { EvalScorer, MCPTestContext } from "../types.js";

/**
 * Scorer that evaluates workflow execution success
 */
export class WorkflowScorer implements EvalScorer {
  name = "Workflow Success Evaluation";

  constructor(
    private options: {
      requireSuccess?: boolean;
      checkMessages?: boolean;
      minMessages?: number;
    } = { requireSuccess: true },
  ) {}

  async score(output: unknown, expected: unknown): Promise<number> {
    if (!output || typeof output !== "object") {
      return 0;
    }

    let score = 0;
    const obj = output as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    // Check success flag against expected outcome
    const expectedSuccess =
      expectedObj?.success !== undefined ? expectedObj.success : true;
    if (this.options.requireSuccess) {
      if (obj.success === expectedSuccess) {
        score += 0.6;
      } else {
        // Partial credit if we got a result but wrong success state
        score += obj.success !== undefined ? 0.2 : 0;
        // On failure, do not award additional message/tool-call points.
        // Ensure failed workflows stay below 0.5 as per test expectations.
        return Math.min(0.49, score);
      }
    } else {
      score += 0.6; // Full points if success is not required
    }

    // Check messages against expected patterns
    if (this.options.checkMessages && Array.isArray(obj.messages)) {
      const minMessages = this.options.minMessages || 1;
      const messages = obj.messages as unknown[];
      const messageCount = messages.length;

      // Message count score (legacy behavior)
      if (messageCount >= minMessages) {
        score += 0.2;
      } else {
        score += (messageCount / minMessages) * 0.2;
      }
    } else {
      score += 0.2;
    }

    // Tool call existence scoring (legacy behavior)
    if (Array.isArray(obj.toolCalls)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    if (!output || typeof output !== "object") {
      return "Output is not a valid workflow result object";
    }

    const obj = output as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;
    const success = obj.success;
    const expectedSuccess =
      expectedObj?.success !== undefined ? expectedObj.success : true;
    const messageCount = Array.isArray(obj.messages)
      ? (obj.messages as unknown[]).length
      : 0;
    const toolCallCount = Array.isArray(obj.toolCalls)
      ? (obj.toolCalls as unknown[]).length
      : 0;
    const expectedTools = (expectedObj?.tools as string[]) || [];
    const availableTools = context.tools.map((t) => t.name);

    let explanation = `Workflow ${success ? "succeeded" : "failed"} (expected: ${expectedSuccess ? "success" : "failure"})`;
    explanation += ` with ${messageCount} messages and ${toolCallCount} tool calls`;

    if (expectedTools.length > 0) {
      const actualTools = Array.isArray(obj.toolCalls)
        ? (obj.toolCalls as Array<Record<string, unknown>>).map((call) =>
            String(call.name || call.tool),
          )
        : [];
      const matchedTools = expectedTools.filter((tool) =>
        actualTools.includes(tool),
      );
      explanation += `. Expected tools: [${expectedTools.join(", ")}], Used: [${actualTools.join(", ")}], Matched: ${matchedTools.length}/${expectedTools.length}`;
    }

    if (Array.isArray(obj.toolCalls)) {
      const invalidTools = (obj.toolCalls as Array<Record<string, unknown>>)
        .map((call) => String(call.name || call.tool))
        .filter((tool) => !availableTools.includes(tool));
      if (invalidTools.length > 0) {
        explanation += `. Invalid tools used: [${invalidTools.join(", ")}]`;
      }
    }

    return explanation;
  }
}
