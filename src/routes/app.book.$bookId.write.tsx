import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { encryptJSON } from "@/lib/crypto";
import { MOODS, useBooks, usePages, type PageData, type Stroke } from "@/lib/journal";
import { getKey, refreshMe } from "@/lib/session";
import { DrawPad } from "@/components/DrawPad";
import { btnPrimary, btnSmall, Spinner } from "@/components/mj";

export const Route = createFileRoute("/app/book/$bookId/write")({
  validateSearch: (s: Record<string, unknown>): { page?: string } =>
    typeof s["page"] === "string" ? { page: s["page"] } : {},
  component: Writer,
});

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function Writer() {
  const { bookId } = Route.useParams();
  const { page: pageId } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: books } = useBooks();
  const { data: pages, isLoading } = usePages(bookId);
  const book = books?.find((b) => b.id === bookId);
  const existing = pageId ? pages?.find((p) => p.id === pageId) : undefined;

  const [loaded, setLoaded] = useState(!pageId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [at, setAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [mood, setMood] = useState("");
  const [scribble, setScribble] = useState<Stroke[]>([]);
  const [signature, setSignature] = useState<Stroke[]>([]);
  const [showScribble, setShowScribble] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setTitle(existing.title);
      setBody(existing.body);
      setAt(toLocalInput(existing.at));
      setMood(existing.mood);
      setScribble(existing.scribble);
      setSignature(existing.signature);
      setShowScribble(existing.scribble.length > 0);
      setShowSign(existing.signature.length > 0);
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (isLoading || !books || (pageId && !loaded)) return <Spinner />;
  if (!book)
    return (
      <p className="font-hand text-2xl">
        Book not found.{" "}
        <Link to="/app" className="underline">
          Shelf
        </Link>
      </p>
    );

  async function save() {
    if (!body.trim() && !scribble.length && !title.trim()) {
      toast("Write or doodle something first ♡");
      return;
    }
    setBusy(true);
    try {
      const data: PageData = {
        title: title.trim(),
        body,
        at: new Date(at).toISOString(),
        mood,
        scribble: showScribble ? scribble : [],
        signature: showSign ? signature : [],
      };
      const enc = await encryptJSON(getKey(), data);
      if (pageId) await api(`/pages/${pageId}`, { method: "PUT", body: { data: enc } });
      else await api(`/books/${bookId}/pages`, { method: "POST", body: { data: enc } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pages", bookId] }),
        qc.invalidateQueries({ queryKey: ["books"] }),
        refreshMe(),
      ]);
      toast.success(pageId ? "Page updated ♡" : "Saved to your book ♡");
      nav({ to: "/app/book/$bookId", params: { bookId } });
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't save. Your words are still here — try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pageId) return;
    await api(`/pages/${pageId}`, { method: "DELETE" });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pages", bookId] }),
      qc.invalidateQueries({ queryKey: ["books"] }),
      refreshMe(),
    ]);
    nav({ to: "/app/book/$bookId", params: { bookId } });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          to="/app/book/$bookId"
          params={{ bookId }}
          className="text-sm font-bold text-muted-foreground hover:text-primary"
        >
          ← {book.title}
        </Link>
        {pageId &&
          (confirmDel ? (
            <span className="flex gap-2 text-sm font-bold">
              <button className="text-destructive" onClick={() => void remove()}>
                yes, delete page
              </button>
              <button onClick={() => setConfirmDel(false)}>cancel</button>
            </span>
          ) : (
            <button
              className="text-sm font-bold text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDel(true)}
            >
              🗑 delete page
            </button>
          ))}
      </div>

      <div className="rise sticker mt-4 overflow-hidden rounded-3xl bg-paper">
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-dashed border-ink/30 px-6 py-4">
          <label className="flex items-center gap-2 font-hand text-xl text-primary">
            📅
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className="rounded-lg bg-transparent font-sans text-sm font-bold text-ink outline-none focus:bg-muted"
            />
          </label>
          <div className="ml-auto flex flex-wrap gap-1">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.label}
                onClick={() => setMood(mood === m.id ? "" : m.id)}
                className={`grid h-9 w-9 place-items-center rounded-full text-xl transition-transform ${mood === m.id ? "scale-125 bg-butter" : "opacity-60 hover:opacity-100"}`}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>
        <div className="ruled relative px-6 pb-8 pt-4 pl-14">
          <span className="absolute inset-y-0 left-10 w-0.5 bg-blush" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Give today a title…"
            className="w-full bg-transparent font-display text-2xl font-bold leading-8 text-ink outline-none placeholder:text-muted-foreground/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
            placeholder="Dear diary…"
            rows={12}
            className="mt-0 w-full resize-y bg-transparent font-hand text-2xl leading-8 text-ink outline-none placeholder:text-muted-foreground/50"
            style={{ minHeight: "24rem" }}
          />
          <p className="text-right text-xs text-muted-foreground">
            {body.length.toLocaleString()} / 20,000
          </p>
        </div>

        <div className="space-y-6 border-t-2 border-dashed border-ink/30 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${btnSmall} ${showScribble ? "bg-butter" : ""}`}
              onClick={() => setShowScribble(!showScribble)}
            >
              ✎ {showScribble ? "Hide scribble pad" : "Add a scribble"}
            </button>
            <button
              type="button"
              className={`${btnSmall} ${showSign ? "bg-butter" : ""}`}
              onClick={() => setShowSign(!showSign)}
            >
              ✍ {showSign ? "Remove signature" : "Sign it"}
            </button>
          </div>
          {showScribble && (
            <DrawPad label="doodle away" value={scribble} onChange={setScribble} ratio={0.45} />
          )}
          {showSign && (
            <div className="ml-auto max-w-sm">
              <DrawPad
                label="your signature"
                value={signature}
                onChange={setSignature}
                ratio={0.35}
                defaultWidth={3}
                palette={false}
              />
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className={btnPrimary} disabled={busy} onClick={() => void save()}>
          {busy ? "Locking & saving…" : pageId ? "Save changes ♡" : "Save to book ♡"}
        </button>
      </div>
      <p className="mt-3 text-right text-xs text-muted-foreground">
        🔒 Encrypted on this device before saving.
      </p>
    </div>
  );
}
