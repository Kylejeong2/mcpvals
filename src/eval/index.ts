import { loadConfig, Config } from "./config.js";
import { ServerRunner } from "./runner.js";
import { TraceStore } from "./trace.js";
import {
  DeterministicEvaluator,
  WorkflowEvaluation,
  EvaluationResult,
} from "./deterministic.js";
import { ToolTester, ToolHealthResult } from "./tool-health.js";
import { ConsoleReporter } from "./reporters/console.js";
import { runLlmJudge } from "./llm-judge.js";

export interface EvaluateOptions {
  debug?: boolean;
  reporter?: "console" | "json" | "junit";
  llmJudge?: boolean;
  toolHealthOnly?: boolean;
  workflowsOnly?: boolean;
}

export interface EvaluationReport {
  config: Config;
  evaluations: WorkflowEvaluation[];
  toolHealthResults: ToolHealthResult[];
  passed: boolean;
  timestamp: Date;
}

/**
 * Main evaluation function
 */
export async function evaluate(
  configPath: string,
  options: EvaluateOptions = {},
): Promise<EvaluationReport> {
  // Load configuration
  const config = await loadConfig(configPath);

  // Validate that we have something to test
  if (config.workflows.length === 0 && config.toolHealthSuites.length === 0) {
    throw new Error(
      "Configuration must include either workflows or toolHealthSuites",
    );
  }

  // Create trace store
  const traceStore = new TraceStore();

  // Create server runner
  const runner = new ServerRunner(config.server, traceStore, {
    timeout: config.timeout,
    debug: options.debug,
  });

  // Results collection
  const evaluations: WorkflowEvaluation[] = [];
  const toolHealthResults: ToolHealthResult[] = [];

  try {
    // Start the server
    console.log("Starting MCP server...");
    await runner.start();

    // List available tools
    const tools = await runner.listTools();
    console.log(`Available tools: ${tools.map((t) => t.name).join(", ")}`);

    // Run tool health tests if requested
    if (!options.workflowsOnly && config.toolHealthSuites.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Tool Health Tests...");

      const toolTester = new ToolTester(runner, config.timeout);

      for (const suite of config.toolHealthSuites) {
        // Validate the test suite
        const validation = await toolTester.validateTestSuite(suite);
        if (!validation.valid) {
          console.warn(
            `Warning: Tool health suite "${suite.name}" references missing tools: ${validation.missingTools.join(", ")}`,
          );
          if (options.debug) {
            console.log(
              `Available tools: ${validation.availableTools.join(", ")}`,
            );
          }
        }

        // Run the suite
        const result = await toolTester.runToolHealthSuite(suite);
        toolHealthResults.push(result);
      }
    }

    // Run workflow evaluations if requested
    if (!options.toolHealthOnly && config.workflows.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Workflow Evaluations...");

      // Run each workflow
      for (const workflow of config.workflows) {
        console.log(`\nRunning workflow: ${workflow.name}`);

        // Clear trace store for this workflow
        traceStore.clear();

        // Execute workflow with LLM
        const { success, messages, toolCalls } =
          await runner.runWorkflowWithLLM(workflow.steps);

        // Import results into trace store
        for (const message of messages) {
          traceStore.addMessage({
            role: message.role as "user" | "assistant",
            content: message.content,
            timestamp: new Date(),
          });
        }

        if (options.debug) {
          console.log(`Workflow execution ${success ? "succeeded" : "failed"}`);
          console.log(`Tool calls made: ${toolCalls.length}`);
        }

        // Evaluate the workflow
        const evaluator = new DeterministicEvaluator(traceStore);
        const evaluation = evaluator.evaluateWorkflow(workflow);
        evaluations.push(evaluation);

        // Optional: LLM Judge evaluation
        if (options.llmJudge && config.llmJudge && config.openaiKey) {
          try {
            console.log("Running LLM Judge evaluation...");
            const llmResult = await runLlmJudge({
              model: config.judgeModel,
              apiKey: config.openaiKey,
              workflow,
              traceStore,
              maxMessages: 20, // Limit to last 20 messages to avoid token limits
            });

            // Add LLM judge result to the evaluation
            const llmJudgeResult: EvaluationResult = {
              metric: "LLM Judge",
              passed: llmResult.score >= config.passThreshold,
              score: llmResult.score,
              details: `Score: ${llmResult.score.toFixed(2)}/${config.passThreshold.toFixed(2)} - ${llmResult.reason}`,
            };

            evaluation.results.push(llmJudgeResult);

            // Update overall passed status based on all results
            evaluation.passed = evaluation.results.every((r) => r.passed);

            console.log(
              `LLM Judge score: ${llmResult.score.toFixed(2)} (threshold: ${config.passThreshold})`,
            );
            console.log(`Reason: ${llmResult.reason}`);
          } catch (error) {
            console.error("LLM Judge evaluation failed:", error);

            // Add failed LLM judge result
            evaluation.results.push({
              metric: "LLM Judge",
              passed: false,
              score: 0,
              details: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }
      }
    }
  } finally {
    // Stop the server
    await runner.stop();
  }

  // Generate report
  const workflowsPassed =
    evaluations.length === 0 || evaluations.every((e) => e.passed);
  const toolHealthPassed =
    toolHealthResults.length === 0 || toolHealthResults.every((r) => r.passed);
  const allPassed = workflowsPassed && toolHealthPassed;

  const report: EvaluationReport = {
    config,
    evaluations,
    toolHealthResults,
    passed: allPassed,
    timestamp: new Date(),
  };

  // Output results
  switch (options.reporter || "console") {
    case "console": {
      const consoleReporter = new ConsoleReporter();
      if (evaluations.length > 0 && toolHealthResults.length > 0) {
        consoleReporter.reportCombined(evaluations, toolHealthResults);
      } else if (evaluations.length > 0) {
        consoleReporter.report(evaluations);
      } else if (toolHealthResults.length > 0) {
        consoleReporter.reportToolHealth(toolHealthResults);
      }
      break;
    }
    case "json":
      console.log(JSON.stringify(report, null, 2));
      break;
    case "junit":
      console.log("JUnit reporter not yet implemented");
      break;
  }

  return report;
}

// Re-export types
export {
  Config,
  Workflow,
  WorkflowStep,
  ToolTest,
  ToolHealthSuite,
} from "./config.js";
export { WorkflowEvaluation, EvaluationResult } from "./deterministic.js";
export { ToolHealthResult, ToolTestResult } from "./tool-health.js";
export { runLlmJudge, LlmJudgeResult } from "./llm-judge.js";
