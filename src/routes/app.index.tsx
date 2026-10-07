import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { encryptJSON } from "@/lib/crypto";
import { useBooks } from "@/lib/journal";
import { getKey, refreshMe, useMe } from "@/lib/session";
import { BookForm, Modal } from "@/components/BookForm";
import { BookCover } from "@/components/BookCover";
import { Spinner } from "@/components/mj";

export const Route = createFileRoute("/app/")({
  component: Shelf,
});

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "up late" : h < 12 ? "good morning" : h < 17 ? "good afternoon" : "good evening";
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="min-w-40 flex-1">
      <div className="flex justify-between text-sm font-bold text-ink">
        <span>{label}</span>
        <span>
          {used} / {max}
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-paper">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.min(100, (used / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Shelf() {
  const me = useMe();
  const qc = useQueryClient();
  const { data: books, isLoading, error } = useBooks();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const full = me.usage.books >= me.limits.books;

  return (
    <div>
      <div className="rise flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-hand text-2xl text-primary">{greeting()},</p>
          <h1 className="text-4xl font-extrabold text-ink md:text-5xl">{me.name} ♡</h1>
        </div>
        <div className="sticker flex w-full max-w-md flex-wrap gap-4 rounded-2xl bg-paper p-4">
          <Meter label="📚 Books" used={me.usage.books} max={me.limits.books} />
          <Meter label="📄 Pages" used={me.usage.pages} max={me.limits.pages} />
          <p className="w-full text-xs text-muted-foreground">
            {me.plan === "premium"
              ? "✨ Premium"
              : "Free plan · Premium (₹99/mo) gives 10 books & 50 pages — coming soon"}
          </p>
        </div>
      </div>

      <h2 className="mt-12 font-hand text-3xl text-ink">my bookshelf</h2>
      {isLoading && <Spinner />}
      {error && <p className="mt-4 text-destructive">{error.message}</p>}
      {books && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-10 border-b-8 border-ink/80 pb-6 sm:grid-cols-3 md:grid-cols-5">
          {books.map((b, i) => (
            <Link
              key={b.id}
              to="/app/book/$bookId"
              params={{ bookId: b.id }}
              className="group block transition-transform hover:-translate-y-2"
              style={{ rotate: `${[-1.5, 1, -0.5, 1.5, 0][i % 5]}deg` }}
            >
              <BookCover book={b} />
              <p className="mt-3 text-sm font-bold text-muted-foreground">
                {b.pages} page{b.pages === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
          <button
            onClick={() =>
              full
                ? toast("Your shelf is full on this plan. Premium is coming soon ✨")
                : setOpen(true)
            }
            className="flex aspect-[3/4] flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink/50 text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <span className="text-4xl">＋</span>
            <span className="font-hand text-2xl">new book</span>
            {full && <span className="mt-1 text-xs text-muted-foreground">shelf full</span>}
          </button>
        </div>
      )}
      {books?.length === 0 && (
        <p className="mt-6 font-hand text-2xl text-muted-foreground">
          your shelf is empty — make your very first book! ↑
        </p>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <p className="font-hand text-2xl text-primary">a fresh notebook</p>
        <h2 className="mb-5 text-2xl font-extrabold text-ink">New journal book</h2>
        <BookForm
          initial={{ title: "", color: "blush" }}
          submitLabel="Create book"
          onCancel={() => setOpen(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = {
              data: await encryptJSON(getKey(), { title: v.title }),
              color: v.color,
            };
            if (v.cover) body["cover"] = v.cover;
            await api("/books", { method: "POST", body });
            await Promise.all([qc.invalidateQueries({ queryKey: ["books"] }), refreshMe()]);
            setOpen(false);
            toast.success("New book on your shelf!");
          }}
        />
      </Modal>
    </div>
  );
}
