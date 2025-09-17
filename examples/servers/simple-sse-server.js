#!/usr/bin/env node

/**
 * Simple SSE MCP Server Example
 *
 * This demonstrates a working SSE-based MCP server using the official SDK.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";

class SimpleSseServer {
  constructor() {
    this.server = new Server(
      {
        name: "simple-sse-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "ping",
            description: "Simple ping tool that returns pong",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "echo",
            description: "Echo back the provided message",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Message to echo back",
                },
              },
              required: ["message"],
            },
          },
          {
            name: "get-config",
            description: "Get server configuration",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "display-message",
            description: "Display a formatted message",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Message to display",
                },
              },
              required: ["message"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "ping":
          return {
            content: [
              {
                type: "text",
                text: "pong",
              },
            ],
          };

        case "echo":
          return {
            content: [
              {
                type: "text",
                text: args.message,
              },
            ],
          };

        case "get-config":
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  server: "simple-sse-server",
                  version: "1.0.0",
                  transport: "sse",
                  timestamp: new Date().toISOString(),
                }),
              },
            ],
          };

        case "display-message":
          return {
            content: [
              {
                type: "text",
                text: `📢 ${args.message}`,
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start(port = 3000) {
    const httpServer = http.createServer((req, res) => {
      // Handle CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === "/sse" && req.method === "POST") {
        // Set up SSE headers
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        // Create SSE transport
        const transport = new SSEServerTransport("/sse", res);

        // Connect server to transport
        this.server.connect(transport);

        // Handle client disconnect
        req.on("close", () => {
          transport.close();
        });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    httpServer.listen(port, () => {
      console.log(`SSE MCP Server running on http://localhost:${port}/sse`);
    });

    process.on("SIGINT", () => {
      console.log("Shutting down SSE server...");
      httpServer.close();
      process.exit(0);
    });
  }
}

// Start the server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SimpleSseServer();
  server.start().catch(console.error);
}

export { SimpleSseServer };
