/* ============================================================================
   generate-icons.mjs
   ----------------------------------------------------------------------------
   Produces the flat-colour raster assets referenced by index.html:

     assets/img/favicon.ico            16 / 32 / 48 px, PNG inside ICO
     assets/img/apple-touch-icon.png   180 x 180
     assets/img/og-image.png           1200 x 630

   Why a script instead of committed binaries? The artwork is four flat colours
   and a few straight lines, so generating it keeps the repository free of opaque
   blobs and guarantees the assets match the CSS tokens exactly. Because the
   images are flat colour they compress to a couple of kilobytes each.

   These files are committed to the repository. The site does not run this
   script at build time, because there is no build step.

   Run with:  node tools/generate-icons.mjs
   ========================================================================= */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets', 'img');

/* Design tokens, kept in step with :root in assets/css/styles.css. */
const INK = [0x1b, 0x1a, 0x15];
const PAPER = [0xf3, 0xef, 0xe6];
const PAPER_RAISED = [0xf8, 0xf5, 0xee];
const ACCENT = [0xa6, 0x3d, 0x22];

/* The mark: a ridge line, drawn in a 64 x 64 space. Matches favicon.svg. */
const RIDGE = [
  [0.125, 0.703], [0.328, 0.484], [0.469, 0.625],
  [0.688, 0.297], [0.875, 0.484],
];
const RIDGE_WEIGHT = 6 / 64;

/* ------------------------------------------------------------------ canvas */

function createCanvas(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function setPixel(canvas, x, y, rgb, alpha = 1) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  const d = canvas.data;
  if (alpha >= 1) {
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  } else {
    /* Straight source-over so overlaps stay clean. */
    const inv = 1 - alpha;
    d[i] = Math.round(rgb[0] * alpha + d[i] * inv);
    d[i + 1] = Math.round(rgb[1] * alpha + d[i + 1] * inv);
    d[i + 2] = Math.round(rgb[2] * alpha + d[i + 2] * inv);
    d[i + 3] = 255;
  }
}

function fillRect(canvas, x, y, w, h, rgb) {
  const x0 = Math.round(x); const y0 = Math.round(y);
  const x1 = Math.round(x + w); const y1 = Math.round(y + h);
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) setPixel(canvas, px, py, rgb);
  }
}

/* Draws a line as a run of filled discs, so joins and caps look deliberate. */
function strokeLine(canvas, x0, y0, x1, y1, weight, rgb) {
  const half = weight / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  for (let s = 0; s <= steps; s += 1) {
    const cx = x0 + (dx * s) / steps;
    const cy = y0 + (dy * s) / steps;
    for (let py = Math.floor(cy - half); py <= Math.ceil(cy + half); py += 1) {
      for (let px = Math.floor(cx - half); px <= Math.ceil(cx + half); px += 1) {
        /* Distance from the centre, for a soft edge. */
        const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
        const cover = Math.max(0, Math.min(1, half + 0.5 - dist));
        if (cover > 0) setPixel(canvas, px, py, rgb, cover);
      }
    }
  }
}

function strokePath(canvas, points, weight, rgb, scale = 1, offsetX = 0, offsetY = 0) {
  for (let i = 0; i < points.length - 1; i += 1) {
    strokeLine(
      canvas,
      offsetX + points[i][0] * scale,
      offsetY + points[i][1] * scale,
      offsetX + points[i + 1][0] * scale,
      offsetY + points[i + 1][1] * scale,
      weight * scale,
      rgb,
    );
  }
}

/* Box-average downsample. Cheap, and enough for flat colour artwork. */
function downsample(canvas, factor) {
  const w = Math.round(canvas.width / factor);
  const h = Math.round(canvas.height / factor);
  const out = createCanvas(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const px = x * factor + sx;
          const py = y * factor + sy;
          if (px >= canvas.width || py >= canvas.height) continue;
          const i = (py * canvas.width + px) * 4;
          r += canvas.data[i]; g += canvas.data[i + 1]; b += canvas.data[i + 2];
          n += 1;
        }
      }
      const i = (y * w + x) * 4;
      out.data[i] = Math.round(r / n);
      out.data[i + 1] = Math.round(g / n);
      out.data[i + 2] = Math.round(b / n);
      out.data[i + 3] = 255;
    }
  }
  return out;
}

