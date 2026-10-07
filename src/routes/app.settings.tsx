import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { deriveAuthKey, encryptJSON, rewrapWithNewPassword, storeKey } from "@/lib/crypto";
import {
  applyTheme,
  clearLocal,
  getKey,
  getWrapped,
  refreshMe,
  updateMe,
  useMe,
  type MeRaw,
  type Theme,
} from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { THEMES } from "@/lib/themes";
import { btnPrimary, btnSoft, Card, ErrorNote, Field } from "@/components/mj";
import { Modal } from "@/components/BookForm";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(me?.name ?? "");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  if (!me) return null;

  async function patch(body: { theme?: Theme; profile?: string }) {
    const r = await api<{ me: MeRaw }>("/me", { method: "PATCH", body });
    await updateMe(r.me);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setPwErr(null);
    if (pw.length < MIN_PASSWORD_LENGTH)
      return setPwErr(`New password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    const wrapped = getWrapped();
    if (!wrapped) return;
    setBusy(true);
    try {
      const { pw: newWrapped, sessionKey } = await rewrapWithNewPassword(cur, wrapped, pw).catch(
        () => {
          throw new ApiError(401, "Your current password isn't right.");
        },
      );
      await api("/auth/password", {
        method: "POST",
        body: {
          currentAuthKey: await deriveAuthKey(me.username, cur),
          authKey: await deriveAuthKey(me.username, pw),
          pw: newWrapped,
        },
      });
      await storeKey(sessionKey);
      await refreshMe();
      setCur("");
      setPw("");
      toast.success("Password changed. Other devices were signed out.");
    } catch (e) {
      setPwErr(e instanceof ApiError ? e.message : "Couldn't change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-hand text-2xl text-primary">all about you</p>
        <h1 className="text-4xl font-extrabold text-ink">Settings</h1>
        <p className="text-muted-foreground">@{me.username}</p>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-ink">Theme</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={async () => {
                applyTheme(t.id);
                await patch({ theme: t.id }).catch(() => toast.error("Couldn't save theme"));
              }}
              className={`rounded-2xl border-2 border-ink p-2 ${me.theme === t.id ? "sticker" : "hover:bg-muted"}`}
            >
              <span
                className="block h-10 rounded-lg border-2 border-ink"
                style={{ background: t.swatch }}
              />
              <span className="mt-1 block text-sm font-bold text-ink">{t.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await patch({ profile: await encryptJSON(getKey(), { name: name.trim() }) });
            toast.success("Name updated ♡");
          }}
        >
          <div className="flex-1">
            <Field
              label="Your name"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button className={btnSoft}>Save</button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-ink">Plan</h2>
        <p className="mt-1 text-muted-foreground">
          You're on <b className="text-ink">{me.plan === "premium" ? "Premium" : "Free"}</b> —{" "}
          {me.limits.books} books, {me.limits.pages} pages.
        </p>
        {me.plan === "free" && (
          <p className="mt-2 font-hand text-xl text-primary">
            Premium · ₹99/month · 10 books & 50 pages — coming soon!
          </p>
        )}
      </Card>

      <Card>
        <form onSubmit={changePassword} className="space-y-3">
          <h2 className="text-xl font-bold text-ink">Change password</h2>
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            hint="Your recovery code keeps working."
          />
          {pwErr && <ErrorNote>{pwErr}</ErrorNote>}
          <button className={btnPrimary} disabled={busy || !cur || !pw}>
            {busy ? "Re-locking…" : "Change password"}
          </button>
        </form>
      </Card>

      <Card className="border-destructive">
        <h2 className="text-xl font-bold text-ink">Delete account</h2>
        <p className="mt-1 text-muted-foreground">
          Erases your account, every book and every page from our server, permanently.
        </p>
        <button
          className="mt-4 font-bold text-destructive hover:underline"
          onClick={() => setDelOpen(true)}
        >
          Delete my account…
        </button>
      </Card>

      <Modal open={delOpen} onClose={() => setDelOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setDelErr(null);
            try {
              await api("/me", {
                method: "DELETE",
                body: { authKey: await deriveAuthKey(me.username, delPw) },
              });
              await clearLocal();
              qc.clear();
              nav({ to: "/" });
            } catch (err) {
              setDelErr(err instanceof ApiError ? err.message : "Couldn't delete account.");
            }
          }}
        >
          <h2 className="text-2xl font-extrabold text-ink">Are you really sure? 🥺</h2>
          <p className="text-muted-foreground">
            Everything will be gone forever. Type your password to confirm.
          </p>
          <Field
            label="Password"
            type="password"
            value={delPw}
            onChange={(e) => setDelPw(e.target.value)}
          />
          {delErr && <ErrorNote>{delErr}</ErrorNote>}
          <div className="flex gap-3">
            <button type="button" className={btnSoft} onClick={() => setDelOpen(false)}>
              Keep my diary
            </button>
            <button className={`${btnPrimary} flex-1 bg-destructive`} disabled={!delPw}>
              Delete forever
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
