// Error handling and resilience patterns for MCP evaluation

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs?: number;
  retryCondition?: (error: unknown) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  monitoringPeriodMs: number;
}

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
}

// Default configuration constants
export const RETRY_CONSTANTS = {
  DEFAULT_MAX_ATTEMPTS: 3,
  DEFAULT_INITIAL_DELAY_MS: 1000,
  DEFAULT_MAX_DELAY_MS: 30000,
  DEFAULT_BACKOFF_MULTIPLIER: 2,
  DEFAULT_JITTER_MS: 100,
} as const;

export const CIRCUIT_BREAKER_CONSTANTS = {
  DEFAULT_FAILURE_THRESHOLD: 5,
  DEFAULT_RESET_TIMEOUT_MS: 60000,
  DEFAULT_HALF_OPEN_MAX_CALLS: 3,
  DEFAULT_MONITORING_PERIOD_MS: 10000,
} as const;

export const RATE_LIMITER_CONSTANTS = {
  DEFAULT_MAX_REQUESTS: 10,
  DEFAULT_WINDOW_MS: 60000,
  DEFAULT_BURST_LIMIT: 5,
} as const;

export enum CircuitBreakerState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export class ExponentialBackoff {
  private options: Required<RetryOptions>;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? RETRY_CONSTANTS.DEFAULT_MAX_ATTEMPTS,
      initialDelayMs:
        options.initialDelayMs ?? RETRY_CONSTANTS.DEFAULT_INITIAL_DELAY_MS,
      maxDelayMs: options.maxDelayMs ?? RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS,
      backoffMultiplier:
        options.backoffMultiplier ?? RETRY_CONSTANTS.DEFAULT_BACKOFF_MULTIPLIER,
      jitterMs: options.jitterMs ?? RETRY_CONSTANTS.DEFAULT_JITTER_MS,
      retryCondition: options.retryCondition ?? this.defaultRetryCondition,
    };
  }

  private defaultRetryCondition(error: unknown): boolean {
    // Retry on network errors, timeouts, and temporary server errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("connection") ||
        message.includes("temporary") ||
        message.includes("503") ||
        message.includes("502") ||
        message.includes("504")
      );
    }
    return false;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.options.initialDelayMs *
      Math.pow(this.options.backoffMultiplier, attempt - 1);

    const clampedDelay = Math.min(exponentialDelay, this.options.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = this.options.jitterMs
      ? Math.random() * this.options.jitterMs
      : 0;

    return clampedDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry if this is the last attempt or if retry condition fails
        if (
          attempt === this.options.maxAttempts ||
          !this.options.retryCondition(error)
        ) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        console.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : String(error),
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(
    private name: string,
    options: Partial<CircuitBreakerOptions> = {},
  ) {
    this.options = {
      failureThreshold:
        options.failureThreshold ??
        CIRCUIT_BREAKER_CONSTANTS.DEFAULT_FAILURE_THRESHOLD,
      resetTimeoutMs:
        options.resetTimeoutMs ??
        CIRCUIT_BREAKER_CONSTANTS.DEFAULT_RESET_TIMEOUT_MS,
      halfOpenMaxCalls:
        options.halfOpenMaxCalls ??
        CIRCUIT_BREAKER_CONSTANTS.DEFAULT_HALF_OPEN_MAX_CALLS,
      monitoringPeriodMs:
        options.monitoringPeriodMs ??
        CIRCUIT_BREAKER_CONSTANTS.DEFAULT_MONITORING_PERIOD_MS,
    };
  }

  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
          this.setState(CircuitBreakerState.HALF_OPEN);
          this.halfOpenCalls = 0;
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return this.halfOpenCalls < this.options.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      console.log(`Circuit breaker ${this.name}: ${this.state} -> ${newState}`);
      this.state = newState;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successCount >= this.options.halfOpenMaxCalls) {
        this.setState(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.setState(CircuitBreakerState.OPEN);
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.setState(CircuitBreakerState.OPEN);
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker ${this.name} is ${this.state}`);
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    halfOpenCalls: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenCalls: this.halfOpenCalls,
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
    console.log(`Circuit breaker ${this.name} reset`);
  }
}

export class RateLimiter {
  private requests: number[] = [];
  private burstTokens: number;
  private options: Required<RateLimiterOptions>;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = {
      maxRequests:
        options.maxRequests ?? RATE_LIMITER_CONSTANTS.DEFAULT_MAX_REQUESTS,
      windowMs: options.windowMs ?? RATE_LIMITER_CONSTANTS.DEFAULT_WINDOW_MS,
      burstLimit:
        options.burstLimit ?? RATE_LIMITER_CONSTANTS.DEFAULT_BURST_LIMIT,
    };
    this.burstTokens = this.options.burstLimit;
  }

  private cleanupOldRequests(): void {
    const now = Date.now();
    const cutoff = now - this.options.windowMs;
    this.requests = this.requests.filter((timestamp) => timestamp > cutoff);
  }

  private replenishBurstTokens(): void {
    // Replenish one token every windowMs / maxRequests milliseconds
    const replenishRate = this.options.windowMs / this.options.maxRequests;
    const now = Date.now();
    const lastRequest = this.requests[this.requests.length - 1] || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest >= replenishRate) {
      const tokensToAdd = Math.floor(timeSinceLastRequest / replenishRate);
      this.burstTokens = Math.min(
        this.options.burstLimit,
        this.burstTokens + tokensToAdd,
      );
    }
  }

  canExecute(): boolean {
    this.cleanupOldRequests();
    this.replenishBurstTokens();

    // Check if we have burst capacity or normal capacity
    return (
      this.burstTokens > 0 || this.requests.length < this.options.maxRequests
    );
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const waitTime = this.getWaitTime();
      throw new Error(`Rate limit exceeded. Try again in ${waitTime}ms`);
    }

    const now = Date.now();
    this.requests.push(now);

    if (this.burstTokens > 0) {
      this.burstTokens--;
    }

    return await operation();
  }

  private getWaitTime(): number {
    if (this.requests.length === 0) return 0;

    const oldestRequest = this.requests[0];
    const waitTime = this.options.windowMs - (Date.now() - oldestRequest);
    return Math.max(0, waitTime);
  }

  getMetrics(): {
    requestsInWindow: number;
    burstTokens: number;
    maxRequests: number;
    windowMs: number;
  } {
    this.cleanupOldRequests();
    return {
      requestsInWindow: this.requests.length,
      burstTokens: this.burstTokens,
      maxRequests: this.options.maxRequests,
      windowMs: this.options.windowMs,
    };
  }

  reset(): void {
    this.requests = [];
    this.burstTokens = this.options.burstLimit;
  }
}

export class ResilienceManager {
  private retryHandlers = new Map<string, ExponentialBackoff>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rateLimiters = new Map<string, RateLimiter>();

  createRetryHandler(
    name: string,
    options: Partial<RetryOptions> = {},
  ): ExponentialBackoff {
    const handler = new ExponentialBackoff(options);
    this.retryHandlers.set(name, handler);
    return handler;
  }

  createCircuitBreaker(
    name: string,
    options: Partial<CircuitBreakerOptions> = {},
  ): CircuitBreaker {
    const breaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, breaker);
    return breaker;
  }

  createRateLimiter(
    name: string,
    options: Partial<RateLimiterOptions> = {},
  ): RateLimiter {
    const limiter = new RateLimiter(options);
    this.rateLimiters.set(name, limiter);
    return limiter;
  }

  getRetryHandler(name: string): ExponentialBackoff | undefined {
    return this.retryHandlers.get(name);
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getRateLimiter(name: string): RateLimiter | undefined {
    return this.rateLimiters.get(name);
  }

  async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: {
      retryHandler?: string;
      circuitBreaker?: string;
      rateLimiter?: string;
    } = {},
  ): Promise<T> {
    let wrappedOperation = operation;

    // Wrap with rate limiter if specified
    if (options.rateLimiter) {
      const limiter = this.rateLimiters.get(options.rateLimiter);
      if (limiter) {
        const originalOp = wrappedOperation;
        wrappedOperation = () => limiter.execute(originalOp);
      }
    }

    // Wrap with circuit breaker if specified
    if (options.circuitBreaker) {
      const breaker = this.circuitBreakers.get(options.circuitBreaker);
      if (breaker) {
        const originalOp = wrappedOperation;
        wrappedOperation = () => breaker.execute(originalOp);
      }
    }

    // Wrap with retry handler if specified
    if (options.retryHandler) {
      const retryHandler = this.retryHandlers.get(options.retryHandler);
      if (retryHandler) {
        const originalOp = wrappedOperation;
        wrappedOperation = () => retryHandler.execute(originalOp);
      }
    }

    return await wrappedOperation();
  }

  getAllMetrics(): {
    circuitBreakers: Record<string, ReturnType<CircuitBreaker["getMetrics"]>>;
    rateLimiters: Record<string, ReturnType<RateLimiter["getMetrics"]>>;
  } {
    const circuitBreakers: Record<
      string,
      ReturnType<CircuitBreaker["getMetrics"]>
    > = {};
    const rateLimiters: Record<
      string,
      ReturnType<RateLimiter["getMetrics"]>
    > = {};

    for (const [name, breaker] of this.circuitBreakers) {
      circuitBreakers[name] = breaker.getMetrics();
    }

    for (const [name, limiter] of this.rateLimiters) {
      rateLimiters[name] = limiter.getMetrics();
    }

    return { circuitBreakers, rateLimiters };
  }

  reset(): void {
    this.circuitBreakers.forEach((breaker) => breaker.reset());
    this.rateLimiters.forEach((limiter) => limiter.reset());
  }
}
