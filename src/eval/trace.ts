import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface TraceEntry {
  timestamp: Date;
  direction: 'client->server' | 'server->client';
  message: JSONRPCMessage;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  timestamp: Date;
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  result: any;
  error?: string;
  httpStatus?: number;
  timestamp: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export class TraceStore {
  private traces: TraceEntry[] = [];
  private toolCalls: ToolCall[] = [];
  private toolResults: ToolResult[] = [];
  private conversation: ConversationMessage[] = [];

  /**
   * Add a raw trace entry
   */
  addTrace(entry: TraceEntry): void {
    this.traces.push(entry);
  }

  /**
   * Add a conversation message
   */
  addMessage(message: ConversationMessage): void {
    this.conversation.push(message);
  }

  /**
   * Record a tool call
   */
  addToolCall(toolCall: ToolCall): void {
    this.toolCalls.push(toolCall);
  }

  /**
   * Record a tool result
   */
  addToolResult(result: ToolResult): void {
    this.toolResults.push(result);
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
    return this.toolResults.find(r => r.toolCallId === toolCallId);
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
} 