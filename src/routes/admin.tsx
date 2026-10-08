import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { loadSession, useMe } from "@/lib/session";
import { rupees } from "@/lib/payments";
import { btnPrimary, btnSmall, btnSoft, Card, Spinner } from "@/components/mj";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Admin — MoiJournal" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    if (!(await loadSession())) throw redirect({ to: "/login" });
  },
  component: Admin,
});

type Summary = {
  users: number;
  premium: number;
  pending_payments: number;
  revenue_paise: number;
  books: number;
  pages: number;
};
type AdminUser = {
  id: string;
  username: string;
  plan: "free" | "premium";
  premium_until: string | null;
  is_admin: boolean;
  created_at: string;
  books: number;
  pages: number;
  last_page_at: string | null;
};
type AdminPayment = {
  id: string;
  username: string;
  months: number;
  amount_paise: number;
  upi_id: string;
  utr: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const MONTH_CHOICES = [1, 3, 6, 12];
const pretty = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<"overview" | "payments" | "users">("overview");
  if (!me) return <Spinner label="checking your keys…" />;
  if (!me.isAdmin)
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="font-hand text-3xl text-primary">not so fast!</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink">Admins only</h1>
        <p className="mt-2 text-muted-foreground">
          This page is for the MoiJournal team. Your diary is just a click away.
        </p>
        <Link to="/app" className={`${btnPrimary} mt-6`}>
          Back to my shelf
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-hand text-2xl text-primary">the back office</p>
            <h1 className="text-4xl font-extrabold text-ink">Admin</h1>
          </div>
          <Link to="/app" className={btnSoft}>
            ← My shelf
          </Link>
        </div>

        <div className="flex gap-2">
          {(["overview", "payments", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold capitalize text-ink ${
                tab === t ? "sticker bg-butter" : "bg-paper hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview />}
        {tab === "payments" && <Payments />}
        {tab === "users" && <Users />}

        <p className="text-center text-xs text-muted-foreground">
          Admins see accounts, plans and payments. Diary pages and covers are stored as ciphertext,
          so nobody here can read them.
        </p>
      </div>
    </div>
  );
}

function useSummary() {
  return useQuery({
    queryKey: ["admin", "summary"],
    queryFn: () => api<Summary>("/admin/summary"),
  });
}

function Overview() {
  const s = useSummary();
  if (s.isLoading) return <Spinner label="adding it all up…" />;
  const d = s.data;
  const cells: [string, string | number][] = [
    ["diaries", d?.users ?? 0],
    ["on premium", d?.premium ?? 0],
    ["awaiting approval", d?.pending_payments ?? 0],
    ["collected", rupees(d?.revenue_paise ?? 0)],
    ["books", d?.books ?? 0],
    ["pages written", d?.pages ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {cells.map(([label, value]) => (
        <div key={label} className="sticker rounded-2xl bg-paper p-5">
          <p className="text-3xl font-extrabold text-ink">{value}</p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Payments() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => api<{ payments: AdminPayment[] }>("/admin/payments?limit=100"),
  });

  async function act(id: string, kind: "approve" | "reject", months?: number) {
    setBusy(id);
    try {
      await api(`/admin/payments/${id}/${kind}`, {
        method: "POST",
        body: kind === "approve" ? { months: months ?? 1 } : {},
      });
      toast.success(kind === "approve" ? "Premium unlocked ✨" : "Marked as not matched");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
      ]);
    } catch {
      toast.error("That didn't work. Try again?");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) return <Spinner label="loading payments…" />;
  const rows = q.data?.payments ?? [];
  if (!rows.length)
    return (
      <Card>
        <p className="font-hand text-2xl text-muted-foreground">no payments yet ♡</p>
      </Card>
    );

  return (
    <div className="space-y-4">
      {rows.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-ink">
                @{p.username} · {rupees(p.amount_paise)} · {p.months}{" "}
                {p.months === 1 ? "month" : "months"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                paid from <b className="text-ink">{p.upi_id}</b>
                {p.utr && <> · UTR {p.utr}</>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                sent {pretty(p.created_at)}
                {p.reviewed_at && ` · reviewed ${pretty(p.reviewed_at)} by ${p.reviewed_by}`}
              </p>
            </div>
            <span
              className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold text-ink ${
                p.status === "pending"
                  ? "bg-butter"
                  : p.status === "approved"
                    ? "bg-sage"
                    : "bg-blush"
              }`}
            >
              {p.status}
            </span>
          </div>
          {p.status === "pending" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground">unlock for</span>
              {MONTH_CHOICES.map((m) => (
                <button
                  key={m}
                  disabled={busy === p.id}
                  onClick={() => act(p.id, "approve", m)}
                  className={m === p.months ? `${btnSmall} bg-butter` : btnSmall}
                >
                  {m}m
                </button>
              ))}
              <button
                disabled={busy === p.id}
                onClick={() => act(p.id, "reject")}
                className={`${btnSmall} ml-auto`}
              >
                Not matched
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "users", term],
    queryFn: () =>
      api<{ users: AdminUser[]; total: number }>(
        `/admin/users?limit=50&q=${encodeURIComponent(term)}`,
      ),
  });

  async function patch(id: string, action: string, months?: number) {
    setBusy(id);
    try {
      await api(`/admin/users/${id}`, {
        method: "PATCH",
        body: months ? { action, months } : { action },
      });
      toast.success("Updated");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch {
      toast.error("That didn't work. Try again?");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="search a username…"
        className="w-full rounded-2xl border-2 border-ink bg-paper px-4 py-3 text-lg text-ink outline-none focus:shadow-[4px_4px_0_var(--ink)]"
      />
      {q.isLoading && <Spinner label="finding people…" />}
      {q.data && (
        <p className="text-sm text-muted-foreground">
          {q.data.total} {q.data.total === 1 ? "diary" : "diaries"}
        </p>
      )}
      {q.data?.users.map((u) => (
        <Card key={u.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-ink">
                @{u.username}{" "}
                {u.is_admin && (
                  <span className="rounded-full border-2 border-ink bg-sky px-2 py-0.5 text-xs">
                    admin
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {u.books} books · {u.pages} pages · last wrote {pretty(u.last_page_at)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                joined {pretty(u.created_at)}
                {u.plan === "premium" &&
                  u.premium_until &&
                  ` · premium until ${pretty(u.premium_until)}`}
              </p>
            </div>
            <span
              className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold text-ink ${
                u.plan === "premium" ? "bg-butter" : "bg-paper"
              }`}
            >
              {u.plan}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">grant</span>
            {MONTH_CHOICES.map((m) => (
              <button
                key={m}
                disabled={busy === u.id}
                onClick={() => patch(u.id, "grant", m)}
                className={btnSmall}
              >
                {m}m
              </button>
            ))}
            {u.plan === "premium" && (
              <button
                disabled={busy === u.id}
                onClick={() => patch(u.id, "revoke")}
                className={btnSmall}
              >
                Revoke
              </button>
            )}
            <button
              disabled={busy === u.id}
              onClick={() => patch(u.id, u.is_admin ? "removeAdmin" : "makeAdmin")}
              className={`${btnSmall} ml-auto`}
            >
              {u.is_admin ? "Remove admin" : "Make admin"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
