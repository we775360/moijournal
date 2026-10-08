import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/session";
import {
  paymentsQuery,
  rupees,
  upiLink,
  UPI_VPA,
  UTR,
  type Payment,
  type PaymentStatus,
} from "@/lib/payments";
import { btnPrimary, Card, ErrorNote, Field } from "@/components/mj";

// Your own UPI/FamPay QR image goes here. Drop the file in `public/` and set this to its
// path, e.g. "/fampay-qr.png". While it is empty the pay card shows only the UPI ID and the
// deep-link button, so a QR that isn't ours is never shown.
const FAMPAY_QR_IMAGE = "";

export const Route = createFileRoute("/app/upgrade")({
  head: () => ({
    meta: [{ title: "Go Premium — MoiJournal" }, { name: "robots", content: "noindex" }],
  }),
  component: Upgrade,
});

const pretty = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-butter",
  approved: "bg-sage",
  rejected: "bg-blush",
};
const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "waiting for approval",
  approved: "approved",
  rejected: "couldn't be matched",
};

function Upgrade() {
  const me = useMe();
  const qc = useQueryClient();
  const info = useQuery(paymentsQuery);
  const [months, setMonths] = useState(1);
  const [upiId, setUpiId] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;

  const perMonth = info.data?.paisePerMonth ?? 9900;
  const amount = perMonth * months;
  const vpa = info.data?.upiId ?? "8108096229@fam";
  const link = upiLink({
    vpa,
    name: "MoiJournal",
    paise: amount,
    note: `MoiJournal Premium x${months}`,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!UPI_VPA.test(upiId.trim()))
      return setErr("That doesn't look like a UPI ID (like name@bank).");
    if (utr.trim() && !UTR.test(utr.trim())) return setErr("A UTR is 9–22 digits.");
    setBusy(true);
    try {
      await api("/payments", {
        method: "POST",
        body: { months, upiId: upiId.trim(), utr: utr.trim() || undefined },
      });
      setUpiId("");
      setUtr("");
      await qc.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Thanks! We'll unlock Premium once we've checked the payment ♡");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const pending = info.data?.payments.some((p) => p.status === "pending");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-hand text-2xl text-primary">treat your diary</p>
        <h1 className="text-4xl font-extrabold text-ink">Go Premium</h1>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-ink">Your plan</h2>
        <p className="mt-1 text-muted-foreground">
          You're on <b className="text-ink">{me.plan === "premium" ? "Premium" : "Free"}</b> —{" "}
          {me.limits.books} books, {me.limits.pages} pages.
        </p>
        {me.plan === "premium" && me.premiumUntil && (
          <p className="mt-2 font-hand text-xl text-primary">
            Premium until {pretty(me.premiumUntil)} ✨
          </p>
        )}
        {me.plan === "free" && (
          <ul className="mt-3 space-y-1 text-ink">
            <li>✓ 10 journal books instead of 2</li>
            <li>✓ 50 pages instead of 10</li>
            <li>✓ Custom covers galore</li>
            <li>✓ Support a tiny team ♡</li>
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-ink">
          {me.plan === "premium" ? "Add more months" : "How many months?"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ₹{(perMonth / 100).toLocaleString("en-IN")} a month. No card, no auto-renew — you pay by
          UPI whenever you feel like it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(info.data?.months ?? [1, 3, 6, 12]).map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`rounded-2xl border-2 border-ink px-5 py-3 font-bold text-ink ${
                months === m ? "sticker bg-butter -rotate-1" : "bg-paper hover:bg-muted"
              }`}
            >
              {m} {m === 1 ? "month" : "months"}
              <span className="block font-hand text-lg leading-none text-muted-foreground">
                {rupees(perMonth * m)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-ink">1 · Pay {rupees(amount)} by UPI</h2>
        <p className="mt-1 text-muted-foreground">
          Open any UPI app — GPay, PhonePe, Paytm, your bank's app — and pay the exact amount.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-dashed border-ink bg-paper px-4 py-3">
          <span className="flex-1 font-mono text-lg font-bold break-all text-ink select-all">
            {vpa}
          </span>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-sm font-bold text-ink hover:bg-muted"
            onClick={() =>
              navigator.clipboard
                .writeText(vpa)
                .then(() => toast.success("UPI ID copied"))
                .catch(() => toast.error("Couldn't copy — please note it down"))
            }
          >
            📋 copy
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <a href={link} className={btnPrimary}>
            Open a UPI app ↗
          </a>
          {FAMPAY_QR_IMAGE && (
            <img
              src={FAMPAY_QR_IMAGE}
              alt="MoiJournal UPI QR code"
              width={160}
              height={160}
              className="sticker h-40 w-40 rounded-2xl bg-paper object-contain p-2"
            />
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          The UPI app opens with the amount already filled in. The name shown there comes from the
          bank that owns this UPI ID.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-ink">2 · Tell us who paid</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We match your payment by hand, so paste the UPI ID you paid <b>from</b> — that's how we
          find you.
        </p>
        {pending ? (
          <p className="mt-4 rounded-2xl border-2 border-ink bg-butter px-4 py-3 font-bold text-ink">
            You already have a payment waiting for approval. We'll unlock Premium as soon as we
            check it ♡
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <Field
              label="Your UPI ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@bank"
              hint="The ID you paid from, not ours."
            />
            <Field
              label="UTR / reference (optional)"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 412345678901"
              hint="The reference number your UPI app shows after paying."
            />
            {err && <ErrorNote>{err}</ErrorNote>}
            <button className={btnPrimary} disabled={busy || !upiId.trim()}>
              {busy ? "Sending…" : `I paid ${rupees(amount)}`}
            </button>
          </form>
        )}
      </Card>

      {info.data && info.data.payments.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-ink">Your requests</h2>
          <ul className="mt-4 space-y-3">
            {info.data.payments.map((p) => (
              <PaymentRow key={p.id} p={p} />
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Something not right? Message us on Instagram{" "}
        <a
          className="font-bold text-primary hover:underline"
          href={`https://instagram.com/${info.data?.support ?? "moijournal26"}`}
          target="_blank"
          rel="noreferrer"
        >
          @{info.data?.support ?? "moijournal26"}
        </a>
      </p>
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink bg-paper px-4 py-3">
      <span className="font-bold text-ink">
        {rupees(p.amount_paise)} · {p.months} {p.months === 1 ? "month" : "months"}
      </span>
      <span
        className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold text-ink ${STATUS_STYLE[p.status]}`}
      >
        {STATUS_LABEL[p.status]}
      </span>
      <span className="w-full text-xs text-muted-foreground">sent {pretty(p.created_at)}</span>
    </li>
  );
}
