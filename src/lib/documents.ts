// Invoices and receipts are drawn in the browser (documents.web.ts). The app ships as a web app;
// in a native build these return nothing and the screen says to use the web app.
import type { DocModel } from '@/domain/documents';

export interface RenderedDocument {
  png: Blob;
  pdf: Blob;
  previewUri: string;
  width: number;
  height: number;
}

export async function renderDocument(doc: DocModel): Promise<RenderedDocument | null> {
  void doc;
  return null;
}

export async function saveFile(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  void blob;
  void fileName;
  return 'cancelled';
}
