/** PDF text extraction, ported VERBATIM from index.html `extractPdfText`. */
import { pdfjsLib } from './pdfWorker';

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    fullText += pageText + '\n';
  }

  const trimmed = fullText.trim();
  if (!trimmed)
    throw new Error(
      'No readable text found in this PDF. Try uploading an image instead.',
    );
  // Limit to ~12 000 chars to stay within free-tier context limits
  return trimmed.slice(0, 12000);
}
