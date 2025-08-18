import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { PERFORMANCE_CONSTANTS } from "../infrastructure/performance.js";

export interface TraceEntry {
  timestamp: Date;
  direction: "client->server" | "server->client";
  message: JSONRPCMessage;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
  timestamp: Date;
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  result: unknown;
  error?: string;
  httpStatus?: number;
  timestamp: Date;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface TraceStoreOptions {
  maxTraceEntries?: number;
  maxToolCalls?: number;
  maxToolResults?: number;
  maxConversationMessages?: number;
  enableCleanup?: boolean;
  cleanupIntervalMs?: number;
  retentionTimeMs?: number;
}

export class TraceStore {
  private traces: TraceEntry[] = [];
  private toolCalls: ToolCall[] = [];
  private toolResults: ToolResult[] = [];
  private conversation: ConversationMessage[] = [];
  private options: Required<TraceStoreOptions>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: TraceStoreOptions = {}) {
    this.options = {
      maxTraceEntries:
        options.maxTraceEntries ?? PERFORMANCE_CONSTANTS.MAX_TRACE_ENTRIES,
      maxToolCalls:
        options.maxToolCalls ?? PERFORMANCE_CONSTANTS.MAX_TOOL_CALLS,
      maxToolResults:
        options.maxToolResults ?? PERFORMANCE_CONSTANTS.MAX_TOOL_CALLS,
      maxConversationMessages: options.maxConversationMessages ?? 1000,
      enableCleanup: options.enableCleanup ?? true,
      cleanupIntervalMs:
        options.cleanupIntervalMs ?? PERFORMANCE_CONSTANTS.CLEANUP_INTERVAL_MS,
      retentionTimeMs: options.retentionTimeMs ?? 300000, // 5 minutes
    };

    if (this.options.enableCleanup) {
      this.startCleanupInterval();
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    const retentionTime = this.options.retentionTimeMs;

    // Clean up old traces
    if (this.traces.length > this.options.maxTraceEntries) {
      const keepCount = Math.floor(this.options.maxTraceEntries * 0.8);
      this.traces = this.traces.slice(-keepCount);
    }

    // Clean up old tool calls
    if (this.toolCalls.length > this.options.maxToolCalls) {
      const keepCount = Math.floor(this.options.maxToolCalls * 0.8);
      this.toolCalls = this.toolCalls.slice(-keepCount);
    }

    // Clean up old tool results
    if (this.toolResults.length > this.options.maxToolResults) {
      const keepCount = Math.floor(this.options.maxToolResults * 0.8);
      this.toolResults = this.toolResults.slice(-keepCount);
    }

    // Clean up old conversation messages
    if (this.conversation.length > this.options.maxConversationMessages) {
      const keepCount = Math.floor(this.options.maxConversationMessages * 0.8);
      this.conversation = this.conversation.slice(-keepCount);
    }

    // Clean up by retention time
    this.traces = this.traces.filter(
      (t) => now - t.timestamp.getTime() < retentionTime,
    );
    this.toolCalls = this.toolCalls.filter(
      (tc) => now - tc.timestamp.getTime() < retentionTime,
    );
    this.toolResults = this.toolResults.filter(
      (tr) => now - tr.timestamp.getTime() < retentionTime,
    );
    this.conversation = this.conversation.filter(
      (cm) => now - cm.timestamp.getTime() < retentionTime,
    );
  }

  /**
   * Add a raw trace entry
   */
  addTrace(entry: TraceEntry): void {
    this.traces.push(entry);

    // Immediate cleanup if we exceed limits
    if (this.traces.length > this.options.maxTraceEntries * 1.2) {
      this.traces = this.traces.slice(-this.options.maxTraceEntries);
    }
  }

  /**
   * Add a conversation message
   */
  addMessage(message: ConversationMessage): void {
    this.conversation.push(message);

    // Immediate cleanup if we exceed limits
    if (this.conversation.length > this.options.maxConversationMessages * 1.2) {
      this.conversation = this.conversation.slice(
        -this.options.maxConversationMessages,
      );
    }
  }

  /**
   * Record a tool call
   */
  addToolCall(toolCall: ToolCall): void {
    this.toolCalls.push(toolCall);

    // Immediate cleanup if we exceed limits
    if (this.toolCalls.length > this.options.maxToolCalls * 1.2) {
      this.toolCalls = this.toolCalls.slice(-this.options.maxToolCalls);
    }
  }

  /**
   * Record a tool result
   */
  addToolResult(result: ToolResult): void {
    this.toolResults.push(result);

    // Immediate cleanup if we exceed limits
    if (this.toolResults.length > this.options.maxToolResults * 1.2) {
      this.toolResults = this.toolResults.slice(-this.options.maxToolResults);
    }
  }

  /**
   * Get all traces
   */
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }

  /**
   * Get all tool calls in order
   */
  getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  /**
   * Get all tool results
   */
  getToolResults(): ToolResult[] {
    return [...this.toolResults];
  }

  /**
   * Get the conversation history
   */
  getConversation(): ConversationMessage[] {
    return [...this.conversation];
  }

  /**
   * Get tool result for a specific tool call
   */
  getToolResult(toolCallId: string): ToolResult | undefined {
    return this.toolResults.find((r) => r.toolCallId === toolCallId);
  }

  /**
   * Get the last message in the conversation
   */
  getLastMessage(): ConversationMessage | undefined {
    return this.conversation[this.conversation.length - 1];
  }

  /**
   * Export all data for analysis
   */
  export() {
    return {
      traces: this.traces,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults,
      conversation: this.conversation,
    };
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.traces = [];
    this.toolCalls = [];
    this.toolResults = [];
    this.conversation = [];
  }

  /**
   * Force cleanup of old data
   */
  forceCleanup(): void {
    this.cleanup();
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    traces: number;
    toolCalls: number;
    toolResults: number;
    conversation: number;
    total: number;
  } {
    return {
      traces: this.traces.length,
      toolCalls: this.toolCalls.length,
      toolResults: this.toolResults.length,
      conversation: this.conversation.length,
      total:
        this.traces.length +
        this.toolCalls.length +
        this.toolResults.length +
        this.conversation.length,
    };
  }

  /**
   * Stop cleanup interval and release resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}
