import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { encryptJSON } from "@/lib/crypto";
import { MOODS, fetchCover, useBooks, usePages } from "@/lib/journal";
import { exportBookPdf } from "@/lib/pdf";
import { getKey, refreshMe, useMe } from "@/lib/session";
import { BookForm, Modal } from "@/components/BookForm";
import { BookCover } from "@/components/BookCover";
import { btnPrimary, btnSmall, btnSoft, Spinner } from "@/components/mj";

export const Route = createFileRoute("/app/book/$bookId/")({
  component: BookView,
});

function BookView() {
  const { bookId } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: books } = useBooks();
  const { data: pages, isLoading } = usePages(bookId);
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const book = books?.find((b) => b.id === bookId);

  if (!books || isLoading) return <Spinner />;
  if (!book || !me)
    return (
      <p className="font-hand text-2xl">
        This book wandered off.{" "}
        <Link to="/app" className="underline">
          Back to shelf
        </Link>
      </p>
    );
  const pagesFull = me.usage.pages >= me.limits.pages;
  const sorted = [...(pages ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  async function doExport() {
    if (!book) return;
    setExporting(true);
    try {
      const cover = book.has_cover ? await fetchCover(book.id, book.updated_at) : null;
      await exportBookPdf(book, pages ?? [], me?.name ?? "me", cover);
    } catch {
      toast.error("Couldn't make the PDF. Try again?");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Link to="/app" className="text-sm font-bold text-muted-foreground hover:text-primary">
        ← shelf
      </Link>
      <div className="mt-4 grid gap-10 md:grid-cols-[220px_1fr]">
        <div className="rise">
          <BookCover book={book} className="-rotate-2" />
          <div className="mt-6 flex flex-col gap-2">
            <button className={btnSmall} onClick={() => setEdit(true)}>
              ✎ Edit book
            </button>
            <button className={btnSmall} disabled={exporting} onClick={() => void doExport()}>
              {exporting ? "Making PDF…" : "⬇ Export PDF"}
            </button>
            <button
              className={`${btnSmall} hover:text-destructive`}
              onClick={() => setConfirmDel(true)}
            >
              🗑 Delete book
            </button>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-hand text-2xl text-primary">
                {book.pages} page{book.pages === 1 ? "" : "s"} so far
              </p>
              <h1 className="text-4xl font-extrabold text-ink">{book.title}</h1>
            </div>
            {pagesFull ? (
              <p className="max-w-xs text-sm text-muted-foreground">
                You've used all {me.limits.pages} pages on your plan. Premium is coming soon ✨
              </p>
            ) : (
              <Link
                to="/app/book/$bookId/write"
                params={{ bookId }}
                search={{}}
                className={btnPrimary}
              >
                ✎ Write a page
              </Link>
            )}
          </div>

          <div className="mt-8 space-y-5">
            {sorted.length === 0 && (
              <div className="sticker ruled rounded-3xl p-10 text-center">
                <p className="font-hand text-3xl text-ink">blank pages, endless possibilities</p>
                <p className="mt-2 text-muted-foreground">
                  Write your first page whenever you're ready.
                </p>
              </div>
            )}
            {sorted.map((p, i) => {
              const d = new Date(p.at);
              const mood = MOODS.find((m) => m.id === p.mood);
              return (
                <Link
                  key={p.id}
                  to="/app/book/$bookId/write"
                  params={{ bookId }}
                  search={{ page: p.id }}
                  className="reveal in sticker ruled block rounded-2xl p-6 transition-transform hover:-translate-y-1"
                  style={{ rotate: `${i % 2 ? 0.4 : -0.4}deg` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-hand text-xl text-primary">
                      {d.toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {mood && (
                      <span className="text-2xl" title={mood.label}>
                        {mood.emoji}
                      </span>
                    )}
                  </div>
                  {p.title && <h3 className="mt-1 text-xl font-bold text-ink">{p.title}</h3>}
                  <p className="mt-1 line-clamp-2 font-hand text-2xl leading-8 text-ink/80">
                    {p.body || "(a page of doodles)"}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs font-bold text-muted-foreground">
                    {p.scribble.length > 0 && <span>✎ scribbles</span>}
                    {p.signature.length > 0 && <span>✍ signed</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)}>
        <h2 className="mb-5 text-2xl font-extrabold text-ink">Edit book</h2>
        <BookForm
          initial={{ title: book.title, color: book.color }}
          hasCover={book.has_cover}
          submitLabel="Save"
          onCancel={() => setEdit(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = {
              data: await encryptJSON(getKey(), { title: v.title }),
              color: v.color,
            };
            if (v.cover !== undefined) body["cover"] = v.cover;
            await api(`/books/${bookId}`, { method: "PATCH", body });
            await qc.invalidateQueries({ queryKey: ["books"] });
            setEdit(false);
          }}
        />
      </Modal>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)}>
        <h2 className="text-2xl font-extrabold text-ink">Delete "{book.title}"?</h2>
        <p className="mt-2 text-muted-foreground">
          All {book.pages} pages go with it. This can't be undone — maybe export a PDF first?
        </p>
        <div className="mt-6 flex gap-3">
          <button className={btnSoft} onClick={() => setConfirmDel(false)}>
            Keep it
          </button>
          <button
            className={`${btnPrimary} flex-1 bg-destructive`}
            onClick={async () => {
              await api(`/books/${bookId}`, { method: "DELETE" });
              await Promise.all([qc.invalidateQueries({ queryKey: ["books"] }), refreshMe()]);
              nav({ to: "/app" });
            }}
          >
            Delete forever
          </button>
        </div>
      </Modal>
    </div>
  );
}
