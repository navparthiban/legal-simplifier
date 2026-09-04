import * as pdfjsLib from 'pdfjs-dist';

// Same worker URL and version (3.11.174) as the original index.html.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export { pdfjsLib };
