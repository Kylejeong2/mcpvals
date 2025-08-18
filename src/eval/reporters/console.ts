import chalk from "chalk";
import {
  WorkflowEvaluation,
  EvaluationResult,
} from "../evaluators/deterministic.js";
import { ToolHealthResult, ToolTestResult } from "../evaluators/tool-health.js";
import {
  ResourceDiscoveryResult,
  ResourceSubscriptionResult,
  ResourceSuiteResult,
  ResourceTemplateResult,
  ResourceTestResult,
} from "../evaluators/resource.js";
import { PromptSuiteResult } from "../evaluators/prompt.js";
import { SamplingSuiteResult } from "../evaluators/sampling.js";

export class ConsoleReporter {
  /**
   * Report evaluation results to the console
   */
  report(evaluations: WorkflowEvaluation[]): void {
    console.log("\n" + chalk.bold.underline("MCP Server Evaluation Results"));
    console.log("=".repeat(60));

    for (const evaluation of evaluations) {
      this.reportWorkflow(evaluation);
    }

    this.reportSummary(evaluations);
  }

  /**
   * Report tool health results to the console
   */
  reportToolHealth(toolHealthResults: ToolHealthResult[]): void {
    console.log("\n" + chalk.bold.underline("Tool Health Test Results"));
    console.log("=".repeat(60));

    for (const result of toolHealthResults) {
      this.reportToolHealthSuite(result);
    }

    this.reportToolHealthSummary(toolHealthResults);
  }

  /**
   * Report combined workflow and tool health results
   */
  reportCombined(
    evaluations: WorkflowEvaluation[],
    toolHealthResults: ToolHealthResult[],
  ): void {
    // Report workflows first
    if (evaluations.length > 0) {
      this.report(evaluations);
    }

    // Report tool health
    if (toolHealthResults.length > 0) {
      this.reportToolHealth(toolHealthResults);
    }

    // Combined summary
    if (evaluations.length > 0 && toolHealthResults.length > 0) {
      this.reportCombinedSummary(evaluations, toolHealthResults);
    }
  }

  /**
   * Report resource evaluation results to the console
   */
  reportResourceEvaluation(resourceResults: ResourceSuiteResult[]): void {
    console.log("\n" + chalk.bold.underline("Resource Evaluation Results"));
    console.log("=".repeat(60));

    for (const result of resourceResults) {
      this.reportResourceSuite(result);
    }

    this.reportResourceSummary(resourceResults);
  }

  /**
   * Report combined workflow, tool health, and resource results
   */
  reportCombinedAll(
    evaluations: WorkflowEvaluation[],
    toolHealthResults: ToolHealthResult[],
    resourceResults: ResourceSuiteResult[],
    promptResults: PromptSuiteResult[] = [],
    samplingResults: SamplingSuiteResult[] = [],
  ): void {
    // Report workflows first
    if (evaluations.length > 0) {
      this.report(evaluations);
    }

    // Report tool health
    if (toolHealthResults.length > 0) {
      this.reportToolHealth(toolHealthResults);
    }

    // Report resource evaluation
    if (resourceResults.length > 0) {
      this.reportResourceEvaluation(resourceResults);
    }

    // Report prompt evaluation
    if (promptResults.length > 0) {
      console.log("\n" + chalk.bold.underline("Prompt Evaluation Results"));
      console.log("=".repeat(60));
      for (const result of promptResults) {
        this.reportPromptSuite(result);
      }
    }

    // Report sampling evaluation
    if (samplingResults.length > 0) {
      console.log("\n" + chalk.bold.underline("Sampling Evaluation Results"));
      console.log("=".repeat(60));
      for (const result of samplingResults) {
        this.reportSamplingSuite(result);
      }
    }

    // Final combined summary
    this.reportCombinedAllSummary(
      evaluations,
      toolHealthResults,
      resourceResults,
      promptResults,
      samplingResults,
    );
  }

