// MoiJournal API — runs on Render. Only reachable through the website's /api proxy
// (requests must carry the shared PROXY_SECRET). Stores ciphertext only.
import express from "express";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { timingSafeEqual, createHash } from "node:crypto";

const env = process.env;
const DATABASE_URL = env.DATABASE_URL;
const JWT_SECRET = env.JWT_SECRET;
const PROXY_SECRET = env.PROXY_SECRET;
const PORT = Number(env.PORT || 4000);
const SECURE_COOKIE = env.INSECURE_COOKIES !== "true";

if (
  !DATABASE_URL ||
  !JWT_SECRET ||
  JWT_SECRET.length < 32 ||
  !PROXY_SECRET ||
  PROXY_SECRET.length < 32
) {
  console.error(
    "Missing env: DATABASE_URL, JWT_SECRET (32+ chars), PROXY_SECRET (32+ chars) are required.",
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
});
await pool.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

const LIMITS = { free: { books: 2, pages: 10 }, premium: { books: 10, pages: 50 } };
const COOKIE = "mj_s";
const SESSION_DAYS = 7;
const DUMMY_HASH = bcrypt.hashSync("moijournal-dummy", 12);

const app = express();
app.disable("x-powered-by");
app.use(helmet());

// --- Only the website proxy may call us ---
// The website and this API must be given the *same* PROXY_SECRET. A mismatch is the one
// deployment mistake that looks like a generic "Forbidden" from the browser, so say which
// side is wrong instead: a short SHA-256 fingerprint lets the two values be compared
// without either secret ever leaving its host (and is useless for brute force).
const fingerprint = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const PROXY_FINGERPRINT = fingerprint(PROXY_SECRET);
const proxyDigest = createHash("sha256").update(PROXY_SECRET).digest();
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const sent = req.get("x-mj-proxy") || "";
  const got = createHash("sha256").update(sent).digest();
  if (!timingSafeEqual(got, proxyDigest)) {
    console.error(
      `[proxy] PROXY_SECRET mismatch: the website sent ${fingerprint(sent)}, this API expects ${PROXY_FINGERPRINT}. ` +
        "Set the same value in both places and redeploy them.",
    );
    res.set("x-mj-error", "proxy-secret-mismatch");
    return res.status(403).json({
      error: "Forbidden",
      code: "proxy-secret-mismatch",
      sentFingerprint: fingerprint(sent),
      expectedFingerprint: PROXY_FINGERPRINT,
    });
  }
  next();
});
// CSRF: browsers can't add this header cross-site without a preflight, which the website never allows.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.get("x-mj") !== "1") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});
app.use(express.json({ limit: "700kb" }));
app.use(cookieParser());

const clientIp = (req) => (req.get("x-mj-client-ip") || "unknown").slice(0, 64);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: clientIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tries. Take a little break and try again in 15 minutes." },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: clientIp,
  legacyHeaders: false,
});

// --- validation ---
const b64 = (max) =>
  z
    .string()
    .max(max)
    .regex(/^[A-Za-z0-9+/=]*$/);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/);
const authKey = b64(64).min(40);
const wrapped = z.object({ salt: b64(64), iv: b64(64), wrapped: b64(128) }).strict();
const theme = z.enum(["blush", "sage", "sky", "butter", "midnight"]);
const color = z.enum(["blush", "sage", "sky", "butter", "lilac", "ink"]);
const uuid = z.string().uuid();
const BOOK_DATA = b64(4_000);
const COVER = b64(400_000);
const PAGE_DATA = b64(600_000);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parse = (schema, value) => {
  const r = schema.safeParse(value);
  if (!r.success) {
    const e = new Error("Invalid request");
    e.status = 400;
    throw e;
  }
  return r.data;
};
const toB64 = (buf) => (buf ? Buffer.from(buf).toString("base64") : null);
const fromB64 = (s) => Buffer.from(s, "base64");

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400 * 1000,
  });
}
const clearSession = (res) =>
  res.clearCookie(COOKIE, { path: "/", httpOnly: true, secure: SECURE_COOKIE, sameSite: "lax" });

