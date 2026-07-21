/**
 * Provider-safe Token Bucket Rate Limiter
 * Ensures outgoing SMS dispatches stay within provider throughput constraints.
 */
export class RateLimiter {
  private capacity: number;
  private tokens: number;
  private refillRate: number; // Tokens per millisecond
  private lastRefillTimestamp: number;

  /**
   * @param requestsPerSecond Maximum allowed requests per second (default: 5)
   * @param maxBurst Maximum burst capacity (default: 10)
   */
  constructor(requestsPerSecond = 5, maxBurst = 10) {
    this.capacity = maxBurst;
    this.tokens = maxBurst;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefillTimestamp = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTimestamp;
    const tokensToAdd = elapsedTime * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  /**
   * Acquire a token before making an outbound request.
   * Delays execution if rate limit tokens are exhausted.
   */
  async acquireToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait duration until next token is available
    const neededTokens = 1 - this.tokens;
    const waitTimeMs = Math.ceil(neededTokens / this.refillRate);
    
    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
    return this.acquireToken();
  }
}

// Global rate limiter instance (default 5 requests/sec max burst 10)
let globalLimiterInstance: RateLimiter | null = null;

export function getGlobalRateLimiter(): RateLimiter {
  if (!globalLimiterInstance) {
    globalLimiterInstance = new RateLimiter(5, 10);
  }
  return globalLimiterInstance;
}
