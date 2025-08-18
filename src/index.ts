export {
  evaluate,
  type EvaluateOptions,
  type EvaluationReport,
} from "./eval/core/index.js";
export {
  type Config,
  type Workflow,
  type WorkflowStep,
} from "./eval/core/config.js";
export {
  type WorkflowEvaluation,
  type EvaluationResult,
} from "./eval/evaluators/deterministic.js";

// Vitest integration exports
export {
  describeEval,
  mcpTest,
  setupMCPServer,
  teardownMCPServer,
} from "./vitest/vitest-eval.js";
export {
  expectToolCall,
  expectWorkflowSuccess,
  expectLatency,
  expectError,
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
} from "./vitest/types.js";
