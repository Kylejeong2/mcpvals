# MCPVals Examples

This directory contains example configurations for testing various MCP servers with MCPVals, organized by test type and complexity.

## 📁 Directory Structure

```
examples/
├── package.json              # Dependencies and test scripts
├── README.md                 # This file
├── run-evaluation.ts         # TypeScript programmatic usage example
├── servers/                  # Example MCP servers
│   ├── simple-mcp-server.js       # Basic math operations server
│   ├── simple-prompt-server.js    # Prompt template server
│   └── simple-sampling-server.js  # Sampling capability server
├── basic/                    # Simple, foundational examples
│   ├── simple-server-eval.config.json    # Basic server testing
│   ├── simple-server-eval.config.ts      # TypeScript version
│   └── simple-prompt-eval.config.json    # Basic prompt testing
├── tools/                    # Tool health evaluation
│   └── tool-health-eval.config.json      # Tool execution testing
├── resources/               # Resource evaluation
│   ├── resource-eval.config.json         # Basic resource testing
│   └── advanced-resource-eval.config.ts  # Advanced resource scenarios
├── prompts/                 # Prompt evaluation
│   ├── prompt-eval.config.json           # Basic prompt testing
│   └── advanced-prompt-eval.config.ts    # Advanced prompt scenarios
├── sampling/                # Sampling evaluation
│   ├── sampling-capability-eval.config.json     # Basic sampling
│   ├── sampling-performance-eval.config.json    # Performance tests
│   ├── sampling-security-eval.config.json       # Security tests
│   ├── sampling-workflow-eval.config.json       # Workflow tests
│   └── comprehensive-sampling-eval.config.ts    # Full sampling suite
├── integrations/            # Third-party service integrations
│   ├── weather-server-eval.config.json          # Weather API testing
│   ├── github-server-eval.config.json           # GitHub API testing
│   └── authenticated-server-eval.config.json    # Auth patterns
├── remote/                  # Remote server testing
│   └── remote-server-eval.config.json           # HTTP/SSE servers
└── advanced/                # Advanced features
    └── llm-judge-eval.config.json               # LLM-based evaluation
```

## 🚀 Quick Start

### Prerequisites

```bash
npm install
```

### Running Tests

Use the predefined npm scripts for easy testing:

```bash
# Basic server functionality
npm run test:simple

# Prompt evaluation
npm run test:prompts

# Tool health checks
npm run test:tools

# Resource evaluation
npm run test:resources

# Sampling capabilities
npm run test:sampling

# Third-party integrations (requires API keys)
npm run test:weather
npm run test:github

# Remote server testing
npm run test:remote

# Advanced LLM judge evaluation
npm run test:advanced

# TypeScript programmatic usage
npm run test:ts
```

## 📋 Test Categories

### 1. Basic Tests (`basic/`)

**Purpose**: Foundational examples demonstrating core MCPVals functionality

**Files**:

- `simple-server-eval.config.json` - Basic server testing with workflows
- `simple-server-eval.config.ts` - TypeScript version with type safety
- `simple-prompt-eval.config.json` - Simple prompt template testing

**Best for**: Getting started, understanding basic concepts

### 2. Tool Health Tests (`tools/`)

**Purpose**: Validate tool execution reliability and error handling

**Files**:

- `tool-health-eval.config.json` - Tool execution health checks

**Metrics tested**:

- Tool call success rates
- Error handling patterns
- Execution timeouts

### 3. Resource Tests (`resources/`)

**Purpose**: Test resource access patterns and performance

**Files**:

- `resource-eval.config.json` - Basic resource access testing
- `advanced-resource-eval.config.ts` - Complex resource scenarios

**Metrics tested**:

- Resource discovery
- Access performance
- Template substitution
- Error scenarios

### 4. Prompt Tests (`prompts/`)

**Purpose**: Evaluate prompt template functionality and generation

**Files**:

- `prompt-eval.config.json` - Basic prompt testing
- `advanced-prompt-eval.config.ts` - Advanced prompt scenarios

**Metrics tested**:

- Prompt discovery
- Template rendering
- Parameter validation
- Error handling

### 5. Sampling Tests (`sampling/`)

**Purpose**: Test sampling capabilities and AI model interactions

**Files**:

- `sampling-capability-eval.config.json` - Basic sampling features
- `sampling-performance-eval.config.json` - Performance benchmarks
- `sampling-security-eval.config.json` - Security validation
- `sampling-workflow-eval.config.json` - Workflow integration
- `comprehensive-sampling-eval.config.ts` - Full sampling test suite

