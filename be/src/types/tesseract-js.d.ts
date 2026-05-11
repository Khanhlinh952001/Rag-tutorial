declare module 'tesseract.js' {
  export interface OcrResult {
    data: {
      text: string;
    };
  }

  export interface OcrWorker {
    recognize(image: string, opts?: object): Promise<OcrResult>;
    setParameters(params: Record<string, string>): Promise<unknown>;
    terminate(): Promise<void>;
  }

  export function createWorker(language?: string): Promise<OcrWorker>;
}
