import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  deriveAuthKey,
  deriveRecoveryAuth,
  normalizeCode,
  recoveryLookup,
  rewrapWithNewPassword,
  type WrappedKey,
} from "@/lib/crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { startSession, type AuthResponse } from "@/lib/session";
import { btnPrimary, btnSoft, ErrorNote, Field, Logo } from "@/components/mj";
import { absoluteUrl } from "@/lib/site";

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
      { property: "og:url", content: absoluteUrl("/recover") },
      // A utility page: keep it out of the index so pages of actual content rank instead.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/recover") }],
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
  const [findCode, setFindCode] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [findBusy, setFindBusy] = useState(false);
  const [findErr, setFindErr] = useState<string | null>(null);

  // The recovery code is hashed in the browser, so it can find the username without the
  // server ever seeing the code itself.
  async function findUsername() {
    setFindErr(null);
    setFound(null);
    setFindBusy(true);
    try {
      const r = await api<{ username: string }>("/auth/username", {
        method: "POST",
        body: { recoveryLookup: await recoveryLookup(findCode) },
      });
      setFound(r.username);
      toast.success("Found your diary ♡");
    } catch (e) {
      setFindErr(e instanceof ApiError ? e.message : "Couldn't look that up.");
    } finally {
      setFindBusy(false);
    }
  }

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

          <div className="rounded-2xl border-2 border-dashed border-ink bg-paper p-4">
            <p className="font-bold text-ink">Forgot your username too?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your recovery code can look it up on its own — no password needed.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <Field
                  label="Recovery code"
                  value={findCode}
                  onChange={(e) => setFindCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                />
              </div>
              <button
                type="button"
                className={btnSoft}
                disabled={findBusy || !findCode.trim()}
                onClick={() => void findUsername()}
              >
                {findBusy ? "Looking…" : "Find it"}
              </button>
            </div>
            {findErr && (
              <div className="mt-3">
                <ErrorNote>{findErr}</ErrorNote>
              </div>
            )}
            {found && (
              <div className="mt-3 rounded-2xl border-2 border-ink bg-butter px-4 py-3">
                <p className="font-bold text-ink">
                  Your username is <span className="font-mono">@{found}</span>
                </p>
                <button
                  type="button"
                  className="mt-1 text-sm font-bold text-primary hover:underline"
                  onClick={() => {
                    setUsername(found);
                    setCode(findCode);
                    toast.success(`Filled in @${found}`);
                  }}
                >
                  Use it and set a new password →
                </button>
              </div>
            )}
          </div>
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
