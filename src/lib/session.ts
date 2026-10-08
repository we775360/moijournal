import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api";
import { decryptJSON, forgetKey, loadKey, storeKey, type WrappedKey } from "./crypto";

export type Theme = "blush" | "sage" | "sky" | "butter" | "midnight";
export type MeRaw = {
  id: string;
  username: string;
  theme: Theme;
  plan: "free" | "premium";
  /** ISO date the paid plan runs out; null while free. */
  premiumUntil: string | null;
  isAdmin: boolean;
  profile: string;
  limits: { books: number; pages: number };
  usage: { books: number; pages: number };
};
export type Me = Omit<MeRaw, "profile"> & { name: string };
export type AuthResponse = { me: MeRaw; keys: WrappedKey };

let me: Me | null = null;
let key: CryptoKey | null = null;
let keys: WrappedKey | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function useMe() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => me,
    () => null,
  );
}
export function getKey() {
  if (!key) throw new Error("Locked");
  return key;
}
export const getWrapped = () => keys;

export function applyTheme(t: Theme | null) {
  if (typeof document === "undefined") return;
  if (t) document.documentElement.dataset["theme"] = t;
  else delete document.documentElement.dataset["theme"];
}

async function setMe(raw: MeRaw) {
  const k = getKey();
  const profile = await decryptJSON<{ name: string }>(k, raw.profile).catch(() => ({
    name: raw.username,
  }));
  const { profile: _p, ...rest } = raw;
  me = { ...rest, name: profile.name };
  applyTheme(me.theme);
  emit();
}

export async function startSession(sessionKey: CryptoKey, r: AuthResponse) {
  key = sessionKey;
  keys = r.keys;
  await storeKey(sessionKey);
  await setMe(r.me);
}

export async function loadSession(): Promise<boolean> {
  if (me && key) return true;
  const k = await loadKey();
  if (!k) return false;
  try {
    const r = await api<AuthResponse>("/me");
    key = k;
    keys = r.keys;
    await setMe(r.me);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await forgetKey();
    return false;
  }
}

export async function refreshMe() {
  const r = await api<AuthResponse>("/me");
  keys = r.keys;
  await setMe(r.me);
}
export async function updateMe(raw: MeRaw) {
  await setMe(raw);
}

export async function logout() {
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  await clearLocal();
}
export async function clearLocal() {
  await forgetKey();
  me = null;
  key = null;
  keys = null;
  applyTheme(null);
  emit();
}
