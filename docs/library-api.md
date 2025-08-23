# Library API

You can run evaluations programmatically.

```ts
import { evaluate } from "mcpvals";

const report = await evaluate("./mcp-eval.config.ts", {
  debug: process.env.CI === undefined,
  reporter: "json",
  llmJudge: true,
});

if (!report.passed) {
  process.exit(1);
}
```

### Re-exported Types

The library exports all configuration and result types for use in TypeScript projects:

**Configuration Types:**

- `Config`, `Workflow`, `WorkflowStep`, `ToolTest`, `ToolHealthSuite`
- `ResourceSuite`, `ResourceTest`, `ResourceDiscoveryTest`, `ResourceTemplateTest`, `ResourceSubscriptionTest`
- `PromptSuite`, `PromptTest`, `PromptArgumentTest`, `PromptTemplateTest`, `PromptSecurityTest`
- `SamplingSuite`, `SamplingCapabilityTest`, `SamplingRequestTest`, `SamplingSecurityTest`, `SamplingPerformanceTest`, `SamplingContentTest`, `SamplingWorkflowTest`
- `OAuth2TestSuite`, `AuthorizationCodeTest`, `ClientCredentialsTest`, `DeviceCodeTest`, `TokenManagementTest`, `PKCEValidationTest`, `ResourceIndicatorTest`, `MultiTenantTest`

**Result Types:**

- `EvaluationReport`, `WorkflowEvaluation`, `EvaluationResult`
- `ToolHealthResult`, `ToolTestResult`
- `ResourceSuiteResult`, `ResourceDiscoveryResult`, `ResourceTestResult`, `ResourceTemplateResult`, `ResourceSubscriptionResult`
- `PromptSuiteResult`, `PromptDiscoveryResult`, `PromptTestResult`, `PromptArgumentResult`, `PromptTemplateResult`, `PromptSecurityResult`
- `SamplingSuiteResult`, `SamplingCapabilityResult`, `SamplingRequestResult`, `SamplingSecurityResult`, `SamplingPerformanceResult`, `SamplingContentResult`, `SamplingWorkflowResult`
- `OAuth2SuiteResult`, `OAuth2TestResult`, `TokenManager`, `PKCEUtils`, `SecurityUtils`
- `runLlmJudge`, `LlmJudgeResult`

---