/* -------------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(canvas) {
  const { width, height, data } = canvas;

  /* Each scanline is prefixed with a filter byte. Filter 0 (none) compresses
     well for flat colour and keeps this encoder short. */
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    /* Level 9 so the committed files are as small as possible. */
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------- ICO */

/* Packs PNG buffers into a single .ico. Every browser in current use reads
   PNG inside ICO, and this keeps each entry's compression intact. */
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const at = index * 16;
    directory[at] = entry.size >= 256 ? 0 : entry.size;   // 0 means 256
    directory[at + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[at + 2] = 0;              // palette size
    directory[at + 3] = 0;              // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(entry.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}

/* -------------------------------------------------------------- the artwork */

/* Square icon: ink ground, ridge in a light tint. */
function drawIcon(size) {
  const scale = 3;
  const canvas = createCanvas(size * scale, size * scale);
  fillRect(canvas, 0, 0, canvas.width, canvas.height, INK);
  strokePath(canvas, RIDGE, RIDGE_WEIGHT, PAPER_RAISED, size * scale);
  return size === 1 ? canvas : downsample(canvas, scale);
}

/* Link preview. Deliberately typographic rather than illustrated: paper
   ground, the mark at reading size, a hairline frame, and a bar-gauge motif
   that echoes the display on the instrument. No text, so nothing depends on
   a font being available at generation time. */
function drawOgImage() {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const s = 2;   // supersample for clean edges
  const c = createCanvas(W * s, H * s);
  const S = (n) => n * s;

  fillRect(c, 0, 0, c.width, c.height, PAPER);

  /* Hairline frame inset from the edge. */
  fillRect(c, S(48), S(48), S(W - 96), S(2), INK);
  fillRect(c, S(48), S(H - 50), S(W - 96), S(2), INK);
  fillRect(c, S(48), S(48), S(2), S(H - 96), INK);
  fillRect(c, S(W - 50), S(48), S(2), S(H - 96), INK);

  /* Mark, at roughly the size it appears in the page header. */
  strokePath(c, RIDGE, RIDGE_WEIGHT, INK, S(150), S(112), S(150));

  /* Accent rule under the mark. */
  fillRect(c, S(112), S(322), S(150), S(6), ACCENT);

  /* Bar gauge on the right, echoing the R2 display. */
  const bars = [0.34, 0.52, 0.74, 0.44, 0.63, 0.28];
  const barW = 34;
  const gap = 20;
  const baseX = 640;
  const baseY = 372;
  const maxH = 210;
  bars.forEach((ratio, i) => {
    const h = maxH * ratio;
    fillRect(c, S(baseX + i * (barW + gap)), S(baseY - h), S(barW), S(h),
      i === 2 ? ACCENT : INK);
  });
  /* Baseline under the bars. */
  fillRect(c, S(baseX - 12), S(baseY), S(bars.length * (barW + gap) + 4), S(3), INK);

  return downsample(c, s);
}

/* ------------------------------------------------------------------- build */

mkdirSync(OUT, { recursive: true });

const written = [];
function save(name, buffer) {
  writeFileSync(join(OUT, name), buffer);
  written.push([name, buffer.length]);
}

/* apple-touch-icon: 180 x 180, no transparency, as iOS expects. */
save('apple-touch-icon.png', encodePNG(drawIcon(180)));

/* favicon.ico: three sizes so small and medium contexts both look right. */
save('favicon.ico', encodeICO(
  [16, 32, 48].map((size) => ({ size, png: encodePNG(drawIcon(size)) })),
));

/* Open Graph card. */
save('og-image.png', encodePNG(drawOgImage()));

console.log('Wrote to assets/img:');
for (const [name, bytes] of written) {
  console.log(`  ${name.padEnd(24)} ${String(bytes).padStart(6)} bytes`);
}