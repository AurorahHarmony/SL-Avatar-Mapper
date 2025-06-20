/**
 * Runs a task as non-blocking. Must be called from an async function to be non-blocking.
 * Do NOT await this function.
 * @param task
 */
export function runInBackground(task: () => Promise<void>): void {
  (async () => {
    try {
      await task();
    } catch (err) {
      console.error("Background task failed:", err);
    }
  })();
}
