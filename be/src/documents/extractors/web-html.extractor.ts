import * as cheerio from 'cheerio';

export interface ExtractedWebPage {
  title: string | null;
  text: string;
}

/**
 * Pull readable text from HTML: strip scripts/styles and collapse whitespace.
 */
export function extractTextFromHtml(html: string): ExtractedWebPage {
  const $ = cheerio.load(html);

  $('script, style, noscript, iframe, svg, template').remove();

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    null;

  let raw: string;
  if ($('body').length > 0) {
    raw = $('body').text();
  } else if ($('html').length > 0) {
    raw = $('html').text();
  } else {
    raw = $.root().text();
  }

  const text = raw
    .replace(/[ \t\f\r]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return { title, text };
}
