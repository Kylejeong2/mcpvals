import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { TraceStoreOptions } from "./trace.js";
import { PerformanceThresholds } from "./performance.js";
import {
  RetryOptions,
  CircuitBreakerOptions,
  RateLimiterOptions,
} from "./resilience.js";

export type MCPTransports =
  | SSEClientTransport
  | StreamableHTTPClientTransport
  | StdioClientTransport;

export interface ServerRunnerOptions {
  timeout?: number;
  debug?: boolean;
  model?: string; // Anthropic model name
  performanceThresholds?: Partial<PerformanceThresholds>;
  traceStoreOptions?: TraceStoreOptions;
  retryOptions?: Partial<RetryOptions>;
  circuitBreakerOptions?: Partial<CircuitBreakerOptions>;
  rateLimiterOptions?: Partial<RateLimiterOptions>;
  enableResilience?: boolean;
}
