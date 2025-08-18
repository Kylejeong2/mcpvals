#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";

const server = new Server(
  {
    name: "filesystem-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const files = await fs.readdir("/tmp");
    const resources = files.map((file) => ({
      uri: `file:///tmp/${file}`,
      name: file,
      mimeType: "text/plain",
    }));

    return {
      resources,
    };
  } catch {
    return {
      resources: [
        {
          uri: "file:///tmp/test.txt",
          name: "test.txt",
          mimeType: "text/plain",
        },
      ],
    };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Extract path from file:// URI
  const filePath = uri.replace("file://", "");

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: content,
        },
      ],
    };
  } catch {
    // Return mock content for demo purposes
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: "Hello World",
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
