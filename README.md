# MCPVals

A comprehensive evaluation library for Model Context Protocol (MCP) servers. Test and validate your MCP servers with complete MCP specification coverage including Tools, Resources, Prompts, and Sampling with deterministic metrics, security validation, and optional LLM-based evaluation.

## Installation

```bash
pnpm add -D mcpvals
# or
npm install --save-dev mcpvals
# or
yarn add -D mcpvals
```

## Quick Example

```typescript
import type { Config } from "mcpvals";

export default {
  server: {
    transport: "stdio",
    command: "node",
    args: ["./my-mcp-server.js"],
  },

  // Test individual tools
  toolHealthSuites: [
    {
      name: "Calculator Tests",
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

  // Test multi-step workflows with LLM
  workflows: [
    {
      name: "Complex Calculation",
      steps: [
        {
          user: "Calculate (5 + 3) * 2, then divide by 4",
          expectedState: "4",
        },
      ],
      expectTools: ["add", "multiply", "divide"],
    },
  ],
} satisfies Config;
```

## Running Tests

```bash
# Run all tests
npx mcpvals eval mcp-eval.config.ts

# Run specific test types
npx mcpvals eval mcp-eval.config.ts --tool-health-only
npx mcpvals eval mcp-eval.config.ts --workflows-only

# Enable LLM judge for quality assessment
npx mcpvals eval mcp-eval.config.ts --llm-judge

# Export results
npx mcpvals eval mcp-eval.config.ts --reporter json > results.json
```

## Documentation

Full documentation is available in /docs

## Features

- **Complete MCP Coverage** - Test Tools, Resources, Prompts, and Sampling
- **LLM-Driven Workflows** - Test complex multi-step interactions
- **Vitest Integration** - Write tests using familiar testing patterns
- **Security Validation** - OAuth 2.1, PKCE, injection prevention
- **Performance Metrics** - Latency tracking and benchmarking
- **Multiple Transports** - stdio, HTTP streaming, Server-Sent Events

## License

MIT

## Acknowledgements

- [Model Context Protocol](https://modelcontextprotocol.io) – for the SDK
- [Vercel AI SDK](https://sdk.vercel.ai) – for LLM integration
- [chalk](https://github.com/chalk/chalk) – for terminal colors
