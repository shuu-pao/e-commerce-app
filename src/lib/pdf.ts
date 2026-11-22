/**
 * A one-page PDF holding one JPEG picture, filling the page. Small enough to write by hand, so the
 * invoice and receipt need no PDF library (and work offline). The page is `widthPt` wide (A4 is
 * 595 pt) and as tall as the picture's proportions make it.
 */
export function jpegToPdf(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number, widthPt = 595.28, title = ''): Uint8Array {
  const w = round(widthPt);
  const h = round((widthPt * pixelHeight) / pixelWidth);
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  const objects: (string | [string, Uint8Array, string])[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    [
      `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      '\nendstream',
    ],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${pdfText(title)}) /Producer (caracebu) >>`,
  ];

  const parts: Uint8Array[] = [];
  let size = 0;
  const add = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? latin1(part) : part;
    parts.push(bytes);
    size += bytes.length;
  };
  // The binary comment line tells readers the file holds binary data.
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(size);
    add(`${i + 1} 0 obj\n`);
    if (typeof obj === 'string') add(obj);
    else obj.forEach(add);
    add('\nendobj\n');
  });
  const xref = size;
  add(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) add(`${String(o).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Each character as one byte; only used for the PDF's own ASCII syntax. */
function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** A title as PDF text: printable ASCII only, with ( ) \ escaped. */
function pdfText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, (c) => '\\' + c);
}
