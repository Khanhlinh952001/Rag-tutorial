export class IngestWebDto {
  /** HTTP(S) URL of the page or site entry point. */
  url!: string;

  /** Override document title (defaults to &lt;title&gt; or hostname). */
  title?: string;

  /** Defaults to system user when omitted (same as file upload). */
  uploadedById?: string;

  /** When true, crawl same-origin links up to maxPages and index all text. */
  entireSite?: boolean;

  /** Max pages to crawl (entireSite only). */
  maxPages?: number;

  /**
   * Index only these URLs (same host as `url`). After calling discover-web,
   * pass the chosen normalized URLs here. Ignores `entireSite`.
   */
  selectedUrls?: string[];
}