async function meJson(u) {
  const { rows } = await pool.query(
    "SELECT (SELECT count(*) FROM books WHERE user_id=$1)::int AS books, (SELECT count(*) FROM pages WHERE user_id=$1)::int AS pages",
    [u.id],
  );
  return {
    id: u.id,
    username: u.username,
    theme: u.theme,
    plan: u.plan,
    profile: toB64(u.profile),
    limits: LIMITS[u.plan] || LIMITS.free,
    usage: rows[0],
  };
}

const auth = wrap(async (req, res, next) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in" });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    clearSession(res);
    return res.status(401).json({ error: "Session expired" });
  }
  const { rows } = await pool.query(
    "SELECT id, username, theme, plan, profile, token_version FROM users WHERE id=$1",
    [payload.sub],
  );
  const u = rows[0];
  if (!u || u.token_version !== payload.tv) {
    clearSession(res);
    return res.status(401).json({ error: "Session expired" });
  }
  req.user = u;
  next();
});

// Left open (no proxy secret) so a deploy can be checked from a browser. The fingerprint
// is the first 12 hex of SHA-256, which is how you tell whether Render and Vercel share
// one PROXY_SECRET without copying the secret around.
app.get("/health", (_req, res) =>
  res.json({ ok: true, proxySecretFingerprint: PROXY_FINGERPRINT }),
);

