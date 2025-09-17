export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  uptime: number;
  gcCount?: number;
  gcDuration?: number;
}

export interface PerformanceThresholds {
  maxHeapUsedMB: number;
  maxRssMB: number;
  maxTestDurationMs: number;
  gcTriggerThresholdMB: number;
}
