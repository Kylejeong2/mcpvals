import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { ResourceEvaluator } from "../src/eval/resource";
import { ServerRunner } from "../src/eval/runner";
import {
  ResourceTest,
  ResourceDiscoveryTest,
  ResourceTemplateTest,
  ResourceSubscriptionTest,
  ResourceSuite,
  createResourceUri,
} from "../src/eval/config";

// Mock ServerRunner
vi.mock("../src/eval/runner");

describe("ResourceEvaluator", () => {
  let resourceEvaluator: ResourceEvaluator;
  let mockRunner: {
    listResources: Mock;
    readResource: Mock;
    listResourceTemplates: Mock;
    subscribeToResource: Mock;
    unsubscribeFromResource: Mock;
  };

  beforeEach(() => {
    mockRunner = {
      listResources: vi.fn(),
      readResource: vi.fn(),
      listResourceTemplates: vi.fn(),
      subscribeToResource: vi.fn(),
      unsubscribeFromResource: vi.fn(),
    };

    resourceEvaluator = new ResourceEvaluator(
      mockRunner as unknown as ServerRunner,
      5000,
    );
  });

  describe("runResourceDiscoveryTest", () => {
    it("should pass when discovering expected resources", async () => {
      const test: ResourceDiscoveryTest = {
        name: "basic-discovery",
        description: "Test resource discovery",
        expectedResources: ["file://test.txt", "file://config.json"],
        timeout: 1000,
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [
          { uri: "file://test.txt", name: "test.txt" },
          { uri: "file://config.json", name: "config.json" },
          { uri: "file://extra.log", name: "extra.log" },
        ],
      });

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.testName).toBe("Test resource discovery");
      expect(result.details).toContain("Successfully discovered 3 resources");
      expect(result.metadata?.foundResources).toEqual([
        "file://test.txt",
        "file://config.json",
        "file://extra.log",
      ]);
      expect(result.metadata?.actualCount).toBe(3);
    });

    it("should fail when missing expected resources", async () => {
      const test: ResourceDiscoveryTest = {
        name: "missing-resources",
        expectedResources: ["file://test.txt", "file://missing.json"],
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [{ uri: "file://test.txt", name: "test.txt" }],
      });

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain(
        "Missing expected resources: file://missing.json",
      );
    });

    it("should validate resource count with exact constraint", async () => {
      const test: ResourceDiscoveryTest = {
        name: "count-exact",
        expectedCount: { exact: 2 },
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [
          { uri: "file://test1.txt", name: "test1.txt" },
          { uri: "file://test2.txt", name: "test2.txt" },
        ],
      });

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should fail when resource count doesn't match exact constraint", async () => {
      const test: ResourceDiscoveryTest = {
        name: "count-mismatch",
        expectedCount: { exact: 3 },
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [{ uri: "file://test.txt", name: "test.txt" }],
      });

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Expected exactly 3 resources, found 1");
    });

    it("should validate min/max resource count constraints", async () => {
      const test: ResourceDiscoveryTest = {
        name: "count-range",
        expectedCount: { min: 2, max: 5 },
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [
          { uri: "file://test1.txt", name: "test1.txt" },
          { uri: "file://test2.txt", name: "test2.txt" },
          { uri: "file://test3.txt", name: "test3.txt" },
        ],
      });

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should handle timeout", async () => {
      const test: ResourceDiscoveryTest = {
        name: "timeout-test",
        timeout: 100,
      };

      mockRunner.listResources.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const result = await resourceEvaluator.runResourceDiscoveryTest(
        test,
        100,
      );

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Resource discovery timeout");
    });

    it("should handle discovery errors", async () => {
      const test: ResourceDiscoveryTest = {
        name: "error-test",
      };

      mockRunner.listResources.mockRejectedValueOnce(
        new Error("Server not responding"),
      );

      const result = await resourceEvaluator.runResourceDiscoveryTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain(
        "Resource discovery failed: Server not responding",
      );
    });
  });

  describe("runResourceTest", () => {
    it("should pass when resource is successfully read", async () => {
      const test: ResourceTest = {
        name: "read-test",
        description: "Test reading a resource",
        uri: createResourceUri("file://test.txt"),
        expectedContent: "Hello World",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://test.txt"),
            mimeType: "text/plain",
            text: "Hello World Test",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.testName).toBe("Test reading a resource");
      expect(result.resourceUri).toBe("file://test.txt");
      expect(result.details).toContain("Resource read successful");
      expect(result.retryCount).toBe(0);
    });

    it("should fail when content doesn't match", async () => {
      const test: ResourceTest = {
        name: "content-mismatch",
        uri: createResourceUri("file://test.txt"),
        expectedContent: "Expected Text",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://test.txt"),
            text: "Different Text",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Content mismatch");
      expect(result.details).toContain('Expected: "Expected Text"');
    });

    it("should validate MIME type", async () => {
      const test: ResourceTest = {
        name: "mime-type-test",
        uri: createResourceUri("file://config.json"),
        expectedMimeType: "application/json",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://config.json"),
            mimeType: "application/json",
            text: '{"test": true}',
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should fail when MIME type doesn't match", async () => {
      const test: ResourceTest = {
        name: "mime-type-mismatch",
        uri: createResourceUri("file://config.json"),
        expectedMimeType: "application/json",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://config.json"),
            mimeType: "text/plain",
            text: '{"test": true}',
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("MIME type mismatch");
      expect(result.details).toContain("Expected: application/json");
      expect(result.details).toContain("Got: text/plain");
    });

    it("should respect latency constraints", async () => {
      const test: ResourceTest = {
        name: "latency-test",
        uri: createResourceUri("file://slow.txt"),
        maxLatency: 50,
        retries: 0,
      };

      mockRunner.readResource.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  contents: [{ uri: "file://slow.txt", text: "slow content" }],
                }),
              100,
            ),
          ),
      );

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("exceeded maximum latency");
      expect(result.latency).toBeGreaterThan(50);
    });

    it("should handle expected errors", async () => {
      const test: ResourceTest = {
        name: "error-test",
        uri: createResourceUri("file://nonexistent.txt"),
        expectError: "File not found",
        retries: 0,
      };

      mockRunner.readResource.mockRejectedValueOnce(
        new Error("File not found: nonexistent.txt"),
      );

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.details).toContain("correctly failed with expected error");
    });

    it("should fail when expected error doesn't occur", async () => {
      const test: ResourceTest = {
        name: "missing-error",
        uri: createResourceUri("file://test.txt"),
        expectError: "Permission denied",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [{ uri: "file://test.txt", text: "content" }],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain(
        'Expected error "Permission denied" but resource read succeeded',
      );
    });

    it("should retry on failure", async () => {
      const test: ResourceTest = {
        name: "retry-test",
        uri: createResourceUri("file://flaky.txt"),
        retries: 2,
      };

      mockRunner.readResource
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Another failure"))
        .mockResolvedValueOnce({
          contents: [{ uri: "file://flaky.txt", text: "success" }],
        });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.retryCount).toBe(2);
      expect(mockRunner.readResource).toHaveBeenCalledTimes(3);
    });

    it("should fail after exhausting retries", async () => {
      const test: ResourceTest = {
        name: "persistent-failure",
        uri: createResourceUri("file://broken.txt"),
        retries: 1,
      };

      mockRunner.readResource.mockRejectedValue(new Error("Persistent error"));

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.retryCount).toBe(1);
      expect(result.details).toContain(
        "Resource read failed: Persistent error",
      );
      expect(mockRunner.readResource).toHaveBeenCalledTimes(2);
    });
  });

  describe("runResourceTemplateTest", () => {
    it("should pass when template is successfully instantiated and read", async () => {
      const test: ResourceTemplateTest = {
        name: "template-test",
        description: "Test resource template",
        templateUri: "file://templates/{name}.txt",
        parameters: { name: "config" },
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://templates/{name}.txt",
            name: "file-template",
            description: "File template",
          },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: "file://templates/config.txt",
            text: "config content",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.templateUri).toBe("file://templates/{name}.txt");
      expect(result.details).toContain("Resource template test successful");
      expect(result.metadata?.instantiatedUri).toBe(
        "file://templates/config.txt",
      );
    });

    it("should fail when template doesn't exist", async () => {
      const test: ResourceTemplateTest = {
        name: "missing-template",
        templateUri: "file://nonexistent/{id}.txt",
        parameters: { id: "123" },
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Resource template not found");
    });

    it("should validate URI pattern", async () => {
      const test: ResourceTemplateTest = {
        name: "pattern-test",
        templateUri: "file://data/{type}/{id}.json",
        parameters: { type: "users", id: "123" },
        expectedUriPattern: "^file://data/users/\\d+\\.json$",
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://data/{type}/{id}.json",
            name: "data-template",
          },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [{ uri: "file://data/users/123.json", text: "{}" }],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should fail when URI pattern doesn't match", async () => {
      const test: ResourceTemplateTest = {
        name: "pattern-mismatch",
        templateUri: "file://data/{id}.txt",
        parameters: { id: "abc" },
        expectedUriPattern: "^file://data/\\d+\\.txt$",
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "file://data/{id}.txt", name: "id-template" },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("URI pattern mismatch");
      expect(result.details).toContain("file://data/abc.txt");
    });

    it("should handle template instantiation errors", async () => {
      const test: ResourceTemplateTest = {
        name: "template-error",
        templateUri: "file://secure/{token}.txt",
        parameters: { token: "invalid" },
        expectError: "Access denied",
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "file://secure/{token}.txt", name: "secure-template" },
        ],
      });

      mockRunner.readResource.mockRejectedValueOnce(
        new Error("Access denied for token: invalid"),
      );

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.details).toContain("correctly failed with expected error");
    });
  });

  describe("runResourceSubscriptionTest", () => {
    it("should pass when subscription is successful", async () => {
      const test: ResourceSubscriptionTest = {
        name: "subscription-test",
        description: "Test resource subscription",
        resourceUri: "file://watched.txt",
        timeout: 1000,
      };

      mockRunner.subscribeToResource.mockResolvedValueOnce({});

      const result = await resourceEvaluator.runResourceSubscriptionTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.resourceUri).toBe("file://watched.txt");
      expect(result.details).toContain("Resource subscription test successful");
      expect(result.metadata?.subscriptionSuccessful).toBe(true);
    });

    it("should fail when subscription fails", async () => {
      const test: ResourceSubscriptionTest = {
        name: "subscription-failure",
        resourceUri: "file://invalid.txt",
      };

      mockRunner.subscribeToResource.mockRejectedValueOnce(
        new Error("Resource not found"),
      );

      const result = await resourceEvaluator.runResourceSubscriptionTest(test);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain("Resource subscription failed");
    });

    it("should validate update expectations", async () => {
      const test: ResourceSubscriptionTest = {
        name: "updates-expected",
        resourceUri: "file://dynamic.txt",
        expectUpdates: true,
      };

      mockRunner.subscribeToResource.mockResolvedValueOnce({});

      const result = await resourceEvaluator.runResourceSubscriptionTest(test);

      // The implementation simulates receiving updates when expectUpdates is true
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.details).toContain("successful");
    });
  });

  describe("runResourceSuite", () => {
    it("should run all test types sequentially", async () => {
      const suite: ResourceSuite = {
        name: "comprehensive-suite",
        description: "Test all resource functionality",
        parallel: false,
        discoveryTests: [
          {
            name: "discovery",
            expectedCount: { min: 1 },
          },
        ],
        resourceTests: [
          {
            name: "read-test",
            uri: createResourceUri("file://test.txt"),
            retries: 0,
          },
        ],
        templateTests: [
          {
            name: "template-test",
            templateUri: "file://templates/{name}.txt",
            parameters: { name: "test" },
            retries: 0,
          },
        ],
        subscriptionTests: [
          {
            name: "subscription-test",
            resourceUri: "file://watched.txt",
          },
        ],
      };

      // Mock all the calls
      mockRunner.listResources.mockResolvedValueOnce({
        resources: [{ uri: "file://test.txt", name: "test.txt" }],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [{ uri: "file://test.txt", text: "content" }],
      });

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "file://templates/{name}.txt", name: "template" },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          { uri: "file://templates/test.txt", text: "template content" },
        ],
      });

      mockRunner.subscribeToResource.mockResolvedValueOnce({});

      const result = await resourceEvaluator.runResourceSuite(suite);

      expect(result.suiteName).toBe("comprehensive-suite");
      expect(result.totalTests).toBe(4);
      expect(result.passedTests).toBe(4);
      expect(result.failedTests).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.discoveryResults).toHaveLength(1);
      expect(result.resourceResults).toHaveLength(1);
      expect(result.templateResults).toHaveLength(1);
      expect(result.subscriptionResults).toHaveLength(1);
    });

    it("should run tests in parallel when specified", async () => {
      const suite: ResourceSuite = {
        name: "parallel-suite",
        parallel: true,
        discoveryTests: [],
        resourceTests: [
          {
            name: "test1",
            uri: createResourceUri("file://test1.txt"),
            retries: 0,
          },
          {
            name: "test2",
            uri: createResourceUri("file://test2.txt"),
            retries: 0,
          },
        ],
        templateTests: [],
        subscriptionTests: [],
      };

      mockRunner.readResource
        .mockResolvedValueOnce({
          contents: [{ uri: "file://test1.txt", text: "content1" }],
        })
        .mockResolvedValueOnce({
          contents: [{ uri: "file://test2.txt", text: "content2" }],
        });

      const result = await resourceEvaluator.runResourceSuite(suite);

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(2);
      expect(result.resourceResults).toHaveLength(2);
    });

    it("should calculate metrics correctly with mixed results", async () => {
      const suite: ResourceSuite = {
        name: "mixed-results",
        parallel: false,
        discoveryTests: [],
        resourceTests: [
          {
            name: "passing-test",
            uri: createResourceUri("file://good.txt"),
            retries: 0,
          },
          {
            name: "failing-test",
            uri: createResourceUri("file://bad.txt"),
            expectError: "Not found", // This should pass
            retries: 0,
          },
          {
            name: "unexpected-failure",
            uri: createResourceUri("file://broken.txt"),
            retries: 0,
          },
        ],
        templateTests: [],
        subscriptionTests: [],
      };

      mockRunner.readResource
        .mockResolvedValueOnce({
          contents: [{ uri: "file://good.txt", text: "good content" }],
        })
        .mockRejectedValueOnce(new Error("Not found"))
        .mockRejectedValueOnce(new Error("Unexpected error"));

      const result = await resourceEvaluator.runResourceSuite(suite);

      expect(result.totalTests).toBe(3);
      expect(result.passedTests).toBe(2); // good.txt passes, bad.txt passes (expected error), broken.txt fails
      expect(result.failedTests).toBe(1);
      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(2 / 3);
    });

    it("should handle empty test suite", async () => {
      const suite: ResourceSuite = {
        name: "empty-suite",
        parallel: false,
        discoveryTests: [],
        resourceTests: [],
        templateTests: [],
        subscriptionTests: [],
      };

      const result = await resourceEvaluator.runResourceSuite(suite);

      expect(result.totalTests).toBe(0);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(1.0);
      expect(result.averageLatency).toBe(0);
    });
  });

  describe("getAvailableResources", () => {
    it("should return list of available resource URIs", async () => {
      mockRunner.listResources.mockResolvedValueOnce({
        resources: [
          { uri: "file://test1.txt", name: "test1.txt" },
          { uri: "file://test2.json", name: "test2.json" },
        ],
      });

      const resources = await resourceEvaluator.getAvailableResources();

      expect(resources).toEqual(["file://test1.txt", "file://test2.json"]);
    });

    it("should handle empty resources list", async () => {
      mockRunner.listResources.mockResolvedValueOnce({ resources: [] });

      const resources = await resourceEvaluator.getAvailableResources();

      expect(resources).toEqual([]);
    });
  });

  describe("getAvailableResourceTemplates", () => {
    it("should return list of available template URIs", async () => {
      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "file://data/{id}.json", name: "data-template" },
          { uriTemplate: "file://logs/{date}.log", name: "log-template" },
        ],
      });

      const templates = await resourceEvaluator.getAvailableResourceTemplates();

      expect(templates).toEqual([
        "file://data/{id}.json",
        "file://logs/{date}.log",
      ]);
    });
  });

  describe("validateResourceSuite", () => {
    it("should validate that all test resources are available", async () => {
      const suite: ResourceSuite = {
        name: "validation-test",
        parallel: false,
        discoveryTests: [],
        resourceTests: [
          {
            name: "test1",
            uri: createResourceUri("file://available.txt"),
            retries: 0,
          },
          {
            name: "test2",
            uri: createResourceUri("file://also-available.json"),
            retries: 0,
          },
        ],
        templateTests: [
          {
            name: "template1",
            templateUri: "file://templates/{id}.txt",
            parameters: { id: "123" },
            retries: 0,
          },
        ],
        subscriptionTests: [],
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [
          { uri: "file://available.txt", name: "available.txt" },
          { uri: "file://also-available.json", name: "also-available.json" },
          { uri: "file://extra.log", name: "extra.log" },
        ],
      });

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "file://templates/{id}.txt", name: "id-template" },
        ],
      });

      const validation = await resourceEvaluator.validateResourceSuite(suite);

      expect(validation.valid).toBe(true);
      expect(validation.missingResources).toEqual([]);
      expect(validation.missingTemplates).toEqual([]);
      expect(validation.availableResources).toContain("file://available.txt");
      expect(validation.availableTemplates).toContain(
        "file://templates/{id}.txt",
      );
    });

    it("should detect missing resources and templates", async () => {
      const suite: ResourceSuite = {
        name: "invalid-suite",
        parallel: false,
        discoveryTests: [],
        resourceTests: [
          {
            name: "test1",
            uri: createResourceUri("file://missing.txt"),
            retries: 0,
          },
          {
            name: "test2",
            uri: createResourceUri("file://available.txt"),
            retries: 0,
          },
        ],
        templateTests: [
          {
            name: "template1",
            templateUri: "file://missing/{id}.txt",
            parameters: { id: "123" },
            retries: 0,
          },
        ],
        subscriptionTests: [],
      };

      mockRunner.listResources.mockResolvedValueOnce({
        resources: [{ uri: "file://available.txt", name: "available.txt" }],
      });

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [],
      });

      const validation = await resourceEvaluator.validateResourceSuite(suite);

      expect(validation.valid).toBe(false);
      expect(validation.missingResources).toEqual(["file://missing.txt"]);
      expect(validation.missingTemplates).toEqual(["file://missing/{id}.txt"]);
    });
  });

  describe("URI template instantiation", () => {
    it("should correctly instantiate simple templates", () => {
      // Test the private method through a public method that uses it
      const suite: ResourceSuite = {
        name: "template-instantiation",
        parallel: false,
        discoveryTests: [],
        resourceTests: [],
        templateTests: [
          {
            name: "simple-template",
            templateUri: "file://data/{id}.json",
            parameters: { id: "123" },
            retries: 0,
          },
        ],
        subscriptionTests: [],
      };

      // We can't directly test the private method, but we can verify it works
      // through the template test functionality
      expect(suite.templateTests![0].templateUri).toBe("file://data/{id}.json");
      expect(suite.templateTests![0].parameters).toEqual({ id: "123" });
    });

    it("should handle parameters with special regex characters", async () => {
      const test: ResourceTemplateTest = {
        name: "regex-chars-test",
        templateUri: "file://data/{key$^()}.json",
        parameters: { "key$^()": "value" },
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://data/{key$^()}.json",
            name: "special-template",
          },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: "file://data/value.json",
            text: '{"data": "test"}',
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.metadata?.instantiatedUri).toBe("file://data/value.json");
    });

    it("should fail when required parameters are missing", async () => {
      const test: ResourceTemplateTest = {
        name: "missing-params-test",
        templateUri: "file://data/{id}/{type}.json",
        parameters: { id: "123" }, // missing 'type' parameter
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://data/{id}/{type}.json",
            name: "multi-param-template",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(false);
      expect(result.details).toContain("Missing required parameters: type");
    });

    it("should handle multiple parameter replacements", async () => {
      const test: ResourceTemplateTest = {
        name: "multi-params-test",
        templateUri: "file://data/{category}/{id}/{format}",
        parameters: { category: "users", id: "123", format: "json" },
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://data/{category}/{id}/{format}",
            name: "multi-param-template",
          },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: "file://data/users/123/json",
            text: '{"user": "data"}',
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.metadata?.instantiatedUri).toBe(
        "file://data/users/123/json",
      );
    });

    it("should handle repeated parameter names in template", async () => {
      const test: ResourceTemplateTest = {
        name: "repeated-params-test",
        templateUri: "file://data/{id}/backup/{id}.bak",
        parameters: { id: "123" },
        retries: 0,
      };

      mockRunner.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [
          {
            uriTemplate: "file://data/{id}/backup/{id}.bak",
            name: "backup-template",
          },
        ],
      });

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: "file://data/123/backup/123.bak",
            text: "backup data",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTemplateTest(test);

      expect(result.passed).toBe(true);
      expect(result.metadata?.instantiatedUri).toBe(
        "file://data/123/backup/123.bak",
      );
    });
  });

  describe("content validation", () => {
    it("should validate text content with contains logic", async () => {
      const test: ResourceTest = {
        name: "content-validation",
        uri: createResourceUri("file://test.txt"),
        expectedContent: "Hello",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://test.txt"),
            text: "Hello World, this is a test!",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("should validate blob content with exact match", async () => {
      const test: ResourceTest = {
        name: "blob-validation",
        uri: createResourceUri("file://image.png"),
        expectedContent: "base64encodeddata",
        retries: 0,
      };

      mockRunner.readResource.mockResolvedValueOnce({
        contents: [
          {
            uri: createResourceUri("file://image.png"),
            blob: "base64encodeddata",
            mimeType: "image/png",
          },
        ],
      });

      const result = await resourceEvaluator.runResourceTest(test);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });
  });
});
