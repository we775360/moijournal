// End-to-end encryption. Everything is encrypted in the browser; the server only ever sees ciphertext.
// - authKey: PBKDF2(password, username) — sent to the server instead of the password.
// - DEK: random AES-256-GCM key that encrypts all content, wrapped by a password-derived key
//   and separately by a recovery-code-derived key.
const te = new TextEncoder();
const td = new TextDecoder();
const ITER = 310_000;
const bs = (u: Uint8Array) => u as unknown as BufferSource;
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function b64(input: ArrayBuffer | Uint8Array): string {
  const u = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function stretch(secret: string, salt: Uint8Array): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", bs(te.encode(secret)), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bs(salt), iterations: ITER },
    base,
    256,
  );
  return new Uint8Array(bits);
}
async function kekFrom(secret: string, salt: Uint8Array) {
  const bits = await stretch(secret, salt);
  return crypto.subtle.importKey("raw", bs(bits), "AES-GCM", false, ["wrapKey", "unwrapKey"]);
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function deriveAuthKey(username: string, password: string) {
  return b64(await stretch(password, te.encode(`moijournal/auth/v1/${username.toLowerCase()}`)));
}
export async function deriveRecoveryAuth(username: string, code: string) {
  return b64(
    await stretch(
      normalizeCode(code),
      te.encode(`moijournal/recovery/v1/${username.toLowerCase()}`),
    ),
  );
}

export type WrappedKey = { salt: string; iv: string; wrapped: string };

async function wrapDek(dek: CryptoKey, secret: string): Promise<WrappedKey> {
  const salt = rand(16);
  const iv = rand(12);
  const kek = await kekFrom(secret, salt);
  const w = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv: bs(iv) });
  return { salt: b64(salt), iv: b64(iv), wrapped: b64(w) };
}
async function unwrapDek(w: WrappedKey, secret: string, extractable: boolean) {
  const kek = await kekFrom(secret, unb64(w.salt));
  return crypto.subtle.unwrapKey(
    "raw",
    bs(unb64(w.wrapped)),
    kek,
    { name: "AES-GCM", iv: bs(unb64(w.iv)) },
    { name: "AES-GCM" },
    extractable,
    ["encrypt", "decrypt"],
  );
}

function makeRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = rand(20);
  let s = "";
  for (let i = 0; i < 20; i++) {
    s += alphabet[(bytes[i] ?? 0) % alphabet.length];
    if (i % 4 === 3 && i < 19) s += "-";
  }
  return s;
}

export async function createVault(username: string, password: string) {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const code = makeRecoveryCode();
  const [pw, rc, authKey, recoveryAuth] = await Promise.all([
    wrapDek(dek, password),
    wrapDek(dek, normalizeCode(code)),
    deriveAuthKey(username, password),
    deriveRecoveryAuth(username, code),
  ]);
  const sessionKey = await unwrapDek(pw, password, false);
  return { keys: { pw, rc }, authKey, recoveryAuth, code, sessionKey };
}

export async function unlock(password: string, pw: WrappedKey) {
  return unwrapDek(pw, password, false);
}

export async function rewrapWithNewPassword(
  oldSecret: string,
  from: WrappedKey,
  newPassword: string,
) {
  const dek = await unwrapDek(from, oldSecret, true);
  const pw = await wrapDek(dek, newPassword);
  return { pw, sessionKey: await unwrapDek(pw, newPassword, false) };
}

// ---- content encryption: [v1][iv 12][AES-GCM(gzip(json))] ----
async function gzip(bytes: Uint8Array, mode: "c" | "d") {
  const stream = new Blob([bs(bytes) as BlobPart])
    .stream()
    .pipeThrough(mode === "c" ? new CompressionStream("gzip") : new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encryptBytes(key: CryptoKey, plain: Uint8Array): Promise<string> {
  const iv = rand(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(plain)),
  );
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return b64(out);
}
export async function decryptBytes(key: CryptoKey, data: string): Promise<Uint8Array> {
  const raw = unb64(data);
  const iv = raw.subarray(1, 13);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(raw.subarray(13))),
  );
}
export async function encryptJSON(key: CryptoKey, value: unknown) {
  return encryptBytes(key, await gzip(te.encode(JSON.stringify(value)), "c"));
}
export async function decryptJSON<T>(key: CryptoKey, data: string): Promise<T> {
  return JSON.parse(td.decode(await gzip(await decryptBytes(key, data), "d"))) as T;
}

// ---- keep the (non-extractable) key across reloads in IndexedDB ----
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("moijournal", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("k");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("k", mode);
    const req = fn(t.objectStore("k"));
    t.oncomplete = () => res(req.result);
    t.onerror = () => rej(t.error);
  });
}
export const storeKey = (k: CryptoKey) =>
  tx("readwrite", (s) => s.put(k, "dek")).then(() => undefined);
export const loadKey = () =>
  tx<CryptoKey | undefined>("readonly", (s) => s.get("dek")).catch(() => undefined);
export const forgetKey = () =>
  tx("readwrite", (s) => s.delete("dek"))
    .then(() => undefined)
    .catch(() => undefined);
