import { BOOK_HEX, useCover, type Book } from "@/lib/journal";

export function BookCover({ book, className = "" }: { book: Book; className?: string }) {
  const { data: url } = useCover(book);
  const dark = book.color === "ink";
  return (
    <div
      className={`sticker relative aspect-[3/4] overflow-hidden rounded-r-xl rounded-l-sm ${className}`}
      style={{ background: BOOK_HEX[book.color] }}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-x-3 top-1/4 rounded-lg border-2 border-dashed px-2 py-3 text-center"
          style={{ borderColor: dark ? "#fffaf2" : "#3b2f2a" }}
        >
          <p
            className="font-display text-lg font-extrabold leading-tight break-words"
            style={{ color: dark ? "#fffaf2" : "#3b2f2a" }}
          >
            {book.title}
          </p>
        </div>
      )}
      <span className="absolute inset-y-0 left-2 w-px bg-black/15" />
      {url && (
        <p
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 font-display font-extrabold leading-tight"
          style={{ color: "#fffaf2" }}
        >
          {book.title}
        </p>
      )}
    </div>
  );
}
