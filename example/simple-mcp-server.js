#!/usr/bin/env node

/**
 * Simple MCP Server Example
 *
 * This server provides basic mathematical operations and can be tested with MCPVals.
 * It can be run locally or deployed to a cloud service.
 *
 * To run locally:
 *   node simple-mcp-server.js
 *
 * To test with MCPVals:
 *   npx mcpvals eval ./simple-server-eval.config.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Create server instance
const server = new Server(
  {
    name: "simple-math-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define available tools
const TOOLS = [
  {
    name: "add",
    description: "Add two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "subtract",
    description: "Subtract second number from first",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
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
  {
    name: "divide",
    description: "Divide first number by second",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "Dividend" },
        b: { type: "number", description: "Divisor (cannot be zero)" },
      },
      required: ["a", "b"],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "add": {
      const result = args.a + args.b;
      return {
        content: [
          {
            type: "text",
            text: `${args.a} + ${args.b} = ${result}`,
          },
        ],
      };
    }

    case "subtract": {
      const result = args.a - args.b;
      return {
        content: [
          {
            type: "text",
            text: `${args.a} - ${args.b} = ${result}`,
          },
        ],
      };
    }

    case "multiply": {
      const result = args.a * args.b;
      return {
        content: [
          {
            type: "text",
            text: `${args.a} × ${args.b} = ${result}`,
          },
        ],
      };
    }

    case "divide": {
      if (args.b === 0) {
        throw new Error("Division by zero is not allowed");
      }
      const result = args.a / args.b;
      return {
        content: [
          {
            type: "text",
            text: `${args.a} ÷ ${args.b} = ${result}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Simple Math MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
