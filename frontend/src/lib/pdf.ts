/**
 * PDF reading. Text PDFs are extracted with pdf.js; scanned PDFs (no real text)
 * are rendered to JPEG page images in the browser and sent down the existing
 * image path.
 *
 * Limits (the old 12,000-char cap was for the free OpenRouter models; Gemini is
 * tried first now):
 *  - MAX_TEXT_CHARS: long enough for typical contracts (~15–20 pages), short
 *    enough that the pre-quiz — which the user is waiting on — stays fast and
 *    the free fallback models can still cope.
 *  - MAX_SCAN_PAGES / image size: keeps a scanned request to a couple of MB,
 *    far under the backend's 15 MB body limit.
 */
import { pdfjsLib } from './pdfWorker';

export const MAX_TEXT_CHARS = 50_000;
export const MAX_SCAN_PAGES = 8;
/** Longest side of a rendered page, in px. Small print stays readable. */
const SCAN_MAX_DIMENSION = 1600;
const SCAN_JPEG_QUALITY = 0.7;
/** Total base64 budget for all page images (the backend accepts 15 MB). */
const SCAN_BYTE_BUDGET = 8 * 1024 * 1024;
/**
 * A PDF counts as scanned when it averages fewer than this many non-space
 * characters of text per page. Averaging (not totalling) means a scan with a
 * page number or a "Scanned with CamScanner" footer on every page still counts
 * as scanned, while a real contract has hundreds+ of characters a page.
 */
export const SCAN_AVG_CHARS_PER_PAGE = 40;

export type PdfResult =
  | { kind: 'text'; content: string; truncated: boolean }
  | {
      kind: 'images';
      content: string[];
      truncated: boolean;
      pagesUsed: number;
      pagesTotal: number;
    };

/** Cut at the last whitespace before the limit so no word is chopped in half. */
function cutAtWord(text: string, max: number): string {
  const slice = text.slice(0, max);
  const lastSpace = slice.search(/\s\S*$/);
  return lastSpace > max * 0.8 ? slice.slice(0, lastSpace) : slice;
}

async function renderPageToJpeg(page: any): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, SCAN_MAX_DIMENSION / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the scanned pages. Please try again.');
  // JPEG has no alpha channel — without a white fill, transparent areas turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY);

  page.cleanup();
  canvas.width = 0; // release the bitmap
  canvas.height = 0;
  return dataUrl;
}

export async function readPdf(file: File): Promise<PdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str ?? '').join(' ');
    fullText += pageText + '\n';
  }

  const trimmed = fullText.trim();
  const avgCharsPerPage = trimmed.replace(/\s/g, '').length / pdf.numPages;

  if (avgCharsPerPage >= SCAN_AVG_CHARS_PER_PAGE) {
    if (trimmed.length > MAX_TEXT_CHARS) {
      return { kind: 'text', content: cutAtWord(trimmed, MAX_TEXT_CHARS), truncated: true };
    }
    return { kind: 'text', content: trimmed, truncated: false };
  }

  // Scanned / image-only PDF → page images (first MAX_SCAN_PAGES, within the byte budget).
  const pagesTotal = pdf.numPages;
  const images: string[] = [];
  let bytes = 0;
  for (let i = 1; i <= Math.min(pagesTotal, MAX_SCAN_PAGES); i++) {
    const dataUrl = await renderPageToJpeg(await pdf.getPage(i));
    if (images.length > 0 && bytes + dataUrl.length > SCAN_BYTE_BUDGET) break;
    images.push(dataUrl);
    bytes += dataUrl.length;
  }

  if (images.length === 0) {
    throw new Error('No readable text found in this PDF. Try uploading an image instead.');
  }
  return {
    kind: 'images',
    content: images,
    truncated: images.length < pagesTotal,
    pagesUsed: images.length,
    pagesTotal,
  };
}
