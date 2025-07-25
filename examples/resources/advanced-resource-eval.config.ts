import { Config } from "../../src/eval/config.js";

const config: Config = {
  server: {
    transport: "stdio",
    command: "node",
    args: ["./servers/simple-mcp-server.js"],
    env: {
      DEBUG: "true",
      LOG_LEVEL: "info",
    },
  },
  workflows: [],
  toolHealthSuites: [],
  promptSuites: [],
  samplingSuites: [],
  resourceSuites: [
    {
      name: "comprehensive-resource-evaluation",
      description: "Comprehensive test of all resource capabilities",
      parallel: false,
      timeout: 15000,
      discoveryTests: [
        {
          name: "resource-discovery",
          description: "Discover all available resources",
          expectedCount: {
            min: 1,
            max: 100,
          },
          timeout: 5000,
        },
        {
          name: "expected-core-files",
          description: "Verify core project files are available",
          expectedResources: [
            "file://package.json",
            "file://README.md",
            "file://tsconfig.json",
          ],
        },
      ],
      resourceTests: [
        {
          name: "package-json-content",
          description: "Validate package.json structure and content",
          uri: "file://package.json",
          expectedContent: "mcpvals",
          expectedMimeType: "application/json",
          maxLatency: 2000,
          retries: 2,
        },
        {
          name: "readme-markdown",
          description: "Read README.md file",
          uri: "file://README.md",
          expectedContent: "evaluation",
          expectedMimeType: "text/markdown",
          retries: 1,
        },
        {
          name: "typescript-config",
          description: "Access TypeScript configuration",
          uri: "file://tsconfig.json",
          expectedContent: "compilerOptions",
          expectedMimeType: "application/json",
          retries: 1,
        },
        {
          name: "binary-file-access",
          description: "Test binary file handling",
          uri: "file://node_modules/.bin/tsc",
          maxLatency: 3000,
          retries: 0,
        },
        {
          name: "nested-file-access",
          description: "Access nested directory files",
          uri: "file://src/eval/index.ts",
          expectedContent: "evaluate",
          expectedMimeType: "text/typescript",
          retries: 1,
        },
      ],
      templateTests: [
        {
          name: "source-file-template",
          description: "Test source file template access",
          templateUri: "file://src/{module}/{file}.ts",
          parameters: {
            module: "eval",
            file: "index",
          },
          expectedUriPattern: "^file://src/eval/index\\.ts$",
          retries: 1,
        },
        {
          name: "test-file-template",
          description: "Test file template with path parameters",
          templateUri: "file://tests/{name}.test.ts",
          parameters: {
            name: "config",
          },
          expectedUriPattern: "^file://tests/\\w+\\.test\\.ts$",
          retries: 1,
        },
        {
          name: "dynamic-path-template",
          description: "Test dynamic path generation",
          templateUri: "file://{base}/{type}/{name}.{ext}",
          parameters: {
            base: "src",
            type: "eval",
            name: "runner",
            ext: "ts",
          },
          retries: 0,
        },
      ],
      subscriptionTests: [
        {
          name: "watch-package-json",
          description: "Subscribe to package.json changes",
          resourceUri: "file://package.json",
          timeout: 3000,
          expectUpdates: false,
        },
        {
          name: "watch-source-file",
          description: "Subscribe to source file changes",
          resourceUri: "file://src/eval/index.ts",
          timeout: 2000,
          expectUpdates: false,
        },
      ],
    },
    {
      name: "error-scenarios",
      description: "Test error handling and edge cases",
      parallel: true,
      discoveryTests: [],
      templateTests: [
        {
          name: "missing-template",
          description: "Test missing template handling",
          templateUri: "file://nonexistent/{param}.txt",
          parameters: { param: "test" },
          expectError: "template",
          retries: 0,
        },
        {
          name: "missing-parameters",
          description: "Test incomplete parameter substitution",
          templateUri: "file://templates/{required}/{optional}.txt",
          parameters: { required: "test" },
          expectError: "parameter",
          retries: 0,
        },
      ],
      subscriptionTests: [],
      resourceTests: [
        {
          name: "file-not-found",
          description: "Test 404 handling",
          uri: "file://does-not-exist.txt",
          expectError: "not found",
          retries: 0,
        },
        {
          name: "permission-denied",
          description: "Test permission error handling",
          uri: "file:///root/.bashrc",
          expectError: "permission",
          retries: 0,
        },
        {
          name: "invalid-uri-scheme",
          description: "Test invalid URI scheme",
          uri: "invalid://test.txt",
          expectError: "scheme",
          retries: 0,
        },
        {
          name: "malformed-uri",
          description: "Test malformed URI handling",
          uri: "file://[invalid-uri]",
          expectError: "uri",
          retries: 0,
        },
      ],
    },
    {
      name: "performance-benchmarks",
      description: "Resource access performance benchmarks",
      parallel: true,
      discoveryTests: [],
      templateTests: [],
      subscriptionTests: [],
      resourceTests: [
        {
          name: "fast-small-file",
          description: "Small file read performance",
          uri: "file://package.json",
          maxLatency: 100,
          retries: 0,
        },
        {
          name: "medium-file-read",
          description: "Medium file read performance",
          uri: "file://README.md",
          maxLatency: 200,
          retries: 0,
        },
        {
          name: "concurrent-read-1",
          uri: "file://tsconfig.json",
          maxLatency: 500,
          retries: 0,
        },
        {
          name: "concurrent-read-2",
          uri: "file://package.json",
          maxLatency: 500,
          retries: 0,
        },
        {
          name: "concurrent-read-3",
          uri: "file://README.md",
          maxLatency: 500,
          retries: 0,
        },
      ],
    },
  ],
  timeout: 30000,
  llmJudge: false,
  judgeModel: "gpt-4o",
  passThreshold: 0.7,
};

export default config;
