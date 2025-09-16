import { performance } from "perf_hooks";
import {
  PerformanceMetrics,
  PerformanceThresholds,
} from "../../types/performance";

// Default performance thresholds
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  maxHeapUsedMB: 512,
  maxRssMB: 1024,
  maxTestDurationMs: 300000, // 5 minutes
  gcTriggerThresholdMB: 256,
};

// Constants for performance monitoring
export const PERFORMANCE_CONSTANTS = {
  MEMORY_CHECK_INTERVAL_MS: 5000,
  PERFORMANCE_LOG_INTERVAL_MS: 30000,
  GC_FORCE_THRESHOLD_MB: 400,
  CLEANUP_INTERVAL_MS: 60000,
  MAX_TRACE_ENTRIES: 10000,
  MAX_TOOL_CALLS: 5000,
  BYTES_TO_MB: 1024 * 1024,
} as const;

export class PerformanceMonitor {
  private startTime = performance.now();
  private initialMemory = process.memoryUsage();
  private checkInterval?: NodeJS.Timeout;
  private logInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private gcStartTime = 0;
  private gcCount = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...thresholds };
    this.setupGCMonitoring();
  }

  private setupGCMonitoring(): void {
    if (global.gc && typeof global.gc === "function") {
      // Monkey patch global.gc to track GC events
      const originalGc = global.gc;
      // Note: This is a simplified approach. In production, consider using performance hooks
      const trackGC = () => {
        this.gcStartTime = performance.now();
        const result = originalGc();
        const gcDuration = performance.now() - this.gcStartTime;
        this.gcCount++;

        // Update last metrics entry with GC info
        const lastMetrics = this.metrics[this.metrics.length - 1];
        if (lastMetrics) {
          lastMetrics.gcCount = this.gcCount;
          lastMetrics.gcDuration = gcDuration;
        }

        return result;
      };

      // Replace the global gc function
      (global as { gc: typeof trackGC }).gc = trackGC;
    }
  }

  start(): void {
    this.startTime = performance.now();
    this.initialMemory = process.memoryUsage();

    // Start memory monitoring
    this.checkInterval = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
    }, PERFORMANCE_CONSTANTS.MEMORY_CHECK_INTERVAL_MS);

    // Start performance logging
    this.logInterval = setInterval(() => {
      this.logPerformanceMetrics();
    }, PERFORMANCE_CONSTANTS.PERFORMANCE_LOG_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = undefined;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  collectMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = performance.now() - this.startTime;

    const metrics: PerformanceMetrics = {
      memoryUsage,
      cpuUsage,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      uptime,
      gcCount: this.gcCount,
    };

    this.metrics.push(metrics);

    // Keep only recent metrics to avoid memory growth
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }

    return metrics;
  }

  private checkThresholds(): void {
    const current = this.metrics[this.metrics.length - 1];
    if (!current) return;

    const heapUsedMB = current.heapUsed / PERFORMANCE_CONSTANTS.BYTES_TO_MB;
    const rssMB = current.rss / PERFORMANCE_CONSTANTS.BYTES_TO_MB;

    // Check if we should trigger garbage collection
    if (heapUsedMB > this.thresholds.gcTriggerThresholdMB && global.gc) {
      console.warn(
        `Memory usage high (${heapUsedMB.toFixed(1)}MB), triggering GC`,
      );
      global.gc();
    }

    // Check memory thresholds
    if (heapUsedMB > this.thresholds.maxHeapUsedMB) {
      console.warn(
        `Heap usage exceeded threshold: ${heapUsedMB.toFixed(1)}MB > ${this.thresholds.maxHeapUsedMB}MB`,
      );
    }

    if (rssMB > this.thresholds.maxRssMB) {
      console.warn(
        `RSS usage exceeded threshold: ${rssMB.toFixed(1)}MB > ${this.thresholds.maxRssMB}MB`,
      );
    }

    // Check test duration
    if (current.uptime > this.thresholds.maxTestDurationMs) {
      console.warn(
        `Test duration exceeded threshold: ${(current.uptime / 1000).toFixed(1)}s > ${(this.thresholds.maxTestDurationMs / 1000).toFixed(1)}s`,
      );
    }
  }

  private logPerformanceMetrics(): void {
    const current = this.metrics[this.metrics.length - 1];
    if (!current) return;

    const heapUsedMB = (
      current.heapUsed / PERFORMANCE_CONSTANTS.BYTES_TO_MB
    ).toFixed(1);
    const heapTotalMB = (
      current.heapTotal / PERFORMANCE_CONSTANTS.BYTES_TO_MB
    ).toFixed(1);
    const rssMB = (current.rss / PERFORMANCE_CONSTANTS.BYTES_TO_MB).toFixed(1);
    const uptimeS = (current.uptime / 1000).toFixed(1);

    console.log(
      `Performance: Heap ${heapUsedMB}/${heapTotalMB}MB, RSS ${rssMB}MB, Uptime ${uptimeS}s, GC ${current.gcCount || 0} times`,
    );
  }

  getCurrentMetrics(): PerformanceMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getMemoryDelta(): {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  } {
    const current = process.memoryUsage();
    return {
      heapUsed: current.heapUsed - this.initialMemory.heapUsed,
      heapTotal: current.heapTotal - this.initialMemory.heapTotal,
      rss: current.rss - this.initialMemory.rss,
      external: current.external - this.initialMemory.external,
    };
  }

  isMemoryHealthy(): boolean {
    const current = this.getCurrentMetrics();
    if (!current) return true;

    const heapUsedMB = current.heapUsed / PERFORMANCE_CONSTANTS.BYTES_TO_MB;
    const rssMB = current.rss / PERFORMANCE_CONSTANTS.BYTES_TO_MB;

    return (
      heapUsedMB <= this.thresholds.maxHeapUsedMB &&
      rssMB <= this.thresholds.maxRssMB
    );
  }

  forceGarbageCollection(): void {
    if (global.gc) {
      console.log("Forcing garbage collection...");
      global.gc();
    } else {
      console.warn(
        "Garbage collection not available. Run with --expose-gc flag.",
      );
    }
  }

  reset(): void {
    this.metrics = [];
    this.startTime = performance.now();
    this.initialMemory = process.memoryUsage();
    this.gcCount = 0;
  }
}

export function formatBytes(bytes: number): string {
  const mb = bytes / PERFORMANCE_CONSTANTS.BYTES_TO_MB;
  return `${mb.toFixed(1)}MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
