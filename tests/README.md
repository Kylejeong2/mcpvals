# MCPVals Library Test Suite

This directory contains comprehensive tests for the MCPVals library, organized by test type for better maintainability and development workflow.

## Test Organization

### Unit Tests (`unit/`)

Fast, isolated tests that focus on individual components without external dependencies.

#### Core Components (`unit/core/`)

- **`config.test.ts`** - Configuration loading, validation, and schema parsing
- **`trace.test.ts`** - TraceStore operations and data management

#### Evaluators (`unit/evaluators/`)

- **`deterministic.test.ts`** - DeterministicEvaluator metrics and logic
- **`llm-judge.test.ts`** - LLM judge evaluation functionality

#### Infrastructure (`unit/infrastructure/`)

- **`sse-validation.test.ts`** - SSE transport validation and configuration

#### Reporters (`unit/reporters/`)

- **`console.test.ts`** - Console output formatting and display

### Integration Tests (`integration/`)

Tests that verify component interactions using mocked external dependencies.

- **`evaluate.test.ts`** - Main evaluation pipeline integration
- **`runner.test.ts`** - ServerRunner with mocked MCP servers
- **`tool-health.test.ts`** - Tool health testing with mocked tools
- **`resource.test.ts`** - Resource evaluation with mocked resources
- **`prompt.test.ts`** - Prompt evaluation with mocked prompts
- **`sampling.test.ts`** - Sampling evaluation with mocked sampling
- **`oauth.test.ts`** - OAuth authentication flow testing

### End-to-End Tests (`e2e/`)

Full system tests with real external dependencies (when possible).

- **`integration.test.ts`** - Complete evaluation scenarios with real configurations

### CLI Tests (`cli/`)

Command-line interface specific tests.

- **`cli.test.ts`** - CLI command parsing and execution
- **`eval.test.ts`** - Evaluation command integration

### Test Fixtures (`fixtures/`)

Shared test data, mock responses, and configuration files.

## Test Coverage Areas

### Configuration Management

- ✅ JSON and TypeScript config loading
- ✅ Environment variable substitution
- ✅ Schema validation with Zod
- ✅ Error handling for malformed configs

### Server Management

- ✅ Stdio and HTTP transport initialization
- ✅ Connection establishment and cleanup
- ✅ Tool listing and calling
- ✅ Process lifecycle management

### Evaluation Metrics

- ✅ End-to-end success detection
- ✅ Tool invocation order validation
- ✅ Tool call health assessment
- ✅ LLM judge integration
- ✅ Scoring and pass/fail determination

### Tool Health Testing

- ✅ Individual tool test execution
- ✅ Expected result validation
- ✅ Error condition testing
- ✅ Retry logic and timeout handling
- ✅ Parallel and sequential execution
- ✅ Latency measurement

### Workflow Execution

- ✅ Multi-step workflow processing
- ✅ LLM interaction and tool calling
- ✅ State tracking and validation
- ✅ Error recovery and reporting

### Command Line Interface

- ✅ Argument parsing and validation
- ✅ Option forwarding to evaluation functions
- ✅ Exit code handling
- ✅ Help and error messages

### Reporting and Output

- ✅ Console output formatting
- ✅ Success and failure indication
- ✅ Detailed metric reporting
- ✅ Combined workflow and tool health results

### Error Handling

- ✅ Configuration errors
- ✅ Server connection failures
- ✅ Tool execution errors
- ✅ Timeout handling
- ✅ Graceful degradation

## Running Tests

### All Tests

```bash
pnpm test
```

### By Test Type

```bash
# Unit tests only (fast)
pnpm test unit/

# Integration tests only
pnpm test integration/

# End-to-end tests only
pnpm test e2e/

# CLI tests only
pnpm test cli/
```

### Specific Test Files

```bash
pnpm test unit/core/config.test.ts
pnpm test integration/evaluate.test.ts
```

### Watch Mode

```bash
pnpm test --watch
```

### Coverage Report

```bash
pnpm test --coverage
```

## Test Organization Benefits

### 🚀 **Performance**

- Unit tests run quickly during development
- Integration tests provide broader coverage
- E2E tests ensure system reliability

### 🎯 **Focus**

- Easy to run specific test categories
- Clear separation of concerns
- Faster feedback loops

### 🔧 **Maintenance**

- Related tests are grouped together
- Easier to locate and update tests
- Clear test dependencies and requirements

### 📊 **CI/CD Optimization**

- Parallel test execution by category
- Fail-fast unit testing
- Comprehensive pre-release validation

## Test Utilities and Mocking

### Mocked Dependencies

- **MCP SDK**: Client, transports, and connections
- **External processes**: `execa` for server spawning
- **AI SDK**: LLM interaction and tool calling
- **File system**: Temporary file creation and cleanup
- **Console output**: Captured for assertion testing

### Test Helpers

- Configuration factory functions
- Mock data generators for evaluations and tool health results
- Temporary file management
- Environment variable setup/teardown

## Best Practices

### Test Organization

- Group related functionality in the same directory
- Use descriptive test names explaining the scenario
- Organize tests by functionality using `describe` blocks
- Setup and teardown in `beforeEach`/`afterEach` hooks

### Mocking Strategy

- Mock external dependencies at module boundaries
- Use dependency injection where possible
- Preserve original behavior for internal logic
- Reset mocks between tests

### Assertions

- Test both success and failure paths
- Verify side effects and state changes
- Check error messages and types
- Validate output formatting and content

### Test Data

- Use factory functions for consistent test data
- Parameterize tests for multiple scenarios
- Include edge cases and boundary conditions
- Test with realistic data sizes and complexity

## Continuous Integration

Tests are run automatically on:

- Pull request creation and updates
- Main branch commits
- Release preparation
- Scheduled daily runs

Coverage reports are generated and tracked to ensure quality standards are maintained.
