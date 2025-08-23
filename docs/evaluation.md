# Evaluation & Metrics

### 5.1 Tool Health Metrics

When running tool health tests, the following is assessed for each test:

- **Result Correctness**: Does the output match `expectedResult`?
- **Error Correctness**: If `expectedError` is set, did the tool fail with a matching error?
- **Latency**: Did the tool respond within `maxLatency`?
- **Success**: Did the tool call complete without unexpected errors?

### 5.2 Resource Evaluation Metrics

For resource tests, the following is assessed:

- **Discovery Metrics**: Resource count validation, expected resource presence
- **Access Metrics**: Successful resource reading, MIME type validation, content correctness
- **Template Metrics**: URI template instantiation, parameter substitution accuracy
- **Subscription Metrics**: Update notification handling, subscription lifecycle management
- **Performance Metrics**: Response latency, retry success rates

### 5.3 Prompt Evaluation Metrics

For prompt tests, the following is assessed:

- **Discovery Metrics**: Prompt availability and enumeration
- **Execution Metrics**: Prompt generation success, content validation, message structure
- **Argument Metrics**: Required/optional parameter handling, validation correctness
- **Template Metrics**: Dynamic content generation, parameter substitution
- **Security Metrics**: Injection prevention, input sanitization effectiveness

### 5.4 Sampling Evaluation Metrics

For sampling tests, the following is assessed:

- **Capability Metrics**: Sampling support detection and negotiation
- **Request Metrics**: Message creation, model preference handling, approval workflows
- **Security Metrics**: Unauthorized request blocking, sensitive data filtering, privacy protection
- **Performance Metrics**: Concurrent request handling, rate limiting, latency management
- **Content Metrics**: Text/image/mixed content validation, format handling

### 5.5 OAuth 2.1 Evaluation Metrics

For OAuth 2.1 authentication tests, the following is assessed:

- **Flow Completion Metrics**: Successful completion of authorization code, client credentials, and device code flows
- **PKCE Security Metrics**: Code challenge/verifier validation, S256 method enforcement, replay attack prevention
- **Token Management Metrics**: Token refresh success, revocation effectiveness, expiration validation
- **Security Validation Metrics**: State parameter validation, nonce verification, audience restriction compliance
- **Multi-Tenant Metrics**: Tenant isolation enforcement, cross-tenant access blocking, tenant switching validation
- **Resource Indicator Metrics**: RFC 8707 compliance, audience restriction, scope validation
- **Performance Metrics**: Token endpoint latency, authorization flow completion time, concurrent request handling

### 5.6 Workflow Metrics (Deterministic)

For each workflow, a trace of the LLM interaction is recorded and evaluated against 3 metrics:

| #   | Metric                | Pass Criteria                                                               |
| --- | --------------------- | --------------------------------------------------------------------------- |
| 1   | End-to-End Success    | `expectedState` is found in the final response.                             |
| 2   | Tool Invocation Order | The tools listed in `expectTools` were called in the exact order specified. |
| 3   | Tool Call Health      | All tool calls completed successfully (no errors, HTTP 2xx, etc.).          |

The overall score is an arithmetic mean. The **evaluation fails** if _any_ metric fails.

### 5.7 LLM Judge (Optional)

Add subjective grading when deterministic checks are not enough (e.g., checking tone, or conversational quality).

- Set `"llmJudge": true` in the config and provide an OpenAI key.
- Use the `--llm-judge` CLI flag.

The judge asks the specified `judgeModel` for a score and a reason. A 4th metric, _LLM Judge_, is added to the workflow results, which passes if `score >= passThreshold`.

---
