import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { execa, ExecaChildProcess } from 'execa';
import { ServerConfig } from './config.js';
import { TraceStore } from './trace.js';

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

  constructor(serverConfig: ServerConfig, traceStore: TraceStore, options: ServerRunnerOptions = {}) {
    this.serverConfig = serverConfig;
    this.traceStore = traceStore;
    this.options = options;
  }

  /**
   * Start the MCP server and establish connection
   */
  async start(): Promise<void> {
    if (this.serverConfig.transport === 'stdio') {
      await this.startStdioServer();
    } else {
      await this.startHttpServer();
    }
  }

  /**
   * Start a stdio-based MCP server
   */
  private async startStdioServer(): Promise<void> {
    if (this.serverConfig.transport !== 'stdio') {
      throw new Error('Invalid server config for stdio');
    }

    // Start the process
    this.process = execa(this.serverConfig.command, this.serverConfig.args || [], {
      env: this.serverConfig.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Create transport
    const transport = new StdioClientTransport({
      command: this.serverConfig.command,
      args: this.serverConfig.args || [],
      env: this.serverConfig.env,
    });

    // Initialize client
    this.client = new Client({
      name: 'mcpvals-evaluator',
      version: '0.0.1',
    }, {
      capabilities: {},
    });

    // Set up tracing
    this.setupTracing();

    // Connect
    await this.client.connect(transport);

    if (this.options.debug) {
      console.log('Connected to stdio MCP server');
    }
  }

  /**
   * Start an HTTP-based MCP server connection
   */
  private async startHttpServer(): Promise<void> {
    if (this.serverConfig.transport !== 'shttp') {
      throw new Error('Invalid server config for HTTP');
    }

    // Create SSE transport
    const transport = new SSEClientTransport(new URL(this.serverConfig.url));

    // Initialize client
    this.client = new Client({
      name: 'mcpvals-evaluator',
      version: '0.0.1',
    }, {
      capabilities: {},
    });

    // Set up tracing
    this.setupTracing();

    // Connect
    await this.client.connect(transport);

    if (this.options.debug) {
      console.log('Connected to HTTP MCP server');
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
      console.log('Tracing enabled for MCP client');
    }
  }

  /**
   * Get the MCP client instance
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error('Server not started');
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
  async callTool(name: string, args: any) {
    const client = this.getClient();
    const toolCallId = `tool_${Date.now()}`;
    
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
        id: `result_${Date.now()}`,
        toolCallId,
        result: response,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      // Record the error
      this.traceStore.addToolResult({
        id: `result_${Date.now()}`,
        toolCallId,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      throw error;
    }
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
      console.log('MCP server stopped');
    }
  }
} 