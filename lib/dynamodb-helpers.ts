const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDynamoThrottleError(error: unknown): boolean {
  const name = getErrorName(error);
  const message = getErrorMessage(error);
  return /ProvisionedThroughputExceeded|Throttling|Rate exceeded|RequestLimitExceeded|Throttled/i.test(
    `${name} ${message}`
  );
}

function getRetryDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return exponentialDelay + jitter;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options?: {
    label?: string;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isDynamoThrottleError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delayMs = getRetryDelayMs(attempt, baseDelayMs, maxDelayMs);
      console.warn('[dynamodb] throttled, retrying', {
        label: options?.label ?? 'operation',
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: getErrorMessage(error)
      });
      await sleep(delayMs);
    }
  }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
