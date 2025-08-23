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
    let content = "";

    // Extract content from various output formats
    if (typeof output === "string") {
      content = output;
    } else {
      const outputObj = output as Record<string, unknown>;
      if (outputObj?.content) {
        // Handle MCP server response format
        if (Array.isArray(outputObj.content)) {
          content = outputObj.content
            .map((item: Record<string, unknown>) =>
              String(item.text || item.content || item),
            )
            .join(" ");
        } else {
          content = String(outputObj.content);
        }
      } else if (outputObj?.text) {
        content = String(outputObj.text);
      } else if (outputObj?.result) {
        // Recursive extraction from nested result
        const resultObj = outputObj.result as Record<string, unknown>;
        if (Array.isArray(resultObj?.content)) {
          content = resultObj.content
            .map((item: Record<string, unknown>) =>
              String(item.text || item.content || item),
            )
            .join(" ");
        } else {
          content = String(outputObj.result);
        }
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
        : String(
            expectedObj?.content ||
              expectedObj?.text ||
              expectedObj?.result ||
              "",
          );

    // Use context to enhance content evaluation
    const testCaseName = context.testCase.name || "";
    const isToolTest = testCaseName.toLowerCase().includes("tool");
    const isWorkflowTest = testCaseName.toLowerCase().includes("workflow");

    if (!this.options.caseSensitive) {
      content = content.toLowerCase();
    }

    let score = 0;

    // Exact match check
    if (this.options.exactMatch && expectedContent) {
      const expectedLower = this.options.caseSensitive
        ? expectedContent
        : expectedContent.toLowerCase();
      return content === expectedLower ? 1 : 0;
    }

    // Enhanced pattern matching with context awareness
    if (this.options.patterns && this.options.patterns.length > 0) {
      const matchedPatterns = this.options.patterns.filter((pattern) =>
        pattern.test(content),
      );
      let patternScore =
        (matchedPatterns.length / this.options.patterns.length) * 0.3;

      // Bonus for context-appropriate patterns
      if (
        isToolTest &&
        matchedPatterns.some((p) => p.toString().includes("tool"))
      ) {
        patternScore += 0.05;
      }
      if (
        isWorkflowTest &&
        matchedPatterns.some((p) =>
          p.toString().includes("workflow|step|process"),
        )
      ) {
        patternScore += 0.05;
      }

      score += patternScore;
    } else {
      score += 0.3;
    }

    // Enhanced required keywords with context
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
      score += (foundKeywords.length / keywords.length) * 0.3;
    } else {
      score += 0.3;
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
      const penalty = (foundForbidden.length / keywords.length) * 0.3;
      score = Math.max(0, score - penalty);
    }

    // Enhanced relevance check with context-aware scoring
    if (expectedContent && expectedContent.trim()) {
      const expectedLower = this.options.caseSensitive
        ? expectedContent
        : expectedContent.toLowerCase();
      const expectedWords = expectedLower
        .split(/\s+/)
        .filter((word: string) => word.length > 2);

      if (expectedWords.length > 0) {
        // Semantic similarity scoring
        const commonWords = expectedWords.filter((word) =>
          content.includes(word),
        );
        let relevanceScore = (commonWords.length / expectedWords.length) * 0.2;

        // Bonus for length appropriateness
        const expectedLength = expectedContent.length;
        const contentLength = content.length;
        const lengthRatio =
          Math.min(contentLength, expectedLength) /
          Math.max(contentLength, expectedLength);

        if (lengthRatio > 0.5) {
          // Content length is reasonably similar to expected
          relevanceScore += 0.05;
        }

        // Context-aware content bonuses
        if (
          isToolTest &&
          (content.includes("tool") ||
            content.includes("function") ||
            content.includes("call"))
        ) {
          relevanceScore += 0.05;
        }
        if (
          isWorkflowTest &&
          (content.includes("step") ||
            content.includes("process") ||
            content.includes("workflow"))
        ) {
          relevanceScore += 0.05;
        }

        score += relevanceScore;
      } else {
        score += 0.2;
      }
    } else {
      // No expected content - score based on context and content quality
      if (content.length > 10) {
        // Has substantial content
        score += 0.15;
      }
      if (isToolTest && content.toLowerCase().includes("tool")) {
        score += 0.05;
      }
      if (
        isWorkflowTest &&
        (content.toLowerCase().includes("workflow") ||
          content.toLowerCase().includes("step"))
      ) {
        score += 0.05;
      }
    }

    // Quality indicators from context
    const availableTools = context.tools.map((t) => t.name);
    const mentionsValidTools = availableTools.some((tool) =>
      content.toLowerCase().includes(tool.toLowerCase()),
    );
    if (mentionsValidTools) {
      score += 0.1; // Bonus for mentioning actual available tools
    }

    return Math.min(1, Math.max(0, score));
  }

  async explain(
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ): Promise<string> {
    let content = "";

    if (typeof output === "string") {
      content = output;
    } else {
      const outputObj = output as Record<string, unknown>;
      if (outputObj?.content) {
        if (Array.isArray(outputObj.content)) {
          content = outputObj.content
            .map((item: Record<string, unknown>) =>
              String(item.text || item.content || item),
            )
            .join(" ");
        } else {
          content = String(outputObj.content);
        }
      } else if (outputObj?.text) {
        content = String(outputObj.text);
      } else if (outputObj?.result) {
        const resultObj = outputObj.result as Record<string, unknown>;
        if (Array.isArray(resultObj?.content)) {
          content = resultObj.content
            .map((item: Record<string, unknown>) =>
              String(item.text || item.content || item),
            )
            .join(" ");
        } else {
          content = String(outputObj.result);
        }
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
    const testCaseName = context.testCase.name || "";
    const availableTools = context.tools.map((t) => t.name);

    let explanation = `Content length: ${content.length} characters`;

    if (expectedContent) {
      explanation += `, expected length: ${expectedContent.length}`;
    }

    // Context information
    explanation += `. Test context: "${testCaseName}"`;

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
        explanation += `. Found required: [${found.join(", ")}]`;
      }
      if (missing.length > 0) {
        explanation += `. Missing required: [${missing.join(", ")}]`;
      }
    }

    if (
      this.options.forbiddenKeywords &&
      this.options.forbiddenKeywords.length > 0
    ) {
      const keywords = this.options.caseSensitive
        ? this.options.forbiddenKeywords
        : this.options.forbiddenKeywords.map((k) => k.toLowerCase());
      const contentToCheck = this.options.caseSensitive
        ? content
        : content.toLowerCase();
      const foundForbidden = keywords.filter((k) => contentToCheck.includes(k));

      if (foundForbidden.length > 0) {
        explanation += `. Found forbidden: [${foundForbidden.join(", ")}]`;
      }
    }

    if (this.options.patterns && this.options.patterns.length > 0) {
      const matched = this.options.patterns.filter((p) =>
        p.test(content),
      ).length;
      explanation += `. Patterns matched: ${matched}/${this.options.patterns.length}`;
    }

    // Tool relevance
    const mentionsValidTools = availableTools.filter((tool) =>
      content.toLowerCase().includes(tool.toLowerCase()),
    );
    if (mentionsValidTools.length > 0) {
      explanation += `. Mentions tools: [${mentionsValidTools.join(", ")}]`;
    }

    // Content quality indicators
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    explanation += `. Word count: ${wordCount}`;

    return explanation;
  }
}