// ---------- auth ----------
app.post(
  "/auth/signup",
  authLimiter,
  wrap(async (req, res) => {
    const body = parse(
      z.object({
        username,
        authKey,
        recoveryAuth: authKey,
        keys: z.object({ pw: wrapped, rc: wrapped }).strict(),
        profile: BOOK_DATA,
        theme,
      }),
      req.body,
    );
    const [authHash, recHash] = await Promise.all([
      bcrypt.hash(body.authKey, 12),
      bcrypt.hash(body.recoveryAuth, 12),
    ]);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (username, auth_hash, recovery_hash, keys, profile, theme)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, theme, plan, profile, token_version`,
        [body.username, authHash, recHash, body.keys, fromB64(body.profile), body.theme],
      );
      setSession(res, rows[0]);
      res.json({ me: await meJson(rows[0]), keys: body.keys.pw });
    } catch (e) {
      if (e.code === "23505")
        return res.status(409).json({ error: "That username is taken. Try another cute one!" });
      throw e;
    }
  }),
);

app.post(
  "/auth/login",
  authLimiter,
  wrap(async (req, res) => {
    const body = parse(z.object({ username, authKey }), req.body);
    const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [body.username]);
    const u = rows[0];
    const bad = () => res.status(401).json({ error: "Username or password doesn't match." });
    if (!u) {
      await bcrypt.compare(body.authKey, DUMMY_HASH);
      return bad();
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      return res
        .status(429)
        .json({ error: "Too many wrong tries. This account is paused for 15 minutes." });
    }
    const ok = await bcrypt.compare(body.authKey, u.auth_hash);
    if (!ok) {
      await pool.query(
        `UPDATE users SET
        locked_until = CASE WHEN failed + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END,
        failed = CASE WHEN failed + 1 >= 8 THEN 0 ELSE failed + 1 END
       WHERE id=$1`,
        [u.id],
      );
      return bad();
    }
    if (u.failed || u.locked_until)
      await pool.query("UPDATE users SET failed=0, locked_until=NULL WHERE id=$1", [u.id]);
    setSession(res, u);
    res.json({ me: await meJson(u), keys: u.keys.pw });
  }),
);

app.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.post(
  "/auth/recover/start",
  authLimiter,
  wrap(async (req, res) => {
    const body = parse(z.object({ username, recoveryAuth: authKey }), req.body);
    const { rows } = await pool.query("SELECT recovery_hash, keys FROM users WHERE username=$1", [
      body.username,
    ]);
    const u = rows[0];
    const ok = await bcrypt.compare(body.recoveryAuth, u ? u.recovery_hash : DUMMY_HASH);
    if (!u || !ok) return res.status(401).json({ error: "That recovery code doesn't match." });
    res.json({ rc: u.keys.rc });
  }),
);

app.post(
  "/auth/recover/finish",
  authLimiter,
  wrap(async (req, res) => {
    const body = parse(
      z.object({ username, recoveryAuth: authKey, authKey, pw: wrapped }),
      req.body,
    );
    const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [body.username]);
    const u = rows[0];
    const ok = await bcrypt.compare(body.recoveryAuth, u ? u.recovery_hash : DUMMY_HASH);
    if (!u || !ok) return res.status(401).json({ error: "That recovery code doesn't match." });
    const hash = await bcrypt.hash(body.authKey, 12);
    const { rows: up } = await pool.query(
      `UPDATE users SET auth_hash=$2, keys = jsonb_set(keys, '{pw}', $3::jsonb), token_version = token_version + 1,
       failed = 0, locked_until = NULL
     WHERE id=$1 RETURNING id, username, theme, plan, profile, token_version`,
      [u.id, hash, JSON.stringify(body.pw)],
    );
    setSession(res, up[0]);
    res.json({ me: await meJson(up[0]), keys: body.pw });
  }),
);

// ---------- account ----------
app.use(["/me", "/books", "/pages", "/auth/password"], apiLimiter);

app.get(
  "/me",
  auth,
  wrap(async (req, res) => {
    const { rows } = await pool.query("SELECT keys FROM users WHERE id=$1", [req.user.id]);
    res.json({ me: await meJson(req.user), keys: rows[0].keys.pw });
  }),
);

app.patch(
  "/me",
  auth,
  wrap(async (req, res) => {
    const body = parse(
      z.object({ theme: theme.optional(), profile: BOOK_DATA.optional() }).strict(),
      req.body,
    );
    const { rows } = await pool.query(
      `UPDATE users SET theme = COALESCE($2, theme), profile = COALESCE($3, profile) WHERE id=$1
     RETURNING id, username, theme, plan, profile, token_version`,
      [req.user.id, body.theme ?? null, body.profile ? fromB64(body.profile) : null],
    );
    res.json({ me: await meJson(rows[0]) });
  }),
);

app.post(
  "/auth/password",
  auth,
  wrap(async (req, res) => {
    const body = parse(z.object({ currentAuthKey: authKey, authKey, pw: wrapped }), req.body);
    const { rows } = await pool.query("SELECT auth_hash FROM users WHERE id=$1", [req.user.id]);
    if (!(await bcrypt.compare(body.currentAuthKey, rows[0].auth_hash))) {
      return res.status(401).json({ error: "Your current password isn't right." });
    }
    const hash = await bcrypt.hash(body.authKey, 12);
    const { rows: up } = await pool.query(
      `UPDATE users SET auth_hash=$2, keys = jsonb_set(keys, '{pw}', $3::jsonb), token_version = token_version + 1
     WHERE id=$1 RETURNING id, username, theme, plan, profile, token_version`,
      [req.user.id, hash, JSON.stringify(body.pw)],
    );
    setSession(res, up[0]);
    res.json({ ok: true });
  }),
);

app.delete(
  "/me",
  auth,
  wrap(async (req, res) => {
    const body = parse(z.object({ authKey }), req.body);
    const { rows } = await pool.query("SELECT auth_hash FROM users WHERE id=$1", [req.user.id]);
    if (!(await bcrypt.compare(body.authKey, rows[0].auth_hash))) {
      return res.status(401).json({ error: "Password isn't right." });
    }
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);
    clearSession(res);
    res.json({ ok: true });
  }),
);

// ---------- books ----------
async function withLimit(userId, kind, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT plan FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const limits = LIMITS[rows[0].plan] || LIMITS.free;
    const table = kind === "books" ? "books" : "pages";
    const { rows: c } = await client.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`,
      [userId],
    );
    if (c[0].n >= limits[kind]) {
      await client.query("ROLLBACK");
      const e = new Error(
        kind === "books"
          ? `Your plan fits ${limits.books} books. Upgrade to Premium for more!`
          : `Your plan fits ${limits.pages} pages. Upgrade to Premium for more!`,
      );
      e.status = 402;
      throw e;
    }
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.get(
  "/books",
  auth,
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.id, b.data, b.color, (b.cover IS NOT NULL) AS has_cover, b.created_at, b.updated_at,
       (SELECT count(*)::int FROM pages p WHERE p.book_id=b.id) AS pages
     FROM books b WHERE b.user_id=$1 ORDER BY b.created_at`,
      [req.user.id],
    );
    res.json({ books: rows.map((r) => ({ ...r, data: toB64(r.data) })) });
  }),
);

app.get(
  "/books/:id/cover",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const { rows } = await pool.query("SELECT cover FROM books WHERE id=$1 AND user_id=$2", [
      id,
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.set("Cache-Control", "private, no-store");
    res.json({ cover: toB64(rows[0].cover) });
  }),
);

app.post(
  "/books",
  auth,
  wrap(async (req, res) => {
    const body = parse(
      z.object({ data: BOOK_DATA, color, cover: COVER.optional() }).strict(),
      req.body,
    );
    const book = await withLimit(req.user.id, "books", async (c) => {
      const { rows } = await c.query(
        "INSERT INTO books (user_id, data, color, cover) VALUES ($1,$2,$3,$4) RETURNING id",
        [req.user.id, fromB64(body.data), body.color, body.cover ? fromB64(body.cover) : null],
      );
      return rows[0];
    });
    res.json(book);
  }),
);

app.patch(
  "/books/:id",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const body = parse(
      z
        .object({
          data: BOOK_DATA.optional(),
          color: color.optional(),
          cover: COVER.nullable().optional(),
        })
        .strict(),
      req.body,
    );
    const sets = ["updated_at = now()"];
    const vals = [id, req.user.id];
    if (body.data) {
      vals.push(fromB64(body.data));
      sets.push(`data=$${vals.length}`);
    }
    if (body.color) {
      vals.push(body.color);
      sets.push(`color=$${vals.length}`);
    }
    if (body.cover !== undefined) {
      vals.push(body.cover ? fromB64(body.cover) : null);
      sets.push(`cover=$${vals.length}`);
    }
    const { rowCount } = await pool.query(
      `UPDATE books SET ${sets.join(", ")} WHERE id=$1 AND user_id=$2`,
      vals,
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  }),
);

app.delete(
  "/books/:id",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    await pool.query("DELETE FROM books WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

// ---------- pages ----------
app.get(
  "/books/:id/pages",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const { rows } = await pool.query(
      "SELECT id, data, created_at, updated_at FROM pages WHERE book_id=$1 AND user_id=$2 ORDER BY created_at",
      [id, req.user.id],
    );
    res.set("Cache-Control", "private, no-store");
    res.json({ pages: rows.map((r) => ({ ...r, data: toB64(r.data) })) });
  }),
);

app.post(
  "/books/:id/pages",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const body = parse(z.object({ data: PAGE_DATA }).strict(), req.body);
    const own = await pool.query("SELECT 1 FROM books WHERE id=$1 AND user_id=$2", [
      id,
      req.user.id,
    ]);
    if (!own.rowCount) return res.status(404).json({ error: "Not found" });
    const page = await withLimit(req.user.id, "pages", async (c) => {
      const { rows } = await c.query(
        "INSERT INTO pages (book_id, user_id, data) VALUES ($1,$2,$3) RETURNING id",
        [id, req.user.id, fromB64(body.data)],
      );
      await c.query("UPDATE books SET updated_at=now() WHERE id=$1", [id]);
      return rows[0];
    });
    res.json(page);
  }),
);

app.put(
  "/pages/:id",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const body = parse(z.object({ data: PAGE_DATA }).strict(), req.body);
    const { rowCount } = await pool.query(
      "UPDATE pages SET data=$3, updated_at=now() WHERE id=$1 AND user_id=$2",
      [id, req.user.id, fromB64(body.data)],
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  }),
);

app.delete(
  "/pages/:id",
  auth,
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    await pool.query("DELETE FROM pages WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
// Express only treats this as an error handler while it declares all four arguments.
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === "entity.too.large" ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? "Something went wrong. Please try again." : err.message || "Error",
  });
});

app.listen(PORT, () => console.log(`MoiJournal API listening on ${PORT}`));
