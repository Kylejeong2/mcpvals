/**
 * ServerRunner - MCP Server Evaluation Client
 *
 * ARCHITECTURAL NOTE: This class implements evaluation testing for MCP servers from the CLIENT perspective.
 * Some MCP features like Sampling are designed for server-to-client communication, so we simulate
 * server behavior for evaluation purposes:
 *
 * - Tools: Direct client-to-server calls (real MCP operations)
 * - Workflows: LLM-driven integration testing using real MCP tools
 *
 * The redundant `client = this.getClient()` calls are kept for consistency with MCP SDK patterns
 * and to ensure fresh client state per operation.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { execa, ExecaChildProcess } from "execa";
import { ServerConfig } from "./config.js";
import { TraceStore } from "./trace.js";
import { PerformanceMonitor } from "../infrastructure/performance.js";
import { ResilienceManager } from "../infrastructure/resilience.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { MCPTransports, ServerRunnerOptions } from "../../types/server.js";

export class ServerRunner {
  private client?: Client;
  private process?: ExecaChildProcess;
  private traceStore: TraceStore;
  private serverConfig: ServerConfig;
  private options: ServerRunnerOptions;
  private performanceMonitor: PerformanceMonitor;
  private resilienceManager: ResilienceManager;
  private sseConnectionState: "connecting" | "connected" | "disconnected" =
    "disconnected";
  private reconnectTimeout?: NodeJS.Timeout;
  private currentTransport?: MCPTransports;
  private reconnectAttempts?: number;
  private currentErrorHandler?: (error: Error) => void;

  constructor(
    serverConfig: ServerConfig,
    traceStore?: TraceStore,
    options: ServerRunnerOptions = {},
  ) {
    this.serverConfig = serverConfig;
    this.traceStore = traceStore || new TraceStore(options.traceStoreOptions);
    this.options = options;

    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor(
      options.performanceThresholds,
    );

    // Initialize resilience management
    this.resilienceManager = new ResilienceManager();

    if (options.enableResilience !== false) {
      // Create default resilience components
      this.resilienceManager.createRetryHandler(
        "default",
        options.retryOptions,
      );
      this.resilienceManager.createCircuitBreaker(
        "mcp-server",
        options.circuitBreakerOptions,
      );
      this.resilienceManager.createRateLimiter(
        "llm-calls",
        options.rateLimiterOptions,
      );
    }
  }

  /**
   * Start the MCP server and establish connection
   */
  async start(): Promise<void> {
    // Start performance monitoring
    this.performanceMonitor.start();

    if (this.options.debug) {
      console.log("Starting performance monitoring...");
    }

    // Start server with resilience
    await this.resilienceManager.executeWithResilience(
      async () => {
        if (this.serverConfig.transport === "stdio") {
          await this.startStdioServer();
        } else if (this.serverConfig.transport === "shttp") {
          await this.startHttpServer();
        } else if (this.serverConfig.transport === "sse") {
          await this.startSseServer();
        }
      },
      {
        retryHandler: "default",
        circuitBreaker: "mcp-server",
      },
    );
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
   * Start an SSE-based MCP server connection
   */
  private async startSseServer(): Promise<void> {
    if (this.serverConfig.transport !== "sse") {
      throw new Error("Invalid server config for SSE");
    }

    this.sseConnectionState = "connecting";

    try {
      await this.createSseConnection();
    } catch (error) {
      this.sseConnectionState = "disconnected";
      throw error;
    }
  }

  private async createSseConnection(): Promise<void> {
    if (this.serverConfig.transport !== "sse") {
      throw new Error("Invalid server config for SSE connection");
    }

    // Clean up any existing timeout
    this.clearReconnectTimeout();

    // Create new SSE transport for each connection attempt
    const transport = new SSEClientTransport(new URL(this.serverConfig.url), {
      requestInit: {
        headers: this.serverConfig.headers,
      },
    });

    this.currentTransport = transport;

    // Initialize client if not already done
    if (!this.client) {
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
    }

    // Set up reconnection handling if enabled
    if (this.serverConfig.reconnect) {
      this.setupSseReconnection(transport);
    }

    // Connect
    await this.client.connect(transport);
    this.sseConnectionState = "connected";

    if (this.options.debug) {
      console.log("Connected to SSE MCP server");
      if (this.serverConfig.headers) {
        console.log(
          "Using custom headers:",
          Object.keys(this.serverConfig.headers),
        );
      }
      console.log(
        `Reconnection: ${this.serverConfig.reconnect ? "enabled" : "disabled"}`,
      );
      if (this.serverConfig.reconnect) {
        console.log(
          `Max reconnect attempts: ${this.serverConfig.maxReconnectAttempts}`,
        );
        console.log(
          `Reconnect interval: ${this.serverConfig.reconnectInterval}ms`,
        );
      }
    }
  }

  private setupSseReconnection(transport: SSEClientTransport): void {
    if (this.serverConfig.transport !== "sse") {
      return;
    }

    // Initialize reconnect attempts if not already set
    if (this.reconnectAttempts === undefined) {
      this.reconnectAttempts = 0;
    }

    const maxAttempts = this.serverConfig.maxReconnectAttempts || 10;
    const reconnectInterval = this.serverConfig.reconnectInterval || 5000;

    const errorHandler = (error: Error) => {
      if (this.options.debug) {
        console.log(`SSE connection error:`, error);
      }

      // Prevent multiple concurrent reconnection attempts
      if (this.sseConnectionState === "connecting") {
        return;
      }

      this.sseConnectionState = "disconnected";

      if (this.reconnectAttempts! < maxAttempts) {
        this.reconnectAttempts!++;
        if (this.options.debug) {
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${maxAttempts}) in ${reconnectInterval}ms...`,
          );
        }

        this.sseConnectionState = "connecting";
        this.reconnectTimeout = setTimeout(async () => {
          try {
            await this.createSseConnection();
            this.reconnectAttempts = 0; // Reset counter on successful reconnection
            if (this.options.debug) {
              console.log("SSE reconnection successful");
            }
          } catch (reconnectError) {
            this.sseConnectionState = "disconnected";
            if (this.options.debug) {
              console.log("SSE reconnection failed:", reconnectError);
            }
          }
        }, reconnectInterval);
      } else {
        if (this.options.debug) {
          console.log(
            `Max reconnection attempts (${maxAttempts}) reached. Giving up.`,
          );
        }
      }
    };

    // Clean up any existing error handler
    if (this.currentErrorHandler) {
      transport.onerror = undefined;
    }

    this.currentErrorHandler = errorHandler;
    transport.onerror = errorHandler;
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
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
      const response = await this.resilienceManager.executeWithResilience(
        async () => {
          return await client.callTool({
            name,
            arguments: args,
          });
        },
        {
          retryHandler: "default",
          circuitBreaker: "mcp-server",
        },
      );

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

        // Capture the current number of recorded tool calls to later slice new ones
        const toolCallsBeforeCount = this.traceStore.getToolCalls().length;

        const result = await this.resilienceManager.executeWithResilience(
          async () => {
            return await generateText({
              model: anthropic("claude-3-5-sonnet-20241022"),
              system: systemPrompt,
              messages,
              tools: aiTools,
              maxSteps: 5,
            });
          },
          {
            retryHandler: "default",
            rateLimiter: "llm-calls",
          },
        );

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
          const newCalls = this.traceStore
            .getToolCalls()
            .slice(toolCallsBeforeCount);

          for (let i = 0; i < result.toolCalls.length; i++) {
            const toolCall = result.toolCalls[i];
            const toolResult = result.toolResults[i];
            const recorded = newCalls[i];

            stepToolCalls.push({
              name: toolCall.toolName,
              args: toolCall.args,
              result: toolResult,
              error: undefined,
            });

            if (recorded) {
              (stepToolCalls as Array<any>)[stepToolCalls.length - 1].id =
                recorded.id;
            }
          }
        }

        messages.push({ role: "assistant", content: finalText });

        // Record the conversation messages in trace store for evaluation
        this.traceStore.addMessage({
          role: "user",
          content: step.user,
          timestamp: new Date(),
        });
        // Associate assistant message with real tool call ids when available
        const resolvedIds: string[] = [];
        for (const tc of stepToolCalls as Array<any>) {
          if (tc.id) resolvedIds.push(tc.id as string);
        }

        // Prefer referencing by ids to avoid duplicating calls; fall back to embedding toolCalls for visibility
        this.traceStore.addMessage({
          role: "assistant",
          content: finalText,
          toolCallIds: resolvedIds.length > 0 ? resolvedIds : undefined,
          toolCalls:
            resolvedIds.length === 0
              ? stepToolCalls.map((tc) => ({
                  id: `call_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2)}`,
                  name: tc.name,
                  arguments: tc.args,
                  timestamp: new Date(),
                }))
              : undefined,
          timestamp: new Date(),
        });

        toolCalls.push(...stepToolCalls);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        messages.push({ role: "assistant", content: `Error: ${errorMsg}` });

        // Record the conversation messages in trace store for error case
        this.traceStore.addMessage({
          role: "user",
          content: step.user,
          timestamp: new Date(),
        });
        this.traceStore.addMessage({
          role: "assistant",
          content: `Error: ${errorMsg}`,
          timestamp: new Date(),
        });

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
    // Clear SSE reconnection timeout
    this.clearReconnectTimeout();

    // Close current transport if it exists
    if (
      this.currentTransport &&
      typeof this.currentTransport.close === "function"
    ) {
      try {
        await this.currentTransport.close();
      } catch (error) {
        if (this.options.debug) {
          console.log("Error closing transport:", error);
        }
      }
    }

    // Stop performance monitoring
    this.performanceMonitor.stop();

    if (this.options.debug) {
      // Report final performance metrics
      const metrics = this.performanceMonitor.getCurrentMetrics();
      const memoryDelta = this.performanceMonitor.getMemoryDelta();
      const resilienceMetrics = this.resilienceManager.getAllMetrics();
      const traceMemory = this.traceStore.getMemoryUsage();

      console.log("=== Final Performance Report ===");
      if (metrics) {
        console.log(`Uptime: ${(metrics.uptime / 1000).toFixed(1)}s`);
        console.log(
          `Memory Delta: Heap +${(memoryDelta.heapUsed / (1024 * 1024)).toFixed(1)}MB, RSS +${(memoryDelta.rss / (1024 * 1024)).toFixed(1)}MB`,
        );
        console.log(`GC Count: ${metrics.gcCount || 0}`);
      }
      console.log(
        `Trace Memory: ${traceMemory.total} entries (${traceMemory.traces} traces, ${traceMemory.toolCalls} tool calls)`,
      );

      // Report resilience metrics
      const circuitBreakerEntries = Object.entries(
        resilienceMetrics.circuitBreakers,
      );
      if (circuitBreakerEntries.length > 0) {
        console.log("Circuit Breakers:");
        circuitBreakerEntries.forEach(([name, metrics]) => {
          console.log(
            `  ${name}: ${metrics.state} (${metrics.failureCount} failures, ${metrics.successCount} successes)`,
          );
        });
      }

      const rateLimiterEntries = Object.entries(resilienceMetrics.rateLimiters);
      if (rateLimiterEntries.length > 0) {
        console.log("Rate Limiters:");
        rateLimiterEntries.forEach(([name, metrics]) => {
          console.log(
            `  ${name}: ${metrics.requestsInWindow}/${metrics.maxRequests} requests, ${metrics.burstTokens} burst tokens`,
          );
        });
      }
    }

    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }

    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }

    // Reset SSE state
    this.sseConnectionState = "disconnected";
    this.currentTransport = undefined;

    // Clean up trace store
    this.traceStore.destroy();

    if (this.options.debug) {
      console.log("MCP server stopped and resources cleaned up");
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      current: this.performanceMonitor.getCurrentMetrics(),
      memoryDelta: this.performanceMonitor.getMemoryDelta(),
      resilience: this.resilienceManager.getAllMetrics(),
      traceMemory: this.traceStore.getMemoryUsage(),
      isHealthy: this.performanceMonitor.isMemoryHealthy(),
    };
  }

  /**
   * Force cleanup of resources
   */
  forceCleanup(): void {
    this.traceStore.forceCleanup();
    this.performanceMonitor.forceGarbageCollection();
  }
}
