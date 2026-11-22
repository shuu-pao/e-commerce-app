// Draws an Invoice or Payment receipt (src/domain/documents.ts) on a canvas, then makes a PNG
// picture (for Instagram chats) and a one-page PDF from it. Everything runs in the browser, so it
// works offline and needs no library. The layout follows the sample the client approved (round 7).
import type { DocModel } from '@/domain/documents';

import { jpegToPdf } from './pdf';

export interface RenderedDocument {
  png: Blob;
  pdf: Blob;
  /** Object URL of the PNG, for the preview. Revoke it when done. */
  previewUri: string;
  width: number;
  height: number;
}

/** Layout units: an A4 page 794 wide (CSS px at 96 dpi). Drawn at SCALE for a sharp picture. */
const PAGE_W = 794;
const A4_H = 1123;
const SCALE = 1.5625; // 1240 px wide, A4 at 150 dpi
const M = 56;
const RIGHT = PAGE_W - M;

const ink = '#1F1A1C';
const body = '#4A4245';
const muted = '#6B6266';
const line = '#DDD5D2';
const green = '#1F7A4D';
const brand = '#EE3C4C';
const brandSoft = '#FEEBE7';

const FONT = {
  regular: 'Figtree_400Regular',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  brand: 'Shrikhand',
};
const font = (family: string, size: number) => `${size}px ${family}, "Segoe UI", system-ui, sans-serif`;

export async function renderDocument(doc: DocModel): Promise<RenderedDocument | null> {
  if (typeof document === 'undefined') return null;
  await fontsReady();
  const qr = doc.qr ? await loadImage(doc.qr).catch(() => null) : null;

  // First pass measures the height; the second draws on a canvas of that size.
  const scratch = document.createElement('canvas').getContext('2d')!;
  const height = Math.ceil(layout(scratch, doc, qr));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, height);
  layout(ctx, doc, qr);
  const png = await toBlob(canvas, 'image/png');

  // The PDF page is at least A4, so it prints at the right size; a long order makes it taller.
  const page = document.createElement('canvas');
  page.width = canvas.width;
  page.height = Math.round(Math.max(height, A4_H) * SCALE);
  const pctx = page.getContext('2d')!;
  pctx.fillStyle = '#FFFFFF';
  pctx.fillRect(0, 0, page.width, page.height);
  pctx.drawImage(canvas, 0, 0);
  const jpeg = new Uint8Array(await (await toBlob(page, 'image/jpeg', 0.92)).arrayBuffer());
  const pdfBytes = jpegToPdf(jpeg, page.width, page.height, 595.28, `${doc.title} ${doc.meta[0]?.value ?? ''}`);
  const pdf = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

  return { png, pdf, previewUri: URL.createObjectURL(png), width: canvas.width, height: canvas.height };
}

/**
 * Hands a file to the device: the share sheet on a phone or iPad (Save Image, Save to Files,
 * Instagram, Messages…), a download elsewhere or when sharing isn't allowed.
 */
