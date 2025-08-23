import { expect } from "vitest";

/**
 * Custom vitest matchers for MCP-specific assertions
 */

declare module "vitest" {
  interface Assertion {
    toCallTool(toolName: string): Promise<void>;
    toCallTools(toolNames: string[]): Promise<void>;
    toHaveSuccessfulWorkflow(): Promise<void>;
    toHaveLatencyBelow(maxMs: number): Promise<void>;
    toContainKeywords(keywords: string[]): Promise<void>;
    toMatchPattern(pattern: RegExp): Promise<void>;
    toHaveToolCallOrder(expectedOrder: string[]): Promise<void>;
  }
}

/**
 * Helper function to extract tool calls from various output formats
 */
function extractToolCalls(output: unknown): string[] {
  const obj = output as Record<string, unknown>;
  if (Array.isArray(obj?.toolCalls)) {
    return obj.toolCalls.map((call: Record<string, unknown>) =>
      String(
        call.name ||
          call.tool ||
          (call.function as Record<string, unknown>)?.name ||
          call,
      ),
    );
  } else if (Array.isArray(output)) {
    return output
      .filter(
        (item: unknown) =>
          typeof item === "string" || (item as Record<string, unknown>)?.name,
      )
      .map((item: unknown) =>
        typeof item === "string"
          ? item
          : String((item as Record<string, unknown>).name),
      );
  } else if (obj?.tools && Array.isArray(obj.tools)) {
    return obj.tools.map((tool: Record<string, unknown>) =>
      String(tool.name || tool),
    );
  }
  return [];
}

/**
 * Helper function to extract content from various output formats
 */
function extractContent(output: unknown): string {
  const obj = output as Record<string, unknown>;
  if (typeof output === "string") {
    return output;
  } else if (obj?.content) {
    // Handle array of content objects (like MCP server responses)
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((item: Record<string, unknown>) =>
          String(item.text || item.content || item),
        )
        .join(" ");
    }
    return String(obj.content);
  } else if (obj?.text) {
    return String(obj.text);
  } else if (obj?.messages && Array.isArray(obj.messages)) {
    return obj.messages
      .map((msg: Record<string, unknown>) =>
        String(msg.content || msg.text || ""),
      )
      .join(" ");
  } else if (obj?.result) {
    return extractContent(obj.result);
  }
  return String(output);
}

/**
 * Helper function to extract latency from various output formats
 */
function extractLatency(output: unknown): number | null {
  const obj = output as Record<string, unknown>;
  if (typeof obj?.latency === "number") return obj.latency;
  if (typeof obj?.executionTime === "number") return obj.executionTime;
  if (typeof obj?.duration === "number") return obj.duration;
  if (typeof obj?.responseTime === "number") return obj.responseTime;
  return null;
}

/**
 * Expect that the output contains a call to a specific tool
 */
export async function expectToolCall(
  output: unknown,
  toolName: string,
): Promise<void> {
  const toolCalls = extractToolCalls(output);
  expect(
    toolCalls.includes(toolName),
    `Expected tool "${toolName}" to be called, but only found: [${toolCalls.join(", ")}]`,
  ).toBe(true);
}

/**
 * Expect that the output contains calls to specific tools
 */
export async function expectToolCalls(
  output: unknown,
  toolNames: string[],
): Promise<void> {
  const toolCalls = extractToolCalls(output);
  const missing = toolNames.filter((name) => !toolCalls.includes(name));

  expect(
    missing.length === 0,
    `Expected tools [${toolNames.join(", ")}] to be called, but missing: [${missing.join(", ")}]. Found: [${toolCalls.join(", ")}]`,
  ).toBe(true);
}

/**
 * Expect that the workflow was successful
 */
export async function expectWorkflowSuccess(output: unknown): Promise<void> {
  const obj = output as Record<string, unknown>;
  expect(output, "Expected output to be defined").toBeDefined();
  expect(output, "Expected output to be an object").toBeTruthy();
  expect(typeof output, "Expected output to be an object").toBe("object");

  expect(
    obj.success,
    `Expected workflow to succeed, but got success: ${obj.success}`,
  ).toBe(true);

  // Also check that we have messages
  expect(
    Array.isArray(obj.messages),
    "Expected workflow output to contain messages array",
  ).toBe(true);

  expect(
    (obj.messages as unknown[]).length > 0,
    "Expected workflow to have at least one message",
  ).toBe(true);
}

