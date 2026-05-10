import { parseOffice } from 'officeparser';

export async function extractPptxText(filePath: string): Promise<string> {
  const ast = await parseOffice(filePath, {
    // OCR can help when slides are mostly images (scanned exports).
    ocr: process.env.PPTX_OCR === 'true',
  });

  return ast.toText().trim();
}
