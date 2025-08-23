# Quick Start

### 1. Installation

```bash
# Install – pick your favourite package manager
pnpm add -D mcpvals            # dev-dependency is typical
```

### 2. Create a config file

Create a config file (e.g., `mcp-eval.config.ts`):

```typescript
import type { Config } from "mcpvals";

export default {
  server: {
    transport: "stdio",
    command: "node",
    args: ["./example/simple-mcp-server.js"],
  },

  // Test individual tools directly
  toolHealthSuites: [
    {
      name: "Calculator Health Tests",
      tests: [
        {
          name: "add",
          args: { a: 5, b: 3 },
          expectedResult: 8,
          maxLatency: 500,
        },
        {
          name: "divide",
          args: { a: 10, b: 0 },
          expectedError: "division by zero",
        },
      ],
    },
  ],

  // Test resources (data and context)
  resourceSuites: [
    {
      name: "Data Access Tests",
      tests: [
        {
          name: "read-config",
          uri: "config://settings",
          expectedMimeType: "application/json",
          maxLatency: 1000,
        },
      ],
    },
  ],

  // Test prompts (templates and workflows)
  promptSuites: [
    {
      name: "Prompt Template Tests",
      tests: [
        {
          name: "user-greeting",
          args: { name: "Alice", role: "admin" },
          expectedContent: ["Welcome", "Alice"],
        },
      ],
    },
  ],

  // Test sampling (LLM requests from server)
  samplingSuites: [
    {
      name: "AI Capability Tests",
      capabilityTests: [
        {
          name: "sampling-supported",
          expectedCapability: true,
        },
      ],
    },
  ],

  // Test OAuth 2.1 authentication flows
  oauth2Suites: [
    {
      name: "OAuth Security Tests",
      authorizationCodeTests: [
        {
          name: "Authorization Code with PKCE",
          flow: "authorization_code",
          server: {
            authorizationEndpoint: "https://auth.example.com/authorize",
            tokenEndpoint: "https://auth.example.com/token",
            supportedGrantTypes: ["authorization_code"],
            supportedScopes: ["read", "write"],
            pkceRequired: true,
          },
          client: {
            clientId: "test-client-id",
            responseType: "code",
            scope: ["read", "write"],
            redirectUri: "https://app.example.com/callback",
            pkce: { enabled: true, codeChallengeMethod: "S256" },
          },
          simulateUserConsent: true,
          expectedResult: "success",
        },
      ],
    },
  ],

  // Test multi-step, LLM-driven workflows
  workflows: [
    {
      name: "Multi-step Calculation",
      steps: [
        {
          user: "Calculate (5 + 3) * 2, then divide by 4",
          expectedState: "4",
        },
      ],
      expectTools: ["add", "multiply", "divide"],
    },
  ],

  // Optional LLM judge
  llmJudge: true,
  openaiKey: process.env.OPENAI_API_KEY,
  passThreshold: 0.8,
} satisfies Config;
```

### 3. Run Evaluation

```bash
# Required for workflow execution
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional for LLM judge
export OPENAI_API_KEY="sk-..."

# Run everything
npx mcpvals eval mcp-eval.config.ts

# Run only tool health tests
npx mcpvals eval mcp-eval.config.ts --tool-health-only

# Run only resource evaluation tests
npx mcpvals eval mcp-eval.config.ts --resources-only

# Run only prompt evaluation tests
npx mcpvals eval mcp-eval.config.ts --prompts-only

# Run only sampling evaluation tests
npx mcpvals eval mcp-eval.config.ts --sampling-only

# Run only OAuth 2.1 authentication tests
npx mcpvals eval mcp-eval.config.ts --oauth-only

# Run with LLM judge and save report
npx mcpvals eval mcp-eval.config.ts --llm-judge --reporter json > report.json
```

---