export async function saveFile(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (navigator.maxTouchPoints > 0 && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError (the tap counted as too long ago) and the rest: download instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

// ---- Layout -------------------------------------------------------------------------------

/** Draws the document and returns its height. Safe to run on any canvas: it only draws and measures. */
function layout(ctx: CanvasRenderingContext2D, doc: DocModel, qr: HTMLImageElement | null): number {
  ctx.textBaseline = 'alphabetic';
  let y = M;

  // Logo, left
  ctx.font = font(FONT.brand, 30);
  const logoW = ctx.measureText('caracebu').width + 28;
  const logoH = 54;
  ctx.fillStyle = brandSoft;
  roundRect(ctx, M, y, logoW, logoH, 10);
  ctx.fill();
  ctx.fillStyle = brand;
  ctx.textAlign = 'left';
  ctx.fillText('caracebu', M + 14, y + 38);

  // Title and number, right-aligned beside the logo (never under it: client, round 7)
  const titleW = RIGHT - (M + logoW + 24);
  ctx.font = font(FONT.bold, 34);
  let ry = y + 30;
  for (const t of wrap(ctx, doc.title.toUpperCase(), titleW)) {
    text(ctx, t, RIGHT, ry, 'right', ink);
    ry += 40;
  }
  ry += 2;
  for (const m of doc.meta) {
    ctx.font = font(FONT.semibold, 13);
    const vw = ctx.measureText(m.value).width;
    text(ctx, m.value, RIGHT, ry, 'right', ink);
    ctx.font = font(FONT.regular, 13);
    text(ctx, m.label + ' ', RIGHT - vw, ry, 'right', muted);
    ry += 20;
  }
  y = Math.max(y + logoH, ry - 14) + 24;
  y = rule(ctx, y);

  // Billed to / Received from
  y = label(ctx, doc.partyLabel, M, y);
  ctx.font = font(FONT.bold, 17);
  text(ctx, doc.partyName, M, y + 6, 'left', ink);
  y += 30;
  ctx.font = font(FONT.regular, 13);
  for (const l of doc.partyLines.flatMap((p) => wrap(ctx, p, 420))) {
    text(ctx, l, M, y, 'left', body);
    y += 19;
  }
  y = rule(ctx, y + 4);

  // Items
  const totalR = RIGHT;
  const qtyR = RIGHT - 130;
  const unitR = qtyR - 70;
  const descW = unitR - 120 - M;
  ctx.font = font(FONT.bold, 11);
  for (const [t, x, align] of [['DESCRIPTION', M, 'left'], ['UNIT PRICE', unitR, 'right'], ['QTY', qtyR, 'right'], ['TOTAL', totalR, 'right']] as const) {
    spaced(ctx, t, x, y + 4, align, muted);
  }
  y += 14;
  hline(ctx, M, RIGHT, y, 1.5, ink);
  for (const l of doc.lines) {
    let ly = y + 26;
    ctx.font = font(FONT.semibold, 14);
    const names = wrap(ctx, l.description, descW);
    names.forEach((n, i) => text(ctx, n, M, ly + i * 20, 'left', ink));
    ctx.font = font(FONT.regular, 14);
    text(ctx, l.unitPrice, unitR, ly, 'right', ink);
    text(ctx, l.qty, qtyR, ly, 'right', ink);
    text(ctx, l.total, totalR, ly, 'right', ink);
    ly += (names.length - 1) * 20;
    if (l.detail) {
      ctx.font = font(FONT.regular, 12);
      for (const d of wrap(ctx, l.detail, descW)) {
        ly += 18;
        text(ctx, d, M, ly, 'left', muted);
      }
    }
    y = ly + 14;
    hline(ctx, M, RIGHT, y, 1, line);
  }

  // Totals, payments and the PAID stamp
  y += 12;
  const sumL = RIGHT - 300;
  const stampY = y;
  for (const s of doc.sums) {
    if (s.tone === 'total') {
      y += 6;
      hline(ctx, sumL, RIGHT, y, 1.5, ink);
      y += 30;
      ctx.font = font(FONT.bold, 17);
      text(ctx, s.label, sumL, y, 'left', ink);
      text(ctx, s.value, RIGHT, y, 'right', ink);
      y += 12;
      continue;
    }
    y += s.tone === 'muted' ? 22 : 26;
    const color = s.tone === 'paid' ? green : s.tone === 'muted' ? muted : body;
    ctx.font = font(s.tone === 'paid' ? FONT.semibold : FONT.regular, s.tone === 'muted' ? 13 : 14);
    text(ctx, s.label, sumL, y, 'left', color);
    text(ctx, s.value, RIGHT, y, 'right', color);
  }
  if (doc.stamp) {
    stamp(ctx, doc.stamp, M + 24, stampY + 56);
    y = Math.max(y, stampY + 84); // a short receipt still makes room for the stamp
  }
  y = rule(ctx, y + 22);

  // Payment details or signature, left; who it's from, right
  const colW = (RIGHT - M - 40) / 2;
  const rightX = M + colW + 40;
  let ly = y;
  if (doc.kind === 'invoice') {
    ly = label(ctx, 'Payment details', M, ly);
    if (!doc.accounts.length && !qr) {
      ctx.font = font(FONT.regular, 13);
      text(ctx, 'Ask us how to pay.', M, ly + 4, 'left', body);
      ly += 20;
    }
    for (const a of doc.accounts) {
      ctx.font = font(FONT.bold, 14);
      text(ctx, a.bank, M, ly + 4, 'left', ink);
      ly += 22;
      ctx.font = font(FONT.regular, 13);
      for (const l of a.lines.flatMap((x) => wrap(ctx, x, colW))) {
        text(ctx, l, M, ly, 'left', body);
        ly += 19;
      }
      ly += 8;
    }
    if (qr) {
      const side = 150;
      const k = Math.min(side / qr.naturalWidth, side / qr.naturalHeight);
      const w = qr.naturalWidth * k;
      const h = qr.naturalHeight * k;
      ctx.drawImage(qr, M, ly, w, h);
      ly += h + 8;
    }
  } else {
    ly = label(ctx, 'Received by', M, ly);
    ly += 48;
    hline(ctx, M, M + 240, ly, 1, ink);
    ly += 20;
    ctx.font = font(FONT.regular, 13);
    for (const l of wrap(ctx, doc.signature ?? '', colW)) {
      text(ctx, l, M, ly, 'left', body);
      ly += 19;
    }
  }
  let fy = label(ctx, 'From', rightX, y);
  ctx.font = font(FONT.bold, 15);
  text(ctx, doc.from.name, rightX, fy + 4, 'left', ink);
  fy += 24;
  ctx.font = font(FONT.regular, 13);
  for (const l of doc.from.lines.flatMap((x) => wrap(ctx, x, colW))) {
    text(ctx, l, rightX, fy, 'left', body);
    fy += 19;
  }

  y = Math.max(ly, fy) + 30;
  ctx.font = font(FONT.regular, 13);
  text(ctx, doc.footer, PAGE_W / 2, y, 'center', muted);
  return y + M - 16;
}

function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, align: CanvasTextAlign, color: string) {
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}

/** Small capitals-style label ("BILLED TO"); returns the y to continue from. */
function label(ctx: CanvasRenderingContext2D, t: string, x: number, y: number): number {
  ctx.font = font(FONT.bold, 11);
  spaced(ctx, t.toUpperCase(), x, y + 4, 'left', muted);
  return y + 24;
}

/** Text with a little letter spacing, drawn letter by letter (canvas letterSpacing is too new for older iPads). */
function spaced(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, align: 'left' | 'right', color: string, gap = 0.9) {
  const widths = [...t].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (t.length - 1);
  let cx = align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  [...t].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + gap;
  });
}

