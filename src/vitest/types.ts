import type { ServerConfig, WorkflowStep } from "../eval/core/config.js";

/**
 * Configuration for an MCP evaluation test
 */
export interface MCPTestConfig {
  /** Name of the test */
  name: string;
  /** Optional description */
  description?: string;
  /** Server configuration */
  server: ServerConfig;
  /** Test cases to run */
  data: () => Promise<MCPTestCase[]> | MCPTestCase[];
  /** Task function that processes inputs */
  task: (input: unknown, context: MCPTestContext) => Promise<unknown>;
  /** Evaluation scorers */
  scorers: EvalScorer[];
  /** Minimum threshold for passing (0-1) */
  threshold?: number;
  /** Global timeout in milliseconds */
  timeout?: number;
}

/**
 * Individual test case data
 */
export interface MCPTestCase {
  /** Input for the test case */
  input: unknown;
  /** Expected output or validation criteria */
  expected?: unknown;
  /** Optional test case name */
  name?: string;
  /** Optional test case description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context provided to test tasks
 */
export interface MCPTestContext {
  /** Server runner instance */
  server: unknown; // ServerRunner type
  /** Available tools */
  tools: Array<{ name: string; description?: string }>;
  /** Test case metadata */
  testCase: MCPTestCase;
  /** Utility functions for common MCP operations */
  utils: {
    /** Call a tool with arguments */
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    /** Run a workflow step */
    runWorkflow: (steps: WorkflowStep[]) => Promise<{
      success: boolean;
      messages: Array<{ role: string; content: string }>;
      toolCalls: unknown[];
    }>;
    /** List available resources */
    listResources: () => Promise<string[]>;
    /** Get a resource */
    getResource: (uri: string) => Promise<unknown>;
    /** List available resource templates */
    listResourceTemplates: () => Promise<string[]>;
    /** Subscribe to a resource */
    subscribeToResource: (uri: string) => Promise<unknown>;
    /** Unsubscribe from a resource */
    unsubscribeFromResource: (uri: string) => Promise<unknown>;
    /** List available prompts */
    listPrompts: () => Promise<string[]>;
    /** Get a prompt */
    getPrompt: (
      name: string,
      args?: Record<string, unknown>,
    ) => Promise<unknown>;
    /** Create a sampling message (server-to-client simulation) */
    createSamplingMessage: (request: {
      includeContext?: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
        uri?: string;
      }>;
      messages: Array<{
        role: "user" | "assistant";
        content: {
          type: "text" | "image";
          text?: string;
          data?: string;
          mimeType?: string;
        };
      }>;
      modelPreferences?: {
        costPriority?: number;
        speedPriority?: number;
        intelligencePriority?: number;
      };
      systemPrompt?: string;
      maxTokens?: number;
      metadata?: Record<string, unknown>;
    }) => Promise<{
      requestId: string;
      userApprovalRequired: boolean;
      messages: unknown[];
    }>;
    /** Simulate user approval for a sampling request */
    simulateUserApproval: (
      requestId: string,
      approved: boolean,
      modifiedRequest?: {
        messages?: Array<{
          role: "user" | "assistant";
          content: {
            type: "text" | "image";
            text?: string;
            data?: string;
            mimeType?: string;
          };
        }>;
        modelPreferences?: {
          costPriority?: number;
          speedPriority?: number;
          intelligencePriority?: number;
        };
      },
    ) => Promise<{
      approved: boolean;
      response?: { role: "assistant"; content: { type: "text"; text: string } };
      error?: string;
    }>;
    /** Validate sampling model preferences */
    validateModelPreferences: (preferences?: {
      costPriority?: number;
      speedPriority?: number;
      intelligencePriority?: number;
    }) => { valid: boolean; errors: string[] };
    /** Validate sampling message content types */
    validateSamplingContent: (
      messages: Array<{
        role: "user" | "assistant";
        content: {
          type: "text" | "image";
          text?: string;
          data?: string;
          mimeType?: string;
        };
      }>,
    ) => { valid: boolean; errors: string[] };
  };
}

/**
 * Evaluation scorer interface
 */
export interface EvalScorer {
  /** Name of this scorer */
  name: string;
  /** Score function that returns 0-1 */
  score: (
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ) => Promise<number> | number;
  /** Optional detailed explanation */
  explain?: (
    output: unknown,
    expected: unknown,
    context: MCPTestContext,
  ) => Promise<string> | string;
}

/**
 * Result of running an evaluation
 */
export interface EvalResult {
  /** Test case that was run */
  testCase: MCPTestCase;
  /** Actual output from the task */
  output: unknown;
  /** Scores from each scorer */
  scores: Array<{
    scorerName: string;
    score: number;
    explanation?: string;
  }>;
  /** Overall average score */
  overallScore: number;
  /** Whether this test case passed the threshold */
  passed: boolean;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Any error that occurred */
  error?: Error;
}

/**
 * Result of running an entire evaluation suite
 */
export interface EvalSuiteResult {
  /** Configuration used */
  config: MCPTestConfig;
  /** Results for each test case */
  results: EvalResult[];
  /** Overall statistics */
  stats: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageScore: number;
    averageExecutionTime: number;
  };
  /** Whether the entire suite passed */
  passed: boolean;
}

// ========== Common concrete types for test cases ==========

/**
 * Test case for tool call operations
 */
export interface ToolCallTestCase {
  name?: string;
  input: {
    operation: string;
    [key: string]: unknown;
  };
  expected: {
    result?: unknown;
    tools?: string[];
    error?: string;
  };
}

/**
 * Test case for workflow operations
 */
export interface WorkflowTestCase {
  name?: string;
  input: {
    query: string;
    expectWorkflow?: boolean;
    expected?: {
      tools?: string[];
      result?: unknown;
      success?: boolean;
    };
  };
  expected: {
    result?: unknown;
    tools?: string[];
    success?: boolean;
  };
}

/**
 * Test case for resource operations
 */
export interface ResourceTestCase {
  name?: string;
  input: {
    action: "list" | "read";
    path?: string;
    uri?: string;
  };
  expected: {
    resources?: boolean;
    content?: string;
  };
}

/**
 * Common MCP tool result format
 */
export interface MCPToolResult {
  content?: Array<{
    type: string;
    text?: string;
    content?: string;
  }>;
  result?: unknown;
  toolCalls?: Array<{ name: string }>;
  latency?: number;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

/**
 * Common MCP workflow result format
 */
export interface MCPWorkflowResult {
  success: boolean;
  messages: Array<{ role: string; content: string }>;
  toolCalls: Array<{ name: string; args?: Record<string, unknown> }>;
  result?: unknown;
  executionTime?: number;
}

/**
 * Scorer configuration options
 */
export interface ToolCallScorerOptions {
  expectedTools?: string[];
  expectedOrder?: boolean;
  allowExtraTools?: boolean;
}

export interface LatencyScorerOptions {
  maxLatencyMs: number;
  penaltyThreshold?: number;
}

export interface ContentScorerOptions {
  exactMatch?: boolean;
  caseSensitive?: boolean;
  patterns?: RegExp[];
  requiredKeywords?: string[];
  forbiddenKeywords?: string[];
}

export interface WorkflowScorerOptions {
  requireSuccess?: boolean;
  checkMessages?: boolean;
  minMessages?: number;
}
