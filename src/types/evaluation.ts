import { Config, Workflow } from "../eval/core/config.js";
import { TraceStore } from "../eval/core/trace.js";
import { ToolHealthResult } from "./tool.js";

export interface EvaluateOptions {
  debug?: boolean;
  reporter?: "console" | "json" | "junit";
  llmJudge?: boolean;
  toolHealthOnly?: boolean;
  workflowsOnly?: boolean;
  model?: string; // Anthropic model name, defaults to claude-sonnet-4-5
}

export interface EvaluationReport {
  config: Config;
  evaluations: WorkflowEvaluation[];
  toolHealthResults: ToolHealthResult[];
  passed: boolean;
  timestamp: Date;
}

export interface EvaluationResult {
  metric: string;
  passed: boolean;
  score: number;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowEvaluation {
  workflowName: string;
  results: EvaluationResult[];
  overallScore: number;
  passed: boolean;
}

export interface LlmJudgeResult {
  score: number; // 0-1 float
  reason: string; // LLM explanation
}

export interface LlmJudgeArgs {
  model: string;
  apiKey: string;
  workflow: Workflow;
  traceStore: TraceStore;
  maxMessages?: number;
}
