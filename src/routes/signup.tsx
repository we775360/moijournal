import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { createVault, encryptJSON } from "@/lib/crypto";
import { applyTheme, startSession, type AuthResponse, type Theme } from "@/lib/session";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/password";
import { THEMES } from "@/lib/themes";
import { btnPrimary, btnSoft, ErrorNote, Field, Logo } from "@/components/mj";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Start your diary — MoiJournal" },
      { name: "description", content: "Create your cosy, encrypted MoiJournal diary in a minute." },
      { property: "og:title", content: "Start your diary — MoiJournal" },
      {
        property: "og:description",
        content: "Create your cosy, encrypted MoiJournal diary in a minute.",
      },
    ],
  }),
  component: Signup,
});

const VIBES = [
  { id: "girl", label: "👧 girl", theme: "blush" as Theme },
  { id: "boy", label: "👦 boy", theme: "sky" as Theme },
  { id: "other", label: "🌈 something else", theme: "sage" as Theme },
  { id: "skip", label: "🤐 rather not say", theme: "butter" as Theme },
];

function Signup() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("blush");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ key: CryptoKey; r: AuthResponse } | null>(null);

  const uname = username.trim().toLowerCase();
  const unameOk = /^[a-z0-9_.]{3,24}$/.test(uname);
  const strength = passwordStrength(pw);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  async function create() {
    setErr(null);
    if (!unameOk) return setErr("Username: 3–24 letters, numbers, dots or underscores.");
    if (pw.length < MIN_PASSWORD_LENGTH)
      return setErr(`Password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setBusy(true);
    try {
      const v = await createVault(uname, pw);
      const profile = await encryptJSON(v.sessionKey, { name: name.trim() });
      const r = await api<AuthResponse>("/auth/signup", {
        method: "POST",
        body: {
          username: uname,
          authKey: v.authKey,
          recoveryAuth: v.recoveryAuth,
          keys: v.keys,
          profile,
          theme,
        },
      });
      setPending({ key: v.sessionKey, r });
      setCode(v.code);
      setStep(4);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!pending) return;
    await startSession(pending.key, pending.r);
    nav({ to: "/app" });
  }

  function downloadCode() {
    if (!code) return;
    const blob = new Blob(
      [
        `MoiJournal recovery code\nUsername: ${uname}\nCode: ${code}\n\nKeep this somewhere safe. It's the only way back in if you forget your password.\n`,
      ],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "moijournal-recovery-code.txt";
    a.click();
  }

  const dots = (
    <div className="mb-8 flex justify-center gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full border-2 border-ink transition-all ${i <= step ? "w-8 bg-primary" : "w-2.5 bg-paper"}`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen px-5 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Logo />
        <Link to="/login" className="text-sm font-bold text-ink hover:text-primary">
          I have a diary →
        </Link>
      </div>
      <div className="mx-auto mt-10 max-w-lg">
        {dots}
        <div key={step} className="rise sticker ruled rounded-3xl p-8">
          {step === 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) setStep(1);
              }}
            >
              <p className="font-hand text-2xl text-primary">hello, lovely!</p>
              <h1 className="text-3xl font-extrabold text-ink">What should your diary call you?</h1>
              <div className="mt-6">
                <Field
                  label="Your name"
                  autoFocus
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mira"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                🔒 Even your name is encrypted — only you will see it.
              </p>
              <button className={`${btnPrimary} mt-6 w-full`} disabled={!name.trim()}>
                Nice to meet me →
              </button>
            </form>
          )}
          {step === 1 && (
            <div>
              <p className="font-hand text-2xl text-primary">hi {name.trim()} ♡</p>
              <h1 className="text-3xl font-extrabold text-ink">You are a…</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Just helps us suggest a theme. We don't save this.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVibe(v.id);
                      pickTheme(v.theme);
                    }}
                    className={`rounded-2xl border-2 border-ink px-4 py-4 text-lg font-bold text-ink transition-all ${vibe === v.id ? "sticker bg-butter -rotate-1" : "bg-paper hover:bg-muted"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button className={btnSoft} onClick={() => setStep(0)}>
                  ←
                </button>
                <button className={`${btnPrimary} flex-1`} onClick={() => setStep(2)}>
                  Next →
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <p className="font-hand text-2xl text-primary">pick your paper</p>
              <h1 className="text-3xl font-extrabold text-ink">Choose a theme</h1>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTheme(t.id)}
                    className={`rounded-2xl border-2 border-ink bg-paper p-3 text-left transition-all ${theme === t.id ? "sticker -rotate-1" : "hover:bg-muted"}`}
                  >
                    <span
                      className="block h-12 rounded-xl border-2 border-ink"
                      style={{ background: t.swatch }}
                    />
                    <span className="mt-2 block font-bold text-ink">{t.name}</span>
                    <span className="block font-hand text-lg leading-none text-muted-foreground">
                      {t.note}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button className={btnSoft} onClick={() => setStep(1)}>
                  ←
                </button>
                <button className={`${btnPrimary} flex-1`} onClick={() => setStep(3)}>
                  Love it →
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
              className="space-y-4"
            >
              <div>
                <p className="font-hand text-2xl text-primary">lock & key</p>
                <h1 className="text-3xl font-extrabold text-ink">Make it yours</h1>
              </div>
              <Field
                label="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mira.writes"
                hint="3–24 letters, numbers, . or _"
              />
              <Field
                label="Password"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                hint={`At least ${MIN_PASSWORD_LENGTH} characters. This password unlocks your diary — we never see it.`}
              />
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < strength ? (strength < 2 ? "bg-destructive" : strength < 3 ? "bg-butter" : "bg-sage") : "bg-muted"}`}
                  />
                ))}
              </div>
              <Field
                label="Password again"
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
              {err && <ErrorNote>{err}</ErrorNote>}
              <div className="flex gap-3 pt-2">
                <button type="button" className={btnSoft} onClick={() => setStep(2)}>
                  ←
                </button>
                <button className={`${btnPrimary} flex-1`} disabled={busy}>
                  {busy ? "Locking it up…" : "Create my diary"}
                </button>
              </div>
            </form>
          )}
          {step === 4 && code && (
            <div>
              <p className="font-hand text-2xl text-primary">one last tiny thing</p>
              <h1 className="text-3xl font-extrabold text-ink">Your secret recovery code</h1>
              <p className="mt-2 text-muted-foreground">
                Your diary is locked so tightly that <b>not even we</b> can open it. If you ever
                forget your password, this code is the only way back in.
              </p>
              <div className="sticker mt-5 rounded-2xl bg-butter p-4 text-center font-mono text-xl font-bold tracking-wider text-ink select-all">
                {code}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-sm font-bold text-ink hover:bg-muted"
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  📋 copy
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-sm font-bold text-ink hover:bg-muted"
                  onClick={downloadCode}
                >
                  ⬇ download
                </button>
              </div>
              <label className="mt-5 flex items-center gap-3 font-bold text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                I've saved it somewhere safe
              </label>
              <button
                className={`${btnPrimary} mt-6 w-full`}
                disabled={!saved}
                onClick={() => void finish()}
              >
                Open my diary ✨
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
