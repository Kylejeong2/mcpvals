#!/usr/bin/env node

/**
 * Simple MCP server that demonstrates basic sampling functionality
 * This is a mock server for testing sampling evaluation capabilities
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

class SimpleSamplingServer {
  constructor() {
    this.server = new Server(
      {
        name: "simple-sampling-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          sampling: {
            // Declare sampling capability
          },
        },
      },
    );

    this.setupSamplingHandlers();
  }

  setupSamplingHandlers() {
    // Handle sampling/createMessage requests
    this.server.setNotificationHandler(
      "sampling/createMessage",
      async (request) => {
        console.error(
          "Received sampling request:",
          JSON.stringify(request, null, 2),
        );

        // Simulate processing the sampling request
        // In a real implementation, this would integrate with an LLM

        const { messages, modelPreferences, systemPrompt, maxTokens } =
          request.params;

        // Simulate requiring user approval for all sampling requests
        const requiresApproval = true;

        if (requiresApproval) {
          // Send user approval request
          await this.server.notification({
            method: "sampling/userApprovalRequest",
            params: {
              requestId: `req_${Date.now()}`,
              messages,
              modelPreferences,
              systemPrompt,
              maxTokens,
            },
          });
        }

        // Simulate approved response (this would normally come after user approval)
        const response = {
          role: "assistant",
          content: {
            type: "text",
            text: "This is a simulated response from the simple sampling server. The request was processed successfully.",
          },
        };

        return {
          response,
          requestId: `req_${Date.now()}`,
          approved: true,
        };
      },
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Simple Sampling Server running on stdio");
  }
}

if (require.main === module) {
  const server = new SimpleSamplingServer();
  server.run().catch(console.error);
}

module.exports = SimpleSamplingServer;
