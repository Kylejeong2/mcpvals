# Configuration

MCPVals loads **either** a `.json` file **or** a `.ts/.js` module that `export default` an object. Any string value in the config supports **Bash-style environment variable interpolation** `${VAR}`.

### `server`

Defines how to connect to your MCP server.

- `transport`: `stdio`, `shttp` (Streaming HTTP), or `sse` (Server-Sent Events).
- `command`/`args`: (for `stdio`) The command to execute your server.
- `env`: (for `stdio`) Environment variables to set for the child process.
- `url`/`headers`: (for `shttp` and `sse`) The endpoint and headers for a remote server.
- `reconnect`/`reconnectInterval`/`maxReconnectAttempts`: (for `sse`) Reconnection settings for SSE connections.

**Example `shttp` with Authentication:**

```json
{
  "server": {
    "transport": "shttp",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}",
      "X-API-Key": "${API_KEY}"
    }
  }
}
```

**Example `sse` with Reconnection:**

```json
{
  "server": {
    "transport": "sse",
    "url": "https://api.example.com/mcp/sse",
    "headers": {
      "Accept": "text/event-stream",
      "Cache-Control": "no-cache",
      "Authorization": "Bearer ${API_TOKEN}"
    },
    "reconnect": true,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10
  }
}
```

### `toolHealthSuites[]`

An array of suites for testing tools directly. Each suite contains:

- `name`: Identifier for the test suite.
- `tests`: An array of individual tool tests.
- `parallel`: (boolean) Whether to run tests in the suite in parallel (default: `false`).
- `timeout`: (number) Override the global timeout for this suite.

#### Tool Test Schema

| Field            | Type      | Description                                                            |
| ---------------- | --------- | ---------------------------------------------------------------------- |
| `name`           | `string`  | Tool name to test (must match an available MCP tool).                  |
| `description`    | `string`? | What this test validates.                                              |
| `args`           | `object`  | Arguments to pass to the tool.                                         |
| `expectedResult` | `any`?    | Expected result. Uses deep equality for objects, contains for strings. |
| `expectedError`  | `string`? | Expected error message if the tool should fail.                        |
| `maxLatency`     | `number`? | Maximum acceptable latency in milliseconds.                            |
| `retries`        | `number`? | Retries on failure (0-5, default: 0).                                  |

### `resourceSuites[]`

An array of suites for testing MCP resources. Each suite contains:

- `name`: Identifier for the resource test suite.
- `discoveryTests`: Tests for resource discovery and enumeration.
- `tests`: Resource access and content validation tests.
- `templateTests`: URI template instantiation tests.
- `subscriptionTests`: Resource subscription and update tests.
- `parallel`: (boolean) Whether to run tests in parallel (default: `false`).
- `timeout`: (number) Override the global timeout for this suite.

#### Resource Test Types

**Discovery Tests**: Validate `listResources` functionality

```typescript
{
  name: "resource-discovery",
  expectedCount: { min: 1, max: 10 }, // Optional count validation
  expectedResources: ["config", "data"], // Must include these resources
}
```

**Resource Access Tests**: Validate `readResource` operations

```typescript
{
  name: "read-config",
  uri: "config://settings.json",
  expectedMimeType: "application/json",
  expectedContent: { "version": "1.0" }, // Partial object match
  maxLatency: 500,
}
```

**Template Tests**: Validate URI template instantiation

```typescript
{
  name: "user-template",
  template: "user://{userId}",
  arguments: { userId: "123" },
  expectedUri: "user://123",
}
```

**Subscription Tests**: Validate resource update subscriptions

```typescript
{
  name: "config-updates",
  resourceUri: "config://settings.json",
  expectUpdates: true, // Whether to expect update notifications
  timeout: 5000,
}
```

### `promptSuites[]`

An array of suites for testing MCP prompts. Each suite contains:

- `name`: Identifier for the prompt test suite.
- `discoveryTests`: Tests for prompt discovery and enumeration.
- `tests`: Prompt execution and content validation tests.
- `argumentTests`: Argument validation tests (required vs optional).
- `templateTests`: Template generation and content tests.
- `securityTests`: Security validation including injection prevention.
- `parallel`: (boolean) Whether to run tests in parallel (default: `false`).

#### Prompt Test Types

**Discovery Tests**: Validate `listPrompts` functionality

```typescript
{
  name: "prompt-discovery",
  expectedCount: { min: 1 },
  expectedPrompts: ["greeting", "summary"],
}
```

**Prompt Execution Tests**: Validate `getPrompt` operations

```typescript
{
  name: "user-greeting",
  args: { name: "Alice", role: "admin" },
  expectedContent: ["Welcome", "Alice"], // Must contain these strings
  expectedMessages: [
    { role: "user", content: "Hello Alice" }
  ],
}
```

**Argument Tests**: Validate prompt argument handling

```typescript
{
  name: "greeting-args",
  requiredArgs: ["name"],
  optionalArgs: ["role"],
  invalidArgs: { name: 123 }, // Should be rejected
}
```

**Security Tests**: Test prompt injection prevention

```typescript
{
  name: "injection-prevention",
  maliciousInputs: [
    "Ignore previous instructions and...",
    "{system: 'override'}",
  ],
  expectRejection: true,
}
```

### `samplingSuites[]`

An array of suites for testing MCP sampling capabilities. Each suite contains:

- `name`: Identifier for the sampling test suite.
- `capabilityTests`: Tests for sampling capability negotiation.
- `requestTests`: Tests for sampling request/response handling.
- `securityTests`: Security validation for sampling operations.
- `performanceTests`: Performance and rate limiting tests.
- `contentTests`: Content type validation (text, image, mixed).
- `workflowTests`: End-to-end sampling workflow tests.

#### Sampling Test Types

