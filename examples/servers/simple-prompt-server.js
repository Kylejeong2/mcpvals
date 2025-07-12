#!/usr/bin/env node

/**
 * Simple MCP server that provides prompts for testing
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "simple-prompt-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      prompts: {},
    },
  },
);

// Add prompts
server.setRequestHandler("prompts/list", async () => {
  return {
    prompts: [
      {
        name: "greeting",
        description: "A simple greeting prompt",
        arguments: [
          {
            name: "name",
            description: "Name of the person to greet",
            required: true,
          },
          {
            name: "language",
            description: "Language for the greeting",
            required: false,
          },
        ],
      },
      {
        name: "summarize",
        description: "Summarize text content",
        arguments: [
          {
            name: "text",
            description: "Text to summarize",
            required: true,
          },
          {
            name: "max_length",
            description: "Maximum length of summary",
            required: false,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler("prompts/get", async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "greeting": {
      const nameArg = args?.name || "there";
      const languageArg = args?.language || "en";

      let greeting = "Hello";
      if (languageArg === "es") greeting = "Hola";
      else if (languageArg === "fr") greeting = "Bonjour";

      return {
        description: `Greeting for ${nameArg}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${greeting} ${nameArg}, how can I help you today?`,
            },
          },
        ],
      };
    }

    case "summarize": {
      const text = args?.text || "";
      const maxLength = parseInt(args?.max_length) || 100;

      if (!text) {
        throw new Error("Text is required for summarization");
      }

      // Simple "summarization" - just truncate and add ellipsis
      const summary =
        text.length > maxLength
          ? text.substring(0, maxLength - 3) + "..."
          : text;

      return {
        description: "Text summary",
        messages: [
          {
            role: "assistant",
            content: {
              type: "text",
              text: `Summary: ${summary}`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Simple Prompt MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
