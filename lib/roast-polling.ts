/** Poll until the server reports completion; elapsed time is not a failure. */
export function startRoastPolling<T extends { status: string }>(
  read: () => Promise<T>,
  apply: (result: T) => void,
  isVisible: () => boolean,
  intervalMs = 2000,
): () => void {
  let cancelled = false;
  let pending = false;
  const interval = setInterval(async () => {
    if (cancelled || pending || !isVisible()) return;
    pending = true;
    try {
      const result = await read();
      if (cancelled) return;
      if (result.status === "generating" || result.status === "ready" || result.status === "error") {
        apply(result);
        if (result.status !== "generating") clearInterval(interval);
      }
    } catch {
      // A temporary network failure says nothing about the background job.
    } finally {
      pending = false;
    }
  }, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}
