import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { deriveAuthKey, unlock } from "@/lib/crypto";
import { startSession, type AuthResponse } from "@/lib/session";
import { btnPrimary, ErrorNote, Field, Logo } from "@/components/mj";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — MoiJournal" },
      { name: "description", content: "Unlock your private MoiJournal diary." },
      { property: "og:title", content: "Log in — MoiJournal" },
      { property: "og:description", content: "Unlock your private MoiJournal diary." },
      { property: "og:url", content: absoluteUrl("/login") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/login") }],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = username.trim().toLowerCase();
      const r = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { username: u, authKey: await deriveAuthKey(u, pw) },
      });
      const key = await unlock(pw, r.keys);
      await startSession(key, r);
      nav({ to: "/app" });
    } catch (e) {
      setErr(
        e instanceof ApiError ? e.message : "Couldn't unlock your diary. Check your password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-5 py-6">
      <div className="mx-auto max-w-6xl">
        <Logo />
      </div>
      <div className="mx-auto mt-14 max-w-md">
        <form onSubmit={submit} className="rise sticker ruled space-y-4 rounded-3xl p-8">
          <div>
            <p className="font-hand text-2xl text-primary">welcome back ♡</p>
            <h1 className="text-3xl font-extrabold text-ink">Unlock your diary</h1>
          </div>
          <Field
            label="Username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className={`${btnPrimary} w-full`} disabled={busy || !username || !pw}>
            {busy ? "Unlocking…" : "Open diary 🔓"}
          </button>
          <div className="flex justify-between text-sm font-bold">
            <Link to="/recover" className="text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-ink hover:text-primary">
              New here? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