  /**
   * Report a single workflow evaluation
   */
  private reportWorkflow(evaluation: WorkflowEvaluation): void {
    const statusIcon = evaluation.passed ? chalk.green("✓") : chalk.red("✗");
    const statusText = evaluation.passed
      ? chalk.green("PASSED")
      : chalk.red("FAILED");

    console.log(
      `\n${chalk.bold("Workflow:")} ${evaluation.workflowName} ${statusIcon} ${statusText}`,
    );
    console.log(
      `${chalk.bold("Overall Score:")} ${this.formatScore(evaluation.overallScore)}`,
    );
    console.log("-".repeat(40));

    for (const result of evaluation.results) {
      this.reportMetric(result);
    }
  }

  /**
   * Report a single tool health suite
   */
  private reportToolHealthSuite(result: ToolHealthResult): void {
    const statusIcon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const statusText = result.passed
      ? chalk.green("PASSED")
      : chalk.red("FAILED");

    console.log(
      `\n${chalk.bold("Tool Health Suite:")} ${result.suiteName} ${statusIcon} ${statusText}`,
    );
    if (result.description) {
      console.log(`${chalk.gray(result.description)}`);
    }
    console.log(
      `${chalk.bold("Overall Score:")} ${this.formatScore(result.overallScore)} ` +
        `(${result.passedTests}/${result.totalTests} tests passed)`,
    );
    console.log(
      `${chalk.bold("Average Latency:")} ${result.averageLatency.toFixed(1)}ms`,
    );
    console.log("-".repeat(40));

    for (const testResult of result.results) {
      this.reportToolTest(testResult);
    }
  }

  /**
   * Report a single tool test result
   */
  private reportToolTest(result: ToolTestResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const latencyColor = result.latency > 1000 ? chalk.yellow : chalk.gray;

    console.log(
      `  ${icon} ${chalk.bold(result.testName)} ` +
        `${latencyColor(`(${result.latency}ms)`)} ` +
        `${this.formatScore(result.score)}`,
    );
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.retryCount > 0) {
      console.log(`    ${chalk.yellow(`Retries: ${result.retryCount}`)}`);
    }

