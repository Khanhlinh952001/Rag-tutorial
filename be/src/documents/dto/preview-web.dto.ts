/** Body for POST /documents/preview-web */
export class PreviewWebDto {
  url!: string;

  /** Crawl every linked page on the same host (BFS). */
  entireSite?: boolean;

  /** Max distinct HTML pages to fetch (default from env, capped). */
  maxPages?: number;
}
