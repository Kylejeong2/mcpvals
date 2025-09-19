import type { EvalScorer, MCPTestContext } from "../types.js";

/**
 * Scorer that evaluates tool call patterns
 */
export class ToolCallScorer implements EvalScorer {
  name = "Tool Call Evaluation";

  constructor(
    private options: {
      expectedTools?: string[];
      expectedOrder?: boolean;
      allowExtraTools?: boolean;
    } = {},
  ) {}

  async score(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<number> {
    // If output contains tool calls, extract them
    let toolCalls: string[] = [];
    const outputObj = output as Record<string, unknown>;

    if (Array.isArray(outputObj?.toolCalls)) {
      toolCalls = outputObj.toolCalls.map((call: unknown) => {
        const callObj = call as Record<string, unknown>;
        return (callObj.name || callObj.tool || call) as string;
      });
    } else if (Array.isArray(output)) {
      toolCalls = output.filter((item: unknown) => typeof item === "string");
    }

    const expectedObj = expected as Record<string, unknown>;
    const expectedTools =
      this.options.expectedTools || (expectedObj?.tools as string[]) || [];

    // Get available tools from context for validation
    const availableTools = context.tools.map((t) => t.name);

    // Check if called tools are actually available
    const invalidTools = toolCalls.filter(
      (tool) => !availableTools.includes(tool),
    );

    if (expectedTools.length === 0) {
      // If no expected tools, penalize invalid tool calls more heavily
      if (invalidTools.length > 0) {
        return 0.2; // Heavy penalty for calling non-existent tools
      }
      return toolCalls.length === 0 ? 1 : 0.5;
    }

    let score = 0;

    // Check if all expected tools were called
    const expectedToolsArray = expectedTools as string[];
    const calledExpectedTools = expectedToolsArray.filter((tool: string) =>
      toolCalls.includes(tool),
    );
    score += (calledExpectedTools.length / expectedToolsArray.length) * 0.6;

    // Check order if required
    if (this.options.expectedOrder && expectedToolsArray.length > 1) {
      let orderScore = 0;
      let lastIndex = -1;

      for (const tool of expectedToolsArray) {
        const index = toolCalls.indexOf(tool);
        if (index > lastIndex) {
          orderScore += 1;
          lastIndex = index;
        }
      }

      score += (orderScore / expectedToolsArray.length) * 0.2;
    } else {
      score += 0.2; // Full order score if order doesn't matter
    }

    // Penalize invalid tools heavily
    if (invalidTools.length > 0) {
      const invalidPenalty = Math.min(invalidTools.length * 0.3, 0.5);
      score = Math.max(0, score - invalidPenalty);
    }

    // Penalize extra valid tools if not allowed
    if (!this.options.allowExtraTools) {
      const extraValidTools = toolCalls.filter(
        (tool) =>
          !expectedToolsArray.includes(tool) && availableTools.includes(tool),
      );
      const extraPenalty = Math.min(extraValidTools.length * 0.1, 0.1);
      score = Math.max(0, score - extraPenalty);
    } else {
      score += 0.1; // Small bonus for no penalty
    }

    // Bonus for using appropriate tools from context
    const appropriateToolsUsed = toolCalls.filter(
      (tool) =>
        expectedToolsArray.includes(tool) && availableTools.includes(tool),
    );
    if (appropriateToolsUsed.length > 0) {
      score += 0.1; // Small bonus for appropriate tool usage
    }

    return Math.min(1, score);
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    let toolCalls: string[] = [];
    const outputObj = output as Record<string, unknown>;

    if (Array.isArray(outputObj?.toolCalls)) {
      toolCalls = outputObj.toolCalls.map((call: unknown) => {
        const callObj = call as Record<string, unknown>;
        return (callObj.name || callObj.tool || call) as string;
      });
    } else if (Array.isArray(output)) {
      toolCalls = output.filter((item: unknown) => typeof item === "string");
    }

    const expectedObj = expected as Record<string, unknown>;
    const expectedTools =
      this.options.expectedTools || (expectedObj?.tools as string[]) || [];
    const expectedToolsArray = expectedTools as string[];

    const availableTools = context.tools.map((t) => t.name);
    const invalidTools = toolCalls.filter(
      (tool) => !availableTools.includes(tool),
    );

    if (expectedToolsArray.length === 0) {
      let explanation = `No specific tools expected. Called: [${toolCalls.join(", ")}]`;
      if (invalidTools.length > 0) {
        explanation += `. Invalid tools called: [${invalidTools.join(", ")}]`;
      }
      return explanation;
    }

    const called = toolCalls.join(", ") || "none";
    const expectedStr = expectedToolsArray.join(", ");
    const missing = expectedToolsArray.filter(
      (tool: string) => !toolCalls.includes(tool),
    );
    const extraValid = toolCalls.filter(
      (tool: string) =>
        !expectedToolsArray.includes(tool) && availableTools.includes(tool),
    );

    let explanation = `Expected: [${expectedStr}], Called: [${called}]`;

    if (missing.length > 0) {
      explanation += `. Missing: [${missing.join(", ")}]`;
    }

    if (extraValid.length > 0 && !this.options.allowExtraTools) {
      explanation += `. Extra valid tools: [${extraValid.join(", ")}]`;
    }

    if (invalidTools.length > 0) {
      explanation += `. Invalid tools: [${invalidTools.join(", ")}] (available: [${availableTools.join(", ")}])`;
    }

    return explanation;
  }
}
