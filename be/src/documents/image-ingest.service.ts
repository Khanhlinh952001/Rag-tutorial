import { Inject, Injectable } from '@nestjs/common';
import { DocumentTextExtractorService } from './extractors/document-text-extractor.service';
import { probeImageSignals } from './extractors/image.extractor';
import { LlmService } from '../llm/llm.service';
import {
  adjustWeightsByImportance,
  baseWeightsForKind,
  buildLayoutChannelFromOcr,
  classifyImageRagKind,
  fuseChannelsDeterministic,
  scoreImportance,
  type ChannelWeights,
  type ImageRagPipelineMeta,
} from './image-rag-pipeline';

export type ImageIngestMethod = 'ocr' | 'vision' | 'ocr-fallback' | 'pipeline';

export type ImageIngestResult = {
  text: string;
  ingestMethod: ImageIngestMethod;
  probeChars: number;
  pipeline?: ImageRagPipelineMeta;
};

export type ImageIngestHooks = {
  beforeVision?: () => Promise<void>;
  /** Optional ProcessingJob step updates (classifier → channels → fuse). */
  onPipelinePhase?: (phase: string) => Promise<void>;
};

function pipelineDisabled(): boolean {
  return process.env.IMAGE_RAG_PIPELINE === 'false';
}

function normalizeWeightsNoVision(w: ChannelWeights): ChannelWeights {
  const ocr = w.ocr + w.vision * 0.55;
  const layout = w.layout + w.vision * 0.45;
  const sum = ocr + layout;
  if (sum <= 0) return { ocr: 0.65, vision: 0, layout: 0.35 };
  return { ocr: ocr / sum, vision: 0, layout: layout / sum };
}

@Injectable()
export class ImageIngestService {
  constructor(
    @Inject(DocumentTextExtractorService)
    private readonly documentTextExtractorService: DocumentTextExtractorService,
    @Inject(LlmService)
    private readonly llmService: LlmService,
  ) {}

  /**
   * Legacy binary route (probe length only) when IMAGE_RAG_PIPELINE=false.
   * Default: classifier → importance → channel weights → optional Vision + OCR → fuse → one RAG string.
   */
  async extractForRag(
    filePath: string,
    mimeType: string,
    hooks?: ImageIngestHooks,
  ): Promise<ImageIngestResult> {
    if (pipelineDisabled()) {
      return this.extractLegacyBinary(filePath, mimeType, hooks);
    }
    return this.extractPipeline(filePath, mimeType, hooks);
  }

  private async extractLegacyBinary(
    filePath: string,
    mimeType: string,
    hooks?: ImageIngestHooks,
  ): Promise<ImageIngestResult> {
    const raw = Number(process.env.IMAGE_OCR_MIN_CHARS ?? 80);
    const threshold = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 80;
    const visionEnabled = process.env.IMAGE_VISION_ENABLED !== 'false';

    const signals = await probeImageSignals(filePath);
    const probeChars = signals.charCount;

    if (probeChars >= threshold || !visionEnabled) {
      const text = await this.documentTextExtractorService.extractByMimeType(
        filePath,
        mimeType,
        { reusePsm3Text: signals.psm3Text },
      );
      return { text, ingestMethod: 'ocr', probeChars };
    }

    await hooks?.beforeVision?.();

    try {
      const text = await this.llmService.describeImageForRag(filePath, mimeType);
      return { text, ingestMethod: 'vision', probeChars };
    } catch {
      const text = await this.documentTextExtractorService.extractByMimeType(
        filePath,
        mimeType,
        { reusePsm3Text: signals.psm3Text },
      );
      return { text, ingestMethod: 'ocr-fallback', probeChars };
    }
  }

  private async extractPipeline(
    filePath: string,
    mimeType: string,
    hooks?: ImageIngestHooks,
  ): Promise<ImageIngestResult> {
    const raw = Number(process.env.IMAGE_OCR_MIN_CHARS ?? 80);
    const threshold = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 80;
    const visionEnabled = process.env.IMAGE_VISION_ENABLED !== 'false';
    const minVisionW = Number(process.env.IMAGE_PIPELINE_MIN_VISION_WEIGHT ?? 0.11);
    const minVision = Number.isFinite(minVisionW) && minVisionW >= 0 ? minVisionW : 0.11;
    const useLlmFuse =
      process.env.OPENAI_API_KEY &&
      process.env.IMAGE_PIPELINE_LLM_FUSE !== 'false';

    await hooks?.onPipelinePhase?.('image-classify');
    const signals = await probeImageSignals(filePath);
    const probeChars = signals.charCount;

    const kind = classifyImageRagKind(signals, threshold);
    const importance = scoreImportance(signals);
    let weights = adjustWeightsByImportance(baseWeightsForKind(kind), importance);

    if (!visionEnabled) {
      weights = normalizeWeightsNoVision(weights);
    }

    const wantVision = visionEnabled && weights.vision >= minVision;
    const wantOcr = weights.ocr + weights.layout >= 0.07;

    let ocrText = '';
    if (wantOcr) {
      await hooks?.onPipelinePhase?.('image-ocr-channel');
      ocrText = await this.documentTextExtractorService.extractByMimeType(
        filePath,
        mimeType,
        { reusePsm3Text: signals.psm3Text },
      );
    }

    const layoutText = buildLayoutChannelFromOcr(ocrText);

    let visionText = '';
    let hadVision = false;
    if (wantVision) {
      await hooks?.beforeVision?.();
      await hooks?.onPipelinePhase?.('image-vision-channel');
      try {
        visionText = await this.llmService.describeImageForRag(filePath, mimeType);
        hadVision = Boolean(visionText.trim());
      } catch {
        hadVision = false;
        visionText = '';
      }
    }

    if (!ocrText.trim() && !visionText.trim()) {
      await hooks?.onPipelinePhase?.('image-ocr-fallback');
      ocrText = await this.documentTextExtractorService.extractByMimeType(
        filePath,
        mimeType,
        { reusePsm3Text: signals.psm3Text },
      );
    }

    const hadFullOcr = wantOcr || Boolean(ocrText.trim());

    await hooks?.onPipelinePhase?.('image-context-fuse');

    let text: string;
    let fuseMethod: 'llm' | 'template' = 'template';
    if (useLlmFuse) {
      try {
        text = await this.llmService.fuseImageRagChannels({
          kind,
          weights,
          ocrText,
          visionText,
          layoutText,
        });
        fuseMethod = 'llm';
      } catch {
        text = fuseChannelsDeterministic(ocrText, visionText, layoutText, weights, kind);
        fuseMethod = 'template';
      }
    } else {
      text = fuseChannelsDeterministic(ocrText, visionText, layoutText, weights, kind);
    }

    const pipeline: ImageRagPipelineMeta = {
      kind,
      importance,
      weights,
      fuseMethod,
      hadVision,
      hadFullOcr,
    };

    return {
      text,
      ingestMethod: 'pipeline',
      probeChars,
      pipeline,
    };
  }
}
