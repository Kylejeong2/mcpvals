import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { execa, ExecaChildProcess } from "execa";
import { ServerConfig } from "./config.js";
import { TraceStore } from "./trace.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";

export interface ServerRunnerOptions {
  timeout?: number;
  debug?: boolean;
}

export class ServerRunner {
  private client?: Client;
  private process?: ExecaChildProcess;
  private traceStore: TraceStore;
  private serverConfig: ServerConfig;
  private options: ServerRunnerOptions;

  constructor(
    serverConfig: ServerConfig,
    traceStore: TraceStore,
    options: ServerRunnerOptions = {},
  ) {
    this.serverConfig = serverConfig;
    this.traceStore = traceStore;
    this.options = options;
  }

  /**
   * Start the MCP server and establish connection
   */
  async start(): Promise<void> {
    if (this.serverConfig.transport === "stdio") {
      await this.startStdioServer();
    } else {
      await this.startHttpServer();
    }
  }

  /**
   * Start a stdio-based MCP server
   */
  private async startStdioServer(): Promise<void> {
    if (this.serverConfig.transport !== "stdio") {
      throw new Error("Invalid server config for stdio");
    }

    // Resolve the command - use process.execPath if command is 'node'
    const command =
      this.serverConfig.command === "node"
        ? process.execPath
        : this.serverConfig.command;

    // Merge process.env with server config env, filtering out undefined values
    const env: Record<string, string> = {};

    // Add process.env variables (filter out undefined)
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Add server config env variables (override process.env)
    if (this.serverConfig.env) {
      Object.assign(env, this.serverConfig.env);
    }

    // Start the process
    this.process = execa(command, this.serverConfig.args || [], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Create transport
    const transport = new StdioClientTransport({
      command,
      args: this.serverConfig.args || [],
      env,
    });

    // Initialize client
    this.client = new Client(
      {
        name: "mcpvals-evaluator",
        version: "0.0.1",
      },
      {
        capabilities: {},
      },
    );

    // Set up tracing
    this.setupTracing();

    // Connect
    await this.client.connect(transport);

    if (this.options.debug) {
      console.log("Connected to stdio MCP server");
    }
  }

  /**
   * Start an HTTP-based MCP server connection
   */
  private async startHttpServer(): Promise<void> {
    if (this.serverConfig.transport !== "shttp") {
      throw new Error("Invalid server config for HTTP");
    }

    // Create StreamableHTTP transport with proper options
    const transport = new StreamableHTTPClientTransport(
      new URL(this.serverConfig.url),
      {
        requestInit: {
          headers: this.serverConfig.headers,
        },
        // Optional: Add reconnection options if needed
        reconnectionOptions: {
          maxReconnectionDelay: 30000,
          initialReconnectionDelay: 1000,
          reconnectionDelayGrowFactor: 1.5,
          maxRetries: 2,
        },
      },
    );

    // Initialize client
    this.client = new Client(
      {
        name: "mcpvals-evaluator",
        version: "0.0.1",
      },
      {
        capabilities: {},
      },
    );

    // Set up tracing
    this.setupTracing();

    // Connect
    await this.client.connect(transport);

    if (this.options.debug) {
      console.log("Connected to HTTP MCP server");
      if (this.serverConfig.headers) {
        console.log(
          "Using custom headers:",
          Object.keys(this.serverConfig.headers),
        );
      }
    }
  }

  /**
   * Set up message tracing
   */
  private setupTracing(): void {
    if (!this.client) return;

    // The MCP SDK client doesn't expose a direct way to intercept messages
    // We'll rely on our wrapper methods (listTools, callTool) to track operations
    // For now, we'll log that tracing is set up
    if (this.options.debug) {
      console.log("Tracing enabled for MCP client");
    }
  }

  /**
   * Get the MCP client instance
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error("Server not started");
    }
    return this.client;
  }

  /**
   * List available tools
   */
  async listTools() {
    const client = this.getClient();
    const response = await client.listTools();
    return response.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>) {
    const client = this.getClient();
    const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Record the tool call
    this.traceStore.addToolCall({
      id: toolCallId,
      name,
      arguments: args,
      timestamp: new Date(),
    });

    try {
      const response = await client.callTool({
        name,
        arguments: args,
      });

      // Record the result
      this.traceStore.addToolResult({
        id: `result_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        toolCallId,
        result: response,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      // Record the error
      this.traceStore.addToolResult({
        id: `result_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        toolCallId,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Convert MCP tools to AI SDK tools
   */
  private async getMcpToolsForAI(): Promise<
    Record<string, ReturnType<typeof tool>>
  > {
    const mcpTools = await this.listTools();
    const aiTools: Record<string, ReturnType<typeof tool>> = {};

    for (const mcpTool of mcpTools) {
      // Create a simple Zod schema based on MCP tool schema
      let parameters = z.object({});

      if (
        mcpTool.inputSchema?.type === "object" &&
        mcpTool.inputSchema.properties
      ) {
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const [propName, propSchema] of Object.entries(
          mcpTool.inputSchema.properties,
        )) {
          // Type the property schema properly - JSON Schema format
          const prop = propSchema as { type?: string; description?: string };
          let zodType: z.ZodTypeAny;

          switch (prop.type) {
            case "string":
              zodType = z.string();
              break;
            case "number":
              zodType = z.number();
              break;
            case "boolean":
              zodType = z.boolean();
              break;
            case "array":
              zodType = z.array(z.unknown());
              break;
            case "object":
              zodType = z.object({});
              break;
            default:
              zodType = z.string(); // Default to string for unknown types
          }

          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }

          // Check if required
          const isRequired =
            mcpTool.inputSchema?.required?.includes(propName) ?? false;
          if (!isRequired) {
            zodType = zodType.optional();
          }

          shape[propName] = zodType;
        }

        parameters = z.object(shape);
      }

      aiTools[mcpTool.name] = tool({
        description: mcpTool.description || `Execute ${mcpTool.name}`,
        parameters,
        execute: async (args: Record<string, unknown>) => {
          const result = await this.callTool(mcpTool.name, args);
          return result;
        },
      }) as unknown as ReturnType<typeof tool>;
    }

    return aiTools;
  }

  /**
   * Run a workflow using AI SDK with proper MCP integration
   * This follows MCP patterns where the LLM controls tool calling
   */
  async runWorkflowWithLLM(
    steps: Array<{
      user: string;
      expectTools?: string[];
      expectedState?: string;
    }>,
  ): Promise<{
    success: boolean;
    messages: Array<{ role: string; content: string }>;
    toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      error?: string;
    }>;
    conversationText: string;
  }> {
    const aiTools = await this.getMcpToolsForAI();
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    const toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      error?: string;
    }> = [];

    // System prompt for MCP workflow evaluation
    const systemPrompt = `You are an AI assistant evaluating an MCP server workflow. 
You have access to MCP tools that you should use to complete user requests.
Be helpful and use the appropriate tools when needed to fulfill each request.
Focus on completing the tasks accurately and efficiently.`;

    for (const step of steps) {
      messages.push({ role: "user", content: step.user });

      try {
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
          throw new Error(
            "ANTHROPIC_API_KEY environment variable is required for workflow execution",
          );
        }

        const anthropic = createAnthropic({
          apiKey: anthropicApiKey,
        });

        const result = await generateText({
          model: anthropic("claude-3-5-sonnet-20241022"),
          system: systemPrompt,
          messages,
          tools: aiTools,
          maxSteps: 5,
        });

        // Extract text and tool results from generateText result
        const finalText = result.text;
        const stepToolCalls: Array<{
          name: string;
          args: Record<string, unknown>;
          result: unknown;
          error?: string;
        }> = [];

        // Process tool calls and results if any
        if (result.toolCalls && result.toolResults) {
          for (let i = 0; i < result.toolCalls.length; i++) {
            const toolCall = result.toolCalls[i];
            const toolResult = result.toolResults[i];
            stepToolCalls.push({
              name: toolCall.toolName,
              args: toolCall.args,
              result: toolResult,
              error: undefined,
            });
          }
        }

        messages.push({ role: "assistant", content: finalText });
        toolCalls.push(...stepToolCalls);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        messages.push({ role: "assistant", content: `Error: ${errorMsg}` });

        toolCalls.push({
          name: "error",
          args: {},
          result: null,
          error: errorMsg,
        });
      }
    }

    // Evaluate success based on expected state and tool execution
    const lastStep = steps[steps.length - 1];
    const finalMessage = messages[messages.length - 1]?.content || "";
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const hasExpectedState =
      !lastStep.expectedState ||
      finalMessage
        .toLowerCase()
        .includes(lastStep.expectedState.toLowerCase()) ||
      toolCalls.some(
        (tc) =>
          tc.result &&
          String(tc.result)
            .toLowerCase()
            .includes(lastStep.expectedState!.toLowerCase()),
      );

    const hasErrors = toolCalls.some((tc) => tc.error);
    const success = hasExpectedState && !hasErrors;

    return {
      success,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      toolCalls,
      conversationText,
    };
  }

  /**
   * Stop the server and clean up
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }

    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }

    if (this.options.debug) {
      console.log("MCP server stopped");
    }
  }
}
