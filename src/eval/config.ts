import { z } from "zod";
import { readFile } from "fs/promises";
import { resolve } from "path";

// Branded types for better type safety
const ToolNameSchema = z.string().min(1).brand<"ToolName">();
const PromptNameSchema = z.string().min(1).brand<"PromptName">();
const ResourceUriSchema = z
  .string()
  .url()
  .or(z.string().regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:/))
  .brand<"ResourceUri">();

// Common argument schema with better validation
const ArgumentValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z.record(z.unknown()),
  z.null(),
]);

const ArgumentsSchema = z.record(z.string(), ArgumentValueSchema);

// Tool test schema for individual tool health testing
export const ToolTestSchema = z.object({
  name: ToolNameSchema.describe("Tool name to test"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  args: ArgumentsSchema.describe("Arguments to pass to the tool"),
  expectedResult: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.unknown()),
      z.record(z.unknown()),
      z.null(),
    ])
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

// Resource test schemas
export const ResourceTestSchema = z.object({
  name: z.string().describe("Resource test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  uri: ResourceUriSchema.describe("Resource URI to test"),
  expectedContent: z
    .union([z.string(), z.array(z.string()), z.record(z.unknown()), z.null()])
    .optional()
    .describe("Expected content for validation"),
  expectedMimeType: z.string().optional().describe("Expected MIME type"),
  expectError: z
    .string()
    .optional()
    .describe("Expected error message if resource should fail"),
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

export const ResourceDiscoveryTestSchema = z.object({
  name: z.string().describe("Discovery test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  expectedResources: z
    .array(z.string())
    .optional()
    .describe("Expected resource URIs to be found"),
  expectedCount: z
    .object({
      min: z.number().optional().describe("Minimum expected resource count"),
      max: z.number().optional().describe("Maximum expected resource count"),
      exact: z.number().optional().describe("Exact expected resource count"),
    })
    .optional()
    .describe("Expected resource count constraints"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const ResourceTemplateTestSchema = z.object({
  name: z.string().describe("Template test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  templateUri: z.string().describe("Resource template URI to test"),
  parameters: z
    .record(z.unknown())
    .describe("Parameters to instantiate the template"),
  expectedUriPattern: z
    .string()
    .optional()
    .describe("Expected URI pattern (regex) after instantiation"),
  expectError: z
    .string()
    .optional()
    .describe("Expected error message if template should fail"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe("Number of retries on failure"),
});

export const ResourceSubscriptionTestSchema = z.object({
  name: z.string().describe("Subscription test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  resourceUri: z.string().describe("Resource URI to subscribe to"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
  expectUpdates: z
    .boolean()
    .optional()
    .describe("Whether to expect resource update notifications"),
});

// Prompt test schemas
export const PromptTestSchema = z.object({
  name: PromptNameSchema.describe("Prompt name to test"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  args: ArgumentsSchema.describe("Arguments to pass to the prompt"),
  expectedContent: z
    .union([z.string(), z.array(z.string()), z.record(z.unknown()), z.null()])
    .optional()
    .describe("Expected content patterns in the prompt output"),
  expectedMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]).describe("Message role"),
        content: z.string().describe("Expected content pattern"),
      }),
    )
    .optional()
    .describe("Expected message structure"),
  expectError: z
    .string()
    .optional()
    .describe("Expected error message if prompt should fail"),
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

export const PromptArgumentTestSchema = z.object({
  name: z.string().describe("Argument validation test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  promptName: z.string().describe("Prompt name to test arguments for"),
  requiredArgs: z
    .array(z.string())
    .optional()
    .describe("Arguments that should be required"),
  optionalArgs: z
    .array(z.string())
    .optional()
    .describe("Arguments that should be optional"),
  invalidArgs: z
    .record(z.unknown())
    .optional()
    .describe("Invalid arguments that should cause errors"),
  validArgs: z
    .record(z.unknown())
    .optional()
    .describe("Valid arguments that should succeed"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const PromptDiscoveryTestSchema = z.object({
  name: z.string().describe("Discovery test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  expectedPrompts: z
    .array(z.string())
    .optional()
    .describe("Expected prompt names to be found"),
  expectedCount: z
    .object({
      min: z.number().optional().describe("Minimum expected prompt count"),
      max: z.number().optional().describe("Maximum expected prompt count"),
      exact: z.number().optional().describe("Exact expected prompt count"),
    })
    .optional()
    .describe("Expected prompt count constraints"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const PromptTemplateTestSchema = z.object({
  name: z.string().describe("Template test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  promptName: z.string().describe("Prompt name to test template for"),
  arguments: z.record(z.unknown()).describe("Arguments to test template with"),
  expectedPatterns: z
    .array(z.string())
    .optional()
    .describe("Expected content patterns in generated messages"),
  unexpectedPatterns: z
    .array(z.string())
    .optional()
    .describe("Content patterns that should NOT appear"),
  validateStructure: z
    .boolean()
    .default(true)
    .describe("Whether to validate message structure"),
  expectError: z
    .string()
    .optional()
    .describe("Expected error message if template should fail"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe("Number of retries on failure"),
});

export const PromptSecurityTestSchema = z.object({
  name: z.string().describe("Security test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  promptName: z.string().describe("Prompt name to test for security"),
  injectionAttempts: z
    .array(z.record(z.unknown()))
    .describe("Prompt injection attempts to test"),
  sanitizationTests: z
    .array(
      z.object({
        input: z.record(z.unknown()).describe("Input arguments"),
        expectedSanitization: z
          .boolean()
          .describe("Whether input should be sanitized"),
      }),
    )
    .optional()
    .describe("Input sanitization tests"),
  maliciousInputs: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Malicious inputs that should be rejected"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

// Sampling test schemas
export const SamplingCapabilityTestSchema = z.object({
  name: z.string().describe("Capability test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  expectedCapability: z
    .boolean()
    .describe("Whether sampling capability should be present"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const SamplingRequestTestSchema = z.object({
  name: z.string().describe("Request test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  includeContext: z
    .array(
      z.object({
        type: z
          .enum(["text", "image", "resource"])
          .describe("Context item type"),
        text: z.string().optional().describe("Text content"),
        data: z.string().optional().describe("Base64 encoded data for images"),
        mimeType: z.string().optional().describe("MIME type for content"),
        uri: z.string().optional().describe("Resource URI"),
      }),
    )
    .optional()
    .describe("Context to include in sampling request"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]).describe("Message role"),
        content: z
          .object({
            type: z.enum(["text", "image"]).describe("Content type"),
            text: z.string().optional().describe("Text content"),
            data: z.string().optional().describe("Base64 encoded image data"),
            mimeType: z.string().optional().describe("MIME type"),
          })
          .describe("Message content"),
      }),
    )
    .describe("Messages to include in sampling request"),
  modelPreferences: z
    .object({
      costPriority: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Cost priority (0-1)"),
      speedPriority: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Speed priority (0-1)"),
      intelligencePriority: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Intelligence priority (0-1)"),
    })
    .optional()
    .describe("Model preference priorities"),
  systemPrompt: z
    .string()
    .optional()
    .describe("System prompt for the sampling request"),
  maxTokens: z.number().optional().describe("Maximum tokens for response"),
  metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
  expectError: z
    .string()
    .optional()
    .describe("Expected error message if request should fail"),
  expectUserApproval: z
    .boolean()
    .default(true)
    .describe("Whether user approval should be requested"),
  simulateUserResponse: z
    .enum(["approve", "reject", "modify"])
    .default("approve")
    .describe("Simulated user response to approval request"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe("Number of retries on failure"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const SamplingSecurityTestSchema = z.object({
  name: z.string().describe("Security test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  unauthorizedRequests: z
    .array(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.object({
              type: z.enum(["text", "image"]),
              text: z.string().optional(),
              data: z.string().optional(),
              mimeType: z.string().optional(),
            }),
          }),
        ),
        expectRejection: z
          .boolean()
          .describe("Whether this request should be rejected"),
      }),
    )
    .describe("Requests that should require user approval or be rejected"),
  sensitiveDataTests: z
    .array(
      z.object({
        input: z.string().describe("Input containing sensitive data"),
        expectFiltering: z
          .boolean()
          .describe("Whether sensitive data should be filtered"),
      }),
    )
    .optional()
    .describe("Tests for sensitive data handling"),
  privacyTests: z
    .array(
      z.object({
        description: z.string().describe("Privacy test description"),
        includePersonalData: z
          .boolean()
          .describe("Whether to include personal data in request"),
        expectDataProtection: z
          .boolean()
          .describe("Whether data should be protected"),
      }),
    )
    .optional()
    .describe("Privacy protection tests"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const SamplingPerformanceTestSchema = z.object({
  name: z.string().describe("Performance test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  concurrentRequests: z
    .number()
    .min(1)
    .max(10)
    .default(1)
    .describe("Number of concurrent sampling requests"),
  messageSize: z
    .enum(["small", "medium", "large"])
    .default("medium")
    .describe("Size of messages in the request"),
  maxLatency: z
    .number()
    .optional()
    .describe("Maximum acceptable latency in milliseconds"),
  expectThrottling: z
    .boolean()
    .default(false)
    .describe("Whether rate limiting/throttling is expected"),
  retries: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe("Number of retries on failure"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const SamplingContentTestSchema = z.object({
  name: z.string().describe("Content test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  testCases: z
    .array(
      z.object({
        contentType: z
          .enum(["text", "image", "mixed"])
          .describe("Type of content to test"),
        input: z
          .object({
            text: z.string().optional().describe("Text input"),
            imageData: z.string().optional().describe("Base64 encoded image"),
            mimeType: z.string().optional().describe("MIME type for image"),
          })
          .describe("Input content"),
        expectedHandling: z
          .enum(["accept", "reject", "convert"])
          .describe("Expected content handling"),
        expectedResponse: z
          .string()
          .optional()
          .describe("Expected response pattern"),
      }),
    )
    .describe("Content type test cases"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe("Number of retries on failure"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

export const SamplingWorkflowTestSchema = z.object({
  name: z.string().describe("Workflow test name"),
  description: z
    .string()
    .optional()
    .describe("Description of what this test does"),
  steps: z
    .array(
      z.object({
        stepType: z
          .enum(["request", "approval", "response", "validation"])
          .describe("Type of workflow step"),
        action: z.string().describe("Action to perform in this step"),
        expectedOutcome: z.string().describe("Expected outcome of this step"),
        userResponse: z
          .enum(["approve", "reject", "modify"])
          .optional()
          .describe("User response for approval steps"),
        timeoutMs: z.number().optional().describe("Step-specific timeout"),
      }),
    )
    .describe("Workflow steps to execute"),
  expectSuccess: z
    .boolean()
    .describe("Whether the overall workflow should succeed"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout for this test in milliseconds"),
});

// Sampling suite schema
export const SamplingSuiteSchema = z.object({
  name: z.string().describe("Name of the sampling suite"),
  description: z.string().optional().describe("Description of this test suite"),
  capabilityTests: z
    .array(SamplingCapabilityTestSchema)
    .optional()
    .default([])
    .describe("Sampling capability negotiation tests"),
  requestTests: z
    .array(SamplingRequestTestSchema)
    .optional()
    .default([])
    .describe("Sampling request validation tests"),
  securityTests: z
    .array(SamplingSecurityTestSchema)
    .optional()
    .default([])
    .describe("Sampling security tests"),
  performanceTests: z
    .array(SamplingPerformanceTestSchema)
    .optional()
    .default([])
    .describe("Sampling performance tests"),
  contentTests: z
    .array(SamplingContentTestSchema)
    .optional()
    .default([])
    .describe("Content type handling tests"),
  workflowTests: z
    .array(SamplingWorkflowTestSchema)
    .optional()
    .default([])
    .describe("End-to-end workflow tests"),
  parallel: z.boolean().default(false).describe("Run tests in parallel"),
  timeout: z
    .number()
    .optional()
    .describe("Override global timeout for these tests"),
});

// Prompt suite schema
export const PromptSuiteSchema = z.object({
  name: z.string().describe("Name of the prompt suite"),
  description: z.string().optional().describe("Description of this test suite"),
  discoveryTests: z
    .array(PromptDiscoveryTestSchema)
    .optional()
    .default([])
    .describe("Prompt discovery tests"),
  promptTests: z
    .array(PromptTestSchema)
    .optional()
    .default([])
    .describe("Individual prompt tests"),
  argumentTests: z
    .array(PromptArgumentTestSchema)
    .optional()
    .default([])
    .describe("Prompt argument validation tests"),
  templateTests: z
    .array(PromptTemplateTestSchema)
    .optional()
    .default([])
    .describe("Prompt template tests"),
  securityTests: z
    .array(PromptSecurityTestSchema)
    .optional()
    .default([])
    .describe("Prompt security tests"),
  parallel: z.boolean().default(false).describe("Run tests in parallel"),
  timeout: z
    .number()
    .optional()
    .describe("Override global timeout for these tests"),
});

// Resource suite schema
export const ResourceSuiteSchema = z.object({
  name: z.string().describe("Name of the resource suite"),
  description: z.string().optional().describe("Description of this test suite"),
  discoveryTests: z
    .array(ResourceDiscoveryTestSchema)
    .optional()
    .default([])
    .describe("Resource discovery tests"),
  resourceTests: z
    .array(ResourceTestSchema)
    .optional()
    .default([])
    .describe("Individual resource tests"),
  templateTests: z
    .array(ResourceTemplateTestSchema)
    .optional()
    .default([])
    .describe("Resource template tests"),
  subscriptionTests: z
    .array(ResourceSubscriptionTestSchema)
    .optional()
    .default([])
    .describe("Resource subscription tests"),
  parallel: z.boolean().default(false).describe("Run tests in parallel"),
  timeout: z
    .number()
    .optional()
    .describe("Override global timeout for these tests"),
});

// Main configuration schema
export const ConfigSchema = z.object({
  server: ServerSchema,
  workflows: z.array(WorkflowSchema).optional().default([]),
  toolHealthSuites: z.array(ToolHealthSuiteSchema).optional().default([]),
  resourceSuites: z.array(ResourceSuiteSchema).optional().default([]),
  promptSuites: z.array(PromptSuiteSchema).optional().default([]),
  samplingSuites: z.array(SamplingSuiteSchema).optional().default([]),
  timeout: z.number().min(1).optional().default(30000),
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
export type ResourceTest = z.infer<typeof ResourceTestSchema>;
export type ResourceDiscoveryTest = z.infer<typeof ResourceDiscoveryTestSchema>;
export type ResourceTemplateTest = z.infer<typeof ResourceTemplateTestSchema>;
export type ResourceSubscriptionTest = z.infer<
  typeof ResourceSubscriptionTestSchema
>;
export type ResourceSuite = z.infer<typeof ResourceSuiteSchema>;
export type PromptTest = z.infer<typeof PromptTestSchema>;
export type PromptArgumentTest = z.infer<typeof PromptArgumentTestSchema>;
export type PromptDiscoveryTest = z.infer<typeof PromptDiscoveryTestSchema>;
export type PromptTemplateTest = z.infer<typeof PromptTemplateTestSchema>;
export type PromptSecurityTest = z.infer<typeof PromptSecurityTestSchema>;
export type PromptSuite = z.infer<typeof PromptSuiteSchema>;
export type SamplingCapabilityTest = z.infer<
  typeof SamplingCapabilityTestSchema
>;
export type SamplingRequestTest = z.infer<typeof SamplingRequestTestSchema>;
export type SamplingSecurityTest = z.infer<typeof SamplingSecurityTestSchema>;
export type SamplingPerformanceTest = z.infer<
  typeof SamplingPerformanceTestSchema
>;
export type SamplingContentTest = z.infer<typeof SamplingContentTestSchema>;
export type SamplingWorkflowTest = z.infer<typeof SamplingWorkflowTestSchema>;
export type SamplingSuite = z.infer<typeof SamplingSuiteSchema>;

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
