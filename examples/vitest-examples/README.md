# Vitest Examples for MCP Testing

This directory contains example test files demonstrating how to use mcpvals with Vitest for testing Model Context Protocol servers.

## Examples

### `basic-tool-test.test.ts`

Demonstrates basic MCP server testing patterns:

- Setting up and tearing down MCP servers
- Testing individual tools
- Testing workflows
- Using custom matchers

### `eval-suite-example.test.ts`

Shows comprehensive evaluation suites with scoring:

- Math calculator server evaluation
- File system resource server evaluation
- Using different types of scorers
- Automated threshold-based pass/fail evaluation

## Running the Examples

**Note**: These examples are for demonstration purposes. To run them, you would need:

1. An actual MCP server implementation (e.g., calculator-server.js, filesystem-server.js)
2. Proper server configurations

```bash
# Install dependencies
pnpm install

# Run a specific example
pnpm test examples/vitest-examples/basic-tool-test.test.ts

# Run all vitest examples
pnpm test examples/vitest-examples/
```

## Creating Your Own Tests

1. **Start with basic tool testing**:

   ```typescript
   import { setupMCPServer, teardownMCPServer, mcpTest } from "mcpvals/vitest";

   describe("My MCP Server", () => {
     beforeAll(async () => {
       await setupMCPServer({
         transport: "stdio",
         command: "node",
         args: ["path/to/your/server.js"],
       });
     });

     afterAll(async () => {
       await teardownMCPServer();
     });

     mcpTest("should handle basic operations", async (utils) => {
       const result = await utils.callTool("myTool", { arg: "value" });
       expect(result).toBeDefined();
     });
   });
   ```

2. **Add comprehensive evaluation**:

   ```typescript
   import { describeEval, ToolCallScorer, LatencyScorer } from "mcpvals/vitest";

   describeEval({
     name: "My Server Evaluation",
     server: {
       /* config */
     },
     data: async () => [
       /* test cases */
     ],
     task: async (input, context) => {
       /* implementation */
     },
     scorers: [new ToolCallScorer(), new LatencyScorer({ maxLatencyMs: 1000 })],
     threshold: 0.8,
   });
   ```

3. **Use custom matchers for clean assertions**:

   ```typescript
   // Instead of complex manual checks
   expect(result.success).toBe(true);
   expect(Array.isArray(result.toolCalls)).toBe(true);
   expect(result.toolCalls.map((t) => t.name)).toContain("expectedTool");

   // Use custom matchers
   await expect(result).toHaveSuccessfulWorkflow();
   await expect(result).toCallTool("expectedTool");
   ```

## Best Practices

1. **Server Lifecycle**: Always use `beforeAll`/`afterAll` for server setup
2. **Test Isolation**: Each test should be independent
3. **Meaningful Assertions**: Use specific custom matchers
4. **Appropriate Timeouts**: Set realistic timeouts for your server
5. **Debug Mode**: Use `VITEST_MCP_DEBUG=true` during development

## Troubleshooting

- **Server doesn't start**: Check your server configuration and paths
- **Tests timeout**: Increase test timeouts or check server performance
- **Tools not found**: Verify your server exposes the expected tools
- **Assertion failures**: Enable debug mode to see detailed test output

For more detailed documentation, see [VITEST_INTEGRATION.md](../../docs/VITEST_INTEGRATION.md).
