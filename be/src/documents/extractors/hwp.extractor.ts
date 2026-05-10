import { readFile } from 'node:fs/promises';

export async function extractHwpText(filePath: string): Promise<string> {
  const tikaUrl = process.env.TIKA_URL ?? 'http://localhost:9998/tika';
  const fileBuffer = await readFile(filePath);

  const response = await fetch(tikaUrl, {
    method: 'PUT',
    headers: {
      Accept: 'text/plain',
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to process HWP/HWPX via Tika (${response.status}). Ensure docker service "tika" is running.`,
    );
  }

  const text = await response.text();
  return text.trim();
}
