import { createWorker } from 'tesseract.js';

/**
 * Tesseract traineddata (join with +). Default includes JP/CN for multilingual screenshots.
 * First run may download data from CDN — needs network.
 */
function resolveLanguages(): string {
  return (
    process.env.OCR_LANGS ??
    process.env.OCR_LANG ??
    'kor+eng+jpn+chi_sim+vie'
  )
    .trim()
    .replace(/\s+/g, '') || 'kor+eng+jpn+chi_sim+vie';
}

function parsePrimaryPsm(): string {
  const raw = (process.env.OCR_PSM ?? '6').trim();
  return /^\d{1,2}$/.test(raw) ? raw : '6';
}

function fallbackMinChars(): number {
  const n = Number(process.env.OCR_MIN_CHARS_FALLBACK ?? 40);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 40;
}

/** merge = run several PSMs and keep longest text; fast = primary PSM then short fallbacks only */
function ocrStrategy(): 'merge' | 'fast' {
  const v = (process.env.OCR_STRATEGY ?? 'merge').toLowerCase().trim();
  return v === 'fast' ? 'fast' : 'merge';
}

async function recognizeWithPsm(
  worker: {
    setParameters: (p: Record<string, string>) => Promise<unknown>;
    recognize: (path: string) => Promise<{ data: { text: string } }>;
  },
  filePath: string,
  psm: string,
): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const {
    data: { text },
  } = await worker.recognize(filePath);
  return text.trim();
}

function pickLongest(candidates: string[]): string {
  return candidates.reduce((best, cur) => (cur.length > best.length ? cur : best), '');
}

function uniquePsms(primary: string, extras: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [primary, ...extras]) {
    if (!/^\d{1,2}$/.test(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export type ImageProbeSignals = {
  charCount: number;
  lineCount: number;
  /** Mean characters per non-empty line (PSM 3 probe). */
  avgLineLength: number;
  /** Full OCR text from the same PSM-3 probe pass (avoids a duplicate Tesseract run later). */
  psm3Text: string;
};

/** One fast OCR pass (PSM 3): line stats for classifier + importance scoring. */
export async function probeImageSignals(filePath: string): Promise<ImageProbeSignals> {
  const langs =
    (process.env.OCR_PROBE_LANGS ?? '').trim().replace(/\s+/g, '') || resolveLanguages();
  const worker = await createWorker(langs);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const {
      data: { text },
    } = await worker.recognize(filePath);
    const trimmed = text.trim();
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const charCount = trimmed.length;
    const lineCount = lines.length;
    const avgLineLength = lineCount > 0 ? charCount / lineCount : charCount;
    return { charCount, lineCount, avgLineLength, psm3Text: trimmed };
  } finally {
    await worker.terminate();
  }
}

/** Length-only probe (same single PSM 3 pass as probeImageSignals). */
export async function probeImageTextLength(filePath: string): Promise<number> {
  const s = await probeImageSignals(filePath);
  return s.charCount;
}

export async function extractImageText(
  filePath: string,
  options?: { reusePsm3Text?: string },
): Promise<string> {
  const reuse = options?.reusePsm3Text?.trim();
  const language = resolveLanguages();
  const worker = await createWorker(language);
  try {
    const primaryPsm = parsePrimaryPsm();
    const minChars = fallbackMinChars();

    const runPsm = async (psm: string) => {
      if (psm === '3' && reuse != null && reuse.length > 0) {
        return reuse;
      }
      return recognizeWithPsm(worker, filePath, psm);
    };

    if (ocrStrategy() === 'fast') {
      let text = await runPsm(primaryPsm);
      if (text.length < minChars) {
        for (const psm of ['11', '4', '3']) {
          if (psm === primaryPsm) continue;
          const alt = await runPsm(psm);
          if (alt.length > text.length) text = alt;
          if (text.length >= minChars) break;
        }
      }
      return text.trim();
    }

    const psms = uniquePsms(primaryPsm, ['3', '11', '4']);
    const parts: string[] = [];
    for (const psm of psms) {
      parts.push(await runPsm(psm));
    }
    return pickLongest(parts).trim();
  } finally {
    await worker.terminate();
  }
}
