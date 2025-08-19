import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ServerRunner } from "../eval/core/runner.js";
import { TraceStore } from "../eval/core/trace.js";
import type {
  MCPTestConfig,
  MCPTestContext,
  EvalResult,
  EvalSuiteResult,
} from "./types.js";
import type { ServerConfig } from "../eval/core/config.js";
import { evaluate } from "../eval/core/index.js";
import type { EvaluateOptions } from "../eval/core/index.js";

/**
 * Global server runner instance for the current test suite
 */
let currentServerRunner: ServerRunner | null = null;
let currentTraceStore: TraceStore | null = null;

/**
 * Setup MCP server for testing (to be called in beforeAll)
 */
export async function setupMCPServer(
  server: ServerConfig,
  options?: { timeout?: number; debug?: boolean },
): Promise<MCPTestContext["utils"]> {
  currentTraceStore = new TraceStore();
  currentServerRunner = new ServerRunner(server, currentTraceStore, {
    timeout: options?.timeout || 30000,
    debug: options?.debug || false,
  });

  await currentServerRunner.start();

  const utils: MCPTestContext["utils"] = {
    callTool: async (name: string, args: Record<string, unknown>) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.callTool(name, args);
    },

    runWorkflow: async (steps) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.runWorkflowWithLLM(steps);
    },

    listResources: async () => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      try {
        const result = await currentServerRunner.listResources();
        return result.resources?.map((r) => r.uri || r.name) || [];
      } catch {
        return [];
      }
    },

    getResource: async (uri: string) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.readResource(uri);
    },

    listResourceTemplates: async () => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      try {
        const result = await currentServerRunner.listResourceTemplates();
        return result.resourceTemplates?.map((t) => t.uriTemplate) || [];
      } catch {
        return [];
      }
    },

    subscribeToResource: async (uri: string) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.subscribeToResource(uri);
    },

    unsubscribeFromResource: async (uri: string) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.unsubscribeFromResource(uri);
    },

    listPrompts: async () => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      try {
        const result = await currentServerRunner.listPrompts();
        return result.prompts?.map((p) => p.name) || [];
      } catch {
        return [];
      }
    },

    getPrompt: async (name: string, args?: Record<string, unknown>) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.getPrompt(name, args);
    },

    createSamplingMessage: async (request) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.createSamplingMessage(request);
    },

    simulateUserApproval: async (requestId, approved, modifiedRequest) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return await currentServerRunner.simulateUserApproval(
        requestId,
        approved,
        modifiedRequest,
      );
    },

    validateModelPreferences: (preferences) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return currentServerRunner.validateModelPreferences(preferences);
    },

    validateSamplingContent: (messages) => {
      if (!currentServerRunner) throw new Error("Server not initialized");
      return currentServerRunner.validateSamplingContent(messages as never);
    },
  };

  return utils;
}

/**
 * Cleanup MCP server after testing (to be called in afterAll)
 */
export async function teardownMCPServer() {
  if (currentServerRunner) {
    await currentServerRunner.stop();
    currentServerRunner = null;
  }
  currentTraceStore = null;
}

/**
 * Describe and run evaluation directly from a config file (unified suites)
 */
export function describeEvalFromConfig(
  name: string,
  configPath: string,
  options: EvaluateOptions & { timeout?: number } = {},
): void {
  describe(name, () => {
    it(
      "should pass evaluation suites",
      async () => {
        const report = await evaluate(configPath, options);
        expect(report.passed).toBe(true);
      },
      options.timeout || 120000,
    );
  });
}

/**
 * Convenience wrappers for single-suite runs via config
 */
export function describeToolHealthFromConfig(
  name: string,
  configPath: string,
  options: Omit<EvaluateOptions, "toolHealthOnly"> & { timeout?: number } = {},
): void {
  return describeEvalFromConfig(name, configPath, {
    ...options,
    toolHealthOnly: true,
  });
}

export function describeResourcesFromConfig(
  name: string,
  configPath: string,
  options: Omit<EvaluateOptions, "resourcesOnly"> & { timeout?: number } = {},
): void {
  return describeEvalFromConfig(name, configPath, {
    ...options,
    resourcesOnly: true,
  });
}

export function describePromptsFromConfig(
  name: string,
  configPath: string,
  options: Omit<EvaluateOptions, "promptsOnly"> & { timeout?: number } = {},
): void {
  return describeEvalFromConfig(name, configPath, {
    ...options,
    promptsOnly: true,
  });
}

export function describeSamplingFromConfig(
  name: string,
  configPath: string,
  options: Omit<EvaluateOptions, "samplingOnly"> & { timeout?: number } = {},
): void {
  return describeEvalFromConfig(name, configPath, {
    ...options,
    samplingOnly: true,
  });
}

export function describeOAuth2FromConfig(
  name: string,
  configPath: string,
  options: Omit<EvaluateOptions, "oauth2Only"> & { timeout?: number } = {},
): void {
  return describeEvalFromConfig(name, configPath, {
    ...options,
    oauth2Only: true,
  });
}

/**
 * Main function to describe an MCP evaluation suite using vitest
 */
