// Runs an async function over items with bounded concurrency, capturing
// per-item results/errors without letting a single failure abort the batch.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<{ value?: R; error?: unknown }[]> {
  const results: { value?: R; error?: unknown }[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { value: await fn(items[i]) };
      } catch (error) {
        results[i] = { error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
