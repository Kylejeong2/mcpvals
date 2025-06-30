# MCPVals Examples

This directory contains example configurations for testing various MCP servers with MCPVals.

## Available Examples

### 1. Simple Math Server (`simple-mcp-server.js`)

A basic MCP server that provides mathematical operations (add, subtract, multiply, divide).

**Features:**

- Four basic math operations
- Error handling (division by zero)
- Clear, deterministic outputs

**To test locally:**

```bash
# Install dependencies
npm install @modelcontextprotocol/sdk

# Run evaluation
npx mcpvals eval ./simple-server-eval.config.json
```

### 2. Weather Server (`weather-server-eval.config.json`)

Tests the official MCP weather server from Anthropic.

**Prerequisites:**

- Get a free AccuWeather API key from [developer.accuweather.com](https://developer.accuweather.com/)
- Set the API key in the config file or environment variable

**To test:**

```bash
# Set your API key
export ACCUWEATHER_API_KEY="your-key-here"

# Run evaluation
npx mcpvals eval ./weather-server-eval.config.json
```

### 3. GitHub Server (`github-server-eval.config.json`)

Tests the official GitHub MCP server with comprehensive workflows.

**Prerequisites:**

- Create a GitHub Personal Access Token
- Set the token in the config file or environment variable

**To test:**

```bash
# Set your GitHub token
export GITHUB_PERSONAL_ACCESS_TOKEN="your-token-here"

# Run evaluation
npx mcpvals eval ./github-server-eval.config.json
```

### 4. Remote Fetch Server (`remote-server-eval.config.json`)

Tests a remote HTTP-based MCP server (no local installation needed).

**To test:**

```bash
# No setup required - uses public endpoint
npx mcpvals eval ./remote-server-eval.config.json
```

## Testing Individual Metrics

Each example is designed to test specific metrics:

### End-to-End Success

- `simple-server-eval.config.json`: "test-end-to-end-only" workflow
- Tests if the final output matches expected state

### Tool Invocation Order

- `simple-server-eval.config.json`: "test-tool-order" workflow
- Validates tools are called in the correct sequence

### Tool Call Health

- `simple-server-eval.config.json`: "test-error-handling" workflow
- Checks error handling and tool execution success

## Creating Your Own Tests

1. **Choose a server type:**
   - `stdio`: For local command-line servers
   - `shttp`: For remote HTTP/SSE servers

2. **Define workflows:**

   ```json
   {
     "workflows": [
       {
         "name": "my-test",
         "steps": [
           {
             "user": "User message",
             "expectTools": ["tool_name"],
             "expectedState": "expected output"
           }
         ]
       }
     ]
   }
   ```

3. **Run evaluation:**
   ```bash
   npx mcpvals eval ./my-config.json
   ```

## Popular MCP Servers to Test

Based on the [awesome-mcp-servers](https://github.com/wong2/awesome-mcp-servers) list:

1. **Filesystem** - File operations

   ```bash
   npx -y @modelcontextprotocol/server-filesystem
   ```

2. **SQLite** - Database operations

   ```bash
   npx -y @modelcontextprotocol/server-sqlite
   ```

3. **Fetch** - Web content fetching

   ```bash
   npx -y @modelcontextprotocol/server-fetch
   ```

4. **Memory** - Knowledge graph storage
   ```bash
   npx -y @modelcontextprotocol/server-memory
   ```

## Tips

1. **Start simple**: Test one metric at a time
2. **Use debug mode**: Add `--debug` to see detailed output
3. **Check tool names**: Use `mcpvals list` to verify your config
4. **Test errors**: Include failure scenarios to ensure robust evaluation

## Deploying Servers

To deploy the simple math server to a cloud service:

1. **Vercel/Netlify Functions**: Convert to HTTP endpoint
2. **Railway/Render**: Deploy as a web service
3. **AWS Lambda**: Use with API Gateway
4. **Google Cloud Run**: Containerize and deploy

Example deployment guide coming soon!

## 🆕 TypeScript Quick-Start

If you prefer programmatic control, use the ESM-friendly API:

```bash
pnpm add -D tsx typescript @mcpvals
```

```ts
// run-evaluation.ts
import { evaluate } from "@mcpvals";

await evaluate("./example/simple-server-eval.config.ts", {
  debug: true,
  reporter: "console",
});
```

Run it with:

```bash
pnpm exec tsx run-evaluation.ts
```

A convenience script is already wired up: `pnpm run test:ts`.

> See `docs/library-usage.md` for the full specification.
