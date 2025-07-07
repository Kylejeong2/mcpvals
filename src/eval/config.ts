import { z } from "zod";
import { readFile } from "fs/promises";
import { resolve } from "path";

// Tool test schema for individual tool health testing
export const ToolTestSchema = z.object({
  name: z.string().describe("Tool name to test"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  args: z.record(z.unknown()).describe("Arguments to pass to the tool"),
  expectedResult: z
    .unknown()
    .optional()
    .describe("Expected result for validation"),
  expectedError: z
    .string()
    .optional()
    .describe("Expected error message if tool should fail"),
  maxLatency: z
    .number()
    .optional()
    .describe("Maximum acceptable latency in milliseconds"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe("Number of retries on failure"),
});

// Tool health suite schema
export const ToolHealthSuiteSchema = z.object({
  name: z.string().describe("Name of the tool health suite"),
  description: z.string().optional().describe("Description of this test suite"),
  tests: z.array(ToolTestSchema).describe("Individual tool tests"),
  parallel: z.boolean().default(false).describe("Run tests in parallel"),
  timeout: z
    .number()
    .optional()
    .describe("Override global timeout for these tests"),
});

// Workflow step schema
export const WorkflowStepSchema = z.object({
  user: z.string().describe("User message to send"),
  expectTools: z
    .array(z.string())
    .optional()
    .describe("Expected tools to be called in order"),
  expectedState: z
    .string()
    .optional()
    .describe("Expected end state for LLM judge"),
});

// Workflow schema
export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
  // Optional: Expected tools for the entire workflow (not per-step)
  expectTools: z
    .array(z.string())
    .optional()
    .describe("Expected tools to be called across all steps"),
});

// Server configuration schema
export const ServerSchema = z.discriminatedUnion("transport", [
  z.object({
    transport: z.literal("stdio"),
    command: z.string(),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    transport: z.literal("shttp"),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
]);

// Main configuration schema
export const ConfigSchema = z.object({
  server: ServerSchema,
  workflows: z.array(WorkflowSchema).optional().default([]),
  toolHealthSuites: z.array(ToolHealthSuiteSchema).optional().default([]),
  timeout: z.number().optional().default(30000),
  llmJudge: z.boolean().default(false),
  openaiKey: z.string().optional(),
  judgeModel: z.string().default("gpt-4o"),
  passThreshold: z.number().min(0).max(1).default(0.8),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type ServerConfig = z.infer<typeof ServerSchema>;
export type ToolTest = z.infer<typeof ToolTestSchema>;
export type ToolHealthSuite = z.infer<typeof ToolHealthSuiteSchema>;

/**
 * Expand environment variables in a string
 * Handles ${VAR_NAME} syntax
 */
function expandEnvVars(str: string): string {
  return str.replace(/\${([^}]+)}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * Recursively expand environment variables in an object
 */
function expandEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return expandEnvVars(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(expandEnvVarsInObject);
  } else if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Load and validate configuration from a file
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const absolutePath = resolve(process.cwd(), configPath);

  try {
    // Handle both .json and .ts/.js files
    if (configPath.endsWith(".json")) {
      const content = await readFile(absolutePath, "utf-8");
      const rawConfig = JSON.parse(content);

      // Process environment variables in all fields
      const expandedConfig = expandEnvVarsInObject(rawConfig);

      return ConfigSchema.parse(expandedConfig);
    } else {
      // Dynamic import for .ts/.js files
      const module = await import(absolutePath);
      const rawConfig = module.default || module;

      // Process environment variables in all fields
      const expandedConfig = expandEnvVarsInObject(rawConfig);

      return ConfigSchema.parse(expandedConfig);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid configuration: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw error;
  }
}
