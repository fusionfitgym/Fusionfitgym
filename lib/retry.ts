/**
 * Reusable Retry Utility
 */

/**
 * Runs an asynchronous function and retries it if it throws an error.
 * 
 * @param fn Asynchronous function to execute
 * @param attempts Number of retries (e.g., 1 means up to 2 total attempts)
 * @param delayMs Wait time between attempts in milliseconds
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 1,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`[Retry Helper] Attempt ${attempt + 1} failed. Retrying in ${delayMs}ms... Error:`, error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