/**
 * Expect that the latency is below a certain threshold
 */
export async function expectLatency(
  output: unknown,
  maxMs: number,
): Promise<void> {
  const latency = extractLatency(output);

  expect(latency !== null, "Could not find latency information in output").toBe(
    true,
  );

  expect(
    latency! <= maxMs,
    `Expected latency to be <= ${maxMs}ms, but got ${latency}ms`,
  ).toBe(true);
}

/**
 * Expect that an error occurred
 */
export async function expectError(
  output: unknown,
  expectedMessage?: string,
): Promise<void> {
  const obj = output as Record<string, unknown>;
  const hasError = !!(
    obj?.error ||
    obj?.success === false ||
    output instanceof Error
  );

  expect(hasError, "Expected an error to occur, but operation succeeded").toBe(
    true,
  );

  if (expectedMessage) {
    const errorObj = obj?.error as Record<string, unknown> | undefined;
    const errorMessage = String(
      errorObj?.message ||
        obj?.message ||
        (output instanceof Error ? output.message : output),
    );

    expect(
      errorMessage.includes(expectedMessage),
      `Expected error message to contain "${expectedMessage}", but got: "${errorMessage}"`,
    ).toBe(true);
  }
}

// Register custom matchers with vitest
expect.extend({
  async toCallTool(received: unknown, toolName: string) {
    try {
      await expectToolCall(received, toolName);
      return {
        pass: true,
        message: () => `Expected not to call tool "${toolName}"`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error instanceof Error ? error.message : String(error)),
      };
    }
  },

  async toCallTools(received: unknown, toolNames: string[]) {
    try {
      await expectToolCalls(received, toolNames);
      return {
        pass: true,
        message: () => `Expected not to call tools [${toolNames.join(", ")}]`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error instanceof Error ? error.message : String(error)),
      };
    }
  },

  async toHaveSuccessfulWorkflow(received: unknown) {
    try {
      await expectWorkflowSuccess(received);
      return {
        pass: true,
        message: () => "Expected workflow to fail",
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error instanceof Error ? error.message : String(error)),
      };
    }
  },

  async toHaveLatencyBelow(received: unknown, maxMs: number) {
    try {
      await expectLatency(received, maxMs);
      return {
        pass: true,
        message: () => `Expected latency to be above ${maxMs}ms`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error instanceof Error ? error.message : String(error)),
      };
    }
  },

  async toContainKeywords(received: unknown, keywords: string[]) {
    const content = extractContent(received).toLowerCase();
    const missing = keywords.filter(
      (keyword) => !content.includes(keyword.toLowerCase()),
    );

    const pass = missing.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected content not to contain keywords [${keywords.join(", ")}]`
          : `Expected content to contain keywords [${keywords.join(", ")}], but missing: [${missing.join(", ")}]`,
    };
  },

  async toMatchPattern(received: unknown, pattern: RegExp) {
    const content = extractContent(received);
    const pass = pattern.test(content);

    return {
      pass,
      message: () =>
        pass
          ? `Expected content not to match pattern ${pattern}`
          : `Expected content to match pattern ${pattern}, but got: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}"`,
    };
  },

  async toHaveToolCallOrder(received: unknown, expectedOrder: string[]) {
    const toolCalls = extractToolCalls(received);

    // Check if all expected tools are present in the correct order
    let lastIndex = -1;
    let correctOrder = true;

    for (const expectedTool of expectedOrder) {
      const index = toolCalls.indexOf(expectedTool, lastIndex + 1);
      if (index === -1 || index <= lastIndex) {
        correctOrder = false;
        break;
      }
      lastIndex = index;
    }

    return {
      pass: correctOrder,
      message: () =>
        correctOrder
          ? `Expected tools not to be called in order [${expectedOrder.join(", ")}]`
          : `Expected tools to be called in order [${expectedOrder.join(", ")}], but got: [${toolCalls.join(", ")}]`,
    };
  },
});
