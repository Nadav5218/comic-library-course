import { pdfjs } from "react-pdf";
import pdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function generatePdfCover(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;

  try {
    const page = await pdfDocument.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 720;
    const viewport = page.getViewport({
      scale: targetWidth / baseViewport.width,
    });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create cover canvas");

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Unable to create cover image")),
        "image/webp",
        0.86,
      );
    });

    return new File([blob], `${file.name.replace(/\.pdf$/i, "")}-cover.webp`, {
      type: "image/webp",
    });
  } finally {
    await pdfDocument.destroy();
  }
}
