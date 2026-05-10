/** Body for POST /documents/discover-web — list same-origin pages (BFS). */
export class DiscoverWebDto {
  url!: string;

  /** Max HTML pages to fetch when discovering links (default from env, capped). */
  maxPages?: number;
}
