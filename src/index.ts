// Export all top-level APIs
export { evaluate } from "./eval/core/index.js";
export type { EvaluateOptions } from "./types/evaluation.js";
export type { EvaluationReport } from "./types/evaluation.js";
export {
  type Config,
  type Workflow,
  type WorkflowStep,
} from "./eval/core/config.js";
export type {
  WorkflowEvaluation,
  EvaluationResult,
} from "./types/evaluation.js";

// Vitest integration exports
export {
  describeEval,
  mcpTest,
  setupMCPServer,
  teardownMCPServer,
  describeEvalFromConfig,
  describeToolHealthFromConfig,
} from "./vitest/vitest-eval.js";
export {
  expectToolCall,
  expectWorkflowSuccess,
  expectLatency,
  expectError,
  expectToolCalls,
} from "./vitest/matchers.js";
export {
  ToolCallScorer,
  WorkflowScorer,
  LatencyScorer,
  ContentScorer,
} from "./vitest/scorers.js";
export type {
  MCPTestConfig,
  MCPTestCase,
  MCPTestContext,
  EvalScorer,
  EvalResult,
  EvalSuiteResult,
  // Concrete test case types
  ToolCallTestCase,
  WorkflowTestCase,
  // Common result types
  MCPToolResult,
  MCPWorkflowResult,
  // Scorer options
  ToolCallScorerOptions,
  LatencyScorerOptions,
  ContentScorerOptions,
  WorkflowScorerOptions,
} from "./vitest/types.js";
