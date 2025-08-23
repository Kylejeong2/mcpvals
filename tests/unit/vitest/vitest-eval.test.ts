import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock ServerRunner used by vitest-eval
vi.mock("../../../src/eval/core/runner.js", () => {
  class MockServerRunner {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});

    // Resources
    listResources = vi.fn(async () => ({
      resources: [{ uri: "file://a.txt" }],
    }));
    readResource = vi.fn(async (uri: string) => ({
      contents: [{ uri, text: "ok" }],
    }));
    listResourceTemplates = vi.fn(async () => ({
      resourceTemplates: [{ uriTemplate: "file://{name}.txt" }],
    }));
    subscribeToResource = vi.fn(async () => ({ subscribed: true }));
    unsubscribeFromResource = vi.fn(async () => ({ unsubscribed: true }));

    // Prompts
    listPrompts = vi.fn(async () => ({ prompts: [{ name: "hello" }] }));
    getPrompt = vi.fn(async (name: string, args?: Record<string, unknown>) => ({
      description: name,
      messages: [
        {
          role: "user",
          content: { type: "text", text: JSON.stringify(args || {}) },
        },
      ],
    }));

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

    // Sampling
    createSamplingMessage = vi.fn(async () => ({
      requestId: "sampling_1",
      userApprovalRequired: true,
      messages: [],
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
    validateSamplingContent = vi.fn(
      (
        messages: Array<{
          role: "user" | "assistant";
          content: {
            type: "text" | "image";
            text?: string;
            data?: string;
            mimeType?: string;
          };
        }>,
      ) => ({
        valid: Array.isArray(messages) && messages.length > 0,
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
  let utils: any;

  beforeAll(async () => {
    utils = await setupMCPServer({
      transport: "stdio",
      command: "node",
      args: ["server.js"],
    } as any);
  });

  afterAll(async () => {
    await teardownMCPServer();
  });

  it("should expose extended resource utilities", async () => {
    const templates = await utils.listResourceTemplates();
    expect(templates).toEqual(["file://{name}.txt"]);

    const sub = await utils.subscribeToResource("file://a.txt");
    expect(sub).toEqual({ subscribed: true });

    const unsub = await utils.unsubscribeFromResource("file://a.txt");
    expect(unsub).toEqual({ unsubscribed: true });
  });

  it("should expose sampling utilities", async () => {
    const req = await utils.createSamplingMessage({
      messages: [{ role: "user", content: { type: "text", text: "hi" } }],
    });
    expect(req.requestId).toBeDefined();
    expect(req.userApprovalRequired).toBe(true);

    const approved = await utils.simulateUserApproval(req.requestId, true);
    expect(approved.approved).toBe(true);
    expect(approved.response?.content.text).toBe("ok");

    const rejected = await utils.simulateUserApproval(req.requestId, false);
    expect(rejected.approved).toBe(false);
    expect(rejected.error).toBeDefined();

    const prefsOk = utils.validateModelPreferences({
      costPriority: 0.5,
      speedPriority: 0.5,
    });
    expect(prefsOk.valid).toBe(true);
    const prefsBad = utils.validateModelPreferences({ costPriority: 2 });
    expect(prefsBad.valid).toBe(false);

    const contentOk = utils.validateSamplingContent([
      { role: "user", content: { type: "text", text: "hello" } },
    ]);
    expect(contentOk.valid).toBe(true);
  });

  it("should keep existing utils working", async () => {
    const tools = await utils.callTool("add", { a: 1, b: 2 });
    expect(tools).toEqual({ name: "add", args: { a: 1, b: 2 } });

    const resList = await utils.listResources();
    expect(resList).toEqual(["file://a.txt"]);

    const prompt = await utils.getPrompt("hello", { who: "world" });
    expect(prompt.messages?.[0]?.role).toBe("user");
  });

  it("should export config-driven describe helpers", () => {
    expect(typeof VitestExports.describeEvalFromConfig).toBe("function");
    expect(typeof VitestExports.describeToolHealthFromConfig).toBe("function");
    expect(typeof VitestExports.describeResourcesFromConfig).toBe("function");
    expect(typeof VitestExports.describePromptsFromConfig).toBe("function");
    expect(typeof VitestExports.describeSamplingFromConfig).toBe("function");
    expect(typeof VitestExports.describeOAuth2FromConfig).toBe("function");
  });
});
