# @mcpvals

An evaluation library for Model Context Protocol (MCP) servers. Test and validate your MCP servers with deterministic metrics and optional LLM-based evaluation.


## Features

- 🎯 **Three Core Metrics**:
  1. **End-to-End Success** - Did the workflow reach the desired end state?
  2. **Tool Invocation Order** - Were tools called in the expected sequence?
  3. **Tool Call Health** - Did all tool calls complete successfully?

- 🤖 **Multiple Server Types**: Support for stdio and HTTP-based MCP servers
- 📊 **Multiple Reporters**: Console, JSON, and JUnit output formats
- 🧠 **LLM Judge** (optional): AI-powered evaluation using Vercel AI SDK
- 🔧 **CLI & Library**: Use as a command-line tool or integrate into your code

## Installation

```bash
npm install @mcpvals
# or
yarn add @mcpvals
# or
pnpm add @mcpvals
# or
bun add @mcpvals
```

## Quick Start

### CLI Usage

```bash
# List workflows in a config file
npx mcpvals list ./mcp-eval.config.json

# Run evaluation
npx mcpvals eval ./mcp-eval.config.json

# With options
npx mcpvals eval ./mcp-eval.config.json --debug --reporter json
```

### Library Usage

```typescript
import { evaluate } from "@mcpvals";

const report = await evaluate("./mcp-eval.config.json", {
  debug: true,
  reporter: "console",
  llmJudge: false
});

console.log(`Evaluation ${report.passed ? "passed" : "failed"}`);
```

### Configuration File

Create an `mcp-eval.config.json` file:

```json
{
  "server": {
    "transport": "stdio",
    "command": "node",
    "args": ["./my-mcp-server.js"]
  },
  "workflows": [
    {
      "name": "basic-math",
      "description": "Test basic math operations",
      "steps": [
        {
          "user": "What is 2 + 2?",
          "expectTools": ["calculate"],
          "expectedState": "4"
        }
      ]
    }
  ],
  "llmJudge": false,
  "timeout": 30000
}
```

## Configuration Schema

### Server Configuration

**stdio servers:**
```json
{
  "transport": "stdio",
  "command": "python",
  "args": ["server.py"],
  "env": {
    "API_KEY": "your-key"
  }
}
```

**HTTP servers:**
```json
{
  "transport": "shttp",
  "url": "http://localhost:8080/mcp",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### Workflow Configuration

```json
{
  "name": "workflow-name",
  "description": "Optional description",
  "steps": [
    {
      "user": "User message to send",
      "expectTools": ["tool1", "tool2"],  // Optional: Expected tools in order
      "expectedState": "Expected result"   // Optional: For end-to-end validation
    }
  ]
}
```

## Evaluation Metrics

### 1. End-to-End Success ✅
Validates that the workflow reached the expected final state. The evaluator checks:
- Last assistant message content
- Final tool result output
- String matching against `expectedState`

### 2. Tool Invocation Order 🔧
Ensures tools are called in the expected sequence:
- Exact order matching
- Partial credit for partially correct sequences
- Handles workflows with no tool expectations

### 3. Tool Call Health 💚
Verifies all tool calls completed successfully:
- No exceptions thrown
- HTTP status codes 200-299
- Valid response payloads

## Output Formats

### Console Reporter (Default)
```
MCP Server Evaluation Results
============================================================

Workflow: basic-math ✓ PASSED
Overall Score: 100%
----------------------------------------
  ✓ End-to-End Success: 100%
    Successfully reached expected state: "4"
  ✓ Tool Invocation Order: 100%
    All 1 tools called in correct order
  ✓ Tool Call Health: 100%
    All 1 tool calls completed successfully

============================================================
Summary:
  Total Workflows: 1
  Passed: 1
  Failed: 0
  Overall Score: 100%

✅ All Evaluations Passed!
```

### JSON Reporter
Outputs complete evaluation data as JSON for programmatic processing.

### JUnit Reporter (Coming Soon)
Generates JUnit XML for CI/CD integration.

## Advanced Usage

### TypeScript Configuration
```typescript
import { Config } from "@mcpvals";

const config: Config = {
  server: {
    transport: "stdio",
    command: "python",
    args: ["server.py"],
    env: { API_KEY: process.env.API_KEY }
  },
  workflows: [...],
  llmJudge: true,
  openaiKey: process.env.OPENAI_API_KEY,
  timeout: 60000
};
```

### LLM Judge (Optional)
Enable AI-powered evaluation for subjective criteria:
```bash
npx mcpvals eval config.json --llm
```

Requires `openaiKey` in config or `OPENAI_API_KEY` environment variable.

## License

Apache-2.0