**Metrics tested**:

- Model preferences
- Context inclusion
- Security constraints
- Performance metrics

### 6. Integration Tests (`integrations/`)

**Purpose**: Test real-world third-party service integrations

**Files**:

- `weather-server-eval.config.json` - Weather API integration
- `github-server-eval.config.json` - GitHub API integration
- `authenticated-server-eval.config.json` - Authentication patterns

**Requirements**:

- API keys and credentials
- Network connectivity
- Service availability

### 7. Remote Tests (`remote/`)

**Purpose**: Test remote HTTP/SSE-based MCP servers

**Files**:

- `remote-server-eval.config.json` - Remote server connectivity

**Features tested**:

- HTTP transport
- SSE streaming
- Network resilience

### 8. Advanced Tests (`advanced/`)

**Purpose**: Advanced evaluation features and complex scenarios

**Files**:

- `llm-judge-eval.config.json` - LLM-based evaluation

**Features**:

- AI-powered assessment
- Semantic validation
- Complex reasoning tests

## 🛠️ Example Servers

### Simple MCP Server (`servers/simple-mcp-server.js`)

A basic MCP server providing mathematical operations:

**Tools**: `add`, `subtract`, `multiply`, `divide`
**Features**: Error handling, deterministic outputs
**Use case**: Basic functionality testing

### Simple Prompt Server (`servers/simple-prompt-server.js`)

A prompt template server for testing prompt evaluation:

**Prompts**: `greeting`, `summarize`
**Features**: Parameter substitution, language support
**Use case**: Prompt template testing

### Simple Sampling Server (`servers/simple-sampling-server.js`)

A server demonstrating sampling capabilities:

**Features**: Model preferences, context handling
**Use case**: Sampling functionality testing

## 📊 Test Configuration Patterns

### JSON Configuration

```json
{
  "server": {
    "transport": "stdio",
    "command": "node",
    "args": ["../servers/simple-mcp-server.js"]
  },
  "workflows": [...],
  "toolHealthSuites": [...],
  "timeout": 30000
}
```

### TypeScript Configuration

```typescript
import { Config } from "../../src/eval/config.js";

const config: Config = {
  server: {
    transport: "stdio",
    command: "node",
    args: ["../servers/simple-mcp-server.js"],
  },
  workflows: [],
  // ... other required properties
};

export default config;
```

## 🔧 Creating Custom Tests

### 1. Choose Your Test Type

Pick the appropriate directory based on what you're testing:

- **Basic functionality** → `basic/`
- **Tool execution** → `tools/`
- **Resource access** → `resources/`
- **Prompt templates** → `prompts/`
- **Sampling features** → `sampling/`
- **Third-party APIs** → `integrations/`
- **Remote servers** → `remote/`
- **Advanced features** → `advanced/`

### 2. Use the Right Template

- **Simple tests**: Use JSON configuration
- **Complex tests**: Use TypeScript configuration
- **Performance tests**: Include timing constraints
- **Error tests**: Include `expectError` fields

### 3. Add Test Scripts

Update `package.json` with your new test:

```json
{
  "scripts": {
    "test:my-feature": "mcpvals eval ./category/my-test.config.json"
  }
}
```

## 🌐 Environment Variables

### Required for Integration Tests

```bash
# Weather server
export ACCUWEATHER_API_KEY="your-key-here"

# GitHub server
export GITHUB_PERSONAL_ACCESS_TOKEN="your-token-here"

# Authenticated server
export API_TOKEN="your-bearer-token"
export API_KEY="your-api-key"
```

## 📝 Best Practices

1. **Start Simple**: Begin with `basic/` examples
2. **Use TypeScript**: For complex configurations with type safety
3. **Test Incrementally**: Add one test type at a time
4. **Handle Errors**: Include negative test cases
5. **Monitor Performance**: Set appropriate timeouts and latency limits
6. **Document Dependencies**: Note required environment variables
7. **Organize by Purpose**: Use the directory structure to categorize tests

## 🚀 Programmatic Usage

For advanced use cases, use the TypeScript API:

```typescript
import { evaluate } from "mcpvals";

const report = await evaluate("./basic/simple-server-eval.config.json", {
  debug: true,
  reporter: "console",
});

if (!report.passed) {
  console.error("❌ Evaluation failed");
  process.exit(1);
}
```

## 📚 Further Reading

- [MCPVals Documentation](../README.md)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Configuration Reference](../docs/configuration.md)
- [API Reference](../docs/api.md)

---

🎯 **Happy Testing!** Start with the `basic/` examples and work your way up to more complex scenarios.
