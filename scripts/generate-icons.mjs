// Generates simple PWA icons (a flashcard with category dots) as PNGs.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function pixel(x, y, size) {
  const bg = [37, 99, 235]; // blue-600
  const card = [255, 255, 255];
  const divider = [209, 213, 219]; // gray-300
  const dots = [
    [239, 68, 68], // red
    [245, 158, 11], // amber
    [34, 197, 94], // green
    [59, 130, 246], // blue
  ];

  // background
  let [r, g, b] = bg;
  let a = 255;

  const pad = size * 0.14;
  const rnd = size * 0.08;

  // card
  if (inRoundedRect(x, y, pad, pad, size - pad, size - pad, rnd)) {
    [r, g, b] = card;

    // category dots
    const dotR = size * 0.055;
    const dotY = size * 0.26;
    const startX = size * 0.3;
    const gap = size * 0.13;
    for (let i = 0; i < 4; i++) {
      const cx = startX + i * gap;
      const dx = x - cx;
      const dy = y - dotY;
      if (dx * dx + dy * dy <= dotR * dotR) {
        [r, g, b] = dots[i];
      }
    }

    // divider line
    const lineY0 = size * 0.52;
    const lineY1 = size * 0.58;
    if (y >= lineY0 && y <= lineY1 && x >= pad + size * 0.08 && x <= size - pad - size * 0.08) {
      [r, g, b] = divider;
    }
  }

  return [r, g, b, a];
}

for (const size of [192, 512]) {
  const png = encodePng(size, pixel);
  const out = path.join(__dirname, "..", "public", `icon-${size}.png`);
  writeFileSync(out, png);
  console.log("wrote", out, png.length, "bytes");
}