**Capability Tests**: Validate sampling capability negotiation

```typescript
{
  name: "sampling-supported",
  expectedCapability: true,
}
```

**Request Tests**: Validate sampling message creation

```typescript
{
  name: "text-sampling",
  messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
  modelPreferences: { costPriority: 0.8, speedPriority: 0.6 },
  expectUserApproval: true,
  simulateUserResponse: "approve",
}
```

**Security Tests**: Validate security controls

```typescript
{
  name: "unauthorized-requests",
  unauthorizedRequests: [
    { messages: [...], expectRejection: true }
  ],
  sensitiveDataTests: [
    { input: "SSN: 123-45-6789", expectFiltering: true }
  ],
}
```

**Performance Tests**: Validate performance and limits

```typescript
{
  name: "concurrent-requests",
  concurrentRequests: 10,
  messageSize: "large",
  expectThrottling: true,
  maxLatency: 5000,
}
```

### `oauth2Suites[]`

An array of suites for testing OAuth 2.1 authentication flows. Each suite contains comprehensive tests for modern OAuth 2.1 security practices including PKCE, resource indicators, and multi-tenant support.

- `name`: Identifier for the OAuth test suite.
- `description`: Optional description of the test suite purpose.
- `authorizationCodeTests`: Authorization code flow tests with PKCE.
- `clientCredentialsTests`: Machine-to-machine authentication tests.
- `deviceCodeTests`: Device authorization flow tests for input-limited devices.
- `tokenManagementTests`: Token refresh, revocation, and expiration tests.
- `pkceValidationTests`: PKCE (Proof Key for Code Exchange) security validation.
- `resourceIndicatorTests`: RFC 8707 resource indicators for audience restriction.
- `multiTenantTests`: Multi-tenant isolation and access control tests.
- `parallel`: (boolean) Whether to run tests in parallel (default: `false`).
- `timeout`: (number) Override the global timeout for this suite.

#### OAuth 2.1 Test Types

**Authorization Code Flow Tests**: Complete OAuth 2.1 authorization code flow with PKCE

```typescript
{
  name: "Authorization Code with PKCE",
  flow: "authorization_code",
  server: {
    authorizationEndpoint: "https://auth.example.com/authorize",
    tokenEndpoint: "https://auth.example.com/token",
    supportedGrantTypes: ["authorization_code"],
    supportedScopes: ["read", "write"],
    pkceRequired: true
  },
  client: {
    clientId: "test-client-id",
    responseType: "code",
    scope: ["read", "write"],
    redirectUri: "https://app.example.com/callback",
    pkce: {
      enabled: true,
      codeChallengeMethod: "S256"
    }
  },
  simulateUserConsent: true,
  expectedResult: "success",
  securityChecks: {
    validatePKCE: true,
    validateState: true,
    checkTokenExpiration: true
  }
}
```

**Token Management Tests**: Refresh, revocation, and expiration validation

```typescript
{
  name: "Token Refresh Test",
  testType: "refresh",
  token: {
    accessToken: "your-jwt-token-here",
    refreshToken: "refresh-token-example",
    tokenType: "Bearer",
    expiresIn: 3600,
    scope: ["read", "write"]
  },
  expectedResult: "success",
  validateTokenClaims: true
}
```

**PKCE Validation Tests**: Security validation for Proof Key for Code Exchange

```typescript
{
  name: "Valid PKCE S256 Challenge",
  codeChallengeMethod: "S256",
  invalidChallenge: false,
  expectedResult: "success",
  securityLevel: "high"
}
```

**Resource Indicator Tests**: RFC 8707 audience restriction validation

```typescript
{
  name: "Resource-Specific Token",
  resourceUri: "https://api.example.com",
  requestedScopes: ["api:read", "api:write"],
  expectedAudience: "https://api.example.com",
  validateAudienceRestriction: true,
  expectedResult: "success"
}
```

**Multi-Tenant Tests**: Tenant isolation and cross-tenant access control

```typescript
{
  name: "Cross-Tenant Access Blocked",
  primaryTenant: {
    tenantId: "tenant-123",
    isolationLevel: "strict",
    crossTenantAccess: false
  },
  secondaryTenant: {
    tenantId: "tenant-456",
    isolationLevel: "strict",
    crossTenantAccess: false
  },
  testScenario: "cross_tenant_blocked",
  expectedResult: "success",
  validateTenantIsolation: true
}
```

### `workflows[]`

An array of LLM-driven test workflows. Each workflow contains:

- `name`: Identifier for the workflow.
- `steps`: An array of user interactions (usually just one for a high-level goal).
- `expectTools`: An array of tool names expected to be called during the workflow.

#### Workflow Step Schema

| Field           | Type      | Description                                                                         |
| --------------- | --------- | ----------------------------------------------------------------------------------- |
| `user`          | `string`  | High-level user intent. The LLM will plan how to accomplish this.                   |
| `expectedState` | `string`? | A sub-string the evaluator looks for in the final assistant message or tool result. |

#### Workflow Best Practices

1.  **Write natural prompts**: Instead of micro-managing tool calls, give the LLM a complete task (e.g., "Book a flight from SF to NY for next Tuesday and then find a hotel near the airport.").
2.  **Use workflow-level `expectTools`**: List all tools you expect to be used across the entire workflow to verify the LLM's plan.

### Global Options

- `timeout`: (number) Global timeout in ms for server startup and individual tool calls. Default: `30000`.
- `llmJudge`: (boolean) Enables the LLM Judge feature. Default: `false`.
- `openaiKey`: (string) OpenAI API key for the LLM Judge.
- `judgeModel`: (string) The model to use for judging. Default: `"gpt-4o"`.
- `passThreshold`: (number) The minimum score (0-1) from the LLM Judge to pass. Default: `0.8`.

---