    if (result.error) {
      console.log(`    ${chalk.red(`Error: ${result.error}`)}`);
    }
  }

  /**
   * Report a single metric result
   */
  private reportMetric(result: EvaluationResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const score = this.formatScore(result.score);

    console.log(`  ${icon} ${chalk.bold(result.metric)}: ${score}`);
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.metadata && Object.keys(result.metadata).length > 0) {
      if (
        result.metadata.failures &&
        Array.isArray(result.metadata.failures) &&
        result.metadata.failures.length > 0
      ) {
        console.log(`    ${chalk.red("Failures:")}`);
        for (const failure of result.metadata.failures) {
          console.log(`      - ${failure}`);
        }
      }
    }
  }

  /**
   * Report overall summary
   */
  private reportSummary(evaluations: WorkflowEvaluation[]): void {
    const totalWorkflows = evaluations.length;
    const passedWorkflows = evaluations.filter((e) => e.passed).length;
    const failedWorkflows = totalWorkflows - passedWorkflows;
    const overallScore =
      evaluations.reduce((sum, e) => sum + e.overallScore, 0) / totalWorkflows;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("Workflow Summary:"));
    console.log(`  Total Workflows: ${totalWorkflows}`);
    console.log(`  Passed: ${chalk.green(passedWorkflows)}`);
    console.log(`  Failed: ${chalk.red(failedWorkflows)}`);
    console.log(`  Overall Score: ${this.formatScore(overallScore)}`);

    if (failedWorkflows > 0) {
      console.log(`\n${chalk.red.bold("❌ Workflow Evaluation Failed")}`);
    } else {
      console.log(
        `\n${chalk.green.bold("✅ All Workflow Evaluations Passed!")}`,
      );
    }
  }

  /**
   * Report tool health summary
   */
  private reportToolHealthSummary(toolHealthResults: ToolHealthResult[]): void {
    const totalSuites = toolHealthResults.length;
    const passedSuites = toolHealthResults.filter((r) => r.passed).length;
    const failedSuites = totalSuites - passedSuites;
    const totalTests = toolHealthResults.reduce(
      (sum, r) => sum + r.totalTests,
      0,
    );
    const passedTests = toolHealthResults.reduce(
      (sum, r) => sum + r.passedTests,
      0,
    );
    const overallScore = totalTests > 0 ? passedTests / totalTests : 1.0;
    const averageLatency =
      totalTests > 0
        ? toolHealthResults.reduce(
            (sum, r) => sum + r.averageLatency * r.totalTests,
            0,
          ) / totalTests
        : 0;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("Tool Health Summary:"));
    console.log(`  Total Suites: ${totalSuites}`);
    console.log(`  Passed Suites: ${chalk.green(passedSuites)}`);
    console.log(`  Failed Suites: ${chalk.red(failedSuites)}`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed Tests: ${chalk.green(passedTests)}`);
    console.log(`  Failed Tests: ${chalk.red(totalTests - passedTests)}`);
    console.log(`  Overall Score: ${this.formatScore(overallScore)}`);
    console.log(`  Average Latency: ${averageLatency.toFixed(1)}ms`);

    if (failedSuites > 0 || passedTests < totalTests) {
      console.log(`\n${chalk.red.bold("❌ Tool Health Tests Failed")}`);
    } else {
      console.log(`\n${chalk.green.bold("✅ All Tool Health Tests Passed!")}`);
    }
  }

  /**
   * Report combined summary
   */
  private reportCombinedSummary(
    evaluations: WorkflowEvaluation[],
    toolHealthResults: ToolHealthResult[],
  ): void {
    const workflowsPassed = evaluations.every((e) => e.passed);
    const toolHealthPassed = toolHealthResults.every((r) => r.passed);
    const allPassed = workflowsPassed && toolHealthPassed;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("Combined Summary:"));
    console.log(
      `  Workflows: ${workflowsPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
    );
    console.log(
      `  Tool Health: ${toolHealthPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
    );

    if (allPassed) {
      console.log(`\n${chalk.green.bold("🎉 All Tests Passed!")}`);
    } else {
      console.log(`\n${chalk.red.bold("❌ Some Tests Failed")}`);
    }
  }

  /**
   * Report a single resource suite
   */
  private reportResourceSuite(result: ResourceSuiteResult): void {
    const statusIcon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const statusText = result.passed
      ? chalk.green("PASSED")
      : chalk.red("FAILED");

    console.log(
      `\n${statusIcon} ${chalk.bold(result.suiteName)}: ${statusText} ` +
        `${this.formatScore(result.overallScore)}`,
    );
    if (result.description) {
      console.log(`  ${chalk.gray(result.description)}`);
    }
    console.log(
      `${chalk.bold("Tests:")} ${result.passedTests}/${result.totalTests} passed`,
    );
    console.log(
      `${chalk.bold("Average Latency:")} ${result.averageLatency.toFixed(1)}ms`,
    );
    console.log("-".repeat(40));

    // Report discovery results
    for (const discoveryResult of result.discoveryResults) {
      this.reportResourceDiscovery(discoveryResult);
    }

    // Report resource test results
    for (const resourceResult of result.resourceResults) {
      this.reportResourceTest(resourceResult);
    }

    // Report template test results
    for (const templateResult of result.templateResults) {
      this.reportResourceTemplate(templateResult);
    }

    // Report subscription test results
    for (const subscriptionResult of result.subscriptionResults) {
      this.reportResourceSubscription(subscriptionResult);
    }
  }

  /**
   * Report a single resource discovery result
   */
  private reportResourceDiscovery(result: ResourceDiscoveryResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const latencyColor = result.latency > 1000 ? chalk.yellow : chalk.gray;

    console.log(
      `  ${icon} ${chalk.bold(result.testName)} ` +
        `${latencyColor(`(${result.latency}ms)`)} ` +
        `${this.formatScore(result.score)}`,
    );
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.metadata) {
      const { foundResources, expectedResources, actualCount } =
        result.metadata;
      if (foundResources && foundResources.length > 0) {
        console.log(`    ${chalk.gray(`Found ${actualCount} resources`)}`);
      }
      if (expectedResources && !result.passed) {
        console.log(
          `    ${chalk.gray(`Expected: ${expectedResources.join(", ")}`)}`,
        );
      }
    }
  }

  /**
   * Report a single resource test result
   */
  private reportResourceTest(result: ResourceTestResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const latencyColor = result.latency > 1000 ? chalk.yellow : chalk.gray;

    console.log(
      `  ${icon} ${chalk.bold(result.testName)} ` +
        `${latencyColor(`(${result.latency}ms)`)} ` +
        `${this.formatScore(result.score)}`,
    );
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.retryCount > 0) {
      console.log(`    ${chalk.yellow(`Retries: ${result.retryCount}`)}`);
    }

    if (result.error) {
      console.log(`    ${chalk.red(`Error: ${result.error}`)}`);
    }
  }

  /**
   * Report a single resource template result
   */
  private reportResourceTemplate(result: ResourceTemplateResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const latencyColor = result.latency > 1000 ? chalk.yellow : chalk.gray;

    console.log(
      `  ${icon} ${chalk.bold(result.testName)} ` +
        `${latencyColor(`(${result.latency}ms)`)} ` +
        `${this.formatScore(result.score)}`,
    );
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.retryCount > 0) {
      console.log(`    ${chalk.yellow(`Retries: ${result.retryCount}`)}`);
    }

    if (result.error) {
      console.log(`    ${chalk.red(`Error: ${result.error}`)}`);
    }

    if (result.metadata && result.metadata.instantiatedUri) {
      console.log(
        `    ${chalk.gray(`URI: ${result.metadata.instantiatedUri}`)}`,
      );
    }
  }

  /**
   * Report a single resource subscription result
   */
  private reportResourceSubscription(result: ResourceSubscriptionResult): void {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const latencyColor = result.latency > 1000 ? chalk.yellow : chalk.gray;

    console.log(
      `  ${icon} ${chalk.bold(result.testName)} ` +
        `${latencyColor(`(${result.latency}ms)`)} ` +
        `${this.formatScore(result.score)}`,
    );
    console.log(`    ${chalk.gray(result.details)}`);

    if (result.metadata) {
      const { subscriptionSuccessful, updatesReceived } = result.metadata;
      console.log(
        `    ${chalk.gray(`Subscription: ${subscriptionSuccessful ? "successful" : "failed"}`)}`,
      );
      if (updatesReceived > 0) {
        console.log(
          `    ${chalk.gray(`Updates received: ${updatesReceived}`)}`,
        );
      }
    }
  }

  /**
   * Report resource evaluation summary
   */
  private reportResourceSummary(resourceResults: ResourceSuiteResult[]): void {
    const totalSuites = resourceResults.length;
    const passedSuites = resourceResults.filter((r) => r.passed).length;
    const failedSuites = totalSuites - passedSuites;
    const totalTests = resourceResults.reduce(
      (sum, r) => sum + r.totalTests,
      0,
    );
    const passedTests = resourceResults.reduce(
      (sum, r) => sum + r.passedTests,
      0,
    );
    const overallScore = totalTests > 0 ? passedTests / totalTests : 1.0;
    const averageLatency =
      totalTests > 0
        ? resourceResults.reduce(
            (sum, r) => sum + r.averageLatency * r.totalTests,
            0,
          ) / totalTests
        : 0;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("Resource Evaluation Summary:"));
    console.log(`  Total Suites: ${totalSuites}`);
    console.log(`  Passed Suites: ${chalk.green(passedSuites)}`);
    console.log(`  Failed Suites: ${chalk.red(failedSuites)}`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed Tests: ${chalk.green(passedTests)}`);
    console.log(`  Failed Tests: ${chalk.red(totalTests - passedTests)}`);
    console.log(`  Overall Score: ${this.formatScore(overallScore)}`);
    console.log(`  Average Latency: ${averageLatency.toFixed(1)}ms`);

    if (failedSuites > 0 || passedTests < totalTests) {
      console.log(`\n${chalk.red.bold("❌ Resource Evaluation Tests Failed")}`);
    } else {
      console.log(
        `\n${chalk.green.bold("✅ All Resource Evaluation Tests Passed!")}`,
      );
    }
  }

  /**
   * Report combined summary for all test types
   */
  private reportCombinedAllSummary(
    evaluations: WorkflowEvaluation[],
    toolHealthResults: ToolHealthResult[],
    resourceResults: ResourceSuiteResult[],
    promptResults: PromptSuiteResult[] = [],
    samplingResults: SamplingSuiteResult[] = [],
  ): void {
    const workflowsPassed =
      evaluations.length === 0 || evaluations.every((e) => e.passed);
    const toolHealthPassed =
      toolHealthResults.length === 0 ||
      toolHealthResults.every((r) => r.passed);
    const resourcesPassed =
      resourceResults.length === 0 || resourceResults.every((r) => r.passed);
    const promptsPassed =
      promptResults.length === 0 || promptResults.every((r) => r.passed);
    const samplingPassed =
      samplingResults.length === 0 || samplingResults.every((r) => r.passed);
    const allPassed =
      workflowsPassed &&
      toolHealthPassed &&
      resourcesPassed &&
      promptsPassed &&
      samplingPassed;

    console.log("\n" + "=".repeat(60));
    console.log(chalk.bold("Combined Summary:"));
    if (evaluations.length > 0) {
      console.log(
        `  Workflows: ${workflowsPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
      );
    }
    if (toolHealthResults.length > 0) {
      console.log(
        `  Tool Health: ${toolHealthPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
      );
    }
    if (resourceResults.length > 0) {
      console.log(
        `  Resource Evaluation: ${resourcesPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
      );
    }
    if (promptResults.length > 0) {
      console.log(
        `  Prompt Evaluation: ${promptsPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
      );
    }
    if (samplingResults.length > 0) {
      console.log(
        `  Sampling Evaluation: ${samplingPassed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
      );
    }

    if (allPassed) {
      console.log(`\n${chalk.green.bold("🎉 All Tests Passed!")}`);
    } else {
      console.log(`\n${chalk.red.bold("❌ Some Tests Failed")}`);
    }
  }

  /**
   * Report a single prompt suite
   */
  private reportPromptSuite(result: PromptSuiteResult): void {
    const status = result.passed
      ? chalk.green("✓ PASSED")
      : chalk.red("✗ FAILED");
    console.log(`\n${status} ${chalk.bold(result.suiteName)}`);
    if (result.description) {
      console.log(`  ${chalk.gray(result.description)}`);
    }
    console.log(`  Tests: ${result.passedTests}/${result.totalTests} passed`);
    console.log(`  Score: ${this.formatScore(result.overallScore)}`);
    console.log(`  Average Latency: ${result.averageLatency.toFixed(1)}ms`);
  }

  /**
   * Report a single sampling suite
   */
  private reportSamplingSuite(result: SamplingSuiteResult): void {
    const status = result.passed
      ? chalk.green("✓ PASSED")
      : chalk.red("✗ FAILED");
    console.log(`\n${status} ${chalk.bold(result.suiteName)}`);
    if (result.description) {
      console.log(`  ${chalk.gray(result.description)}`);
    }
    console.log(`  Tests: ${result.passedTests}/${result.totalTests} passed`);
    console.log(`  Score: ${this.formatScore(result.overallScore)}`);
    console.log(`  Average Latency: ${result.averageLatency.toFixed(1)}ms`);
  }

  /**
   * Format a score as a percentage with color
   */
  private formatScore(score: number): string {
    const percentage = (score * 100).toFixed(1) + "%";
    if (score >= 0.8) {
      return chalk.green(percentage);
    } else if (score >= 0.6) {
      return chalk.yellow(percentage);
    } else {
      return chalk.red(percentage);
    }
  }
}
