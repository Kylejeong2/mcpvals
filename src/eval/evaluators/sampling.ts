import { ServerRunner } from "../core/runner.js";

// Sampling Test Interfaces
export interface SamplingCapabilityTest {
  name: string;
  description?: string;
  expectedCapability: boolean;
  timeout?: number;
}

export interface SamplingRequestTest {
  name: string;
  description?: string;
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
  expectError?: string;
  expectUserApproval: boolean;
  simulateUserResponse: "approve" | "reject" | "modify";
  retries: number;
  timeout?: number;
}

export interface SamplingSecurityTest {
  name: string;
  description?: string;
  unauthorizedRequests: Array<{
    messages: Array<{
      role: "user" | "assistant";
      content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }>;
    expectRejection: boolean;
  }>;
  sensitiveDataTests?: Array<{
    input: string;
    expectFiltering: boolean;
  }>;
  privacyTests?: Array<{
    description: string;
    includePersonalData: boolean;
    expectDataProtection: boolean;
  }>;
  timeout?: number;
}

export interface SamplingPerformanceTest {
  name: string;
  description?: string;
  concurrentRequests: number;
  messageSize: "small" | "medium" | "large";
  maxLatency?: number;
  expectThrottling: boolean;
  retries: number;
  timeout?: number;
}

export interface SamplingContentTest {
  name: string;
  description?: string;
  testCases: Array<{
    contentType: "text" | "image" | "mixed";
    input: {
      text?: string;
      imageData?: string;
      mimeType?: string;
    };
    expectedHandling: "accept" | "reject" | "convert";
    expectedResponse?: string;
  }>;
  retries: number;
  timeout?: number;
}

export interface SamplingWorkflowTest {
  name: string;
  description?: string;
  steps: Array<{
    stepType: "request" | "approval" | "response" | "validation";
    action: string;
    expectedOutcome: string;
    userResponse?: "approve" | "reject" | "modify";
    timeoutMs?: number;
  }>;
  expectSuccess: boolean;
  timeout?: number;
}

export interface SamplingSuite {
  name: string;
  description?: string;
  capabilityTests?: SamplingCapabilityTest[];
  requestTests?: SamplingRequestTest[];
  securityTests?: SamplingSecurityTest[];
  performanceTests?: SamplingPerformanceTest[];
  contentTests?: SamplingContentTest[];
  workflowTests?: SamplingWorkflowTest[];
  parallel?: boolean;
  timeout?: number;
}

// Result Interfaces
export interface SamplingCapabilityResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    expectedCapability: boolean;
    actualCapability: boolean;
    serverInfo?: unknown;
  };
}

export interface SamplingRequestResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface SamplingSecurityResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    unauthorizedRequestsBlocked: number;
    totalUnauthorizedRequests: number;
    sensitiveDataFiltered: number;
    totalSensitiveDataTests: number;
    privacyTestsPassed: number;
    totalPrivacyTests: number;
  };
}

export interface SamplingPerformanceResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: {
    concurrentRequests: number;
    averageLatency: number;
    maxLatency?: number;
    throttlingDetected: boolean;
    requestsCompleted: number;
    requestsFailed: number;
  };
}

export interface SamplingContentResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: {
    testCasesRun: number;
    testCasesPassed: number;
    contentTypeResults: Array<{
      contentType: string;
      expectedHandling: string;
      actualHandling: string;
      passed: boolean;
    }>;
  };
}

export interface SamplingWorkflowResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    stepsCompleted: number;
    totalSteps: number;
    stepResults: Array<{
      stepType: string;
      action: string;
      expectedOutcome: string;
      actualOutcome: string;
      passed: boolean;
    }>;
  };
}

export interface SamplingSuiteResult {
  suiteName: string;
  description?: string;
  capabilityResults: SamplingCapabilityResult[];
  requestResults: SamplingRequestResult[];
  securityResults: SamplingSecurityResult[];
  performanceResults: SamplingPerformanceResult[];
  contentResults: SamplingContentResult[];
  workflowResults: SamplingWorkflowResult[];
  overallScore: number;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
}

export class SamplingEvaluator {
  constructor(
    private runner: ServerRunner,
    private globalTimeout: number = 30000,
  ) {}

