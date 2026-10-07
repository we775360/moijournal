// All calls go through this site's own /api proxy, so the session cookie is first-party.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-MJ": "1" },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, "Can't reach MoiJournal right now. Check your internet?");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? "Something went wrong.");
  return json as T;
}
