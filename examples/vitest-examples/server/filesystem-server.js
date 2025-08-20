#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "node:path";

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

  // Securely resolve path from file:// URI and restrict access to /tmp
  const BASE_DIR = "/tmp";
  let filePath = "";
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") {
      throw new Error("Invalid protocol: only file:// URIs are allowed");
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const normalized = path.normalize(decodedPath);

    // Ensure access is strictly within BASE_DIR
    const baseResolved = path.resolve(BASE_DIR);
    const targetResolved = path.resolve(normalized);
    if (
      targetResolved !== baseResolved &&
      !targetResolved.startsWith(baseResolved + path.sep)
    ) {
      throw new Error("Access outside allowed directory");
    }

    filePath = targetResolved;
  } catch (e) {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Invalid file URI: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }

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
