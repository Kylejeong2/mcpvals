# MCPVals Usage Guide

This guide shows you how to use MCPVals to evaluate your MCP servers, with specific examples for testing each of the three core metrics individually.

## Table of Contents
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Testing Individual Metrics](#testing-individual-metrics)
  - [1. End-to-End Success](#1-end-to-end-success)
  - [2. Tool Invocation Order](#2-tool-invocation-order)
  - [3. Tool Call Health](#3-tool-call-health)
- [Advanced Configuration](#advanced-configuration)
- [Interpreting Results](#interpreting-results)

## Installation

```bash
npm install @mcpvals
# or
pnpm add @mcpvals
# or
yarn add @mcpvals
```

## Basic Usage

### CLI Usage

```bash
# List workflows in a config
npx mcpvals list ./mcp-eval.config.json

# Run evaluation
npx mcpvals eval ./mcp-eval.config.json

# With debug output
npx mcpvals eval ./mcp-eval.config.json --debug

# Output as JSON
npx mcpvals eval ./mcp-eval.config.json --reporter json
```

### Library Usage

```typescript
import { evaluate } from "@mcpvals";

async function runEvaluation() {
  const report = await evaluate("./mcp-eval.config.json", {
    debug: false,
    reporter: "console"
  });
  
  console.log(`Passed: ${report.passed}`);
  console.log(`Workflows evaluated: ${report.evaluations.length}`);
}
```

## Testing Individual Metrics

### 1. End-to-End Success

This metric validates that your workflow reaches the expected final state. It checks both the assistant's final message and the last tool result.

**Example: Testing a Calculator MCP Server**

```json
{
  "server": {
    "transport": "stdio",
    "command": "node",
    "args": ["./calculator-server.js"]
  },
  "workflows": [
    {
      "name": "test-end-to-end-success",
      "description": "Verify the calculator produces correct results",
      "steps": [
        {
          "user": "What is 15 + 27?",
          "expectedState": "42"
        }
      ]
    }
  ]
}
```

**What it checks:**
- ✅ Does the final message contain "42"?
- ✅ Does the last tool result contain "42"?
- ❌ Fails if neither contains the expected state

**Tips for End-to-End Testing:**
- Use specific, unique values in `expectedState`
- The check is case-insensitive
- It searches for substring matches, so "The answer is 42" will match "42"

### 2. Tool Invocation Order

This metric ensures tools are called in the expected sequence, which is critical for multi-step workflows.

**Example: Testing a Weather + Restaurant Finder MCP Server**

```json
{
  "server": {
    "transport": "stdio", 
    "command": "python",
    "args": ["./travel-assistant.py"]
  },
  "workflows": [
    {
      "name": "test-tool-order",
      "description": "Verify tools are called in correct sequence",
      "steps": [
        {
          "user": "Get weather for San Francisco",
          "expectTools": ["get_weather"]
        },
        {
          "user": "Find Italian restaurants nearby",
          "expectTools": ["get_location", "search_restaurants"]
        },
        {
          "user": "Make a reservation at the first one",
          "expectTools": ["make_reservation"]
        }
      ]
    }
  ]
}
```

**What it checks:**
- ✅ Were all expected tools called?
- ✅ Were they called in the exact order specified?
- ❌ Fails if tools are missing or out of order
- ⚠️  Partial credit given (e.g., 3/4 tools in correct order = 75%)

**Tips for Tool Order Testing:**
- List tools in the exact order you expect them
- Tools from all steps are concatenated into one sequence
- Extra tool calls after the expected ones don't cause failure

### 3. Tool Call Health

This metric verifies that all tool calls complete successfully without errors.

**Example: Testing Error Handling in a Database MCP Server**

```json
{
  "server": {
    "transport": "shttp",
    "url": "http://localhost:8080/mcp",
    "headers": {
      "Authorization": "Bearer test-token"
    }
  },
  "workflows": [
    {
      "name": "test-tool-health",
      "description": "Verify all tools execute without errors",
      "steps": [
        {
          "user": "Create a new user account for john@example.com",
          "expectTools": ["create_user"]
        },
        {
          "user": "Fetch the user details",
          "expectTools": ["get_user"]
        },
        {
          "user": "Update the user's name to John Doe",
          "expectTools": ["update_user"]
        }
      ]
    }
  ]
}
```

**What it checks:**
- ✅ Did each tool return a result?
- ✅ No exceptions thrown?
- ✅ HTTP status codes 200-299 (for HTTP servers)?
- ❌ Fails if any tool errors or returns bad status

**Tips for Tool Health Testing:**
- Test both success and failure scenarios
- For HTTP servers, the library checks status codes
- Tool timeouts are controlled by the `timeout` config option

## Advanced Configuration

### Testing All Metrics Together

```json
{
  "server": {
    "transport": "stdio",
    "command": "node",
    "args": ["./my-server.js"],
    "env": {
      "API_KEY": "test-key",
      "DEBUG": "true"
    }
  },
  "workflows": [
    {
      "name": "comprehensive-test",
      "description": "Test all three metrics",
      "steps": [
        {
          "user": "Calculate the sum of 10 and 20",
          "expectTools": ["add"],
          "expectedState": "30"
        },
        {
          "user": "Now multiply the result by 2",
          "expectTools": ["multiply"],
          "expectedState": "60"
        }
      ]
    }
  ],
  "timeout": 30000,
  "llmJudge": false
}
```

### TypeScript Configuration

```typescript
import { Config } from "@mcpvals";
import { evaluate } from "@mcpvals";

const config: Config = {
  server: {
    transport: "stdio",
    command: "tsx",
    args: ["./src/server.ts"],
    env: {
      NODE_ENV: "test"
    }
  },
  workflows: [
    {
      name: "typescript-test",
      description: "Test TypeScript MCP server",
      steps: [
        {
          user: "Run the test command",
          expectTools: ["execute_test"],
          expectedState: "success"
        }
      ]
    }
  ],
  timeout: 60000
};

// Run with custom config object
const report = await evaluate(config, {
  debug: true,
  reporter: "json"
});
```

## Interpreting Results

### Console Output

```
MCP Server Evaluation Results
============================================================

Workflow: calculator-test ✓ PASSED
Overall Score: 100%
----------------------------------------
  ✓ End-to-End Success: 100%
    Successfully reached expected state: "42"
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

### JSON Output Structure

```json
{
  "config": { /* your config */ },
  "evaluations": [
    {
      "workflowName": "calculator-test",
      "passed": true,
      "overallScore": 1.0,
      "results": [
        {
          "metric": "End-to-End Success",
          "passed": true,
          "score": 1.0,
          "details": "Successfully reached expected state: \"42\"",
          "metadata": {
            "expectedState": "42",
            "lastMessageContent": "The result is 42"
          }
        },
        {
          "metric": "Tool Invocation Order",
          "passed": true,
          "score": 1.0,
          "details": "All 1 tools called in correct order",
          "metadata": {
            "expectedTools": ["calculate"],
            "actualTools": ["calculate"],
            "matchCount": 1
          }
        },
        {
          "metric": "Tool Call Health",
          "passed": true,
          "score": 1.0,
          "details": "All 1 tool calls completed successfully",
          "metadata": {
            "totalCalls": 1,
            "successCount": 1,
            "failures": []
          }
        }
      ]
    }
  ],
  "passed": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Understanding Scores

- **100%** - Perfect score, all checks passed
- **70-99%** - Partial success (shown in yellow)
- **0-69%** - Failed (shown in red)

Each metric contributes equally to the overall score:
- Overall Score = (Metric1 + Metric2 + Metric3) / 3

## Common Patterns

### Testing Error Scenarios

```json
{
  "workflows": [
    {
      "name": "error-handling-test",
      "steps": [
        {
          "user": "Divide 10 by 0",
          "expectTools": ["divide"]
        }
      ]
    }
  ]
}
```

This will:
- ✅ Pass Tool Invocation Order (if `divide` is called)
- ❌ Fail Tool Call Health (if division by zero throws error)
- ❓ End-to-End Success depends on error handling

### Testing Optional Tools

```json
{
  "workflows": [
    {
      "name": "conditional-tools",
      "steps": [
        {
          "user": "Get weather if available, otherwise skip",
          "expectTools": [],
          "expectedState": "weather data or skipped"
        }
      ]
    }
  ]
}
```

### Testing Multi-Step Workflows

```json
{
  "workflows": [
    {
      "name": "complex-workflow",
      "steps": [
        {
          "user": "Initialize the system",
          "expectTools": ["init"]
        },
        {
          "user": "Process the data",
          "expectTools": ["validate", "transform", "save"]
        },
        {
          "user": "Generate report",
          "expectTools": ["generate_report"],
          "expectedState": "Report generated successfully"
        }
      ]
    }
  ]
}
```

## Best Practices

1. **Start Simple**: Test one metric at a time when debugging
2. **Use Descriptive Names**: Make workflow and step names clear
3. **Test Edge Cases**: Include error scenarios and boundary conditions
4. **Version Your Tests**: Keep test configs in version control
5. **CI/CD Integration**: Run evaluations in your build pipeline

```bash
# In your CI/CD pipeline
npx mcpvals eval ./tests/mcp-eval.config.json || exit 1
```

## Troubleshooting

### Server Won't Start
- Check the command and args are correct
- Verify the server file exists and is executable
- Look for error messages with `--debug` flag

### Tools Not Found
- Ensure tool names match exactly (case-sensitive)
- Verify the server is exposing the expected tools
- Use `mcpvals list` to see what's in your config

### Unexpected Failures
- Use `--reporter json` to see detailed metadata
- Check if your `expectedState` is too specific
- Verify tool arguments are being passed correctly 