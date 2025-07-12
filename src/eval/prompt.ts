import { ServerRunner } from "./runner.js";

// Prompt Test Interfaces
export interface PromptTest {
  name: string;
  description?: string;
  args: Record<string, unknown>;
  expectedContent?: unknown;
  expectedMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  expectError?: string;
  maxLatency?: number;
  retries: number;
}

export interface PromptArgumentTest {
  name: string;
  description?: string;
  promptName: string;
  requiredArgs?: string[];
  optionalArgs?: string[];
  invalidArgs?: Record<string, unknown>;
  validArgs?: Record<string, unknown>;
  timeout?: number;
}

export interface PromptDiscoveryTest {
  name: string;
  description?: string;
  expectedPrompts?: string[];
  expectedCount?: {
    min?: number;
    max?: number;
    exact?: number;
  };
  timeout?: number;
}

export interface PromptTemplateTest {
  name: string;
  description?: string;
  promptName: string;
  arguments: Record<string, unknown>;
  expectedPatterns?: string[];
  unexpectedPatterns?: string[];
  validateStructure?: boolean;
  expectError?: string;
  retries: number;
}

export interface PromptSecurityTest {
  name: string;
  description?: string;
  promptName: string;
  injectionAttempts: Array<Record<string, unknown>>;
  sanitizationTests?: Array<{
    input: Record<string, unknown>;
    expectedSanitization: boolean;
  }>;
  maliciousInputs?: Array<Record<string, unknown>>;
  timeout?: number;
}

export interface PromptSuite {
  name: string;
  description?: string;
  discoveryTests?: PromptDiscoveryTest[];
  promptTests?: PromptTest[];
  argumentTests?: PromptArgumentTest[];
  templateTests?: PromptTemplateTest[];
  securityTests?: PromptSecurityTest[];
  parallel?: boolean;
  timeout?: number;
}

// Result Interfaces
export interface PromptTestResult {
  testName: string;
  promptName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface PromptArgumentResult {
  testName: string;
  promptName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    requiredArgsValidation?: Record<string, boolean>;
    optionalArgsValidation?: Record<string, boolean>;
    invalidArgsRejected?: boolean;
    validArgsAccepted?: boolean;
  };
}

export interface PromptDiscoveryResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    expectedPrompts?: string[];
    foundPrompts: string[];
    expectedCount?: { min?: number; max?: number; exact?: number };
    actualCount: number;
  };
}

export interface PromptTemplateResult {
  testName: string;
  promptName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface PromptSecurityResult {
  testName: string;
  promptName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    injectionsPrevented: number;
    totalInjectionAttempts: number;
    sanitizationResults?: Array<{
      input: Record<string, unknown>;
      wasSanitized: boolean;
      expectedSanitization: boolean;
    }>;
    maliciousInputsBlocked: number;
    totalMaliciousInputs: number;
  };
}

export interface PromptSuiteResult {
  suiteName: string;
  description?: string;
  discoveryResults: PromptDiscoveryResult[];
  promptResults: PromptTestResult[];
  argumentResults: PromptArgumentResult[];
  templateResults: PromptTemplateResult[];
  securityResults: PromptSecurityResult[];
  overallScore: number;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
}

export class PromptEvaluator {
  constructor(
    private runner: ServerRunner,
    private globalTimeout: number = 30000,
  ) {}

