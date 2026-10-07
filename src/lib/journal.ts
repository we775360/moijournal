import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { decryptBytes, decryptJSON, encryptBytes } from "./crypto";
import { getKey } from "./session";

export type Stroke = { c: string; w: number; p: number[] };
export type BookColor = "blush" | "sage" | "sky" | "butter" | "lilac" | "ink";
export type PageData = {
  title: string;
  body: string;
  at: string;
  mood: string;
  scribble: Stroke[];
  signature: Stroke[];
};
export type Book = {
  id: string;
  title: string;
  color: BookColor;
  has_cover: boolean;
  pages: number;
  updated_at: string;
};
export type Page = PageData & { id: string; created_at: string };

export const MOODS = [
  { id: "happy", emoji: "😊", label: "happy" },
  { id: "loved", emoji: "🥰", label: "loved" },
  { id: "calm", emoji: "😌", label: "calm" },
  { id: "excited", emoji: "🤩", label: "excited" },
  { id: "tired", emoji: "😴", label: "tired" },
  { id: "sad", emoji: "😢", label: "sad" },
  { id: "angry", emoji: "😤", label: "angry" },
];
export const BOOK_COLORS: BookColor[] = ["blush", "sage", "sky", "butter", "lilac", "ink"];
export const BOOK_HEX: Record<BookColor, string> = {
  blush: "#f2b8c0",
  sage: "#b9dcc0",
  sky: "#b6d4ee",
  butter: "#f6e3a1",
  lilac: "#d6c6f0",
  ink: "#3b2f2a",
};

type RawBook = Omit<Book, "title"> & { data: string };
type RawPage = { id: string; data: string; created_at: string };

export const booksQuery = {
  queryKey: ["books"],
  queryFn: async (): Promise<Book[]> => {
    const r = await api<{ books: RawBook[] }>("/books");
    const k = getKey();
    return Promise.all(
      r.books.map(async ({ data, ...b }) => ({
        ...b,
        title: (await decryptJSON<{ title: string }>(k, data).catch(() => ({ title: "🔒 locked" })))
          .title,
      })),
    );
  },
};
export const useBooks = () => useQuery(booksQuery);

export const pagesQuery = (bookId: string) => ({
  queryKey: ["pages", bookId],
  queryFn: async (): Promise<Page[]> => {
    const r = await api<{ pages: RawPage[] }>(`/books/${bookId}/pages`);
    const k = getKey();
    return Promise.all(
      r.pages.map(async (p) => ({
        id: p.id,
        created_at: p.created_at,
        ...(await decryptJSON<PageData>(k, p.data)),
      })),
    );
  },
});
export const usePages = (bookId: string) => useQuery(pagesQuery(bookId));

const coverCache = new Map<string, string>();
export async function fetchCover(bookId: string, version: string): Promise<string | null> {
  const ck = `${bookId}:${version}`;
  const hit = coverCache.get(ck);
  if (hit) return hit;
  const r = await api<{ cover: string | null }>(`/books/${bookId}/cover`);
  if (!r.cover) return null;
  const bytes = await decryptBytes(getKey(), r.cover);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "image/webp" }));
  coverCache.set(ck, url);
  return url;
}
export function useCover(book: Book | undefined) {
  return useQuery({
    queryKey: ["cover", book?.id, book?.updated_at],
    queryFn: () => (book ? fetchCover(book.id, book.updated_at) : null),
    enabled: !!book?.has_cover,
    staleTime: Infinity,
  });
}

// Shrinks any photo to a small 480×640 WebP so covers stay tiny in the database.
export async function prepareCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is too big (max 15 MB).");
  const bmp = await createImageBitmap(file);
  const W = 480;
  const H = 640;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read image.");
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  let q = 0.78;
  let blob: Blob | null = null;
  while (q > 0.3) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
    if (blob && blob.size < 120_000) break;
    q -= 0.12;
  }
  if (!blob) throw new Error("Couldn't process image.");
  return encryptBytes(getKey(), new Uint8Array(await blob.arrayBuffer()));
}
