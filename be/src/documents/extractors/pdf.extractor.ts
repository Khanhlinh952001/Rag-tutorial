import * as fs from 'node:fs';
import { PDFParse } from 'pdf-parse';

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();

  return data.text;
}