  /**
   * Run a prompt discovery test
   */
  async runPromptDiscoveryTest(
    test: PromptDiscoveryTest,
    suiteTimeout?: number,
  ): Promise<PromptDiscoveryResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      // Set up timeout for the prompt discovery
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Prompt discovery timeout")),
          timeout,
        ),
      );

      // List prompts
      const resultPromise = this.runner.listPrompts();
      const result = await Promise.race([resultPromise, timeoutPromise]);

      const endTime = Date.now();
      const latency = endTime - startTime;

      const foundPrompts = result.prompts?.map((p) => p.name) || [];
      const actualCount = foundPrompts.length;

      // Validate expected prompts if provided
      if (test.expectedPrompts) {
        const missingPrompts = test.expectedPrompts.filter(
          (expected) => !foundPrompts.includes(expected),
        );

        if (missingPrompts.length > 0) {
          return {
            testName: test.description || `${test.name} discovery test`,
            passed: false,
            score: 0,
            latency,
            details: `Missing expected prompts: ${missingPrompts.join(", ")}`,
            metadata: {
              expectedPrompts: test.expectedPrompts,
              foundPrompts,
              actualCount,
            },
          };
        }
      }

      // Validate expected count if provided
      if (test.expectedCount) {
        const { min, max, exact } = test.expectedCount;
        let countValid = true;
        let countError = "";

        if (exact !== undefined && actualCount !== exact) {
          countValid = false;
          countError = `Expected exactly ${exact} prompts, found ${actualCount}`;
        } else if (min !== undefined && actualCount < min) {
          countValid = false;
          countError = `Expected at least ${min} prompts, found ${actualCount}`;
        } else if (max !== undefined && actualCount > max) {
          countValid = false;
          countError = `Expected at most ${max} prompts, found ${actualCount}`;
        }

        if (!countValid) {
          return {
            testName: test.description || `${test.name} discovery test`,
            passed: false,
            score: 0,
            latency,
            details: countError,
            metadata: {
              expectedCount: test.expectedCount,
              foundPrompts,
              actualCount,
            },
          };
        }
      }

      // Success case
      return {
        testName: test.description || `${test.name} discovery test`,
        passed: true,
        score: 1.0,
        latency,
        details: `Successfully discovered ${actualCount} prompts in ${latency}ms`,
        metadata: {
          expectedPrompts: test.expectedPrompts,
          foundPrompts,
          expectedCount: test.expectedCount,
          actualCount,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} discovery test`,
        passed: false,
        score: 0,
        latency,
        details: `Prompt discovery failed: ${errorMessage}`,
        metadata: {
          foundPrompts: [],
          actualCount: 0,
        },
      };
    }
  }

  /**
   * Run a single prompt test
   */
  async runPromptTest(
    test: PromptTest,
    suiteTimeout?: number,
  ): Promise<PromptTestResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Set up timeout for the prompt call
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Prompt call timeout")), timeout),
        );

        // Get the prompt
        const resultPromise = this.runner.getPrompt(test.name, test.args);
        const result = await Promise.race([resultPromise, timeoutPromise]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Check latency constraint
        if (test.maxLatency && latency > test.maxLatency) {
          return {
            testName: test.description || `${test.name} test`,
            promptName: test.name,
            passed: false,
            score: 0,
            latency,
            details: `Prompt call exceeded maximum latency: ${latency}ms > ${test.maxLatency}ms`,
            retryCount,
          };
        }

        // Validate expected content if provided
        if (test.expectedContent !== undefined) {
          const contentMatches = this.validatePromptContent(
            result.messages,
            test.expectedContent,
          );
          if (!contentMatches) {
            return {
              testName: test.description || `${test.name} test`,
              promptName: test.name,
              passed: false,
              score: 0,
              latency,
              details: `Content mismatch. Expected: ${JSON.stringify(test.expectedContent)}`,
              retryCount,
              metadata: {
                expectedContent: test.expectedContent,
                actualMessages: result.messages,
              },
            };
          }
        }

        // Validate expected message structure if provided
        if (test.expectedMessages) {
          const structureMatches = this.validateMessageStructure(
            result.messages,
            test.expectedMessages,
          );
          if (!structureMatches) {
            return {
              testName: test.description || `${test.name} test`,
              promptName: test.name,
              passed: false,
              score: 0,
              latency,
              details: `Message structure mismatch`,
              retryCount,
              metadata: {
                expectedMessages: test.expectedMessages,
                actualMessages: result.messages,
              },
            };
          }
        }

        // If we expected an error but didn't get one
        if (test.expectError) {
          return {
            testName: test.description || `${test.name} test`,
            promptName: test.name,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectError}" but prompt call succeeded`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              actualResult: result,
            },
          };
        }

        // Success case
        return {
          testName: test.description || `${test.name} test`,
          promptName: test.name,
          passed: true,
          score: 1.0,
          latency,
          details: `Prompt call successful in ${latency}ms`,
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
        if (test.expectError && errorMessage.includes(test.expectError)) {
          const endTime = Date.now();
          const latency = endTime - startTime;

          return {
            testName: test.description || `${test.name} test`,
            promptName: test.name,
            passed: true,
            score: 1.0,
            latency,
            details: `Prompt correctly failed with expected error: ${test.expectError}`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              actualError: errorMessage,
            },
          };
        }

        // If we have retries left, try again
        if (retryCount < test.retries) {
          retryCount++;
          console.log(
            `Prompt test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} test`,
          promptName: test.name,
          passed: false,
          score: 0,
          latency,
          details: `Prompt call failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} test`,
      promptName: test.name,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a prompt argument validation test
   */
  async runPromptArgumentTest(
    test: PromptArgumentTest,
    suiteTimeout?: number,
  ): Promise<PromptArgumentResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      // First, get the available prompts to verify the prompt exists
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Prompt argument test timeout")),
          timeout,
        ),
      );

      const promptsPromise = this.runner.listPrompts();
      const prompts = await Promise.race([promptsPromise, timeoutPromise]);

      const prompt = prompts.prompts?.find((p) => p.name === test.promptName);

      if (!prompt) {
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} argument test`,
          promptName: test.promptName,
          passed: false,
          score: 0,
          latency,
          details: `Prompt not found: ${test.promptName}`,
        };
      }

      let score = 1.0;
      const details = "Argument validation successful";
      const metadata: PromptArgumentResult["metadata"] = {};

      // Test required arguments
      if (test.requiredArgs) {
        metadata.requiredArgsValidation = {};
        for (const reqArg of test.requiredArgs) {
          try {
            // Try calling without this required argument
            const argsWithoutRequired = { ...test.validArgs };
            delete argsWithoutRequired[reqArg];

            await this.runner.getPrompt(test.promptName, argsWithoutRequired);

            // If it succeeds, the argument is not actually required
            metadata.requiredArgsValidation[reqArg] = false;
            score *= 0.8;
          } catch {
            // If it fails, the argument is properly required
            metadata.requiredArgsValidation[reqArg] = true;
          }
        }
      }

      // Test optional arguments
      if (test.optionalArgs) {
        metadata.optionalArgsValidation = {};
        for (const optArg of test.optionalArgs) {
          try {
            // Try calling without this optional argument
            const argsWithoutOptional = { ...test.validArgs };
            delete argsWithoutOptional[optArg];

            await this.runner.getPrompt(test.promptName, argsWithoutOptional);

            // If it succeeds, the argument is properly optional
            metadata.optionalArgsValidation[optArg] = true;
          } catch {
            // If it fails, the argument might not be optional
            metadata.optionalArgsValidation[optArg] = false;
            score *= 0.9;
          }
        }
      }

      // Test invalid arguments
      if (test.invalidArgs) {
        try {
          await this.runner.getPrompt(test.promptName, test.invalidArgs);
          // If it succeeds with invalid args, that's bad
          metadata.invalidArgsRejected = false;
          score *= 0.5;
        } catch {
          // If it fails with invalid args, that's good
          metadata.invalidArgsRejected = true;
        }
      }

      // Test valid arguments
      if (test.validArgs) {
        try {
          await this.runner.getPrompt(test.promptName, test.validArgs);
          // If it succeeds with valid args, that's good
          metadata.validArgsAccepted = true;
        } catch {
          // If it fails with valid args, that's bad
          metadata.validArgsAccepted = false;
          score *= 0.5;
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        testName: test.description || `${test.name} argument test`,
        promptName: test.promptName,
        passed: score >= 0.8,
        score,
        latency,
        details,
        metadata,
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} argument test`,
        promptName: test.promptName,
        passed: false,
        score: 0,
        latency,
        details: `Prompt argument test failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Run a prompt template test
   */
  async runPromptTemplateTest(
    test: PromptTemplateTest,
    suiteTimeout?: number,
  ): Promise<PromptTemplateResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Set up timeout for the prompt template test
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Prompt template test timeout")),
            timeout,
          ),
        );

        // Get the prompt with arguments
        const resultPromise = this.runner.getPrompt(
          test.promptName,
          test.arguments,
        );
        const result = await Promise.race([resultPromise, timeoutPromise]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Validate message structure if required
        if (test.validateStructure !== false) {
          const hasValidStructure = this.validatePromptStructure(
            result.messages,
          );
          if (!hasValidStructure) {
            return {
              testName: test.description || `${test.name} template test`,
              promptName: test.promptName,
              passed: false,
              score: 0,
              latency,
              details: "Invalid message structure in generated prompt",
              retryCount,
              metadata: {
                messages: result.messages,
              },
            };
          }
        }

        // Check for expected patterns
        if (test.expectedPatterns) {
          const missingPatterns = this.findMissingPatterns(
            result.messages,
            test.expectedPatterns,
          );
          if (missingPatterns.length > 0) {
            return {
              testName: test.description || `${test.name} template test`,
              promptName: test.promptName,
              passed: false,
              score: 0,
              latency,
              details: `Missing expected patterns: ${missingPatterns.join(", ")}`,
              retryCount,
              metadata: {
                missingPatterns,
                messages: result.messages,
              },
            };
          }
        }

        // Check for unexpected patterns
        if (test.unexpectedPatterns) {
          const foundUnexpectedPatterns = this.findUnexpectedPatterns(
            result.messages,
            test.unexpectedPatterns,
          );
          if (foundUnexpectedPatterns.length > 0) {
            return {
              testName: test.description || `${test.name} template test`,
              promptName: test.promptName,
              passed: false,
              score: 0,
              latency,
              details: `Found unexpected patterns: ${foundUnexpectedPatterns.join(", ")}`,
              retryCount,
              metadata: {
                unexpectedPatterns: foundUnexpectedPatterns,
                messages: result.messages,
              },
            };
          }
        }

        // If we expected an error but didn't get one
        if (test.expectError) {
          return {
            testName: test.description || `${test.name} template test`,
            promptName: test.promptName,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectError}" but prompt template succeeded`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              actualResult: result,
            },
          };
        }

        // Success case
        return {
          testName: test.description || `${test.name} template test`,
          promptName: test.promptName,
          passed: true,
          score: 1.0,
          latency,
          details: `Prompt template test successful in ${latency}ms`,
          retryCount,
          metadata: {
            arguments: test.arguments,
            messages: result.messages,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        // If we expected this error, it's a success
        if (test.expectError && errorMessage.includes(test.expectError)) {
          const endTime = Date.now();
          const latency = endTime - startTime;

          return {
            testName: test.description || `${test.name} template test`,
            promptName: test.promptName,
            passed: true,
            score: 1.0,
            latency,
            details: `Prompt template correctly failed with expected error: ${test.expectError}`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              actualError: errorMessage,
            },
          };
        }

        // If we have retries left, try again
        if (retryCount < test.retries) {
          retryCount++;
          console.log(
            `Prompt template test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} template test`,
          promptName: test.promptName,
          passed: false,
          score: 0,
          latency,
          details: `Prompt template test failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} template test`,
      promptName: test.promptName,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a prompt security test
   */
  async runPromptSecurityTest(
    test: PromptSecurityTest,
    suiteTimeout?: number,
  ): Promise<PromptSecurityResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      let injectionsPrevented = 0;
      const totalInjectionAttempts = test.injectionAttempts.length;
      let maliciousInputsBlocked = 0;
      const totalMaliciousInputs = test.maliciousInputs?.length || 0;

      // Test prompt injection prevention
      for (const injectionAttempt of test.injectionAttempts) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Security test timeout")),
              timeout,
            ),
          );

          const resultPromise = this.runner.getPrompt(
            test.promptName,
            injectionAttempt,
          );
          const result = await Promise.race([resultPromise, timeoutPromise]);

          // Check if the injection was properly handled
          if (this.detectPromptInjection(result.messages)) {
            // Injection was not prevented
            console.log(
              `Potential injection detected in prompt output for ${test.promptName}`,
            );
          } else {
            // Injection was prevented
            injectionsPrevented++;
          }
        } catch {
          // If the prompt call fails with injection attempt, that's good security
          injectionsPrevented++;
        }
      }

      // Test input sanitization
      const sanitizationResults: Array<{
        input: Record<string, unknown>;
        wasSanitized: boolean;
        expectedSanitization: boolean;
      }> = [];

      if (test.sanitizationTests) {
        for (const sanitizationTest of test.sanitizationTests) {
          try {
            const result = await this.runner.getPrompt(
              test.promptName,
              sanitizationTest.input,
            );
            const wasSanitized = this.detectInputSanitization(
              sanitizationTest.input,
              result.messages,
            );

            sanitizationResults.push({
              input: sanitizationTest.input,
              wasSanitized,
              expectedSanitization: sanitizationTest.expectedSanitization,
            });
          } catch {
            // If call fails, assume input was rejected (sanitized)
            sanitizationResults.push({
              input: sanitizationTest.input,
              wasSanitized: true,
              expectedSanitization: sanitizationTest.expectedSanitization,
            });
          }
        }
      }

      // Test malicious input blocking
      if (test.maliciousInputs) {
        for (const maliciousInput of test.maliciousInputs) {
          try {
            await this.runner.getPrompt(test.promptName, maliciousInput);
            // If it succeeds, malicious input was not blocked
          } catch {
            // If it fails, malicious input was blocked
            maliciousInputsBlocked++;
          }
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Calculate security score
      const injectionScore =
        totalInjectionAttempts > 0
          ? injectionsPrevented / totalInjectionAttempts
          : 1.0;
      const sanitizationScore =
        sanitizationResults.length > 0
          ? sanitizationResults.filter(
              (r) => r.wasSanitized === r.expectedSanitization,
            ).length / sanitizationResults.length
          : 1.0;
      const maliciousInputScore =
        totalMaliciousInputs > 0
          ? maliciousInputsBlocked / totalMaliciousInputs
          : 1.0;

      const overallScore =
        (injectionScore + sanitizationScore + maliciousInputScore) / 3;
      const passed = overallScore >= 0.8;

      return {
        testName: test.description || `${test.name} security test`,
        promptName: test.promptName,
        passed,
        score: overallScore,
        latency,
        details: `Security test completed: ${Math.round(overallScore * 100)}% secure`,
        metadata: {
          injectionsPrevented,
          totalInjectionAttempts,
          sanitizationResults,
          maliciousInputsBlocked,
          totalMaliciousInputs,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} security test`,
        promptName: test.promptName,
        passed: false,
        score: 0,
        latency,
        details: `Prompt security test failed: ${errorMessage}`,
        metadata: {
          injectionsPrevented: 0,
          totalInjectionAttempts: test.injectionAttempts.length,
          maliciousInputsBlocked: 0,
          totalMaliciousInputs: test.maliciousInputs?.length || 0,
        },
      };
    }
  }

  /**
   * Run a complete prompt suite
   */
  async runPromptSuite(suite: PromptSuite): Promise<PromptSuiteResult> {
    console.log(`\nRunning prompt suite: ${suite.name}`);

    const discoveryResults: PromptDiscoveryResult[] = [];
    const promptResults: PromptTestResult[] = [];
    const argumentResults: PromptArgumentResult[] = [];
    const templateResults: PromptTemplateResult[] = [];
    const securityResults: PromptSecurityResult[] = [];

    const allTests = [
      ...(suite.discoveryTests || []),
      ...(suite.promptTests || []),
      ...(suite.argumentTests || []),
      ...(suite.templateTests || []),
      ...(suite.securityTests || []),
    ];

    if (suite.parallel) {
      // Run tests in parallel
      console.log(`Running ${allTests.length} tests in parallel...`);

      const [
        discoveryPromises,
        promptPromises,
        argumentPromises,
        templatePromises,
        securityPromises,
      ] = await Promise.all([
        Promise.all(
          (suite.discoveryTests || []).map((test) =>
            this.runPromptDiscoveryTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.promptTests || []).map((test) =>
            this.runPromptTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.argumentTests || []).map((test) =>
            this.runPromptArgumentTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.templateTests || []).map((test) =>
            this.runPromptTemplateTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.securityTests || []).map((test) =>
            this.runPromptSecurityTest(test, suite.timeout),
          ),
        ),
      ]);

      discoveryResults.push(...discoveryPromises);
      promptResults.push(...promptPromises);
      argumentResults.push(...argumentPromises);
      templateResults.push(...templatePromises);
      securityResults.push(...securityPromises);
    } else {
      // Run tests sequentially
      console.log(`Running ${allTests.length} tests sequentially...`);

      // Run discovery tests
      for (const test of suite.discoveryTests || []) {
        const result = await this.runPromptDiscoveryTest(test, suite.timeout);
        discoveryResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run prompt tests
      for (const test of suite.promptTests || []) {
        const result = await this.runPromptTest(test, suite.timeout);
        promptResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run argument tests
      for (const test of suite.argumentTests || []) {
        const result = await this.runPromptArgumentTest(test, suite.timeout);
        argumentResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run template tests
      for (const test of suite.templateTests || []) {
        const result = await this.runPromptTemplateTest(test, suite.timeout);
        templateResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run security tests
      for (const test of suite.securityTests || []) {
        const result = await this.runPromptSecurityTest(test, suite.timeout);
        securityResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }
    }

    // Calculate metrics
    const allResults = [
      ...discoveryResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...promptResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...argumentResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...templateResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...securityResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
    ];
    const totalTests = allResults.length;
    const passedTests = allResults.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const overallScore = totalTests > 0 ? passedTests / totalTests : 1.0;
    const passed = passedTests === totalTests;
    const averageLatency =
      totalTests > 0
        ? allResults.reduce((sum, r) => sum + r.latency, 0) / totalTests
        : 0;

    return {
      suiteName: suite.name,
      description: suite.description,
      discoveryResults,
      promptResults,
      argumentResults,
      templateResults,
      securityResults,
      overallScore,
      passed,
      totalTests,
      passedTests,
      failedTests,
      averageLatency,
    };
  }

  // Helper methods

  /**
   * Validate if prompt content matches expected patterns
   */
  private validatePromptContent(
    messages: unknown[],
    expected: unknown,
  ): boolean {
    const messageText = this.extractTextFromMessages(messages);

    if (typeof expected === "string") {
      return messageText.toLowerCase().includes(expected.toLowerCase());
    }

    return JSON.stringify(messages) === JSON.stringify(expected);
  }

  /**
   * Validate message structure matches expected format
   */
  private validateMessageStructure(
    actualMessages: unknown[],
    expectedMessages: Array<{ role: "user" | "assistant"; content: string }>,
  ): boolean {
    if (actualMessages.length !== expectedMessages.length) {
      return false;
    }

    for (let i = 0; i < actualMessages.length; i++) {
      const actual = actualMessages[i];
      const expected = expectedMessages[i];

      if (
        typeof actual !== "object" ||
        actual === null ||
        !("role" in actual) ||
        !("content" in actual)
      ) {
        return false;
      }

      const actualMessage = actual as { role: string; content: unknown };

      if (actualMessage.role !== expected.role) {
        return false;
      }

      if (typeof actualMessage.content === "string") {
        if (
          !actualMessage.content
            .toLowerCase()
            .includes(expected.content.toLowerCase())
        ) {
          return false;
        }
      } else if (
        typeof actualMessage.content === "object" &&
        actualMessage.content !== null &&
        "text" in actualMessage.content
      ) {
        const textContent = (actualMessage.content as { text: string }).text;
        if (
          !textContent.toLowerCase().includes(expected.content.toLowerCase())
        ) {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate prompt message structure is valid
   */
  private validatePromptStructure(messages: unknown[]): boolean {
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }

    for (const message of messages) {
      if (
        typeof message !== "object" ||
        message === null ||
        !("role" in message) ||
        !("content" in message)
      ) {
        return false;
      }

      const msgRole = (message as { role: unknown }).role;
      if (
        typeof msgRole !== "string" ||
        !["user", "assistant", "system"].includes(msgRole)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find missing expected patterns in messages
   */
  private findMissingPatterns(
    messages: unknown[],
    expectedPatterns: string[],
  ): string[] {
    const messageText = this.extractTextFromMessages(messages);
    const missingPatterns: string[] = [];

    for (const pattern of expectedPatterns) {
      if (!messageText.toLowerCase().includes(pattern.toLowerCase())) {
        missingPatterns.push(pattern);
      }
    }

    return missingPatterns;
  }

  /**
   * Find unexpected patterns in messages
   */
  private findUnexpectedPatterns(
    messages: unknown[],
    unexpectedPatterns: string[],
  ): string[] {
    const messageText = this.extractTextFromMessages(messages);
    const foundUnexpectedPatterns: string[] = [];

    for (const pattern of unexpectedPatterns) {
      if (messageText.toLowerCase().includes(pattern.toLowerCase())) {
        foundUnexpectedPatterns.push(pattern);
      }
    }

    return foundUnexpectedPatterns;
  }

  /**
   * Extract text content from messages
   */
  private extractTextFromMessages(messages: unknown[]): string {
    const textParts: string[] = [];

    for (const message of messages) {
      if (
        typeof message === "object" &&
        message !== null &&
        "content" in message
      ) {
        const content = (message as { content: unknown }).content;

        if (typeof content === "string") {
          textParts.push(content);
        } else if (
          typeof content === "object" &&
          content !== null &&
          "text" in content
        ) {
          const textContent = (content as { text: unknown }).text;
          if (typeof textContent === "string") {
            textParts.push(textContent);
          }
        }
      }
    }

    return textParts.join(" ");
  }

  /**
   * Detect potential prompt injection in messages
   */
  private detectPromptInjection(messages: unknown[]): boolean {
    const messageText = this.extractTextFromMessages(messages);
    const injectionPatterns = [
      "ignore previous instructions",
      "forget your role",
      "system:",
      "assistant:",
      "user:",
      "prompt:",
      "new instructions:",
      "override",
      "jailbreak",
      "pretend",
    ];

    return injectionPatterns.some((pattern) =>
      messageText.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  /**
   * Detect if input was sanitized in the output
   */
  private detectInputSanitization(
    input: Record<string, unknown>,
    messages: unknown[],
  ): boolean {
    const messageText = this.extractTextFromMessages(messages);
    const inputText = JSON.stringify(input).toLowerCase();

    // Check if potentially dangerous input patterns appear in output
    const dangerousPatterns = [
      "<script",
      "javascript:",
      "data:",
      "vbscript:",
      "onload=",
      "onerror=",
    ];

    for (const pattern of dangerousPatterns) {
      if (
        inputText.includes(pattern) &&
        messageText.toLowerCase().includes(pattern)
      ) {
        return false; // Input was not sanitized
      }
    }

    return true; // Input appears to be sanitized
  }

  /**
   * Get available prompts for validation
   */
  async getAvailablePrompts(): Promise<string[]> {
    const result = await this.runner.listPrompts();
    return result.prompts?.map((p) => p.name) || [];
  }

  /**
   * Validate that all test prompts exist
   */
  async validatePromptSuite(suite: PromptSuite): Promise<{
    valid: boolean;
    missingPrompts: string[];
    availablePrompts: string[];
  }> {
    const availablePrompts = await this.getAvailablePrompts();

    const testPrompts = [
      ...(suite.promptTests || []).map((t) => t.name),
      ...(suite.argumentTests || []).map((t) => t.promptName),
      ...(suite.templateTests || []).map((t) => t.promptName),
      ...(suite.securityTests || []).map((t) => t.promptName),
    ];

    const missingPrompts = testPrompts.filter(
      (prompt) => !availablePrompts.includes(prompt),
    );

    return {
      valid: missingPrompts.length === 0,
      missingPrompts,
      availablePrompts,
    };
  }
}
