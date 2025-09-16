import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock ServerRunner used by vitest-eval
vi.mock("../../../src/eval/core/runner.js", () => {
  class MockServerRunner {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});

    // Tools
    listTools = vi.fn(async () => [{ name: "add", description: "Add" }]);
    callTool = vi.fn(async (name: string, args: Record<string, unknown>) => ({
      name,
      args,
    }));

    // Workflows
    runWorkflowWithLLM = vi.fn(async (steps: Array<{ user: string }>) => ({
      success: true,
      messages: steps.map((s) => ({ role: "user", content: s.user })),
      toolCalls: [],
      conversationText: steps.map((s) => s.user).join("\n"),
    }));

    simulateUserApproval = vi.fn(async (_id: string, approved: boolean) =>
      approved
        ? {
            approved: true,
            response: {
              role: "assistant" as const,
              content: { type: "text" as const, text: "ok" },
            },
          }
        : { approved: false, error: "rejected" },
    );
    validateModelPreferences = vi.fn(
      (prefs?: {
        costPriority?: number;
        speedPriority?: number;
        intelligencePriority?: number;
      }) => ({
        valid:
          !prefs ||
          Object.values(prefs).every(
            (v) => v === undefined || (v >= 0 && v <= 1),
          ),
        errors: [],
      }),
    );
  }
  return { ServerRunner: MockServerRunner };
});

// Import after mocks are set up
import {
  setupMCPServer,
  teardownMCPServer,
} from "../../../src/vitest/vitest-eval.js";
import * as VitestExports from "../../../src/vitest/vitest-eval.js";

describe("Vitest integration: utils and wrappers", () => {
  beforeAll(async () => {
    await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["server.js"],
    } as any);
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  it("should export config-driven describe helpers", () => {
    expect(typeof VitestExports.describeEvalFromConfig).toBe("function");
    expect(typeof VitestExports.describeToolHealthFromConfig).toBe("function");
  });
});
