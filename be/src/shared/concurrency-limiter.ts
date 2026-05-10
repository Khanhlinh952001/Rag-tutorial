/** FIFO limit on concurrent async calls (LLM backpressure). */
export function createAsyncConcurrencyLimiter(maxConcurrent: number) {
  if (!Number.isFinite(maxConcurrent) || maxConcurrent <= 0) {
    return async <T>(fn: () => Promise<T>): Promise<T> => fn();
  }

  let active = 0;
  const waitQueue: Array<() => void> = [];

  return async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => waitQueue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      const next = waitQueue.shift();
      if (next) next();
    }
  };
}
