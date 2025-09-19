import type { EvalScorer, MCPTestContext } from "../types.js";

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
