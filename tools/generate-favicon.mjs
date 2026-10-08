// Generates MoiJournal's brand icon — the SVG that browsers prefer, the multi-size .ico
// that older browsers, bookmarks and OS shortcuts fall back to, and the 1200x630
// og-image.png that link previews and search results use.
//
//   node tools/generate-favicon.mjs
//
// One shape list drives both outputs, so the icon can be tweaked in one place. The icon
// is drawn from rounded rectangles only, which both SVG and the rasteriser below express
// directly. Palette matches the app's styles.css tokens.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const INK = "#3b2f2a";
const BLUSH = "#f2b8c0";
const PAPER = "#fffaf2";
const BUTTER = "#f6e3a1";
const LINE = "#d8e3ee";

// A cosy notebook on a blush "sticker" badge: the hard offset shadow matches the
// `sticker` utility in styles.css. Painted back to front, in a 256x256 viewBox.
const SHAPES = [
  { x: 20, y: 24, w: 216, h: 216, r: 56, fill: INK }, // sticker shadow
  { x: 12, y: 12, w: 232, h: 232, r: 56, fill: INK }, // badge outline
  { x: 21, y: 21, w: 214, h: 214, r: 47, fill: BLUSH }, // badge face
  { x: 66, y: 52, w: 124, h: 150, r: 14, fill: INK }, // page block outline
  { x: 74, y: 60, w: 108, h: 134, r: 8, fill: PAPER }, // page block
  { x: 92, y: 84, w: 66, h: 6, r: 3, fill: LINE },
  { x: 92, y: 102, w: 66, h: 6, r: 3, fill: LINE },
  { x: 92, y: 120, w: 66, h: 6, r: 3, fill: LINE },
  { x: 92, y: 138, w: 44, h: 6, r: 3, fill: LINE },
  { x: 148, y: 34, w: 38, h: 100, r: 7, fill: INK }, // bookmark outline
  { x: 154, y: 40, w: 26, h: 88, r: 5, fill: BUTTER }, // bookmark
];

const VIEWBOX = 256;

// Same brand, wider canvas: the 1200x630 card social platforms and search results show.
const OG = { width: 1200, height: 630 };

const scaleShapes = (shapes, k, dx, dy) =>
  shapes.map((s) => ({
    ...s,
    x: s.x * k + dx,
    y: s.y * k + dy,
    w: s.w * k,
    h: s.h * k,
    r: s.r * k,
  }));

// A ruled paper sticker with the notebook badge centred on it, drawn in the OG canvas'
// own pixel coordinates (so it is rendered with scale 1).
const OG_SHAPES = [
  { x: 84, y: 60, w: 1032, h: 510, r: 48, fill: INK }, // sticker shadow
  { x: 72, y: 48, w: 1032, h: 510, r: 48, fill: PAPER }, // card
  ...scaleShapes(SHAPES, 1.7, 370, 85), // the badge, 435px, centred on the card
];

// ---------------------------------------------------------------- SVG

function toSvg() {
  const body = SHAPES.map(
    ({ x, y, w, h, r, fill }) =>
      `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" />`,
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-label="MoiJournal">
${body}
</svg>
`;
}

// ---------------------------------------------------------------- rasteriser

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

// Signed distance to a rounded rectangle: negative inside, so `<= 0` is a hit.
function distanceToShape(px, py, { x, y, w, h, r }) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Samples SUB x SUB points per output pixel and averages them, which antialiases the
// edges far more simply than coverage maths would.
const SUB = 4;

// Colours are averaged over covered samples only and alpha is their share of the pixel, so
// the PNG keeps straight (non-premultiplied) alpha and edges stay clean. A `background`
// paints the whole canvas; without one, uncovered samples stay transparent.
function render({ width, height, shapes, background = null, scale = 1 }) {
  const pixels = Buffer.alloc(width * height * 4);
  const step = 1 / SUB;
  const total = SUB * SUB;
  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let hits = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const px = (ox + (sx + 0.5) * step) / scale;
          const py = (oy + (sy + 0.5) * step) / scale;
          let colour = background;
          for (const shape of shapes) {
            if (distanceToShape(px, py, shape) <= 0) colour = shape.fill;
          }
          if (colour === null) continue;
          const [cr, cg, cb] = hex(colour);
          r += cr;
          g += cg;
          b += cb;
          hits++;
        }
      }
      const at = (oy * width + ox) * 4;
      pixels[at] = hits === 0 ? 0 : Math.round(r / hits);
      pixels[at + 1] = hits === 0 ? 0 : Math.round(g / hits);
      pixels[at + 2] = hits === 0 ? 0 : Math.round(b / hits);
      pixels[at + 3] = Math.round((hits / total) * 255);
    }
  }
  return pixels;
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- ICO

function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256 in the ICO directory
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette size
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32BE(0, 8);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

// ---------------------------------------------------------------- output

const ICO_SIZES = [16, 32, 48, 256];
// Android installs the site as an app off these two, so they ship as separate PNGs.
const PWA_SIZES = [192, 512];
const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = `${root}public`;

const icon = (size) => render({ width: size, height: size, shapes: SHAPES, scale: size / VIEWBOX });

const images = ICO_SIZES.map((size) => ({ size, png: toPng(icon(size), size, size) }));

writeFileSync(`${publicDir}/favicon.svg`, toSvg());
writeFileSync(`${publicDir}/favicon.ico`, toIco(images));
writeFileSync(`${publicDir}/apple-touch-icon.png`, toPng(icon(180), 180, 180));
for (const size of PWA_SIZES) {
  writeFileSync(`${publicDir}/icon-${size}.png`, toPng(icon(size), size, size));
}
// Android crops maskable icons to its own shape, so the badge sits at 70% on a blush field
// instead of filling the canvas edge to edge.
const maskableSize = 512;
const badge = maskableSize * 0.7;
writeFileSync(
  `${publicDir}/icon-maskable-512.png`,
  toPng(
    render({
      width: maskableSize,
      height: maskableSize,
      shapes: scaleShapes(
        SHAPES,
        badge / VIEWBOX,
        (maskableSize - badge) / 2,
        (maskableSize - badge) / 2,
      ),
      background: BLUSH,
    }),
    maskableSize,
    maskableSize,
  ),
);
writeFileSync(
  `${publicDir}/og-image.png`,
  toPng(
    render({
      width: OG.width,
      height: OG.height,
      shapes: OG_SHAPES,
      background: BLUSH,
    }),
    OG.width,
    OG.height,
  ),
);

console.log(
  `favicon.svg, favicon.ico (${ICO_SIZES.join(", ")}), apple-touch-icon.png, ` +
    `icon-${PWA_SIZES.join(".png, icon-")}.png, icon-maskable-512.png and og-image.png written to public/.`,
);
