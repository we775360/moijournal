import { createFileRoute } from "@tanstack/react-router";

// Same-origin proxy to the Render API. Keeps the session cookie first-party (works on iPhone/Safari)
// and attaches a shared secret so the API can't be called directly.
async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const origin = process.env["API_ORIGIN"];
  const secret = process.env["PROXY_SECRET"];
  if (!origin || !secret) {
    return Response.json(
      { error: "MoiJournal isn't connected to its server yet." },
      { status: 503 },
    );
  }
  const path = (params._splat ?? "").replace(/^\/+/, "");
  if (!/^[a-zA-Z0-9/_.-]*$/.test(path) || path.includes("..")) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const headers = new Headers();
  for (const h of ["content-type", "cookie", "x-mj"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("x-mj-proxy", secret);
  // Only headers the hosting platform sets are read here, because the API trusts this
  // value for rate limiting and any client can invent a header of its own.
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  headers.set("x-mj-client-ip", ip);

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD")
    init.body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${origin.replace(/\/$/, "")}/${path}${url.search}`, init);
  } catch {
    return Response.json(
      { error: "Our server is waking up. Try again in a few seconds!" },
      { status: 503 },
    );
  }
  const proxyError = upstream.headers.get("x-mj-error");
  if (proxyError) {
    // The API could not verify our shared secret, so every signed-in request will fail
    // until the two PROXY_SECRET values match. Surface it in the Vercel logs too.
    console.error(
      `[proxy] API rejected our PROXY_SECRET (${proxyError}). Check that the Vercel and Render values are identical.`,
    );
  }
  const out = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json",
    "cache-control": "private, no-store",
  });
  if (proxyError) out.set("x-mj-error", proxyError);
  for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: proxy, POST: proxy, PUT: proxy, PATCH: proxy, DELETE: proxy },
  },
});
