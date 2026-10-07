// Builds the PDF entirely in the browser from decrypted pages — nothing is sent anywhere.
import type { Book, Page, Stroke } from "./journal";
import { BOOK_HEX, MOODS } from "./journal";

function drawStrokesPdf(
  doc: import("jspdf").jsPDF,
  strokes: Stroke[],
  x: number,
  y: number,
  w: number,
) {
  const s = w / 1000;
  for (const st of strokes) {
    doc.setDrawColor(st.c);
    doc.setLineWidth(Math.max(0.2, st.w * s * 0.9));
    doc.setLineCap("round");
    doc.setLineJoin("round");
    for (let i = 2; i < st.p.length; i += 2) {
      doc.line(
        x + (st.p[i - 2] ?? 0) * s,
        y + (st.p[i - 1] ?? 0) * s,
        x + (st.p[i] ?? 0) * s,
        y + (st.p[i + 1] ?? 0) * s,
      );
    }
  }
}
const strokeHeight = (strokes: Stroke[]) =>
  strokes.reduce((m, s) => Math.max(m, ...s.p.filter((_, i) => i % 2 === 1)), 0);
// Standard PDF fonts are Latin only, so emoji are stripped rather than printed as garbage.
// The variation selector and zero-width joiner go too — on their own they render as blanks.
const EMOJI = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D}/gu;
const clean = (t: string) => t.replace(EMOJI, "");

export async function exportBookPdf(
  book: Book,
  pages: Page[],
  author: string,
  coverUrl: string | null,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = 148;
  const H = 210;
  const M = 16;
  const ink = "#3b2f2a";
  const accent = "#d9577a";

  // ---- cover ----
  doc.setFillColor(BOOK_HEX[book.color]);
  doc.rect(0, 0, W, H, "F");
  if (coverUrl) {
    const img = await fetch(coverUrl)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((res) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.readAsDataURL(b);
          }),
      );
    const png = await new Promise<string>((res) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = im.height;
        c.getContext("2d")?.drawImage(im, 0, 0);
        res(c.toDataURL("image/jpeg", 0.9));
      };
      im.src = img;
    });
    doc.addImage(png, "JPEG", 0, 0, W, H);
    doc.setFillColor("#fffaf2");
    doc.roundedRect(M, H - 70, W - 2 * M, 46, 4, 4, "F");
  } else {
    doc.setFillColor("#fffaf2");
    doc.roundedRect(M, 60, W - 2 * M, 70, 4, 4, "F");
  }
  doc.setDrawColor(ink);
  doc.setLineWidth(0.6);
  const boxY = coverUrl ? H - 70 : 60;
  const boxH = coverUrl ? 46 : 70;
  doc.roundedRect(M, boxY, W - 2 * M, boxH, 4, 4, "S");
  doc.setTextColor(ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const titleLines = doc.splitTextToSize(clean(book.title) || "My Diary", W - 2 * M - 12);
  doc.text(titleLines.slice(0, 2), W / 2, boxY + boxH / 2 - 4, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.text(`the diary of ${clean(author)}`, W / 2, boxY + boxH / 2 + 12, { align: "center" });

  // ---- pages ----
  const sorted = [...pages].sort((a, b) => a.at.localeCompare(b.at));
  let pageNo = 1;
  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#a08f86");
    doc.text(`${clean(book.title)}  ·  ${pageNo++}`, W / 2, H - 8, { align: "center" });
  };
  const newSheet = () => {
    doc.addPage();
    doc.setFillColor("#fffaf2");
    doc.rect(0, 0, W, H, "F");
    doc.setDrawColor("#d8e3ee");
    doc.setLineWidth(0.2);
    for (let ly = 38; ly < H - 16; ly += 8) doc.line(M, ly, W - M, ly);
    doc.setDrawColor("#f2b8c0");
    doc.line(M + 6, 12, M + 6, H - 14);
  };

  for (const p of sorted) {
    newSheet();
    const d = new Date(p.at);
    const mood = MOODS.find((m) => m.id === p.mood);
    doc.setTextColor(accent);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text(
      d.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }) +
        "  ·  " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      M + 10,
      20,
    );
    if (mood) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`feeling ${mood.label}`.toUpperCase(), W - M, 20, { align: "right" });
    }
    let y = 32;
    if (p.title.trim()) {
      doc.setTextColor(ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      const tl = doc.splitTextToSize(clean(p.title), W - 2 * M - 10);
      doc.text(tl, M + 10, y);
      y += tl.length * 7 + 2;
    }
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(ink);
    const lines: string[] = doc.splitTextToSize(clean(p.body), W - 2 * M - 10);
    const lh = 8;
    y = 37 + Math.max(0, Math.ceil((y - 37) / 8)) * 8;
    for (const line of lines) {
      if (y > H - 22) {
        footer();
        newSheet();
        y = 37;
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.setTextColor(ink);
      }
      doc.text(line, M + 10, y);
      y += lh;
    }
    const boxW = W - 2 * M - 10;
    if (p.scribble.length) {
      const h = (strokeHeight(p.scribble) / 1000) * boxW + 4;
      if (y + h > H - 22) {
        footer();
        newSheet();
        y = 30;
      }
      drawStrokesPdf(doc, p.scribble, M + 10, y, boxW);
      y += h + 4;
    }
    if (p.signature.length) {
      const sw = 50;
      const h = (strokeHeight(p.signature) / 1000) * sw + 4;
      if (y + h > H - 18) {
        footer();
        newSheet();
        y = 30;
      }
      drawStrokesPdf(doc, p.signature, W - M - sw, y, sw);
    }
    footer();
  }

  if (!sorted.length) {
    newSheet();
    doc.setFont("times", "italic");
    doc.setFontSize(14);
    doc.setTextColor(ink);
    doc.text("No pages yet — the best stories are still to come.", W / 2, H / 2, {
      align: "center",
    });
  }

  doc.setProperties({ title: clean(book.title), author: clean(author), creator: "MoiJournal" });
  doc.save(
    `${
      clean(book.title)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase() || "diary"
    }.pdf`,
  );
}
