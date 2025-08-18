/**
 * ServerRunner - MCP Server Evaluation Client
 *
 * ARCHITECTURAL NOTE: This class implements evaluation testing for MCP servers from the CLIENT perspective.
 * Some MCP features like Sampling are designed for server-to-client communication, so we simulate
 * server behavior for evaluation purposes:
 *
 * - Tools/Resources/Prompts: Direct client-to-server calls (real MCP operations)
 * - Sampling: Simulated server-to-client requests (evaluation testing)
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
import { TraceStore, TraceStoreOptions } from "./trace.js";
import {
  PerformanceMonitor,
  PerformanceThresholds,
} from "../infrastructure/performance.js";
import {
  ResilienceManager,
  RetryOptions,
  CircuitBreakerOptions,
  RateLimiterOptions,
} from "../infrastructure/resilience.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";

type MCPTransports =
  | SSEClientTransport
  | StreamableHTTPClientTransport
  | StdioClientTransport;

export interface ServerRunnerOptions {
  timeout?: number;
  debug?: boolean;
  performanceThresholds?: Partial<PerformanceThresholds>;
  traceStoreOptions?: TraceStoreOptions;
  retryOptions?: Partial<RetryOptions>;
  circuitBreakerOptions?: Partial<CircuitBreakerOptions>;
  rateLimiterOptions?: Partial<RateLimiterOptions>;
  enableResilience?: boolean;
}

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
        capabilities: {
          sampling: {},
        },
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
        capabilities: {
          sampling: {},
        },
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
          capabilities: {
            sampling: {},
          },
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
   * List available resources
   */
  async listResources(params?: Record<string, unknown>) {
    const client = this.getClient();
    const response = await client.listResources(params);
    return {
      resources: response.resources || [],
      nextCursor: response.nextCursor,
    };
  }

  /**
   * Read a resource
   */
  async readResource(uri: string) {
    const client = this.getClient();
    const response = await client.readResource({ uri });
    return {
      contents: response.contents || [],
    };
  }

  /**
   * List available resource templates
   */
  async listResourceTemplates(params?: Record<string, unknown>) {
    const client = this.getClient();
    const response = await client.listResourceTemplates(params);
    return {
      resourceTemplates: response.resourceTemplates || [],
      nextCursor: response.nextCursor,
    };
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeToResource(uri: string) {
    const client = this.getClient();
    try {
      const response = await client.subscribeResource({ uri });
      return response;
    } catch (error) {
      // Some servers might not support subscriptions
      throw new Error(
        `Resource subscription failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeFromResource(uri: string) {
    const client = this.getClient();
    try {
      const response = await client.unsubscribeResource({ uri });
      return response;
    } catch (error) {
      throw new Error(
        `Resource unsubscription failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List available prompts
   */
  async listPrompts(params?: Record<string, unknown>) {
    const client = this.getClient();
    const response = await client.listPrompts(params);
    return {
      prompts: response.prompts || [],
      nextCursor: response.nextCursor,
    };
  }

  /**
   * Get a prompt with arguments
   */
  async getPrompt(name: string, args?: Record<string, unknown>) {
    const client = this.getClient();
    // Convert unknown values to JSON strings to ensure type compatibility
    const stringifiedArgs: Record<string, string> = {};
    if (args) {
      for (const [key, value] of Object.entries(args)) {
        stringifiedArgs[key] =
          typeof value === "string" ? value : JSON.stringify(value);
      }
    }

    const response = await client.getPrompt({
      name,
      arguments: stringifiedArgs,
    });
    return {
      description: response.description,
      messages: response.messages || [],
    };
  }

  /**
   * Check if the server supports sampling capability
   */
  async checkSamplingCapability(): Promise<boolean> {
    try {
      // Check if sampling capability was negotiated during connection
      // In MCP, capabilities are exchanged during the initialization handshake
      // Since we don't have direct capability introspection in the current SDK,
      // we'll assume sampling is supported and let specific operations fail if needed
      return true;
    } catch (error) {
      console.warn("Failed to check sampling capability:", error);
      return false;
    }
  }

  /**
   * Create a sampling message request to the server
   * This simulates the server requesting LLM completions from the client
   */
  async createSamplingMessage(request: {
    includeContext?: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
    messages: Array<{
      role: "user" | "assistant";
      content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }>;
    modelPreferences?: {
      costPriority?: number;
      speedPriority?: number;
      intelligencePriority?: number;
    };
    systemPrompt?: string;
    maxTokens?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{
    requestId: string;
    userApprovalRequired: boolean;
    messages: unknown[];
  }> {
    // NOTE: Sampling in MCP is server-to-client communication (server requests LLM completions)
    // Since we're an evaluation client testing the server, we simulate the server's perspective
    // In production, the server would send sampling/createMessage requests to the client
    const requestId = `sampling_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    try {
      // In a real MCP sampling scenario, the server would send a sampling request
      // to the client via the createMessage notification
      // For evaluation purposes, we simulate this interaction

      // Validate model preferences if provided
      if (request.modelPreferences) {
        const { costPriority, speedPriority, intelligencePriority } =
          request.modelPreferences;
        if (
          (costPriority !== undefined &&
            (costPriority < 0 || costPriority > 1)) ||
          (speedPriority !== undefined &&
            (speedPriority < 0 || speedPriority > 1)) ||
          (intelligencePriority !== undefined &&
            (intelligencePriority < 0 || intelligencePriority > 1))
        ) {
          throw new Error("Model preferences must be between 0 and 1");
        }
      }

      // Prepare the sampling request structure for evaluation tracing
      const samplingRequest = {
        includeContext: request.includeContext || [],
        messages: request.messages,
        modelPreferences: request.modelPreferences || {},
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens || 1000,
        metadata: {
          ...request.metadata,
          requestId,
          evaluationMode: true,
        },
      };

      // Record the sampling request for evaluation tracing
      this.traceStore.addToolCall({
        id: requestId,
        name: "sampling/createMessage",
        arguments: samplingRequest,
        timestamp: new Date(),
      });

      // Per MCP spec, sampling requests require user approval (human-in-the-loop)
      // For evaluation purposes, we always simulate this requirement
      const userApprovalRequired = true;

      // Simulate the response structure that would come from a real sampling implementation
      return {
        requestId,
        userApprovalRequired,
        messages: request.messages,
      };
    } catch (error) {
      // Record the error
      this.traceStore.addToolResult({
        id: `result_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        toolCallId: requestId,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      throw new Error(
        `Sampling request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Simulate user approval for sampling requests
   */
  async simulateUserApproval(
    requestId: string,
    approved: boolean,
    modifiedRequest?: {
      messages?: Array<{
        role: "user" | "assistant";
        content: {
          type: "text" | "image";
          text?: string;
          data?: string;
          mimeType?: string;
        };
      }>;
      modelPreferences?: {
        costPriority?: number;
        speedPriority?: number;
        intelligencePriority?: number;
      };
    },
  ): Promise<{
    approved: boolean;
    response?: {
      role: "assistant";
      content: {
        type: "text";
        text: string;
      };
    };
    error?: string;
  }> {
    try {
      if (!approved) {
        // User rejected the sampling request
        this.traceStore.addToolResult({
          id: `approval_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          toolCallId: requestId,
          result: { approved: false, reason: "User rejected sampling request" },
          timestamp: new Date(),
        });

        return {
          approved: false,
          error: "User rejected sampling request",
        };
      }

      // User approved - simulate LLM response
      // In a real implementation, this would call the actual LLM
      const mockResponse = {
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: "This is a simulated response for sampling evaluation. The request was approved and processed successfully.",
        },
      };

      // Record the successful approval and response
      this.traceStore.addToolResult({
        id: `approval_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        toolCallId: requestId,
        result: {
          approved: true,
          response: mockResponse,
          modifiedRequest: modifiedRequest,
        },
        timestamp: new Date(),
      });

      return {
        approved: true,
        response: mockResponse,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.traceStore.addToolResult({
        id: `approval_error_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        toolCallId: requestId,
        result: null,
        error: errorMessage,
        timestamp: new Date(),
      });

      return {
        approved: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate model preferences according to MCP sampling spec
   */
  validateModelPreferences(preferences?: {
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!preferences) {
      return { valid: true, errors: [] };
    }

    // All priorities should be between 0 and 1
    if (preferences.costPriority !== undefined) {
      if (preferences.costPriority < 0 || preferences.costPriority > 1) {
        errors.push("costPriority must be between 0 and 1");
      }
    }

    if (preferences.speedPriority !== undefined) {
      if (preferences.speedPriority < 0 || preferences.speedPriority > 1) {
        errors.push("speedPriority must be between 0 and 1");
      }
    }

    if (preferences.intelligencePriority !== undefined) {
      if (
        preferences.intelligencePriority < 0 ||
        preferences.intelligencePriority > 1
      ) {
        errors.push("intelligencePriority must be between 0 and 1");
      }
    }

    // Optionally check that priorities sum to 1 (though this may not be strictly required)
    const total =
      (preferences.costPriority || 0) +
      (preferences.speedPriority || 0) +
      (preferences.intelligencePriority || 0);

    if (total > 0 && Math.abs(total - 1) > 0.001) {
      // Allow some tolerance for floating point arithmetic
      console.warn(
        `Model preferences total ${total}, consider normalizing to sum to 1`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate sampling message content types
   */
  validateSamplingContent(
    messages: Array<{
      role: "user" | "assistant";
      content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (!["user", "assistant"].includes(message.role)) {
        errors.push(
          `Message ${i}: Invalid role '${message.role}', must be 'user' or 'assistant'`,
        );
      }

      if (!["text", "image"].includes(message.content.type)) {
        errors.push(
          `Message ${i}: Invalid content type '${message.content.type}', must be 'text' or 'image'`,
        );
      }

      if (message.content.type === "text") {
        if (!message.content.text) {
          errors.push(`Message ${i}: Text content requires 'text' field`);
        }
      } else if (message.content.type === "image") {
        if (!message.content.data) {
          errors.push(
            `Message ${i}: Image content requires 'data' field with base64 encoded image`,
          );
        }
        if (!message.content.mimeType) {
          errors.push(`Message ${i}: Image content requires 'mimeType' field`);
        } else if (!message.content.mimeType.startsWith("image/")) {
          errors.push(`Message ${i}: Image mimeType must start with 'image/'`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
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
          for (let i = 0; i < result.toolCalls.length; i++) {
            const toolCall = result.toolCalls[i];
            const toolResult = result.toolResults[i];

            // NOTE: Tool calls are already recorded in TraceStore by the callTool method
            // when the AI tools execute, so we don't need to record them again here

            stepToolCalls.push({
              name: toolCall.toolName,
              args: toolCall.args,
              result: toolResult,
              error: undefined,
            });
          }
        }

        messages.push({ role: "assistant", content: finalText });

        // Record the conversation messages in trace store for evaluation
        this.traceStore.addMessage({
          role: "user",
          content: step.user,
          timestamp: new Date(),
        });
        this.traceStore.addMessage({
          role: "assistant",
          content: finalText,
          toolCalls: stepToolCalls.map((tc) => ({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            name: tc.name,
            arguments: tc.args,
            timestamp: new Date(),
          })),
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
