export interface ToolTestResult {
  testName: string;
  toolName: string;
  passed: boolean;
  score: number;
  latency: number;
  details: string;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ToolHealthResult {
  suiteName: string;
  description?: string;
  results: ToolTestResult[];
  overallScore: number;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatency: number;
}
