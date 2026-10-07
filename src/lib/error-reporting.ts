// Errors caught by a React error boundary never reach window.onerror, so the boundary
// hands them here. Keeping this in one place means an error service can be plugged in
// later without touching any route.
type ErrorContext = Record<string, unknown>;

// Loaders and server functions throw things that aren't Errors — a raw Response, or a
// plain `{ message }` object — which String() would flatten to "[object Object]".
function describeThrown(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null | undefined)?.message;
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[moijournal] ${describeThrown(error)}`, {
    ...context,
    ...(typeof window === "undefined" ? {} : { route: window.location.pathname }),
    ...(stack === undefined ? {} : { stack }),
  });
}
