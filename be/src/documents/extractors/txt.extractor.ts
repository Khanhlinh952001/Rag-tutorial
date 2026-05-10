import * as fs from 'node:fs';

export async function extractTxtText(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}
