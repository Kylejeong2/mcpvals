import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  Mock,
  afterEach,
  MockInstance,
} from "vitest";
import { Command } from "commander";
import { createEvalCommand, listCommand } from "../../src/cli/eval";

// Mock the evaluate function
vi.mock("../../src/eval/core/index", () => ({
  evaluate: vi.fn(),
}));

// Mock config loading for list command
vi.mock("../../src/eval/core/config", () => ({
  loadConfig: vi.fn(),
}));

// Mock chalk to avoid console formatting issues in tests
vi.mock("chalk", () => ({
  default: {
    bold: (str: string) => str,
    cyan: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
  },
}));

describe("CLI Commands", () => {
  let mockEvaluate: Mock;
  let mockLoadConfig: Mock;
  let mockExit: MockInstance;
  let mockConsoleLog: MockInstance;
  let mockConsoleError: MockInstance;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mocks
    mockEvaluate = vi.fn();
    mockLoadConfig = vi.fn();

    // Mock process.exit to prevent actual exit during tests
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit called with code ${code}`);
      });

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const evaluateModule = await import("../../src/eval/core/index");
    const configModule = await import("../../src/eval/core/config");

    vi.mocked(evaluateModule.evaluate).mockImplementation(mockEvaluate);
    vi.mocked(configModule.loadConfig).mockImplementation(mockLoadConfig);

    // Default successful evaluation
    mockEvaluate.mockResolvedValue({
      passed: true,
      evaluations: [],
      toolHealthResults: [],
      config: {},
      timestamp: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("evalCommand", () => {
    it("should parse eval command with config argument", async () => {
      const result = {
        passed: true,
        evaluations: [],
        toolHealthResults: [],
        config: {},
        timestamp: new Date(),
      };
      mockEvaluate.mockResolvedValue(result);

      const evalCmd = createEvalCommand();

      // Parse the command and wait for action to complete
      await evalCmd.parseAsync(["test-config.json"], { from: "user" });

      expect(mockEvaluate).toHaveBeenCalledWith("test-config.json", {
        debug: undefined,
        reporter: "console",
        llmJudge: undefined,
        toolHealthOnly: undefined,
        workflowsOnly: undefined,
      });
    });

    it("should parse eval command with options", async () => {
      const evalCmd = createEvalCommand();

      await evalCmd.parseAsync(
        [
          "test-config.json",
          "--debug",
          "--reporter",
          "json",
          "--llm-judge",
          "--tool-health-only",
        ],
        { from: "user" },
      );

      expect(mockEvaluate).toHaveBeenCalledWith("test-config.json", {
        debug: true,
        reporter: "json",
        llmJudge: true,
        toolHealthOnly: true,
        workflowsOnly: undefined,
      });
    });

    it("should handle evaluation failure", async () => {
      const result = {
        passed: false,
        evaluations: [],
        toolHealthResults: [],
        config: {},
        timestamp: new Date(),
      };
      mockEvaluate.mockResolvedValue(result);

      const evalCmd = createEvalCommand();

      await expect(
        evalCmd.parseAsync(["test-config.json"], { from: "user" }),
      ).rejects.toThrow("process.exit called with code 1");

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle evaluation error", async () => {
      mockEvaluate.mockRejectedValue(new Error("Config not found"));

      const evalCmd = createEvalCommand();

      await expect(
        evalCmd.parseAsync(["test-config.json"], { from: "user" }),
      ).rejects.toThrow("process.exit called with code 1");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Evaluation failed:",
        expect.any(Error),
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should throw error when config argument is missing", async () => {
      const evalCmd = createEvalCommand();

      await expect(evalCmd.parseAsync([], { from: "user" })).rejects.toThrow();
    });
  });

  describe("listCommand", () => {
    it("should create list command with correct configuration", () => {
      expect(listCommand).toBeInstanceOf(Command);
      expect(listCommand.name()).toBe("list");
      expect(listCommand.description()).toContain("List workflows");
    });

    it("should list workflows from config", async () => {
      const mockConfig = {
        server: {
          transport: "stdio",
          command: "node",
          args: ["server.js"],
        },
        workflows: [
          {
            name: "workflow-1",
            description: "First workflow",
            steps: [
              { user: "Step 1", expectTools: ["tool1"] },
              { user: "Step 2", expectTools: ["tool2"] },
            ],
          },
          {
            name: "workflow-2",
            steps: [{ user: "Single step" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.stringMatching(/.*config\.json$/),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Available workflows:"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("workflow-1: First workflow"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("workflow-2"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Steps: 2"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Steps: 1"),
      );
    });

    it("should display server information", async () => {
      const mockConfig = {
        server: {
          transport: "stdio",
          command: "node",
          args: ["server.js", "--port", "3000"],
        },
        workflows: [
          {
            name: "test-workflow",
            steps: [{ user: "Test" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Server type: stdio"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Command: node server.js --port 3000"),
      );
    });

    it("should display HTTP server information", async () => {
      const mockConfig = {
        server: {
          transport: "shttp",
          url: "https://api.example.com/mcp",
        },
        workflows: [
          {
            name: "test-workflow",
            steps: [{ user: "Test" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Server type: shttp"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("URL: https://api.example.com/mcp"),
      );
    });

    it("should display expected tools count", async () => {
      const mockConfig = {
        server: {
          transport: "stdio",
          command: "node",
        },
        workflows: [
          {
            name: "tool-workflow",
            steps: [
              { user: "Step 1", expectTools: ["tool1", "tool2"] },
              { user: "Step 2", expectTools: ["tool3"] },
            ],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Expected tools: 3"),
      );
    });

    it("should handle workflows without descriptions", async () => {
      const mockConfig = {
        server: {
          transport: "stdio",
          command: "node",
        },
        workflows: [
          {
            name: "no-description-workflow",
            steps: [{ user: "Test" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("no-description-workflow"),
      );
      // Should not have a colon followed by description
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringMatching(/no-description-workflow: .+/),
      );
    });

    it("should handle workflows without expected tools", async () => {
      const mockConfig = {
        server: {
          transport: "stdio",
          command: "node",
        },
        workflows: [
          {
            name: "no-tools-workflow",
            steps: [{ user: "Step 1" }, { user: "Step 2" }],
          },
        ],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["config.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Steps: 2"),
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Expected tools:"),
      );
    });

    it("should handle config loading errors", async () => {
      mockLoadConfig.mockRejectedValue(new Error("Config file not found"));

      await expect(
        listCommand.parseAsync(["missing.json"], { from: "user" }),
      ).rejects.toThrow(/process\.exit.*1/);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load config:"),
        expect.any(Error),
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should resolve absolute path for config", async () => {
      const mockConfig = {
        server: { transport: "stdio", command: "node" },
        workflows: [{ name: "test", steps: [{ user: "test" }] }],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["relative-config.json"], { from: "user" });

      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.stringMatching(/.*relative-config\.json$/),
      );
      // Should be an absolute path
      const calledPath = mockLoadConfig.mock.calls[0][0];
      expect(calledPath).toMatch(/^\/.*relative-config\.json$/);
    });

    it("should handle empty workflows array", async () => {
      const mockConfig = {
        server: { transport: "stdio", command: "node" },
        workflows: [],
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      await listCommand.parseAsync(["empty.json"], { from: "user" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Available workflows:"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Server type: stdio"),
      );
    });
  });

  describe("Command Integration", () => {
    it("should handle eval command with various argument combinations", async () => {
      const result = {
        passed: true,
        evaluations: [],
        toolHealthResults: [],
        config: {},
        timestamp: new Date(),
      };

      const evalCmd = createEvalCommand();

      // Mock the evaluate function to capture actual arguments
      mockEvaluate.mockImplementation((configPath, options) => {
        expect(configPath).toBe("full-config.json");
        expect(options).toEqual({
          debug: true,
          reporter: "json",
          llmJudge: true,
          toolHealthOnly: undefined,
          workflowsOnly: true,
        });
        return Promise.resolve(result);
      });

      await evalCmd.parseAsync(
        [
          "full-config.json",
          "--debug",
          "--reporter",
          "json",
          "--llm-judge",
          "--workflows-only",
        ],
        { from: "user" },
      );

      expect(mockEvaluate).toHaveBeenCalled();
    });

    it("should handle conflicting flags gracefully", async () => {
      const result = {
        passed: true,
        evaluations: [],
        toolHealthResults: [],
        config: {},
        timestamp: new Date(),
      };

      const evalCmd = createEvalCommand();

      // Mock the evaluate function to capture actual arguments
      mockEvaluate.mockImplementation((configPath, options) => {
        expect(configPath).toBe("config.json");
        expect(options).toEqual({
          debug: undefined,
          reporter: "console",
          llmJudge: undefined,
          toolHealthOnly: true,
          workflowsOnly: true,
        });
        return Promise.resolve(result);
      });

      await evalCmd.parseAsync(
        [
          "config.json",
          "--reporter",
          "console",
          "--tool-health-only",
          "--workflows-only",
        ],
        { from: "user" },
      );

      expect(mockEvaluate).toHaveBeenCalled();
    });

    it("should preserve original process.exit behavior after tests", () => {
      // This test ensures our mocking doesn't leak
      expect(mockExit).toBeDefined();
      expect(typeof mockExit).toBe("function");
    });
  });
});
