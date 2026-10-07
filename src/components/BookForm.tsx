import { useState, type ReactNode } from "react";
import { BOOK_COLORS, BOOK_HEX, prepareCover, type BookColor } from "@/lib/journal";
import { btnPrimary, btnSoft, ErrorNote, Field } from "./mj";

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rise sticker max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-paper p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export type BookFormValue = { title: string; color: BookColor; cover?: string | null };

export function BookForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  hasCover,
}: {
  initial: { title: string; color: BookColor };
  submitLabel: string;
  onSubmit: (v: BookFormValue) => Promise<void>;
  onCancel: () => void;
  hasCover?: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [color, setColor] = useState<BookColor>(initial.color);
  const [cover, setCover] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try {
      setCover(await prepareCover(file));
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't use that image.");
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return setErr("Give your book a name!");
        setBusy(true);
        setErr(null);
        try {
          const v: BookFormValue = { title: title.trim(), color };
          if (cover !== undefined) v.cover = cover;
          await onSubmit(v);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-5">
        <div
          className="sticker relative h-36 w-26 shrink-0 overflow-hidden rounded-lg"
          style={{ background: BOOK_HEX[color], width: "6.5rem" }}
        >
          {preview && <img src={preview} alt="" className="h-full w-full object-cover" />}
          {!preview && (
            <p className="p-2 pt-10 text-center font-display text-sm font-extrabold text-ink">
              {title || "My Diary"}
            </p>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <Field
            label="Book name"
            maxLength={60}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer of 2026"
          />
          <div>
            <span className="mb-1 block text-sm font-bold text-ink">Colour</span>
            <div className="flex flex-wrap gap-2">
              {BOOK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 border-ink ${color === c ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ background: BOOK_HEX[c] }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-full border-2 border-dashed border-ink px-4 py-2 text-sm font-bold text-ink hover:bg-muted">
          🖼 {cover || hasCover ? "Change cover photo" : "Upload cover photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        {(hasCover || cover) && cover !== null && (
          <button
            type="button"
            className="text-sm font-bold text-muted-foreground hover:text-destructive"
            onClick={() => {
              setCover(null);
              setPreview(null);
            }}
          >
            remove cover
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        🔒 Covers are shrunk and encrypted on your device before upload.
      </p>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="flex gap-3 pt-1">
        <button type="button" className={btnSoft} onClick={onCancel}>
          Cancel
        </button>
        <button className={`${btnPrimary} flex-1`} disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
