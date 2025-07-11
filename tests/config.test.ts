import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigSchema } from "../src/eval/config";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Config Schema Validation", () => {
  it("should validate a minimal valid config", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should validate HTTP server config", () => {
    const config = {
      server: {
        transport: "shttp",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject invalid transport", () => {
    const config = {
      server: {
        transport: "invalid",
        command: "node",
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("transport");
    }
  });

  it("should reject invalid timeout", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
      },
      workflows: [],
      timeout: -1,
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject workflow step without user message", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
      },
      workflows: [
        {
          name: "test",
          steps: [
            {
              // Missing required 'user' field
              expectedState: "done",
            },
          ],
        },
      ],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should validate tool health suite", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
      },
      workflows: [],
      toolHealthSuites: [
        {
          name: "math-tests",
          tests: [
            {
              name: "add",
              args: { a: 1, b: 2 },
              expectedResult: 3,
            },
          ],
        },
      ],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject invalid passThreshold", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
      },
      workflows: [],
      passThreshold: 1.5, // > 1.0
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should apply default values", () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeout).toBe(30000);
      expect(result.data.llmJudge).toBe(false);
      expect(result.data.judgeModel).toBe("gpt-4o");
      expect(result.data.passThreshold).toBe(0.8);
      if (result.data.server.transport === "stdio") {
        expect(result.data.server.args).toEqual([]);
      }
    }
  });
});

describe("Config Loading", () => {
  let tempDir: string;
  let tempFiles: string[] = [];

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcpvals-test-"));
  });

  afterEach(() => {
    // Clean up temp files
    tempFiles.forEach((file) => {
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup errors
      }
    });
    tempFiles = [];
  });

  const createTempFile = (filename: string, content: string): string => {
    const filepath = join(tempDir, filename);
    writeFileSync(filepath, content);
    tempFiles.push(filepath);
    return filepath;
  };

  it("should load valid JSON config", async () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      },
      workflows: [
        {
          name: "test-workflow",
          steps: [{ user: "Hello" }],
        },
      ],
    };

    const configPath = createTempFile("config.json", JSON.stringify(config));
    const result = await loadConfig(configPath);

    expect(result.server.transport).toBe("stdio");
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].name).toBe("test-workflow");
  });

  it("should load TypeScript config file", async () => {
    const configContent = `
export default {
  server: {
    transport: "stdio",
    command: "node",
    args: ["server.js"],
  },
  workflows: [
    {
      name: "ts-workflow",
      steps: [{ user: "Hello from TS" }],
    },
  ],
};
`;

    const configPath = createTempFile("config.ts", configContent);
    const result = await loadConfig(configPath);

    expect(result.workflows[0].name).toBe("ts-workflow");
    expect(result.workflows[0].steps[0].user).toBe("Hello from TS");
  });

  it("should expand environment variables", async () => {
    process.env.TEST_COMMAND = "node";
    process.env.TEST_URL = "https://test.example.com";

    const config = {
      server: {
        transport: "stdio",
        command: "${TEST_COMMAND}",
        args: ["${TEST_URL}/server.js"],
      },
      workflows: [],
    };

    const configPath = createTempFile("config.json", JSON.stringify(config));
    const result = await loadConfig(configPath);

    if (result.server.transport === "stdio") {
      expect(result.server.command).toBe("node");
      expect(result.server.args![0]).toBe("https://test.example.com/server.js");
    }

    delete process.env.TEST_COMMAND;
    delete process.env.TEST_URL;
  });

  it("should leave undefined env vars as-is", async () => {
    const config = {
      server: {
        transport: "stdio",
        command: "${UNDEFINED_VAR}",
      },
      workflows: [],
    };

    const configPath = createTempFile("config.json", JSON.stringify(config));
    const result = await loadConfig(configPath);

    if (result.server.transport === "stdio") {
      expect(result.server.command).toBe("${UNDEFINED_VAR}");
    }
  });

  it("should expand env vars in nested objects", async () => {
    process.env.API_KEY = "secret123";

    const config = {
      server: {
        transport: "shttp",
        url: "https://api.example.com",
        headers: {
          Authorization: "Bearer ${API_KEY}",
        },
      },
      workflows: [],
    };

    const configPath = createTempFile("config.json", JSON.stringify(config));
    const result = await loadConfig(configPath);

    expect(result.server.transport).toBe("shttp");
    if (result.server.transport === "shttp") {
      expect(result.server.headers!["Authorization"]).toBe("Bearer secret123");
    }

    delete process.env.API_KEY;
  });

  it("should throw on invalid JSON", async () => {
    const configPath = createTempFile("invalid.json", "{ invalid json }");

    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  it("should throw on schema validation error", async () => {
    const invalidConfig = {
      server: {
        transport: "invalid-transport",
        command: "node",
      },
      workflows: [],
    };

    const configPath = createTempFile(
      "invalid.json",
      JSON.stringify(invalidConfig),
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      /Invalid configuration/,
    );
  });

  it("should handle complex tool health suite config", async () => {
    const config = {
      server: {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      },
      workflows: [],
      toolHealthSuites: [
        {
          name: "comprehensive-tests",
          description: "Full tool testing suite",
          parallel: true,
          timeout: 5000,
          tests: [
            {
              name: "add",
              description: "Test addition",
              args: { a: 2, b: 3 },
              expectedResult: 5,
              maxLatency: 1000,
              retries: 2,
            },
            {
              name: "divide",
              description: "Test division by zero",
              args: { a: 10, b: 0 },
              expectedError: "Division by zero",
            },
          ],
        },
      ],
    };

    const configPath = createTempFile("complex.json", JSON.stringify(config));
    const result = await loadConfig(configPath);

    expect(result.toolHealthSuites).toHaveLength(1);
    const suite = result.toolHealthSuites[0];
    expect(suite.name).toBe("comprehensive-tests");
    expect(suite.parallel).toBe(true);
    expect(suite.timeout).toBe(5000);
    expect(suite.tests).toHaveLength(2);
    expect(suite.tests[0].retries).toBe(2);
    expect(suite.tests[1].expectedError).toBe("Division by zero");
  });
});