export function describeEval(config: MCPTestConfig): void {
  describe(config.name, () => {
    let serverUtils: MCPTestContext["utils"];
    let tools: Array<{ name: string; description?: string }> = [];

    beforeAll(async () => {
      serverUtils = await setupMCPServer(config.server, {
        timeout: config.timeout,
        debug: process.env.VITEST_MCP_DEBUG === "true",
      });
      // Get actual tools list
      if (currentServerRunner) {
        tools = await currentServerRunner.listTools();
      }
    });

    afterAll(async () => {
      await teardownMCPServer();
    });

    it(
      `should pass evaluation threshold (${config.threshold || 0.8})`,
      async () => {
        const testCases = Array.isArray(config.data)
          ? config.data
          : await config.data();
        const results: EvalResult[] = [];

        for (const testCase of testCases) {
          const context: MCPTestContext = {
            server: currentServerRunner!,
            tools,
            testCase,
            utils: serverUtils,
          };

          const startTime = Date.now();
          let output: unknown;
          let error: Error | undefined;

          try {
            output = await config.task(testCase.input, context);
          } catch (err: unknown) {
            error = err instanceof Error ? err : new Error(String(err));
            output = null;
          }

          const executionTime = Date.now() - startTime;

          // Run all scorers
          const scores = await Promise.all(
            config.scorers.map(async (scorer) => {
              try {
                const score = await scorer.score(
                  output,
                  testCase.expected,
                  context,
                );
                const explanation = scorer.explain
                  ? await scorer.explain(output, testCase.expected, context)
                  : undefined;

                return {
                  scorerName: scorer.name,
                  score,
                  explanation,
                };
              } catch (scorerError) {
                return {
                  scorerName: scorer.name,
                  score: 0,
                  explanation: `Scorer failed: ${scorerError instanceof Error ? scorerError.message : String(scorerError)}`,
                };
              }
            }),
          );

          const overallScore =
            scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
          const threshold = config.threshold || 0.8;

          const result: EvalResult = {
            testCase,
            output,
            scores,
            overallScore,
            passed: overallScore >= threshold && !error,
            executionTime,
            error,
          };

          results.push(result);
        }

        // Calculate suite statistics
        const stats = {
          totalTests: results.length,
          passedTests: results.filter((r) => r.passed).length,
          failedTests: results.filter((r) => !r.passed).length,
          averageScore:
            results.reduce((sum, r) => sum + r.overallScore, 0) /
            results.length,
          averageExecutionTime:
            results.reduce((sum, r) => sum + r.executionTime, 0) /
            results.length,
        };

        const suiteResult: EvalSuiteResult = {
          config,
          results,
          stats,
          passed: stats.failedTests === 0,
        };

        // Log detailed results if in debug mode
        if (process.env.VITEST_MCP_DEBUG === "true") {
          console.log("\n📊 MCP Evaluation Results:");
          console.log(
            `Total: ${stats.totalTests}, Passed: ${stats.passedTests}, Failed: ${stats.failedTests}`,
          );
          console.log(
            `Average Score: ${stats.averageScore.toFixed(3)}, Average Time: ${stats.averageExecutionTime.toFixed(0)}ms`,
          );

          results.forEach((result, i) => {
            const status = result.passed ? "✅" : "❌";
            console.log(
              `\n${status} Test ${i + 1}: ${result.testCase.name || "Unnamed"}`,
            );
            console.log(
              `   Score: ${result.overallScore.toFixed(3)} (${result.executionTime}ms)`,
            );

            if (result.error) {
              console.log(`   Error: ${result.error.message}`);
            }

            result.scores.forEach((score) => {
              console.log(`   ${score.scorerName}: ${score.score.toFixed(3)}`);
              if (score.explanation) {
                console.log(`     → ${score.explanation}`);
              }
            });
          });
        }

        // Vitest assertions
        expect(
          suiteResult.passed,
          `Evaluation failed: ${stats.failedTests}/${stats.totalTests} tests failed. Average score: ${stats.averageScore.toFixed(3)}`,
        ).toBe(true);
        expect(stats.averageScore).toBeGreaterThanOrEqual(
          config.threshold || 0.8,
        );
      },
      config.timeout || 60000,
    ); // Default 60 second timeout for evaluation tests
  });
}

/**
 * Helper function for running individual MCP tests within a larger suite
 */
export function mcpTest(
  name: string,
  testFn: (utils: MCPTestContext["utils"]) => Promise<void>,
  timeout?: number,
) {
  it(
    name,
    async () => {
      if (!currentServerRunner) {
        throw new Error(
          "MCP server not initialized. Make sure to call setupMCPServer in beforeAll",
        );
      }

      const utils: MCPTestContext["utils"] = {
        callTool: async (name: string, args: Record<string, unknown>) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.callTool(name, args);
        },

        runWorkflow: async (steps) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.runWorkflowWithLLM(steps);
        },

        listResources: async () => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          try {
            const result = await currentServerRunner.listResources();
            return result.resources?.map((r) => r.uri || r.name) || [];
          } catch {
            return [];
          }
        },

        getResource: async (uri: string) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.readResource(uri);
        },

        listResourceTemplates: async () => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          try {
            const result = await currentServerRunner.listResourceTemplates();
            return result.resourceTemplates?.map((t) => t.uriTemplate) || [];
          } catch {
            return [];
          }
        },

        subscribeToResource: async (uri: string) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.subscribeToResource(uri);
        },

        unsubscribeFromResource: async (uri: string) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.unsubscribeFromResource(uri);
        },

        listPrompts: async () => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          try {
            const result = await currentServerRunner.listPrompts();
            return result.prompts?.map((p) => p.name) || [];
          } catch {
            return [];
          }
        },

        getPrompt: async (name: string, args?: Record<string, unknown>) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.getPrompt(name, args);
        },

        createSamplingMessage: async (request) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.createSamplingMessage(request);
        },

        simulateUserApproval: async (requestId, approved, modifiedRequest) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return await currentServerRunner.simulateUserApproval(
            requestId,
            approved,
            modifiedRequest,
          );
        },

        validateModelPreferences: (preferences) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return currentServerRunner.validateModelPreferences(preferences);
        },

        validateSamplingContent: (messages) => {
          if (!currentServerRunner) throw new Error("Server not initialized");
          return currentServerRunner.validateSamplingContent(messages as never);
        },
      };

      await testFn(utils);
    },
    timeout || 30000,
  );
}
