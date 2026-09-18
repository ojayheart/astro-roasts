/** Poll until the server reports completion; elapsed time is not a failure. */
export function startRoastPolling<T extends { status: string }>(
  read: (signal: AbortSignal) => Promise<T>,
  apply: (result: T) => void,
  isVisible: () => boolean,
  intervalMs = 2000,
  requestTimeoutMs = 15_000,
): () => void {
  let cancelled = false;
  let pending: {
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  const interval = setInterval(async () => {
    if (cancelled || pending || !isVisible()) return;
    const controller = new AbortController();
    const request = {
      controller,
      timer: setTimeout(() => {
        // Only abandon this status request, never the background roast.
        // Release it even if the transport fails to settle after aborting.
        controller.abort();
        if (pending === request) pending = null;
      }, requestTimeoutMs),
    };
    pending = request;
    try {
      const result = await read(controller.signal);
      if (cancelled || controller.signal.aborted) return;
      if (result.status === "generating" || result.status === "ready" || result.status === "error") {
        apply(result);
        if (result.status !== "generating") clearInterval(interval);
      }
    } catch {
      // A temporary network failure says nothing about the background job.
    } finally {
      clearTimeout(request.timer);
      if (pending === request) pending = null;
    }
  }, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(interval);
    if (pending) {
      clearTimeout(pending.timer);
      pending.controller.abort();
      pending = null;
    }
  };
}
