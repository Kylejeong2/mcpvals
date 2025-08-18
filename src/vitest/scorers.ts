import type { EvalScorer, MCPTestContext } from "./types.js";

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = context; // Acknowledge unused parameter

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

    if (expectedTools.length === 0) {
      // If no expected tools, score based on whether unknown tools were called inappropriately
      return toolCalls.length === 0 ? 1 : 0.5;
    }

    let score = 0;

    // Check if all expected tools were called
    const expectedToolsArray = expectedTools as string[];
    const calledExpectedTools = expectedToolsArray.filter((tool: string) =>
      toolCalls.includes(tool),
    );
    score += (calledExpectedTools.length / expectedToolsArray.length) * 0.7;

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

    // Penalize extra tools if not allowed
    if (!this.options.allowExtraTools) {
      const extraTools = toolCalls.filter(
        (tool) => !expectedToolsArray.includes(tool),
      );
      const penalty = Math.min(extraTools.length * 0.1, 0.1);
      score = Math.max(0, score - penalty);
    } else {
      score += 0.1; // Small bonus for no penalty
    }

    return Math.min(1, score);
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = context; // Acknowledge unused parameter

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

    const expectedToolsArray2 = expectedTools as string[];
    if (expectedToolsArray2.length === 0) {
      return `No specific tools expected. Called: [${toolCalls.join(", ")}]`;
    }

    const called = toolCalls.join(", ") || "none";
    const expectedStr = expectedToolsArray2.join(", ");
    const missing = expectedToolsArray2.filter(
      (tool: string) => !toolCalls.includes(tool),
    );
    const extra = toolCalls.filter(
      (tool: string) => !expectedToolsArray2.includes(tool),
    );

    let explanation = `Expected: [${expectedStr}], Called: [${called}]`;

    if (missing.length > 0) {
      explanation += `. Missing: [${missing.join(", ")}]`;
    }

    if (extra.length > 0 && !this.options.allowExtraTools) {
      explanation += `. Extra: [${extra.join(", ")}]`;
    }

    return explanation;
  }
}

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

  async score(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { expected, context }; // Acknowledge unused parameters

    if (!output || typeof output !== "object") {
      return 0;
    }

    let score = 0;
    const obj = output as Record<string, unknown>;

    // Check success flag
    if (this.options.requireSuccess) {
      if (obj.success === true) {
        score += 0.6;
      }
    } else {
      score += 0.6; // Give full points if success is not required
    }

    // Check messages if required
    if (this.options.checkMessages && Array.isArray(obj.messages)) {
      const minMessages = this.options.minMessages || 1;
      const messages = obj.messages as unknown[];
      if (messages.length >= minMessages) {
        score += 0.2;
      } else {
        score += (messages.length / minMessages) * 0.2;
      }
    } else {
      score += 0.2;
    }

    // Check for tool calls existence
    if (Array.isArray(obj.toolCalls)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  async explain(output: unknown): Promise<string> {
    if (!output || typeof output !== "object") {
      return "Output is not a valid workflow result object";
    }

    const obj2 = output as Record<string, unknown>;
    const success = obj2.success;
    const messageCount = Array.isArray(obj2.messages)
      ? (obj2.messages as unknown[]).length
      : 0;
    const toolCallCount = Array.isArray(obj2.toolCalls)
      ? (obj2.toolCalls as unknown[]).length
      : 0;

    return `Workflow ${success ? "succeeded" : "failed"} with ${messageCount} messages and ${toolCallCount} tool calls`;
  }
}

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { expected, context }; // Acknowledge unused parameters

    // Try to get latency from various sources
    let latency = 0;
    const outputObj = output as Record<string, unknown>;

    if (typeof outputObj?.latency === "number") {
      latency = outputObj.latency;
    } else if (typeof outputObj?.executionTime === "number") {
      latency = outputObj.executionTime;
    } else if (typeof outputObj?.duration === "number") {
      latency = outputObj.duration;
    }

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

    const maxLatency = this.options.maxLatencyMs;
    const penaltyThreshold = this.options.penaltyThreshold || maxLatency * 0.8;

    if (latency <= penaltyThreshold) {
      return 1; // Perfect score for good latency
    } else if (latency <= maxLatency) {
      // Linear penalty between threshold and max
      const penaltyRange = maxLatency - penaltyThreshold;
      const overThreshold = latency - penaltyThreshold;
      return 1 - (overThreshold / penaltyRange) * 0.5;
    } else {
      // Severe penalty for exceeding max latency
      return 0.1;
    }
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { expected, context }; // Acknowledge unused parameters

    let latency = 0;
    const outputObj = output as Record<string, unknown>;

    if (typeof outputObj?.latency === "number") {
      latency = outputObj.latency;
    } else if (typeof outputObj?.executionTime === "number") {
      latency = outputObj.executionTime;
    } else if (typeof outputObj?.duration === "number") {
      latency = outputObj.duration;
    }

    if (latency === 0) {
      return "Could not measure latency from output";
    }

    const maxLatency = this.options.maxLatencyMs;
    const status = latency <= maxLatency ? "acceptable" : "too slow";

    return `Latency: ${latency}ms (max: ${maxLatency}ms) - ${status}`;
  }
}