function rule(ctx: CanvasRenderingContext2D, y: number): number {
  hline(ctx, M, RIGHT, y, 1, line);
  return y + 26;
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, width: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x1, y - width / 2, x2 - x1, width);
}

function stamp(ctx: CanvasRenderingContext2D, word: string, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.font = font(FONT.bold, 26);
  const widths = [...word].map((c) => ctx.measureText(c).width);
  const w = widths.reduce((a, b) => a + b, 0) + 4 * (word.length - 1) + 32;
  ctx.strokeStyle = green;
  ctx.lineWidth = 3;
  roundRect(ctx, 0, -30, w, 44, 6);
  ctx.stroke();
  spaced(ctx, word, 16, 2, 'left', green, 4);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Splits text into lines no wider than maxWidth, breaking long words if it must. */
function wrap(ctx: CanvasRenderingContext2D, t: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of t.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (ctx.measureText(current).width > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > maxWidth) cut--;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// ---- Loading ------------------------------------------------------------------------------

/**
 * Waits for the app's fonts, but never long: Safari 26 can leave document.fonts.load()
 * unanswered (WebKit bug 305470, docs/BRIEF.md). Without them the document uses the system font.
 */
async function fontsReady() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const loads = Object.values(FONT).map((f) => fonts.load(font(f, 16), 'caracebu ₱').catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The document could not be drawn.'))), type, quality));
}
