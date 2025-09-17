import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

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
