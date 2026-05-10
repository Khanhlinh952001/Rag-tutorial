import * as cheerio from 'cheerio';

const SKIP_PATH_RE =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mjs|json|xml|zip|rar|mp4|mp3|woff2?|ttf|eot)$/i;

/** Normalize URL for deduplication (strip hash). */
export function normalizeVisitUrl(href: string): string {
  try {
    const u = new URL(href);
    u.hash = '';
    return u.href;
  } catch {
    return href;
  }
}

/** Absolute same-origin links suitable for queueing (HTML navigation). */
export function collectSameOriginLinks(
  html: string,
  pageUrl: string,
  allowedHostnameLower: string,
): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  const base = new URL(pageUrl);

  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    if (
      !raw ||
      raw.startsWith('javascript:') ||
      raw.startsWith('mailto:') ||
      raw.startsWith('tel:') ||
      raw.startsWith('#')
    ) {
      return;
    }
    try {
      const abs = new URL(raw, base);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
      if (abs.hostname.toLowerCase() !== allowedHostnameLower) return;
      if (SKIP_PATH_RE.test(abs.pathname)) return;
      abs.hash = '';
      out.add(abs.href);
    } catch {
      // ignore invalid href
    }
  });

  return [...out];
}
