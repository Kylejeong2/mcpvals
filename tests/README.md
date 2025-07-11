# MCPVals Library Test Suite

This directory contains comprehensive tests for the MCPVals library, covering all major components and functionality.

## Test Structure

### Unit Tests

#### Core Evaluation Components

- **`config.test.ts`** - Configuration loading and validation
  - JSON and TypeScript config parsing
  - Environment variable expansion
  - Zod schema validation
  - Error handling for invalid configurations

- **`trace.test.ts`** - TraceStore operations and data management
  - Trace entry storage and retrieval
  - Tool call and result tracking
  - Conversation message management
  - Data filtering and querying

- **`deterministic.test.ts`** - DeterministicEvaluator metrics
  - End-to-end success evaluation
  - Tool invocation order checking
  - Tool call health assessment
  - Edge cases and error conditions

- **`tool-health.test.ts`** - ToolTester functionality
  - Individual tool test execution
  - Tool health suite management
  - Retry logic and timeout handling
  - Result validation and scoring

- **`runner.test.ts`** - ServerRunner operations
  - MCP server lifecycle management
  - Tool listing and calling
  - Workflow execution with LLM
  - Both stdio and HTTP transport modes

#### Main Evaluation Function

- **`evaluate.test.ts`** - Main integration point
  - Complete evaluation pipeline
  - Configuration validation
  - LLM judge integration
  - Reporter selection and output
  - Error handling and cleanup

#### Command Line Interface

- **`cli.test.ts`** - CLI command parsing and execution
  - Argument and option parsing
  - Command forwarding to evaluation functions
  - Exit code handling
  - Error reporting

#### Reporting

- **`reporter-console.test.ts`** - Console output formatting
  - Workflow evaluation reporting
  - Tool health result display
  - Combined reporting modes
  - Formatting and display consistency

### Integration Tests

- **`integration.test.ts`** - End-to-end scenarios
  - Full evaluation pipeline with real configurations
  - Multiple workflow and tool health suite combinations
  - Error handling and recovery
  - Performance and reliability testing
  - Real-world usage scenarios

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
npm test
```

### Specific Test Files

```bash
npm test config.test.ts
npm test integration.test.ts
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm run test:coverage
```

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

## Test Data and Fixtures

### Example Configurations

- Basic stdio server setup
- HTTP server with authentication
- Multi-workflow configurations
- Tool health suite definitions
- Environment variable examples

### Mock Responses

- Successful tool calls and results
- Error conditions and failures
- LLM conversation flows
- Server capability listings

## Coverage Goals

The test suite aims for comprehensive coverage of:

1. **Functional Coverage**: All public APIs and main code paths
2. **Error Coverage**: All error conditions and edge cases
3. **Integration Coverage**: End-to-end workflows and real-world scenarios
4. **Performance Coverage**: Timeout handling and resource management
5. **Configuration Coverage**: All supported configuration options

## Best Practices

### Test Organization

- One test file per source module
- Descriptive test names explaining the scenario
- Grouped tests by functionality using `describe` blocks
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
