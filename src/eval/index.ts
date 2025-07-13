import { loadConfig, Config } from "./config.js";
import { ServerRunner } from "./runner.js";
import { TraceStore } from "./trace.js";
import {
  DeterministicEvaluator,
  WorkflowEvaluation,
  EvaluationResult,
} from "./deterministic.js";
import { ToolTester, ToolHealthResult } from "./tool-health.js";
import { ResourceEvaluator, ResourceSuiteResult } from "./resource.js";
import { PromptEvaluator, PromptSuiteResult } from "./prompt.js";
import { SamplingEvaluator, SamplingSuiteResult } from "./sampling.js";
import { OAuth2TestRunner, OAuth2SuiteResult } from "../auth/oauth-runner.js";
import { ConsoleReporter } from "./reporters/console.js";
import { runLlmJudge } from "./llm-judge.js";

export interface EvaluateOptions {
  debug?: boolean;
  reporter?: "console" | "json" | "junit";
  llmJudge?: boolean;
  toolHealthOnly?: boolean;
  workflowsOnly?: boolean;
  resourcesOnly?: boolean;
  promptsOnly?: boolean;
  samplingOnly?: boolean;
  oauth2Only?: boolean;
}

export interface EvaluationReport {
  config: Config;
  evaluations: WorkflowEvaluation[];
  toolHealthResults: ToolHealthResult[];
  resourceResults: ResourceSuiteResult[];
  promptResults: PromptSuiteResult[];
  samplingResults: SamplingSuiteResult[];
  oauth2Results: OAuth2SuiteResult[];
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
  if (
    (config.workflows?.length ?? 0) === 0 &&
    (config.toolHealthSuites?.length ?? 0) === 0 &&
    (config.resourceSuites?.length ?? 0) === 0 &&
    (config.promptSuites?.length ?? 0) === 0 &&
    (config.samplingSuites?.length ?? 0) === 0 &&
    (config.oauth2Suites?.length ?? 0) === 0
  ) {
    throw new Error(
      "Configuration must include workflows, toolHealthSuites, resourceSuites, promptSuites, samplingSuites, or oauth2Suites",
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
  const resourceResults: ResourceSuiteResult[] = [];
  const promptResults: PromptSuiteResult[] = [];
  const samplingResults: SamplingSuiteResult[] = [];
  const oauth2Results: OAuth2SuiteResult[] = [];

  try {
    // Start the server
    console.log("Starting MCP server...");
    await runner.start();

    // List available tools
    const tools = await runner.listTools();
    console.log(`Available tools: ${tools.map((t) => t.name).join(", ")}`);

    // Run tool health tests if requested
    if (
      !options.workflowsOnly &&
      !options.resourcesOnly &&
      !options.promptsOnly &&
      !options.samplingOnly &&
      (config.toolHealthSuites?.length ?? 0) > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Tool Health Tests...");

      const toolTester = new ToolTester(runner, config.timeout);

      for (const suite of config.toolHealthSuites ?? []) {
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

    // Run resource evaluation tests if requested
    if (
      !options.workflowsOnly &&
      !options.toolHealthOnly &&
      !options.promptsOnly &&
      !options.samplingOnly &&
      (config.resourceSuites?.length ?? 0) > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Resource Evaluation Tests...");

      const resourceEvaluator = new ResourceEvaluator(runner, config.timeout);

      // List available resources for debugging
      try {
        const availableResources =
          await resourceEvaluator.getAvailableResources();
        console.log(
          `Available resources: ${availableResources.length > 0 ? availableResources.join(", ") : "none"}`,
        );

        const availableTemplates =
          await resourceEvaluator.getAvailableResourceTemplates();
        if (availableTemplates.length > 0) {
          console.log(
            `Available resource templates: ${availableTemplates.join(", ")}`,
          );
        }
      } catch (error) {
        console.log(
          "Unable to list resources - server may not support resources",
        );
        if (options.debug) {
          console.log(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      for (const suite of config.resourceSuites ?? []) {
        // Validate the resource suite
        try {
          const validation =
            await resourceEvaluator.validateResourceSuite(suite);
          if (!validation.valid) {
            console.warn(
              `Warning: Resource suite "${suite.name}" references missing resources or templates:`,
            );
            if (validation.missingResources.length > 0) {
              console.warn(
                `  Missing resources: ${validation.missingResources.join(", ")}`,
              );
            }
            if (validation.missingTemplates.length > 0) {
              console.warn(
                `  Missing templates: ${validation.missingTemplates.join(", ")}`,
              );
            }
            if (options.debug) {
              console.log(
                `  Available resources: ${validation.availableResources.join(", ")}`,
              );
              console.log(
                `  Available templates: ${validation.availableTemplates.join(", ")}`,
              );
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Unable to validate resource suite "${suite.name}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Run the resource suite
        const result = await resourceEvaluator.runResourceSuite(suite);
        resourceResults.push(result);
      }
    }

    // Run prompt evaluation tests if requested
    if (
      !options.workflowsOnly &&
      !options.toolHealthOnly &&
      !options.resourcesOnly &&
      !options.samplingOnly &&
      (config.promptSuites?.length ?? 0) > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Prompt Evaluation Tests...");

      const promptEvaluator = new PromptEvaluator(runner, config.timeout);

      // List available prompts for debugging
      try {
        const availablePrompts = await promptEvaluator.getAvailablePrompts();
        console.log(
          `Available prompts: ${availablePrompts.length > 0 ? availablePrompts.join(", ") : "none"}`,
        );
      } catch (error) {
        console.log("Unable to list prompts - server may not support prompts");
        if (options.debug) {
          console.log(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      for (const suite of config.promptSuites ?? []) {
        // Validate the prompt suite
        try {
          const validation = await promptEvaluator.validatePromptSuite(suite);
          if (!validation.valid) {
            console.warn(
              `Warning: Prompt suite "${suite.name}" references missing prompts: ${validation.missingPrompts.join(", ")}`,
            );
            if (options.debug) {
              console.log(
                `  Available prompts: ${validation.availablePrompts.join(", ")}`,
              );
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Unable to validate prompt suite "${suite.name}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Run the prompt suite
        const result = await promptEvaluator.runPromptSuite(suite);
        promptResults.push(result);
      }
    }

    // Run sampling evaluation tests if requested
    if (
      !options.workflowsOnly &&
      !options.toolHealthOnly &&
      !options.resourcesOnly &&
      !options.promptsOnly &&
      (config.samplingSuites?.length ?? 0) > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Sampling Evaluation Tests...");

      const samplingEvaluator = new SamplingEvaluator(runner, config.timeout);

      // Check sampling capability for debugging
      try {
        const hasCapability = await samplingEvaluator.validateSamplingSuite({
          name: "capability-check",
        });
        console.log(
          `Sampling capability: ${hasCapability.hasCapability ? "supported" : "not supported"}`,
        );
        if (!hasCapability.hasCapability) {
          console.warn(
            "Server does not support sampling capability - some tests may fail",
          );
        }
      } catch (error) {
        console.log(
          "Unable to check sampling capability - server may not support sampling",
        );
        if (options.debug) {
          console.log(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      for (const suite of config.samplingSuites ?? []) {
        // Validate the sampling suite
        try {
          const validation =
            await samplingEvaluator.validateSamplingSuite(suite);
          if (!validation.valid) {
            console.warn(
              `Warning: Sampling suite "${suite.name}" has validation errors:`,
            );
            for (const error of validation.errors) {
              console.warn(`  ${error}`);
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Unable to validate sampling suite "${suite.name}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Run the sampling suite
        const result = await samplingEvaluator.runSamplingSuite(suite);
        samplingResults.push(result);
      }
    }

    // Run OAuth 2.1 evaluation tests if requested
    if (
      !options.workflowsOnly &&
      !options.toolHealthOnly &&
      !options.resourcesOnly &&
      !options.promptsOnly &&
      !options.samplingOnly &&
      (config.oauth2Suites?.length ?? 0) > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running OAuth 2.1 Authentication Tests...");

      const oauth2Runner = new OAuth2TestRunner(options.debug);

      for (const suite of config.oauth2Suites ?? []) {
        if (options.debug) {
          console.log(`Starting OAuth 2.1 suite: ${suite.name}`);
          if (suite.description) {
            console.log(`Description: ${suite.description}`);
          }
        }

        // Run the OAuth 2.1 suite
        const result = await oauth2Runner.runTestSuite(suite);
        oauth2Results.push(result);
      }
    }

    // Run workflow evaluations if requested
    if (
      !options.toolHealthOnly &&
      !options.resourcesOnly &&
      !options.promptsOnly &&
      !options.samplingOnly &&
      !options.oauth2Only &&
      config.workflows.length > 0
    ) {
      console.log("\n" + "=".repeat(60));
      console.log("Running Workflow Evaluations...");

      // Clear trace store before workflow evaluations to avoid interference from tool health tests
      traceStore.clear();

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
  const resourcesPassed =
    resourceResults.length === 0 || resourceResults.every((r) => r.passed);
  const promptsPassed =
    promptResults.length === 0 || promptResults.every((r) => r.passed);
  const samplingPassed =
    samplingResults.length === 0 || samplingResults.every((r) => r.passed);
  const oauth2Passed =
    oauth2Results.length === 0 ||
    oauth2Results.every((r) => r.failedTests === 0);
  const allPassed =
    workflowsPassed &&
    toolHealthPassed &&
    resourcesPassed &&
    promptsPassed &&
    samplingPassed &&
    oauth2Passed;

  const report: EvaluationReport = {
    config,
    evaluations,
    toolHealthResults,
    resourceResults,
    promptResults,
    samplingResults,
    oauth2Results,
    passed: allPassed,
    timestamp: new Date(),
  };

  // Output results
  switch (options.reporter || "console") {
    case "console": {
      const consoleReporter = new ConsoleReporter();
      const hasMultipleTypes =
        [
          evaluations.length > 0,
          toolHealthResults.length > 0,
          resourceResults.length > 0,
          promptResults.length > 0,
          samplingResults.length > 0,
          oauth2Results.length > 0,
        ].filter(Boolean).length > 1;

      if (hasMultipleTypes) {
        // Extended combined reporting (we'll need to update ConsoleReporter later)
        consoleReporter.reportCombinedAll(
          evaluations,
          toolHealthResults,
          resourceResults,
          promptResults,
          samplingResults,
        );
        if (promptResults.length > 0) {
          console.log("\n" + "=".repeat(60));
          console.log("PROMPT EVALUATION SUMMARY");
          console.log("=".repeat(60));
          for (const result of promptResults) {
            const status = result.passed ? "✓ PASSED" : "✗ FAILED";
            console.log(
              `${status} ${result.suiteName} (${result.passedTests}/${result.totalTests} tests passed, ${result.averageLatency.toFixed(0)}ms avg)`,
            );
          }
        }
        if (samplingResults.length > 0) {
          console.log("\n" + "=".repeat(60));
          console.log("SAMPLING EVALUATION SUMMARY");
          console.log("=".repeat(60));
          for (const result of samplingResults) {
            const status = result.passed ? "✓ PASSED" : "✗ FAILED";
            console.log(
              `${status} ${result.suiteName} (${result.passedTests}/${result.totalTests} tests passed, ${result.averageLatency.toFixed(0)}ms avg)`,
            );
          }
        }
        if (oauth2Results.length > 0) {
          console.log("\n" + "=".repeat(60));
          console.log("OAUTH 2.1 AUTHENTICATION SUMMARY");
          console.log("=".repeat(60));
          for (const result of oauth2Results) {
            const status = result.failedTests === 0 ? "✓ PASSED" : "✗ FAILED";
            console.log(
              `${status} ${result.name} (${result.passedTests}/${result.totalTests} tests passed, ${result.duration}ms)`,
            );
          }
        }
      } else if (evaluations.length > 0) {
        consoleReporter.report(evaluations);
      } else if (toolHealthResults.length > 0) {
        consoleReporter.reportToolHealth(toolHealthResults);
      } else if (resourceResults.length > 0) {
        consoleReporter.reportResourceEvaluation(resourceResults);
      } else if (samplingResults.length > 0) {
        // Basic sampling results reporting
        console.log("\n" + "=".repeat(60));
        console.log("SAMPLING EVALUATION RESULTS");
        console.log("=".repeat(60));
        for (const result of samplingResults) {
          const status = result.passed ? "✓ PASSED" : "✗ FAILED";
          console.log(`\n${status} ${result.suiteName}`);
          if (result.description) {
            console.log(`Description: ${result.description}`);
          }
          console.log(
            `Tests: ${result.passedTests}/${result.totalTests} passed (${(result.overallScore * 100).toFixed(1)}%)`,
          );
          console.log(`Average latency: ${result.averageLatency.toFixed(0)}ms`);

          // Show failed tests
          if (result.failedTests > 0) {
            const allResults = [
              ...result.capabilityResults.filter((r) => !r.passed),
              ...result.requestResults.filter((r) => !r.passed),
              ...result.securityResults.filter((r) => !r.passed),
              ...result.performanceResults.filter((r) => !r.passed),
              ...result.contentResults.filter((r) => !r.passed),
              ...result.workflowResults.filter((r) => !r.passed),
            ];

            if (allResults.length > 0) {
              console.log("\nFailed tests:");
              for (const testResult of allResults) {
                console.log(
                  `  ✗ ${testResult.testName}: ${testResult.details}`,
                );
              }
            }
          }
        }
      } else if (promptResults.length > 0) {
        // Basic prompt results reporting
        console.log("\n" + "=".repeat(60));
        console.log("PROMPT EVALUATION RESULTS");
        console.log("=".repeat(60));
        for (const result of promptResults) {
          const status = result.passed ? "✓ PASSED" : "✗ FAILED";
          console.log(`\n${status} ${result.suiteName}`);
          if (result.description) {
            console.log(`Description: ${result.description}`);
          }
          console.log(
            `Tests: ${result.passedTests}/${result.totalTests} passed (${(result.overallScore * 100).toFixed(1)}%)`,
          );
          console.log(`Average latency: ${result.averageLatency.toFixed(0)}ms`);

          // Show failed tests
          if (result.failedTests > 0) {
            const allResults = [
              ...result.discoveryResults.filter((r) => !r.passed),
              ...result.promptResults.filter((r) => !r.passed),
              ...result.argumentResults.filter((r) => !r.passed),
              ...result.templateResults.filter((r) => !r.passed),
              ...result.securityResults.filter((r) => !r.passed),
            ];

            if (allResults.length > 0) {
              console.log("\nFailed tests:");
              for (const testResult of allResults) {
                console.log(
                  `  ✗ ${testResult.testName}: ${testResult.details}`,
                );
              }
            }
          }
        }
      } else if (oauth2Results.length > 0) {
        // Basic OAuth 2.1 results reporting
        console.log("\n" + "=".repeat(60));
        console.log("OAUTH 2.1 AUTHENTICATION RESULTS");
        console.log("=".repeat(60));
        for (const result of oauth2Results) {
          const status = result.failedTests === 0 ? "✓ PASSED" : "✗ FAILED";
          console.log(`\n${status} ${result.name}`);
          console.log(
            `Tests: ${result.passedTests}/${result.totalTests} passed`,
          );
          console.log(`Duration: ${result.duration}ms`);

          // Show failed tests
          if (result.failedTests > 0) {
            console.log("\nFailed tests:");
            for (const testResult of result.results.filter((r) => !r.success)) {
              console.log(
                `  ✗ ${testResult.name} (${testResult.flow}): ${testResult.error || "Unknown error"}`,
              );
            }
          }
        }
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
  ResourceTest,
  ResourceDiscoveryTest,
  ResourceTemplateTest,
  ResourceSubscriptionTest,
  ResourceSuite,
  PromptTest,
  PromptArgumentTest,
  PromptDiscoveryTest,
  PromptTemplateTest,
  PromptSecurityTest,
  PromptSuite,
  SamplingCapabilityTest,
  SamplingRequestTest,
  SamplingSecurityTest,
  SamplingPerformanceTest,
  SamplingContentTest,
  SamplingWorkflowTest,
  SamplingSuite,
} from "./config.js";
export { WorkflowEvaluation, EvaluationResult } from "./deterministic.js";
export { ToolHealthResult, ToolTestResult } from "./tool-health.js";
export { ResourceSuiteResult } from "./resource.js";
export { PromptSuiteResult } from "./prompt.js";
export { SamplingSuiteResult } from "./sampling.js";
export { OAuth2SuiteResult, OAuth2TestResult } from "../auth/oauth-runner.js";
export { runLlmJudge, LlmJudgeResult } from "./llm-judge.js";
