# MCPVals - MCP Server Evaluation Library

## Overview

MCPVals is a TypeScript/Next.js evaluation library for Model Context Protocol (MCP) servers. It provides deterministic metrics to validate MCP server behavior and optional LLM-based evaluation capabilities.

## What We Built

### Core Components

1. **Configuration System** (`src/eval/config.ts`)
   - Zod-based schema validation
   - Support for stdio and HTTP servers
   - Workflow definition with steps
   - TypeScript and JSON config support

2. **Server Runner** (`src/eval/runner.ts`)
   - Manages MCP server lifecycle
   - Supports both stdio and SSE transports
   - Handles tool listing and invocation
   - Integrates with MCP SDK client

3. **Trace Store** (`src/eval/trace.ts`)
   - Records all MCP message exchanges
   - Tracks tool calls and results
   - Maintains conversation history
   - Provides data for evaluation

4. **Deterministic Evaluator** (`src/eval/deterministic.ts`)
   - **Metric 1: End-to-End Success** - Validates workflow reached expected state
   - **Metric 2: Tool Invocation Order** - Ensures correct tool call sequence
   - **Metric 3: Tool Call Health** - Verifies all tools executed successfully

5. **Reporters**
   - **Console Reporter** (`src/eval/reporters/console.ts`) - Pretty-printed results with colors
   - **JSON Reporter** - Machine-readable output
   - **JUnit Reporter** - (Planned) CI/CD integration

6. **CLI Interface** (`src/cli/eval.ts`)
   - `mcpvals eval` - Run evaluations
   - `mcpvals list` - List workflows in config
   - Command-line options for debug, reporter type, LLM judge

7. **Library API** (`src/eval/index.ts`)
   - Programmatic evaluation interface
   - TypeScript support with full types
   - Async/await based

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Config    │────▶│ ServerRunner │────▶│ MCP Server  │
│   Loader    │     └──────────────┘     └─────────────┘
└─────────────┘              │
                             ▼
                      ┌─────────────┐
                      │ TraceStore  │
                      └─────────────┘
                             │
                             ▼
                  ┌───────────────────┐
                  │  Deterministic    │
                  │   Evaluator       │
                  └───────────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │  Reporter   │
                      └─────────────┘
```

## Key Design Decisions

1. **Deterministic First**: Focus on objective, measurable metrics before adding LLM judgment
2. **Transport Agnostic**: Support both stdio and HTTP-based MCP servers
3. **Extensible**: Easy to add new metrics, reporters, or server types
4. **TypeScript Native**: Full type safety and IDE support
5. **CLI & Library**: Usable as both command-line tool and programmatic API

## Usage Examples

### CLI

```bash
# Run evaluation
npx mcpvals eval ./config.json

# With options
npx mcpvals eval ./config.json --debug --reporter json --llm
```

### Library

```typescript
import { evaluate } from "@mcpvals";

const report = await evaluate("./config.json", {
  debug: true,
  reporter: "console",
});
```

## Future Enhancements

1. **LLM Judge Implementation** - Use AI SDK for subjective evaluation
2. **JUnit Reporter** - XML output for CI/CD
3. **Parallel Workflow Execution** - Run multiple workflows concurrently
4. **Coverage Metrics** - Track % of server tools tested
5. **Visual Dashboard** - Web UI for results
6. **GitHub Actions Integration** - Fail CI on evaluation failures

## Testing

The library includes comprehensive tests:

- Configuration validation
- Trace store functionality
- Deterministic evaluator logic
- End-to-end evaluation flow

All tests pass successfully, validating the core functionality.
