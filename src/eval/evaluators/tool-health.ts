import { ToolTest, ToolHealthSuite } from "../core/config.js";
import { ServerRunner } from "../core/runner.js";

export interface ToolTestResult {
  testName: string;
  toolName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ToolHealthResult {
  suiteName: string;
  description?: string;
  results: ToolTestResult[];
  overallScore: number;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
}

export class ToolTester {
  constructor(
    private runner: ServerRunner,
    private globalTimeout: number = 30000,
  ) {}

  /**
   * Run a single tool test
   */
  async runToolTest(
    test: ToolTest,
    suiteTimeout?: number,
  ): Promise<ToolTestResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Set up timeout for the tool call
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tool call timeout")), timeout),
        );

        // Make the tool call
        const resultPromise = this.runner.callTool(test.name, test.args);
        const result = await Promise.race([resultPromise, timeoutPromise]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Check latency constraint
        if (test.maxLatency && latency > test.maxLatency) {
          return {
            testName: test.description || `${test.name} test`,
            toolName: test.name,
            passed: false,
            score: 0,
            latency,
            details: `Tool call exceeded maximum latency: ${latency}ms > ${test.maxLatency}ms`,
            retryCount,
          };
        }

        // Validate expected result if provided
        if (test.expectedResult !== undefined) {
          const resultMatches = this.validateResult(
            result,
            test.expectedResult,
          );
          if (!resultMatches) {
            return {
              testName: test.description || `${test.name} test`,
              toolName: test.name,
              passed: false,
              score: 0,
              latency,
              details: `Result mismatch. Expected: ${JSON.stringify(test.expectedResult)}, Got: ${JSON.stringify(result)}`,
              retryCount,
              metadata: {
                expectedResult: test.expectedResult,
                actualResult: result,
              },
            };
          }
        }

        // If we expected an error but didn't get one
        if (test.expectedError) {
          return {
            testName: test.description || `${test.name} test`,
            toolName: test.name,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectedError}" but tool call succeeded`,
            retryCount,
            metadata: {
              expectedError: test.expectedError,
              actualResult: result,
            },
          };
        }

        // Success case
        return {
          testName: test.description || `${test.name} test`,
          toolName: test.name,
          passed: true,
          score: 1.0,
          latency,
          details: `Tool call successful in ${latency}ms`,
          retryCount,
          metadata: {
            result,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        // If we expected this error, it's a success
        if (test.expectedError && errorMessage.includes(test.expectedError)) {
          const endTime = Date.now();
          const latency = endTime - startTime;

          return {
            testName: test.description || `${test.name} test`,
            toolName: test.name,
            passed: true,
            score: 1.0,
            latency,
            details: `Tool correctly failed with expected error: ${test.expectedError}`,
            retryCount,
            metadata: {
              expectedError: test.expectedError,
              actualError: errorMessage,
            },
          };
        }

        // If we have retries left, try again
        if (retryCount < test.retries) {
          retryCount++;
          console.log(
            `Tool test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} test`,
          toolName: test.name,
          passed: false,
          score: 0,
          latency,
          details: `Tool call failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} test`,
      toolName: test.name,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a complete tool health suite
   */
  async runToolHealthSuite(suite: ToolHealthSuite): Promise<ToolHealthResult> {
    console.log(`\nRunning tool health suite: ${suite.name}`);

    let results: ToolTestResult[];

    if (suite.parallel) {
      // Run tests in parallel
      console.log(`Running ${suite.tests.length} tests in parallel...`);
      const promises = suite.tests.map((test) =>
        this.runToolTest(test, suite.timeout),
      );
      results = await Promise.all(promises);
    } else {
      // Run tests sequentially
      console.log(`Running ${suite.tests.length} tests sequentially...`);
      results = [];
      for (const test of suite.tests) {
        const result = await this.runToolTest(test, suite.timeout);
        results.push(result);

        // Log progress
        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }
    }

    // Calculate metrics
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const overallScore = totalTests > 0 ? passedTests / totalTests : 1.0;
    const passed = passedTests === totalTests;
    const averageLatency =
      totalTests > 0
        ? results.reduce((sum, r) => sum + r.latency, 0) / totalTests
        : 0;

    return {
      suiteName: suite.name,
      description: suite.description,
      results,
      overallScore,
      passed,
      totalTests,
      passedTests,
      failedTests,
      averageLatency,
    };
  }

  /**
   * Validate if actual result matches expected result
   * Uses deep equality for objects/arrays, string contains for strings
   */
  private validateResult(actual: unknown, expected: unknown): boolean {
    if (typeof expected === "string" && typeof actual === "string") {
      // For strings, check if actual contains expected (case-insensitive)
      return actual.toLowerCase().includes(expected.toLowerCase());
    }

    if (typeof expected === "number" && typeof actual === "number") {
      // For numbers, allow small floating point differences
      return Math.abs(actual - expected) < 0.0001;
    }

    // For objects and arrays, use deep equality
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  /**
   * Get available tools for validation
   */
  async getAvailableTools(): Promise<string[]> {
    const tools = await this.runner.listTools();
    return tools.map((t) => t.name);
  }

  /**
   * Validate that all test tools exist
   */
  async validateTestSuite(suite: ToolHealthSuite): Promise<{
    valid: boolean;
    missingTools: string[];
    availableTools: string[];
  }> {
    const availableTools = await this.getAvailableTools();
    const testTools = suite.tests.map((t) => t.name);
    const missingTools = testTools.filter(
      (tool) => !availableTools.includes(tool),
    );

    return {
      valid: missingTools.length === 0,
      missingTools,
      availableTools,
    };
  }
}
