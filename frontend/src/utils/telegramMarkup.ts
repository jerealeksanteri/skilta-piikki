/**
 * Converts the newsletter editor's markers into Telegram Bot API HTML.
 * The same output is shown in the preview and sent to the server, so what the
 * admin sees is what users get. All user text is HTML-escaped first, so the
 * only tags in the output are the ones produced here.
 *
 *   **bold**  __italic__  ++underline++  ~~strike~~  ||spoiler||
 *   `code`    [text](https://link)       "> " at line start = quote
 */

export const TELEGRAM_MESSAGE_LIMIT = 4096;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const INLINE_RULES: [RegExp, string][] = [
  [/\*\*([\s\S]+?)\*\*/g, 'b'],
  [/__([\s\S]+?)__/g, 'i'],
  [/\+\+([\s\S]+?)\+\+/g, 'u'],
  [/~~([\s\S]+?)~~/g, 's'],
  [/\|\|([\s\S]+?)\|\|/g, 'tg-spoiler'],
];

function convertInline(text: string): string {
  // Protect code spans and link targets from the other markers with placeholders.
  const protectedParts: string[] = [];
  const protect = (html: string) => {
    protectedParts.push(html);
    return `\u0000${protectedParts.length - 1}\u0000`;
  };

  let out = text.replace(/`([^`\n]+)`/g, (_m, code: string) => protect(`<code>${code}</code>`));
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => {
    const href = url.replace(/"/g, '&quot;');
    return `${protect(`<a href="${href}">`)}${label}${protect('</a>')}`;
  });
  for (const [pattern, tag] of INLINE_RULES) {
    out = out.replace(pattern, `<${tag}>$1</${tag}>`);
  }
  // eslint-disable-next-line no-control-regex
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => protectedParts[Number(i)]);
}

export function markupToTelegramHtml(markup: string): string {
  // eslint-disable-next-line no-control-regex
  const lines = escapeHtml(markup.replace(/\u0000/g, '')).split('\n');

  // Split into plain and quote ("> " lines) segments. Inline markers are
  // converted per segment, so they can never straddle a quote boundary.
  const segments: { quote: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const m = line.match(/^&gt; ?(.*)$/);
    const isQuote = m !== null;
    const text = m ? m[1] : line;
    const last = segments[segments.length - 1];
    if (last && last.quote === isQuote) last.lines.push(text);
    else segments.push({ quote: isQuote, lines: [text] });
  }

  return segments
    .map((seg) => {
      const html = convertInline(seg.lines.join('\n'));
      return seg.quote ? `<blockquote>${html}</blockquote>` : html;
    })
    .join('\n');
}

/** Visible length as Telegram counts it (UTF-16 code units of the text). */
export function visibleLength(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').length;
}
