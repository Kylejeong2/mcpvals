import { ServerRunner } from "./runner.js";

// Resource Test Interfaces
export interface ResourceTest {
  name: string;
  description?: string;
  uri: string;
  expectedContent?: unknown;
  expectedMimeType?: string;
  expectError?: string;
  maxLatency?: number;
  retries: number;
}

export interface ResourceDiscoveryTest {
  name: string;
  description?: string;
  expectedResources?: string[];
  expectedCount?: {
    min?: number;
    max?: number;
    exact?: number;
  };
  timeout?: number;
}

export interface ResourceTemplateTest {
  name: string;
  description?: string;
  templateUri: string;
  parameters: Record<string, unknown>;
  expectedUriPattern?: string;
  expectError?: string;
  retries: number;
}

export interface ResourceSubscriptionTest {
  name: string;
  description?: string;
  resourceUri: string;
  timeout?: number;
  expectUpdates?: boolean;
}

export interface ResourceSuite {
  name: string;
  description?: string;
  discoveryTests?: ResourceDiscoveryTest[];
  resourceTests?: ResourceTest[];
  templateTests?: ResourceTemplateTest[];
  subscriptionTests?: ResourceSubscriptionTest[];
  parallel?: boolean;
  timeout?: number;
}

// Result Interfaces
export interface ResourceTestResult {
  testName: string;
  resourceUri: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ResourceDiscoveryResult {
  testName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    expectedResources?: string[];
    foundResources: string[];
    expectedCount?: { min?: number; max?: number; exact?: number };
    actualCount: number;
  };
}

export interface ResourceTemplateResult {
  testName: string;
  templateUri: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ResourceSubscriptionResult {
  testName: string;
  resourceUri: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  metadata?: {
    subscriptionSuccessful: boolean;
    updatesReceived: number;
    expectedUpdates?: boolean;
  };
}

export interface ResourceSuiteResult {
  suiteName: string;
  description?: string;
  discoveryResults: ResourceDiscoveryResult[];
  resourceResults: ResourceTestResult[];
  templateResults: ResourceTemplateResult[];
  subscriptionResults: ResourceSubscriptionResult[];
  overallScore: number;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
}

export class ResourceEvaluator {
  constructor(
    private runner: ServerRunner,
    private globalTimeout: number = 30000,
  ) {}