/**
 * Scorer that evaluates content quality and correctness
 */
export class ContentScorer implements EvalScorer {
  name = "Content Quality Evaluation";

  constructor(
    private options: {
      exactMatch?: boolean;
      caseSensitive?: boolean;
      patterns?: RegExp[];
      requiredKeywords?: string[];
      forbiddenKeywords?: string[];
    } = {},
  ) {}

  async score(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = context; // Acknowledge unused parameter

    let content = "";

    // Extract content from various output formats
    if (typeof output === "string") {
      content = output;
    } else {
      const outputObj = output as Record<string, unknown>;
      if (outputObj?.content) {
        content = String(outputObj.content);
      } else if (outputObj?.text) {
        content = String(outputObj.text);
      } else if (outputObj?.messages && Array.isArray(outputObj.messages)) {
        content = outputObj.messages
          .map((msg: unknown) => {
            const msgObj = msg as Record<string, unknown>;
            return msgObj.content || msgObj.text || "";
          })
          .join(" ");
      } else {
        content = String(output);
      }
    }

    const expectedObj = expected as Record<string, unknown>;
    const expectedContent =
      typeof expected === "string"
        ? expected
        : String(expectedObj?.content || expectedObj?.text || "");

    if (!this.options.caseSensitive) {
      content = content.toLowerCase();
    }

    let score = 0;

    // Exact match check
    if (this.options.exactMatch && expectedContent) {
      const expectedLower = this.options.caseSensitive
        ? expectedContent
        : expectedContent.toLowerCase();
      score += content === expectedLower ? 1 : 0;
      return score;
    }

    // Pattern matching
    if (this.options.patterns && this.options.patterns.length > 0) {
      const matchedPatterns = this.options.patterns.filter((pattern) =>
        pattern.test(content),
      );
      score += (matchedPatterns.length / this.options.patterns.length) * 0.4;
    } else {
      score += 0.4; // No patterns to check
    }

    // Required keywords
    if (
      this.options.requiredKeywords &&
      this.options.requiredKeywords.length > 0
    ) {
      const keywords = this.options.caseSensitive
        ? this.options.requiredKeywords
        : this.options.requiredKeywords.map((k) => k.toLowerCase());
      const foundKeywords = keywords.filter((keyword) =>
        content.includes(keyword),
      );
      score += (foundKeywords.length / keywords.length) * 0.4;
    } else {
      score += 0.4;
    }

    // Forbidden keywords penalty
    if (
      this.options.forbiddenKeywords &&
      this.options.forbiddenKeywords.length > 0
    ) {
      const keywords = this.options.caseSensitive
        ? this.options.forbiddenKeywords
        : this.options.forbiddenKeywords.map((k) => k.toLowerCase());
      const foundForbidden = keywords.filter((keyword) =>
        content.includes(keyword),
      );
      const penalty = (foundForbidden.length / keywords.length) * 0.2;
      score = Math.max(0, score - penalty);
    }

    // Basic relevance check with expected content
    if (expectedContent && expectedContent.trim()) {
      const expectedLower = this.options.caseSensitive
        ? expectedContent
        : expectedContent.toLowerCase();
      const commonWords = expectedLower
        .split(/\s+/)
        .filter((word: string) => word.length > 2 && content.includes(word));
      const expectedWords = expectedLower
        .split(/\s+/)
        .filter((word: string) => word.length > 2);
      if (expectedWords.length > 0) {
        score += (commonWords.length / expectedWords.length) * 0.2;
      } else {
        score += 0.2;
      }
    } else {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { expected, context }; // Acknowledge unused parameters

    let content = "";

    if (typeof output === "string") {
      content = output;
    } else {
      const outputObj = output as Record<string, unknown>;
      if (outputObj?.content) {
        content = String(outputObj.content);
      } else if (outputObj?.text) {
        content = String(outputObj.text);
      } else if (outputObj?.messages && Array.isArray(outputObj.messages)) {
        content = outputObj.messages
          .map((msg: unknown) => {
            const msgObj = msg as Record<string, unknown>;
            return msgObj.content || msgObj.text || "";
          })
          .join(" ");
      } else {
        content = String(output);
      }
    }

    let explanation = `Content length: ${content.length} characters`;

    if (
      this.options.requiredKeywords &&
      this.options.requiredKeywords.length > 0
    ) {
      const keywords = this.options.caseSensitive
        ? this.options.requiredKeywords
        : this.options.requiredKeywords.map((k) => k.toLowerCase());
      const contentToCheck = this.options.caseSensitive
        ? content
        : content.toLowerCase();
      const found = keywords.filter((k) => contentToCheck.includes(k));
      const missing = keywords.filter((k) => !contentToCheck.includes(k));

      if (found.length > 0) {
        explanation += `. Found keywords: [${found.join(", ")}]`;
      }
      if (missing.length > 0) {
        explanation += `. Missing keywords: [${missing.join(", ")}]`;
      }
    }

    if (this.options.patterns && this.options.patterns.length > 0) {
      const matched = this.options.patterns.filter((p) =>
        p.test(content),
      ).length;
      explanation += `. Patterns matched: ${matched}/${this.options.patterns.length}`;
    }

    return explanation;
  }
}
