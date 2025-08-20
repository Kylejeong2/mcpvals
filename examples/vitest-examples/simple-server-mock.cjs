#!/usr/bin/env node

/**
 * Simple mock MCP server for testing examples
 * This is a minimal implementation that demonstrates the basic patterns
 */

class MockMCPServer {
  constructor() {
    this.tools = new Map([
      [
        "echo",
        {
          name: "echo",
          description: "Echo back the input message",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message to echo back" },
            },
            required: ["message"],
          },
        },
      ],
      [
        "add",
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number", description: "First number" },
              b: { type: "number", description: "Second number" },
            },
            required: ["a", "b"],
          },
        },
      ],
      [
        "multiply",
        {
          name: "multiply",
          description: "Multiply two numbers",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number", description: "First number" },
              b: { type: "number", description: "Second number" },
            },
            required: ["a", "b"],
          },
        },
      ],
    ]);
  }

  handleMessage(message) {
    const { method, params, id } = message;

    try {
      switch (method) {
        case "initialize":
          return this.createResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              prompts: {},
              resources: {},
            },
            serverInfo: {
              name: "mock-server",
              version: "1.0.0",
            },
          });

        case "tools/list":
          return this.createResponse(id, {
            tools: Array.from(this.tools.values()),
          });

        case "tools/call":
          return this.handleToolCall(id, params);

        case "prompts/list":
          return this.createResponse(id, { prompts: [] });

        case "resources/list":
          return this.createResponse(id, { resources: [] });

        default:
          return this.createError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      return this.createError(id, -32603, error.message);
    }
  }

  handleToolCall(id, params) {
    const { name, arguments: args } = params;

    switch (name) {
      case "echo":
        return this.createResponse(id, {
          content: [{ type: "text", text: args.message || "" }],
        });

      case "add": {
        const sum = (args.a || 0) + (args.b || 0);
        return this.createResponse(id, {
          content: [{ type: "text", text: String(sum) }],
        });
      }

      case "multiply": {
        const product = (args.a || 0) * (args.b || 0);
        return this.createResponse(id, {
          content: [{ type: "text", text: String(product) }],
        });
      }

      default:
        return this.createError(id, -32602, `Unknown tool: ${name}`);
    }
  }

  createResponse(id, result) {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  createError(id, code, message) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
  }
}

// Simple stdio-based JSON-RPC handler
function main() {
  const server = new MockMCPServer();
  let buffer = "";

  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => {
    // Limit buffer growth to mitigate potential DoS via oversized input
    buffer += chunk.slice(0, 1_000_000);

    // Process complete messages (assuming one per line)
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          // Basic structural validation before trusting the parsed object
          // Also cap line length to avoid excessive memory usage
          if (line.length > 1_000_000) {
            throw new Error("Input too large");
          }
          const message = JSON.parse(line);
          if (
            typeof message !== "object" ||
            message === null ||
            ("__proto__" in message) ||
            ("constructor" in message &&
              message.constructor &&
              message.constructor !== Object)
          ) {
            throw new Error("Invalid JSON-RPC message structure");
          }
          const response = server.handleMessage(message);
          process.stdout.write(JSON.stringify(response) + "\n");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Parse error";
          const errorResponse = server.createError(null, -32700, msg);
          process.stdout.write(JSON.stringify(errorResponse) + "\n");
        }
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}

module.exports = MockMCPServer;
