import { readFileSync } from 'node:fs';

export function extractJsonText(filePath: string): string {
  const raw = readFileSync(filePath, 'utf-8').trim();
  if (!raw) {
    return '';
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid JSON: could not parse file content.');
  }
  return JSON.stringify(value, null, 2).trim();
}
