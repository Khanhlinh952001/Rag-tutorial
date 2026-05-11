import type { ImageProbeSignals } from './extractors/image.extractor';

/** Coarse image class for routing OCR / Vision / layout-style text. */
export type ImageRagKind = 'dense_printed' | 'sparse_scene' | 'structured_mixed';

export type ChannelWeights = {
  ocr: number;
  vision: number;
  layout: number;
};

export type ImportanceScores = {
  /** How much reliable machine-readable text Tesseract likely captured. */
  textDensity: number;
  /** Multi-line / short-line structure (menus, tables, receipts). */
  layoutStructure: number;
  /** Photo / scene / handwriting likelihood (Vision should help). */
  sceneLikelihood: number;
};

export type ImageRagPipelineMeta = {
  kind: ImageRagKind;
  importance: ImportanceScores;
  weights: ChannelWeights;
  fuseMethod: 'llm' | 'template';
  hadVision: boolean;
  hadFullOcr: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeWeights(w: ChannelWeights): ChannelWeights {
  const sum = w.ocr + w.vision + w.layout;
  if (sum <= 0) return { ocr: 0.34, vision: 0.33, layout: 0.33 };
  return {
    ocr: w.ocr / sum,
    vision: w.vision / sum,
    layout: w.layout / sum,
  };
}

export function scoreImportance(signals: ImageProbeSignals): ImportanceScores {
  const { charCount, lineCount, avgLineLength } = signals;
  const textDensity = clamp01(charCount / 520);
  const lineBoost = avgLineLength < 48 ? 1 : 0.72;
  const layoutStructure = clamp01(lineCount / 14) * lineBoost;
  const sceneLikelihood = clamp01(
    1 - charCount / 300 + (lineCount <= 2 ? 0.12 : 0) + (charCount < 55 ? 0.18 : 0),
  );
  return { textDensity, layoutStructure, sceneLikelihood };
}

export function classifyImageRagKind(
  signals: ImageProbeSignals,
  ocrMinChars: number,
): ImageRagKind {
  const { charCount, lineCount, avgLineLength } = signals;
  const low = Math.max(36, Math.floor(ocrMinChars * 0.42));

  if (charCount < low) {
    return 'sparse_scene';
  }

  if (charCount >= ocrMinChars && lineCount >= 4 && avgLineLength < 40) {
    return 'structured_mixed';
  }

  if (charCount >= ocrMinChars) {
    return 'dense_printed';
  }

  if (lineCount >= 5 && avgLineLength < 44) {
    return 'structured_mixed';
  }

  return 'structured_mixed';
}

export function baseWeightsForKind(kind: ImageRagKind): ChannelWeights {
  switch (kind) {
    case 'dense_printed':
      return { ocr: 0.72, vision: 0.18, layout: 0.1 };
    case 'sparse_scene':
      return { ocr: 0.22, vision: 0.58, layout: 0.2 };
    case 'structured_mixed':
    default:
      return { ocr: 0.48, vision: 0.32, layout: 0.2 };
  }
}

/**
 * Blend fixed class weights with per-image importance so similar classes
 * still adapt slightly to the probe.
 */
export function adjustWeightsByImportance(
  base: ChannelWeights,
  imp: ImportanceScores,
): ChannelWeights {
  const w: ChannelWeights = {
    ocr: base.ocr * (0.38 + 0.62 * imp.textDensity),
    vision: base.vision * (0.35 + 0.65 * imp.sceneLikelihood),
    layout: base.layout * (0.35 + 0.65 * imp.layoutStructure),
  };
  return normalizeWeights(w);
}

/** Strip OCR into line-oriented "layout" text for a third retrieval channel. */
export function buildLayoutChannelFromOcr(ocrText: string): string {
  const trimmed = ocrText.trim();
  if (!trimmed) return '';
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  const body = lines.map((l, i) => `${String(i + 1).padStart(2, '0')}. ${l}`).join('\n');
  return ['[레이아웃/줄 읽기 순서 — OCR 기반]', '', body].join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n…(truncated ${s.length - max} chars)`;
}

/** Cheap merge when LLM fuse is off or API fails. */
export function fuseChannelsDeterministic(
  ocrText: string,
  visionText: string,
  layoutText: string,
  weights: ChannelWeights,
  kind: ImageRagKind,
): string {
  const w = normalizeWeights(weights);
  const maxOcr = Number(process.env.IMAGE_PIPELINE_MAX_OCR_CHARS ?? 12000);
  const maxVision = Number(process.env.IMAGE_PIPELINE_MAX_VISION_CHARS ?? 6000);
  const maxLayout = Number(process.env.IMAGE_PIPELINE_MAX_LAYOUT_CHARS ?? 8000);
  const safeMaxOcr = Number.isFinite(maxOcr) && maxOcr > 200 ? Math.floor(maxOcr) : 12000;
  const safeMaxVision = Number.isFinite(maxVision) && maxVision > 200 ? Math.floor(maxVision) : 6000;
  const safeMaxLayout = Number.isFinite(maxLayout) && maxLayout > 200 ? Math.floor(maxLayout) : 8000;

  const parts: string[] = [
    '# 이미지 RAG 통합 추출',
    '',
    `분류: ${kind} · 가중치 OCR ${w.ocr.toFixed(2)} / Vision ${w.vision.toFixed(2)} / Layout ${w.layout.toFixed(2)}`,
    '',
  ];

  if (ocrText.trim()) {
    parts.push('## OCR 채널', '', truncate(ocrText.trim(), safeMaxOcr), '');
  }
  if (visionText.trim()) {
    parts.push('## Vision 채널', '', truncate(visionText.trim(), safeMaxVision), '');
  }
  if (layoutText.trim()) {
    parts.push('## 레이아웃 채널', '', truncate(layoutText.trim(), safeMaxLayout), '');
  }

  return parts.join('\n').trim();
}