  /**
   * Run a sampling capability test
   */
  async runSamplingCapabilityTest(
    test: SamplingCapabilityTest,
    suiteTimeout?: number,
  ): Promise<SamplingCapabilityResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      // Set up timeout for the capability check
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Sampling capability test timeout")),
          timeout,
        ),
      );

      // Check if sampling capability is present
      const resultPromise = this.runner.checkSamplingCapability();
      const actualCapability = await Promise.race([
        resultPromise,
        timeoutPromise,
      ]);

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Validate against expected capability
      const passed = actualCapability === test.expectedCapability;
      const score = passed ? 1.0 : 0;

      return {
        testName: test.description || `${test.name} capability test`,
        passed,
        score,
        latency,
        details: passed
          ? `Sampling capability correctly ${actualCapability ? "present" : "absent"} in ${latency}ms`
          : `Capability mismatch: expected ${test.expectedCapability}, got ${actualCapability}`,
        metadata: {
          expectedCapability: test.expectedCapability,
          actualCapability,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} capability test`,
        passed: false,
        score: 0,
        latency,
        details: `Sampling capability test failed: ${errorMessage}`,
        metadata: {
          expectedCapability: test.expectedCapability,
          actualCapability: false,
        },
      };
    }
  }

  /**
   * Run a sampling request test
   */
  async runSamplingRequestTest(
    test: SamplingRequestTest,
    suiteTimeout?: number,
  ): Promise<SamplingRequestResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Validate request content first
        const contentValidation = this.runner.validateSamplingContent(
          test.messages,
        );
        if (!contentValidation.valid) {
          return {
            testName: test.description || `${test.name} request test`,
            passed: false,
            score: 0,
            latency: Date.now() - startTime,
            details: `Invalid content: ${contentValidation.errors.join(", ")}`,
            retryCount,
            metadata: {
              contentValidationErrors: contentValidation.errors,
            },
          };
        }

        // Validate model preferences if provided
        if (test.modelPreferences) {
          const preferencesValidation = this.runner.validateModelPreferences(
            test.modelPreferences,
          );
          if (!preferencesValidation.valid) {
            return {
              testName: test.description || `${test.name} request test`,
              passed: false,
              score: 0,
              latency: Date.now() - startTime,
              details: `Invalid model preferences: ${preferencesValidation.errors.join(", ")}`,
              retryCount,
              metadata: {
                modelPreferencesErrors: preferencesValidation.errors,
              },
            };
          }
        }

        // Set up timeout for the sampling request
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Sampling request timeout")),
            timeout,
          ),
        );

        // Create sampling message request
        const requestPromise = this.runner.createSamplingMessage({
          includeContext: test.includeContext,
          messages: test.messages,
          modelPreferences: test.modelPreferences,
          systemPrompt: test.systemPrompt,
          maxTokens: test.maxTokens,
          metadata: test.metadata,
        });

        const samplingResponse = await Promise.race([
          requestPromise,
          timeoutPromise,
        ]);

        // Check if user approval is expected and required
        if (test.expectUserApproval !== samplingResponse.userApprovalRequired) {
          return {
            testName: test.description || `${test.name} request test`,
            passed: false,
            score: 0,
            latency: Date.now() - startTime,
            details: `User approval expectation mismatch: expected ${test.expectUserApproval}, got ${samplingResponse.userApprovalRequired}`,
            retryCount,
            metadata: {
              expectedUserApproval: test.expectUserApproval,
              actualUserApprovalRequired: samplingResponse.userApprovalRequired,
              samplingResponse,
            },
          };
        }

        // Simulate user response if approval is required
        let approvalResponse;
        if (samplingResponse.userApprovalRequired) {
          const approved = test.simulateUserResponse === "approve";
          const modifiedRequest =
            test.simulateUserResponse === "modify"
              ? {
                  messages: test.messages,
                  modelPreferences: test.modelPreferences,
                }
              : undefined;

          approvalResponse = await this.runner.simulateUserApproval(
            samplingResponse.requestId,
            approved,
            modifiedRequest,
          );

          // Check approval outcome
          if (!approved && !approvalResponse.error) {
            return {
              testName: test.description || `${test.name} request test`,
              passed: false,
              score: 0,
              latency: Date.now() - startTime,
              details: "User rejection was not properly handled",
              retryCount,
              metadata: {
                approvalResponse,
              },
            };
          }
        }

        const endTime = Date.now();
        const latency = endTime - startTime;

        // If we expected an error but didn't get one
        if (test.expectError) {
          return {
            testName: test.description || `${test.name} request test`,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectError}" but sampling request succeeded`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              samplingResponse,
              approvalResponse,
            },
          };
        }

        // Success case
        return {
          testName: test.description || `${test.name} request test`,
          passed: true,
          score: 1.0,
          latency,
          details: `Sampling request test successful in ${latency}ms`,
          retryCount,
          metadata: {
            samplingResponse,
            approvalResponse,
            userApprovalRequired: samplingResponse.userApprovalRequired,
            simulatedResponse: test.simulateUserResponse,
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
            testName: test.description || `${test.name} request test`,
            passed: true,
            score: 1.0,
            latency,
            details: `Sampling request correctly failed with expected error: ${test.expectError}`,
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
            `Sampling request test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} request test`,
          passed: false,
          score: 0,
          latency,
          details: `Sampling request test failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} request test`,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a sampling security test
   */
  async runSamplingSecurityTest(
    test: SamplingSecurityTest,
    suiteTimeout?: number,
  ): Promise<SamplingSecurityResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      let unauthorizedRequestsBlocked = 0;
      let sensitiveDataFiltered = 0;
      let privacyTestsPassed = 0;

      const totalUnauthorizedRequests = test.unauthorizedRequests.length;
      const totalSensitiveDataTests = test.sensitiveDataTests?.length || 0;
      const totalPrivacyTests = test.privacyTests?.length || 0;

      // Test unauthorized requests
      for (const unauthorizedRequest of test.unauthorizedRequests) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Security test timeout")),
              timeout,
            ),
          );

          const requestPromise = this.runner.createSamplingMessage({
            messages: unauthorizedRequest.messages,
          });

          const response = await Promise.race([requestPromise, timeoutPromise]);

          // Check if the request was properly handled
          if (unauthorizedRequest.expectRejection) {
            // If we expected rejection but got a response, that's a security issue
            if (response && !response.userApprovalRequired) {
              // Request was not properly secured
              console.warn(
                "Unauthorized request was not blocked or flagged for approval",
              );
            } else {
              // Request was properly secured
              unauthorizedRequestsBlocked++;
            }
          } else {
            // If we didn't expect rejection, the request should succeed
            if (response) {
              unauthorizedRequestsBlocked++;
            }
          }
        } catch {
          // If request failed and we expected rejection, that's good
          if (unauthorizedRequest.expectRejection) {
            unauthorizedRequestsBlocked++;
          }
        }
      }

      // Test sensitive data handling
      if (test.sensitiveDataTests) {
        for (const sensitiveTest of test.sensitiveDataTests) {
          try {
            const messages = [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: sensitiveTest.input,
                },
              },
            ];

            const response = await this.runner.createSamplingMessage({
              messages,
            });

            // Check if sensitive data was properly filtered or flagged
            const containsSensitiveData = this.detectSensitiveData(
              response.messages,
            );
            const wasFiltered = !containsSensitiveData;

            if (wasFiltered === sensitiveTest.expectFiltering) {
              sensitiveDataFiltered++;
            }
          } catch {
            // If call failed due to sensitive data, that counts as filtering
            if (sensitiveTest.expectFiltering) {
              sensitiveDataFiltered++;
            }
          }
        }
      }

      // Test privacy protection
      if (test.privacyTests) {
        for (const privacyTest of test.privacyTests) {
          try {
            const messages = [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: privacyTest.includePersonalData
                    ? "Here is my SSN: 123-45-6789 and credit card: 4111-1111-1111-1111"
                    : "Please help me with a general question.",
                },
              },
            ];

            const response = await this.runner.createSamplingMessage({
              messages,
            });

            if (privacyTest.expectDataProtection) {
              // Check if personal data was protected (requires approval or filtered)
              if (
                response.userApprovalRequired ||
                !this.detectPersonalData(response.messages)
              ) {
                privacyTestsPassed++;
              }
            } else {
              // If no protection expected, request should proceed normally
              if (!response.userApprovalRequired) {
                privacyTestsPassed++;
              }
            }
          } catch {
            // If call failed due to privacy protection, that's good if expected
            if (privacyTest.expectDataProtection) {
              privacyTestsPassed++;
            }
          }
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Calculate security score
      const unauthorizedScore =
        totalUnauthorizedRequests > 0
          ? unauthorizedRequestsBlocked / totalUnauthorizedRequests
          : 1.0;
      const sensitiveDataScore =
        totalSensitiveDataTests > 0
          ? sensitiveDataFiltered / totalSensitiveDataTests
          : 1.0;
      const privacyScore =
        totalPrivacyTests > 0 ? privacyTestsPassed / totalPrivacyTests : 1.0;

      const overallScore =
        (unauthorizedScore + sensitiveDataScore + privacyScore) / 3;
      const passed = overallScore >= 0.8;

      return {
        testName: test.description || `${test.name} security test`,
        passed,
        score: overallScore,
        latency,
        details: `Security test completed: ${Math.round(overallScore * 100)}% secure`,
        metadata: {
          unauthorizedRequestsBlocked,
          totalUnauthorizedRequests,
          sensitiveDataFiltered,
          totalSensitiveDataTests,
          privacyTestsPassed,
          totalPrivacyTests,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} security test`,
        passed: false,
        score: 0,
        latency,
        details: `Sampling security test failed: ${errorMessage}`,
        metadata: {
          unauthorizedRequestsBlocked: 0,
          totalUnauthorizedRequests: test.unauthorizedRequests.length,
          sensitiveDataFiltered: 0,
          totalSensitiveDataTests: test.sensitiveDataTests?.length || 0,
          privacyTestsPassed: 0,
          totalPrivacyTests: test.privacyTests?.length || 0,
        },
      };
    }
  }

  /**
   * Run a sampling performance test
   */
  async runSamplingPerformanceTest(
    test: SamplingPerformanceTest,
    suiteTimeout?: number,
  ): Promise<SamplingPerformanceResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Generate test messages based on size
        const messages = this.generateTestMessages(test.messageSize);

        // Run concurrent requests
        const requestPromises: Promise<unknown>[] = [];
        const requestLatencies: number[] = [];
        let requestsCompleted = 0;
        let requestsFailed = 0;
        let throttlingDetected = false;

        for (let i = 0; i < test.concurrentRequests; i++) {
          const requestStart = Date.now();
          const promise = this.runner
            .createSamplingMessage({
              messages,
              metadata: { requestIndex: i, performanceTest: true },
            })
            .then((response) => {
              const requestLatency = Date.now() - requestStart;
              requestLatencies.push(requestLatency);
              requestsCompleted++;
              return response;
            })
            .catch((error) => {
              const requestLatency = Date.now() - requestStart;
              requestLatencies.push(requestLatency);
              requestsFailed++;

              // Check if error indicates throttling
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              if (
                errorMessage &&
                (errorMessage.includes("rate limit") ||
                  errorMessage.includes("Rate limit") ||
                  errorMessage.includes("throttle") ||
                  errorMessage.includes("too many requests"))
              ) {
                throttlingDetected = true;
              }
              return null; // Don't re-throw to allow Promise.allSettled to complete
            });

          requestPromises.push(promise);
        }

        // Set up timeout for all requests
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Performance test timeout")),
            timeout,
          ),
        );

        // Wait for all requests or timeout
        try {
          await Promise.race([
            Promise.allSettled(requestPromises),
            timeoutPromise,
          ]);
        } catch (error: unknown) {
          // Timeout occurred
          if (error instanceof Error && error.message.includes("timeout")) {
            // Count any remaining requests as failed
            requestsFailed +=
              test.concurrentRequests - (requestsCompleted + requestsFailed);
          }
        }

        const endTime = Date.now();
        const latency = endTime - startTime;
        const averageLatency =
          requestLatencies.length > 0
            ? requestLatencies.reduce((sum, lat) => sum + lat, 0) /
              requestLatencies.length
            : 0;

        // Check if throttling expectation was met
        if (test.expectThrottling !== throttlingDetected) {
          return {
            testName: test.description || `${test.name} performance test`,
            passed: false,
            score: 0,
            latency,
            details: `Throttling expectation mismatch: expected ${test.expectThrottling}, detected ${throttlingDetected}`,
            retryCount,
            metadata: {
              concurrentRequests: test.concurrentRequests,
              averageLatency,
              maxLatency: test.maxLatency,
              throttlingDetected,
              requestsCompleted,
              requestsFailed,
            },
          };
        }

        // Check latency constraint
        if (test.maxLatency && averageLatency > test.maxLatency) {
          return {
            testName: test.description || `${test.name} performance test`,
            passed: false,
            score: 0,
            latency,
            details: `Average latency exceeded maximum: ${averageLatency}ms > ${test.maxLatency}ms`,
            retryCount,
            metadata: {
              concurrentRequests: test.concurrentRequests,
              averageLatency,
              maxLatency: test.maxLatency,
              throttlingDetected,
              requestsCompleted,
              requestsFailed,
            },
          };
        }

        // Calculate performance score
        const completionRate = requestsCompleted / test.concurrentRequests;
        let score = completionRate;

        // Bonus for meeting latency requirements
        if (test.maxLatency && averageLatency <= test.maxLatency) {
          score = Math.min(1.0, score + 0.1);
        }

        // Bonus for correct throttling behavior
        if (test.expectThrottling === throttlingDetected) {
          score = Math.min(1.0, score + 0.1);
        }

        const passed = score >= 0.8;

        return {
          testName: test.description || `${test.name} performance test`,
          passed,
          score,
          latency,
          details: `Performance test completed: ${requestsCompleted}/${test.concurrentRequests} requests successful, avg latency ${averageLatency}ms`,
          retryCount,
          metadata: {
            concurrentRequests: test.concurrentRequests,
            averageLatency,
            maxLatency: test.maxLatency,
            throttlingDetected,
            requestsCompleted,
            requestsFailed,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        // If we have retries left, try again
        if (retryCount < test.retries) {
          retryCount++;
          console.log(
            `Performance test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} performance test`,
          passed: false,
          score: 0,
          latency,
          details: `Performance test failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
          metadata: {
            concurrentRequests: test.concurrentRequests,
            averageLatency: 0,
            maxLatency: test.maxLatency,
            throttlingDetected: false,
            requestsCompleted: 0,
            requestsFailed: test.concurrentRequests,
          },
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} performance test`,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
      metadata: {
        concurrentRequests: test.concurrentRequests,
        averageLatency: 0,
        maxLatency: test.maxLatency,
        throttlingDetected: false,
        requestsCompleted: 0,
        requestsFailed: test.concurrentRequests,
      },
    };
  }

  /**
   * Run a sampling content test
   */
  async runSamplingContentTest(
    test: SamplingContentTest,
    suiteTimeout?: number,
  ): Promise<SamplingContentResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        let testCasesRun = 0;
        let testCasesPassed = 0;
        const contentTypeResults: Array<{
          contentType: string;
          expectedHandling: string;
          actualHandling: string;
          passed: boolean;
        }> = [];

        for (const testCase of test.testCases) {
          testCasesRun++;

          try {
            // Prepare messages based on content type
            const messages = this.prepareContentTestMessages(testCase);

            // Set up timeout for content test
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Content test timeout")),
                timeout,
              ),
            );

            const requestPromise = this.runner.createSamplingMessage({
              messages,
            });
            const response = await Promise.race([
              requestPromise,
              timeoutPromise,
            ]);

            // Determine actual handling
            let actualHandling: "accept" | "reject" | "convert";
            if (response && response.userApprovalRequired) {
              actualHandling = "accept"; // Accepted but requires approval
            } else if (response) {
              actualHandling = "accept"; // Accepted directly
            } else {
              actualHandling = "reject"; // Rejected
            }

            // Check if response matches expected pattern
            if (testCase.expectedResponse) {
              const responseText = JSON.stringify(response);
              if (
                !responseText
                  .toLowerCase()
                  .includes(testCase.expectedResponse.toLowerCase())
              ) {
                actualHandling = "reject"; // Response didn't match expected pattern
              }
            }

            const passed = actualHandling === testCase.expectedHandling;
            if (passed) {
              testCasesPassed++;
            }

            contentTypeResults.push({
              contentType: testCase.contentType,
              expectedHandling: testCase.expectedHandling,
              actualHandling,
              passed,
            });
          } catch {
            // Test case failed
            const actualHandling =
              testCase.expectedHandling === "reject" ? "reject" : "error";
            const passed = testCase.expectedHandling === "reject";

            if (passed) {
              testCasesPassed++;
            }

            contentTypeResults.push({
              contentType: testCase.contentType,
              expectedHandling: testCase.expectedHandling,
              actualHandling,
              passed,
            });
          }
        }

        const endTime = Date.now();
        const latency = endTime - startTime;

        const score = testCasesRun > 0 ? testCasesPassed / testCasesRun : 1.0;
        const passed = score >= 0.8;

        return {
          testName: test.description || `${test.name} content test`,
          passed,
          score,
          latency,
          details: `Content test completed: ${testCasesPassed}/${testCasesRun} test cases passed`,
          retryCount,
          metadata: {
            testCasesRun,
            testCasesPassed,
            contentTypeResults,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        // If we have retries left, try again
        if (retryCount < test.retries) {
          retryCount++;
          console.log(
            `Content test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} content test`,
          passed: false,
          score: 0,
          latency,
          details: `Content test failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
          metadata: {
            testCasesRun: 0,
            testCasesPassed: 0,
            contentTypeResults: [],
          },
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} content test`,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
      metadata: {
        testCasesRun: 0,
        testCasesPassed: 0,
        contentTypeResults: [],
      },
    };
  }

  /**
   * Run a sampling workflow test
   */
  async runSamplingWorkflowTest(
    test: SamplingWorkflowTest,
    suiteTimeout?: number,
  ): Promise<SamplingWorkflowResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      let stepsCompleted = 0;
      const totalSteps = test.steps.length;
      const stepResults: Array<{
        stepType: string;
        action: string;
        expectedOutcome: string;
        actualOutcome: string;
        passed: boolean;
      }> = [];

      let samplingRequestId: string | undefined;
      const workflowState: Record<string, unknown> = {};

      for (const step of test.steps) {
        try {
          const stepTimeout = step.timeoutMs || timeout;
          const stepStartTime = Date.now();

          let actualOutcome = "";
          let passed = false;

          switch (step.stepType) {
            case "request":
              {
                // Create a sampling request
                const messages = [
                  {
                    role: "user" as const,
                    content: {
                      type: "text" as const,
                      text: step.action,
                    },
                  },
                ];

                const response = await this.runner.createSamplingMessage({
                  messages,
                  metadata: { workflowStep: stepsCompleted, workflowState },
                });

                samplingRequestId = response.requestId;
                workflowState.lastRequestId = samplingRequestId;
                actualOutcome = `Request created with ID ${samplingRequestId}`;
                passed = actualOutcome
                  .toLowerCase()
                  .includes(step.expectedOutcome.toLowerCase());
              }
              break;

            case "approval":
              {
                if (!samplingRequestId) {
                  actualOutcome =
                    "No sampling request ID available for approval";
                  passed = false;
                } else {
                  const userResponse = step.userResponse || "approve";
                  const approved = userResponse === "approve";

                  const approvalResponse =
                    await this.runner.simulateUserApproval(
                      samplingRequestId,
                      approved,
                    );

                  workflowState.lastApprovalResponse = approvalResponse;
                  actualOutcome = approved
                    ? "Request approved"
                    : "Request rejected";
                  passed = actualOutcome
                    .toLowerCase()
                    .includes(step.expectedOutcome.toLowerCase());
                }
              }
              break;

            case "response":
              {
                // Check if we have a response from previous steps
                const lastApproval = workflowState.lastApprovalResponse as {
                  response: { content: { text: string } };
                };
                if (lastApproval && lastApproval.response) {
                  actualOutcome = `Response received: ${lastApproval.response.content.text.substring(0, 50)}...`;
                } else {
                  actualOutcome = "No response available";
                }
                passed = actualOutcome
                  .toLowerCase()
                  .includes(step.expectedOutcome.toLowerCase());
              }
              break;

            case "validation":
              {
                // Validate the workflow state
                const stateValid = this.validateWorkflowState(
                  workflowState,
                  step.action,
                );
                actualOutcome = stateValid
                  ? "Workflow state valid"
                  : "Workflow state invalid";
                passed = actualOutcome
                  .toLowerCase()
                  .includes(step.expectedOutcome.toLowerCase());
              }
              break;

            default:
              actualOutcome = `Unknown step type: ${step.stepType}`;
              passed = false;
          }

          if (passed) {
            stepsCompleted++;
          }

          stepResults.push({
            stepType: step.stepType,
            action: step.action,
            expectedOutcome: step.expectedOutcome,
            actualOutcome,
            passed,
          });

          // If step failed and we expect success, short-circuit
          if (!passed && test.expectSuccess) {
            break;
          }

          // Check step timeout
          const stepLatency = Date.now() - stepStartTime;
          if (stepTimeout && stepLatency > stepTimeout) {
            actualOutcome = `Step timeout after ${stepLatency}ms`;
            passed = false;
            stepResults[stepResults.length - 1] = {
              ...stepResults[stepResults.length - 1],
              actualOutcome,
              passed,
            };
            break;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          stepResults.push({
            stepType: step.stepType,
            action: step.action,
            expectedOutcome: step.expectedOutcome,
            actualOutcome: `Error: ${errorMessage}`,
            passed: false,
          });

          // If step failed and we expect success, short-circuit
          if (test.expectSuccess) {
            break;
          }
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      const workflowPassed = test.expectSuccess
        ? stepsCompleted === totalSteps
        : stepsCompleted >= 0;
      const score = totalSteps > 0 ? stepsCompleted / totalSteps : 1.0;

      return {
        testName: test.description || `${test.name} workflow test`,
        passed: workflowPassed,
        score,
        latency,
        details: `Workflow test completed: ${stepsCompleted}/${totalSteps} steps passed`,
        metadata: {
          stepsCompleted,
          totalSteps,
          stepResults,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} workflow test`,
        passed: false,
        score: 0,
        latency,
        details: `Workflow test failed: ${errorMessage}`,
        metadata: {
          stepsCompleted: 0,
          totalSteps: test.steps.length,
          stepResults: [],
        },
      };
    }
  }

  /**
   * Run a complete sampling suite
   */
  async runSamplingSuite(suite: SamplingSuite): Promise<SamplingSuiteResult> {
    console.log(`\nRunning sampling suite: ${suite.name}`);

    const capabilityResults: SamplingCapabilityResult[] = [];
    const requestResults: SamplingRequestResult[] = [];
    const securityResults: SamplingSecurityResult[] = [];
    const performanceResults: SamplingPerformanceResult[] = [];
    const contentResults: SamplingContentResult[] = [];
    const workflowResults: SamplingWorkflowResult[] = [];

    const allTests = [
      ...(suite.capabilityTests || []),
      ...(suite.requestTests || []),
      ...(suite.securityTests || []),
      ...(suite.performanceTests || []),
      ...(suite.contentTests || []),
      ...(suite.workflowTests || []),
    ];

    if (suite.parallel) {
      // Run tests in parallel
      console.log(`Running ${allTests.length} tests in parallel...`);

      const [
        capabilityPromises,
        requestPromises,
        securityPromises,
        performancePromises,
        contentPromises,
        workflowPromises,
      ] = await Promise.all([
        Promise.all(
          (suite.capabilityTests || []).map((test) =>
            this.runSamplingCapabilityTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.requestTests || []).map((test) =>
            this.runSamplingRequestTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.securityTests || []).map((test) =>
            this.runSamplingSecurityTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.performanceTests || []).map((test) =>
            this.runSamplingPerformanceTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.contentTests || []).map((test) =>
            this.runSamplingContentTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.workflowTests || []).map((test) =>
            this.runSamplingWorkflowTest(test, suite.timeout),
          ),
        ),
      ]);

      capabilityResults.push(...capabilityPromises);
      requestResults.push(...requestPromises);
      securityResults.push(...securityPromises);
      performanceResults.push(...performancePromises);
      contentResults.push(...contentPromises);
      workflowResults.push(...workflowPromises);
    } else {
      // Run tests sequentially
      console.log(`Running ${allTests.length} tests sequentially...`);

      // Run capability tests
      for (const test of suite.capabilityTests || []) {
        const result = await this.runSamplingCapabilityTest(
          test,
          suite.timeout,
        );
        capabilityResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run request tests
      for (const test of suite.requestTests || []) {
        const result = await this.runSamplingRequestTest(test, suite.timeout);
        requestResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run security tests
      for (const test of suite.securityTests || []) {
        const result = await this.runSamplingSecurityTest(test, suite.timeout);
        securityResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run performance tests
      for (const test of suite.performanceTests || []) {
        const result = await this.runSamplingPerformanceTest(
          test,
          suite.timeout,
        );
        performanceResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run content tests
      for (const test of suite.contentTests || []) {
        const result = await this.runSamplingContentTest(test, suite.timeout);
        contentResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run workflow tests
      for (const test of suite.workflowTests || []) {
        const result = await this.runSamplingWorkflowTest(test, suite.timeout);
        workflowResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }
    }

    // Calculate metrics
    const allResults = [
      ...capabilityResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...requestResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...securityResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...performanceResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...contentResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...workflowResults.map((r) => ({
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
      capabilityResults,
      requestResults,
      securityResults,
      performanceResults,
      contentResults,
      workflowResults,
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
   * Detect sensitive data in messages
   */
  private detectSensitiveData(messages: unknown[]): boolean {
    const messageText = this.extractTextFromMessages(messages);
    const sensitivePatterns = [
      /\d{3}-\d{2}-\d{4}/, // SSN pattern
      /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/, // Credit card pattern
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email pattern
      /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/, // Phone pattern
    ];

    return sensitivePatterns.some((pattern) => pattern.test(messageText));
  }

  /**
   * Detect personal data in messages
   */
  private detectPersonalData(messages: unknown[]): boolean {
    const messageText = this.extractTextFromMessages(messages);
    return (
      this.detectSensitiveData(messages) ||
      messageText.toLowerCase().includes("personal")
    );
  }

  /**
   * Generate test messages of different sizes
   */
  private generateTestMessages(size: "small" | "medium" | "large"): Array<{
    role: "user" | "assistant";
    content: {
      type: "text";
      text: string;
    };
  }> {
    const baseText = "This is a test message for sampling evaluation.";
    let text = baseText;

    switch (size) {
      case "small":
        text = baseText;
        break;
      case "medium":
        text = baseText.repeat(10);
        break;
      case "large":
        text = baseText.repeat(100);
        break;
    }

    return [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ];
  }

  /**
   * Prepare messages for content type testing
   */
  private prepareContentTestMessages(testCase: {
    contentType: "text" | "image" | "mixed";
    input: {
      text?: string;
      imageData?: string;
      mimeType?: string;
    };
  }): Array<{
    role: "user" | "assistant";
    content: {
      type: "text" | "image";
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }> {
    const messages: Array<{
      role: "user" | "assistant";
      content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }> = [];

    switch (testCase.contentType) {
      case "text":
        messages.push({
          role: "user",
          content: {
            type: "text",
            text: testCase.input.text || "Test text content",
          },
        });
        break;

      case "image":
        messages.push({
          role: "user",
          content: {
            type: "image",
            data:
              testCase.input.imageData ||
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
            mimeType: testCase.input.mimeType || "image/png",
          },
        });
        break;

      case "mixed":
        messages.push({
          role: "user",
          content: {
            type: "text",
            text: testCase.input.text || "Mixed content with text",
          },
        });
        messages.push({
          role: "user",
          content: {
            type: "image",
            data:
              testCase.input.imageData ||
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            mimeType: testCase.input.mimeType || "image/png",
          },
        });
        break;
    }

    return messages;
  }

  /**
   * Validate workflow state
   */
  private validateWorkflowState(
    state: Record<string, unknown>,
    validation: string,
  ): boolean {
    // Simple validation based on the validation string
    if (validation.includes("requestId")) {
      return !!state.lastRequestId;
    }
    if (validation.includes("approval")) {
      return !!state.lastApprovalResponse;
    }
    if (validation.includes("response")) {
      const approval = state.lastApprovalResponse as { response: unknown };
      return !!(approval && approval.response);
    }
    return true; // Default to valid for unknown validations
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

        if (
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
   * Check if sampling capability exists in the server
   */
  async validateSamplingSuite(suite: SamplingSuite): Promise<{
    valid: boolean;
    hasCapability: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const hasCapability = await this.runner.checkSamplingCapability();

      if (!hasCapability && (suite.requestTests?.length || 0) > 0) {
        errors.push(
          "Server does not support sampling capability but sampling tests are configured",
        );
      }

      return {
        valid: errors.length === 0,
        hasCapability,
        errors,
      };
    } catch (error) {
      errors.push(
        `Failed to validate sampling capability: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        valid: false,
        hasCapability: false,
        errors,
      };
    }
  }
}
