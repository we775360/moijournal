import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  deriveAuthKey,
  deriveRecoveryAuth,
  normalizeCode,
  rewrapWithNewPassword,
  type WrappedKey,
} from "@/lib/crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { startSession, type AuthResponse } from "@/lib/session";
import { btnPrimary, ErrorNote, Field, Logo } from "@/components/mj";

export const Route = createFileRoute("/recover")({
  head: () => ({
    meta: [
      { title: "Recover your diary — MoiJournal" },
      { name: "description", content: "Use your recovery code to set a new MoiJournal password." },
      { property: "og:title", content: "Recover your diary — MoiJournal" },
      {
        property: "og:description",
        content: "Use your recovery code to set a new MoiJournal password.",
      },
    ],
  }),
  component: Recover,
});

function Recover() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < MIN_PASSWORD_LENGTH)
      return setErr(`New password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    setBusy(true);
    try {
      const u = username.trim().toLowerCase();
      const recoveryAuth = await deriveRecoveryAuth(u, code);
      const { rc } = await api<{ rc: WrappedKey }>("/auth/recover/start", {
        method: "POST",
        body: { username: u, recoveryAuth },
      });
      const { pw: newPw, sessionKey } = await rewrapWithNewPassword(normalizeCode(code), rc, pw);
      const r = await api<AuthResponse>("/auth/recover/finish", {
        method: "POST",
        body: { username: u, recoveryAuth, authKey: await deriveAuthKey(u, pw), pw: newPw },
      });
      await startSession(sessionKey, r);
      nav({ to: "/app" });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That recovery code didn't work.");
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
            <p className="font-hand text-2xl text-primary">don't worry</p>
            <h1 className="text-3xl font-extrabold text-ink">Get back into your diary</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the recovery code you saved when you signed up.
            </p>
          </div>
          <Field
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            label="Recovery code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className={`${btnPrimary} w-full`} disabled={busy || !username || !code}>
            {busy ? "Unlocking…" : "Set new password"}
          </button>
          <Link
            to="/login"
            className="block text-center text-sm font-bold text-muted-foreground hover:text-primary"
          >
            ← back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
