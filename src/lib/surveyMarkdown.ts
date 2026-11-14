/**
 * Renders an imported argus-survey doc (docs/survey/) to HTML for the docs page.
 *
 * - Headings get GitHub's anchors, so `docsUrl()` and survey's own `#…` links land.
 * - Links between imported files stay in the docs. Everything else opens in a new
 *   tab, and a scheme other than http(s)/mailto is dropped (resolveDocLink).
 * - Images load only from this origin, so reading the docs fetches nothing from a
 *   third party. One that was not imported renders as a link instead.
 * - Raw HTML in the markdown is dropped (an inline tag's text stays). The files are
 *   pinned and hash-checked, but the page still shouldn't trust them with markup.
 *   README's logo is the one casualty; its images are off-origin anyway.
 */

import { Marked, type Tokens } from "marked";
import { githubAnchor, resolveDocImage, resolveDocLink } from "@/lib/surveyDocs";

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The doc's first level-1 heading (lexed, so a `# comment` in a code block is not one). */
const firstH1 = (markdown: string): Tokens.Heading | undefined =>
  new Marked({ gfm: true }).lexer(markdown).find((t): t is Tokens.Heading => t.type === "heading" && t.depth === 1);

/** The doc's title: its first `# ` heading, without inline code marks. */
export function docTitle(markdown: string, fallback: string): string {
  const h1 = firstH1(markdown);
  return h1 ? h1.text.replace(/`/g, "") : fallback;
}

/**
 * HTML for `markdown`, which lives at survey path `file` (relative links resolve from there).
 * A doc with no `# ` heading of its own is headed with `title`.
 */
export function renderSurveyDoc(markdown: string, file: string, title = ""): string {
  const seen = new Map<string, number>();
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, token: Tokens.Heading) {
        // GitHub slugs the rendered text, so a link in a heading counts by its text only.
        const base = githubAnchor(token.text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1"));
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      link(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const to = resolveDocLink(token.href, file);
        if (!to) return inner;
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        if (!to.external) return `<a href="${escapeHtml(to.href)}"${title}>${inner}</a>`;
        return `<a href="${escapeHtml(to.href)}"${title} target="_blank" rel="noopener noreferrer">${inner}<span class="sr-only"> (opens in new tab)</span></a>`;
      },
      image(token: Tokens.Image) {
        const src = resolveDocImage(token.href, file);
        const alt = escapeHtml(token.text);
        if (src) return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async">`;
        const to = resolveDocLink(token.href, file);
        if (!to) return alt;
        if (!to.external) return `<a href="${escapeHtml(to.href)}">${alt || "image"}</a>`;
        return `<a href="${escapeHtml(to.href)}" target="_blank" rel="noopener noreferrer">${alt || "image"}<span class="sr-only"> (opens in new tab)</span></a>`;
      },
      html() {
        return "";
      },
    },
  });
  const heading = title && !firstH1(markdown) ? `<h1>${escapeHtml(title)}</h1>\n` : "";
  const html = heading + (marked.parse(markdown) as string);
  // Wide tables scroll inside their own box, never the page.
  return html.replace(/<table>/g, '<div class="doc-table"><table>').replace(/<\/table>/g, "</table></div>");
}