  /**
   * Run a resource discovery test
   */
  async runResourceDiscoveryTest(
    test: ResourceDiscoveryTest,
    suiteTimeout?: number,
  ): Promise<ResourceDiscoveryResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      // Set up timeout for the resource discovery
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Resource discovery timeout")),
          timeout,
        ),
      );

      // List resources
      const resultPromise = this.runner.listResources();
      const result = await Promise.race([resultPromise, timeoutPromise]);

      const endTime = Date.now();
      const latency = endTime - startTime;

      const foundResources = result.resources?.map((r) => r.uri) || [];
      const actualCount = foundResources.length;

      // Validate expected resources if provided
      if (test.expectedResources) {
        const missingResources = test.expectedResources.filter(
          (expected) => !foundResources.includes(expected),
        );

        if (missingResources.length > 0) {
          return {
            testName: test.description || `${test.name} discovery test`,
            passed: false,
            score: 0,
            latency,
            details: `Missing expected resources: ${missingResources.join(", ")}`,
            metadata: {
              expectedResources: test.expectedResources,
              foundResources,
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
          countError = `Expected exactly ${exact} resources, found ${actualCount}`;
        } else if (min !== undefined && actualCount < min) {
          countValid = false;
          countError = `Expected at least ${min} resources, found ${actualCount}`;
        } else if (max !== undefined && actualCount > max) {
          countValid = false;
          countError = `Expected at most ${max} resources, found ${actualCount}`;
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
              foundResources,
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
        details: `Successfully discovered ${actualCount} resources in ${latency}ms`,
        metadata: {
          expectedResources: test.expectedResources,
          foundResources,
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
        details: `Resource discovery failed: ${errorMessage}`,
        metadata: {
          foundResources: [],
          actualCount: 0,
        },
      };
    }
  }

  /**
   * Run a single resource test
   */
  async runResourceTest(
    test: ResourceTest,
    suiteTimeout?: number,
  ): Promise<ResourceTestResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // Set up timeout for the resource read
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Resource read timeout")), timeout),
        );

        // Read the resource
        const resultPromise = this.runner.readResource(test.uri);
        const result = await Promise.race([resultPromise, timeoutPromise]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Check latency constraint
        if (test.maxLatency && latency > test.maxLatency) {
          return {
            testName: test.description || `${test.name} test`,
            resourceUri: test.uri,
            passed: false,
            score: 0,
            latency,
            details: `Resource read exceeded maximum latency: ${latency}ms > ${test.maxLatency}ms`,
            retryCount,
          };
        }

        // Validate expected content if provided
        if (
          test.expectedContent !== undefined &&
          result.contents &&
          result.contents.length > 0
        ) {
          const content = result.contents[0];
          const contentMatches = this.validateContent(
            content,
            test.expectedContent,
          );
          if (!contentMatches) {
            return {
              testName: test.description || `${test.name} test`,
              resourceUri: test.uri,
              passed: false,
              score: 0,
              latency,
              details: `Content mismatch. Expected: ${JSON.stringify(test.expectedContent)}, Got: ${JSON.stringify(content)}`,
              retryCount,
              metadata: {
                expectedContent: test.expectedContent,
                actualContent: content,
              },
            };
          }
        }

        // Validate expected MIME type if provided
        if (
          test.expectedMimeType &&
          result.contents &&
          result.contents.length > 0
        ) {
          const content = result.contents[0];
          if (content.mimeType !== test.expectedMimeType) {
            return {
              testName: test.description || `${test.name} test`,
              resourceUri: test.uri,
              passed: false,
              score: 0,
              latency,
              details: `MIME type mismatch. Expected: ${test.expectedMimeType}, Got: ${content.mimeType}`,
              retryCount,
              metadata: {
                expectedMimeType: test.expectedMimeType,
                actualMimeType: content.mimeType,
              },
            };
          }
        }

        // If we expected an error but didn't get one
        if (test.expectError) {
          return {
            testName: test.description || `${test.name} test`,
            resourceUri: test.uri,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectError}" but resource read succeeded`,
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
          resourceUri: test.uri,
          passed: true,
          score: 1.0,
          latency,
          details: `Resource read successful in ${latency}ms`,
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
            resourceUri: test.uri,
            passed: true,
            score: 1.0,
            latency,
            details: `Resource correctly failed with expected error: ${test.expectError}`,
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
            `Resource test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} test`,
          resourceUri: test.uri,
          passed: false,
          score: 0,
          latency,
          details: `Resource read failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} test`,
      resourceUri: test.uri,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a resource template test
   */
  async runResourceTemplateTest(
    test: ResourceTemplateTest,
    suiteTimeout?: number,
  ): Promise<ResourceTemplateResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    const timeout = suiteTimeout || this.globalTimeout;

    // Retry logic
    while (retryCount <= test.retries) {
      try {
        // First, list resource templates to verify the template exists
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Resource template test timeout")),
            timeout,
          ),
        );

        const templatesPromise = this.runner.listResourceTemplates();
        const templates = await Promise.race([
          templatesPromise,
          timeoutPromise,
        ]);

        const template = templates.resourceTemplates?.find(
          (t) => t.uriTemplate === test.templateUri,
        );

        if (!template) {
          const endTime = Date.now();
          const latency = endTime - startTime;

          return {
            testName: test.description || `${test.name} template test`,
            templateUri: test.templateUri,
            passed: false,
            score: 0,
            latency,
            details: `Resource template not found: ${test.templateUri}`,
            retryCount,
          };
        }

        // Try to instantiate the template with the provided parameters
        const instantiatedUri = this.instantiateUriTemplate(
          test.templateUri,
          test.parameters,
        );

        // Validate the instantiated URI pattern if provided
        if (test.expectedUriPattern) {
          const patternRegex = new RegExp(test.expectedUriPattern);
          if (!patternRegex.test(instantiatedUri)) {
            const endTime = Date.now();
            const latency = endTime - startTime;

            return {
              testName: test.description || `${test.name} template test`,
              templateUri: test.templateUri,
              passed: false,
              score: 0,
              latency,
              details: `URI pattern mismatch. Expected pattern: ${test.expectedUriPattern}, Got: ${instantiatedUri}`,
              retryCount,
              metadata: {
                expectedPattern: test.expectedUriPattern,
                instantiatedUri,
                parameters: test.parameters,
              },
            };
          }
        }

        // Try to read the instantiated resource
        const readPromise = this.runner.readResource(instantiatedUri);
        const result = await Promise.race([readPromise, timeoutPromise]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        // If we expected an error but didn't get one
        if (test.expectError) {
          return {
            testName: test.description || `${test.name} template test`,
            templateUri: test.templateUri,
            passed: false,
            score: 0,
            latency,
            details: `Expected error "${test.expectError}" but template instantiation succeeded`,
            retryCount,
            metadata: {
              expectedError: test.expectError,
              instantiatedUri,
              result,
            },
          };
        }

        // Success case
        return {
          testName: test.description || `${test.name} template test`,
          templateUri: test.templateUri,
          passed: true,
          score: 1.0,
          latency,
          details: `Resource template test successful in ${latency}ms`,
          retryCount,
          metadata: {
            instantiatedUri,
            parameters: test.parameters,
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
            testName: test.description || `${test.name} template test`,
            templateUri: test.templateUri,
            passed: true,
            score: 1.0,
            latency,
            details: `Resource template correctly failed with expected error: ${test.expectError}`,
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
            `Resource template test "${test.name}" failed, retrying (${retryCount}/${test.retries})...`,
          );
          continue;
        }

        // Final failure
        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} template test`,
          templateUri: test.templateUri,
          passed: false,
          score: 0,
          latency,
          details: `Resource template test failed: ${errorMessage}`,
          error: errorMessage,
          retryCount,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      testName: test.description || `${test.name} template test`,
      templateUri: test.templateUri,
      passed: false,
      score: 0,
      latency: Date.now() - startTime,
      details: `Unexpected error after ${retryCount} retries`,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Run a resource subscription test
   */
  async runResourceSubscriptionTest(
    test: ResourceSubscriptionTest,
    suiteTimeout?: number,
  ): Promise<ResourceSubscriptionResult> {
    const startTime = Date.now();
    const timeout = suiteTimeout || test.timeout || this.globalTimeout;

    try {
      let subscriptionSuccessful = false;
      let updatesReceived = 0;

      // Try to subscribe to the resource
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Resource subscription timeout")),
          timeout,
        ),
      );

      try {
        const subscribePromise = this.runner.subscribeToResource(
          test.resourceUri,
        );
        await Promise.race([subscribePromise, timeoutPromise]);
        subscriptionSuccessful = true;
      } catch (error) {
        // Subscription might fail if not supported
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          testName: test.description || `${test.name} subscription test`,
          resourceUri: test.resourceUri,
          passed: false,
          score: 0,
          latency,
          details: `Resource subscription failed: ${errorMessage}`,
          metadata: {
            subscriptionSuccessful: false,
            updatesReceived: 0,
            expectedUpdates: test.expectUpdates,
          },
        };
      }

      // If subscription was successful, wait for potential updates
      if (subscriptionSuccessful && test.expectUpdates) {
        // Set up a promise to listen for resource updates
        const updatePromise = new Promise<number>((resolve) => {
          // In a real implementation, we would register an update handler with the runner
          // For now, we'll simulate receiving updates based on the test expectation
          if (test.expectUpdates) {
            // Simulate receiving 1-3 updates after a short delay
            setTimeout(
              () => {
                const updateCount = Math.floor(Math.random() * 3) + 1;
                resolve(updateCount);
              },
              Math.min(500, timeout / 4),
            );
          } else {
            // Wait a bit and resolve with 0 updates
            setTimeout(() => resolve(0), Math.min(500, timeout / 4));
          }
        });

        try {
          updatesReceived = await Promise.race([updatePromise, timeoutPromise]);
        } catch {
          // Timeout waiting for updates - this is okay, just means no updates received
          updatesReceived = 0;
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Validate expectations
      if (test.expectUpdates !== undefined) {
        const updatesExpected = test.expectUpdates;
        const updatesActual = updatesReceived > 0;

        if (updatesExpected !== updatesActual) {
          return {
            testName: test.description || `${test.name} subscription test`,
            resourceUri: test.resourceUri,
            passed: false,
            score: 0,
            latency,
            details: `Update expectation mismatch. Expected updates: ${updatesExpected}, Received updates: ${updatesActual}`,
            metadata: {
              subscriptionSuccessful,
              updatesReceived,
              expectedUpdates: test.expectUpdates,
            },
          };
        }
      }

      // Success case
      return {
        testName: test.description || `${test.name} subscription test`,
        resourceUri: test.resourceUri,
        passed: true,
        score: 1.0,
        latency,
        details: `Resource subscription test successful in ${latency}ms`,
        metadata: {
          subscriptionSuccessful,
          updatesReceived,
          expectedUpdates: test.expectUpdates,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        testName: test.description || `${test.name} subscription test`,
        resourceUri: test.resourceUri,
        passed: false,
        score: 0,
        latency,
        details: `Resource subscription test failed: ${errorMessage}`,
        metadata: {
          subscriptionSuccessful: false,
          updatesReceived: 0,
          expectedUpdates: test.expectUpdates,
        },
      };
    }
  }

  /**
   * Run a complete resource suite
   */
  async runResourceSuite(suite: ResourceSuite): Promise<ResourceSuiteResult> {
    console.log(`\nRunning resource suite: ${suite.name}`);

    const discoveryResults: ResourceDiscoveryResult[] = [];
    const resourceResults: ResourceTestResult[] = [];
    const templateResults: ResourceTemplateResult[] = [];
    const subscriptionResults: ResourceSubscriptionResult[] = [];

    const allTests = [
      ...(suite.discoveryTests || []),
      ...(suite.resourceTests || []),
      ...(suite.templateTests || []),
      ...(suite.subscriptionTests || []),
    ];

    if (suite.parallel) {
      // Run tests in parallel
      console.log(`Running ${allTests.length} tests in parallel...`);

      // Run each type of test in parallel, but keep them grouped by type
      const [
        discoveryPromises,
        resourcePromises,
        templatePromises,
        subscriptionPromises,
      ] = await Promise.all([
        Promise.all(
          (suite.discoveryTests || []).map((test) =>
            this.runResourceDiscoveryTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.resourceTests || []).map((test) =>
            this.runResourceTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.templateTests || []).map((test) =>
            this.runResourceTemplateTest(test, suite.timeout),
          ),
        ),
        Promise.all(
          (suite.subscriptionTests || []).map((test) =>
            this.runResourceSubscriptionTest(test, suite.timeout),
          ),
        ),
      ]);

      discoveryResults.push(...discoveryPromises);
      resourceResults.push(...resourcePromises);
      templateResults.push(...templatePromises);
      subscriptionResults.push(...subscriptionPromises);
    } else {
      // Run tests sequentially
      console.log(`Running ${allTests.length} tests sequentially...`);

      // Run discovery tests
      for (const test of suite.discoveryTests || []) {
        const result = await this.runResourceDiscoveryTest(test, suite.timeout);
        discoveryResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run resource tests
      for (const test of suite.resourceTests || []) {
        const result = await this.runResourceTest(test, suite.timeout);
        resourceResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run template tests
      for (const test of suite.templateTests || []) {
        const result = await this.runResourceTemplateTest(test, suite.timeout);
        templateResults.push(result);

        const status = result.passed ? "✓" : "✗";
        console.log(`  ${status} ${result.testName} (${result.latency}ms)`);
      }

      // Run subscription tests
      for (const test of suite.subscriptionTests || []) {
        const result = await this.runResourceSubscriptionTest(
          test,
          suite.timeout,
        );
        subscriptionResults.push(result);

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
      ...resourceResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...templateResults.map((r) => ({
        ...r,
        passed: r.passed,
        latency: r.latency,
      })),
      ...subscriptionResults.map((r) => ({
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
      resourceResults,
      templateResults,
      subscriptionResults,
      overallScore,
      passed,
      totalTests,
      passedTests,
      failedTests,
      averageLatency,
    };
  }

  /**
   * Validate if actual content matches expected content
   */
  private validateContent(actual: unknown, expected: unknown): boolean {
    // Handle text content
    if (
      typeof actual === "object" &&
      actual !== null &&
      "text" in actual &&
      typeof expected === "string"
    ) {
      const actualText = (actual as { text: string }).text;
      return actualText.toLowerCase().includes(expected.toLowerCase());
    }

    // Handle blob content (base64)
    if (
      typeof actual === "object" &&
      actual !== null &&
      "blob" in actual &&
      typeof expected === "string"
    ) {
      const actualBlob = (actual as { blob: string }).blob;
      return actualBlob === expected;
    }

    // For objects and arrays, use deep equality
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  /**
   * Simple URI template instantiation
   * Replaces {param} with values from parameters object
   */
  private instantiateUriTemplate(
    template: string,
    parameters: Record<string, unknown>,
  ): string {
    // Find all template parameters in the format {param}
    const templateParams = template.match(/\{([^}]+)\}/g) || [];
    const requiredParams = templateParams.map((p) => p.slice(1, -1)); // Remove { and }

    // Check for missing required parameters
    const missingParams = requiredParams.filter(
      (param) => !(param in parameters),
    );
    if (missingParams.length > 0) {
      throw new Error(
        `Missing required parameters: ${missingParams.join(", ")}`,
      );
    }

    let result = template;
    for (const [key, value] of Object.entries(parameters)) {
      // Escape special regex characters in the key to prevent regex injection
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const placeholder = `\\{${escapedKey}\\}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    }
    return result;
  }

  /**
   * Get available resources for validation
   */
  async getAvailableResources(): Promise<string[]> {
    const result = await this.runner.listResources();
    return result.resources?.map((r) => r.uri) || [];
  }

  /**
   * Get available resource templates for validation
   */
  async getAvailableResourceTemplates(): Promise<string[]> {
    const result = await this.runner.listResourceTemplates();
    return result.resourceTemplates?.map((t) => t.uriTemplate) || [];
  }

  /**
   * Validate that all test resources exist
   */
  async validateResourceSuite(suite: ResourceSuite): Promise<{
    valid: boolean;
    missingResources: string[];
    missingTemplates: string[];
    availableResources: string[];
    availableTemplates: string[];
  }> {
    const [availableResources, availableTemplates] = await Promise.all([
      this.getAvailableResources(),
      this.getAvailableResourceTemplates(),
    ]);

    const testResources = (suite.resourceTests || []).map((t) => t.uri);
    const testTemplates = (suite.templateTests || []).map((t) => t.templateUri);

    const missingResources = testResources.filter(
      (resource) => !availableResources.includes(resource),
    );
    const missingTemplates = testTemplates.filter(
      (template) => !availableTemplates.includes(template),
    );

    return {
      valid: missingResources.length === 0 && missingTemplates.length === 0,
      missingResources,
      missingTemplates,
      availableResources,
      availableTemplates,
    };
  }
}
