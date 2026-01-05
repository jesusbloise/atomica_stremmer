// Utilidades de resaltado de texto.
// - escapeRegExp: escapa regex.
// - escapeHtml: sanitiza HTML.
// - highlightInline: resalta coincidencias en strings.
// - highlightHTMLSafe: resalta sin romper etiquetas HTML.
// - highlightPlainToHTML: resalta texto plano convertido a HTML.

// utilidades de highlight y escapes
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const highlightInline = (text: string, term: string): string => {
  if (!term) return text;
  const re = new RegExp(`(${escapeRegExp(term)})`, "ig");
  return text.replace(
    re,
    `<mark style="background: rgba(234,179,8,0.4); border-radius: 2px; padding: 0 1px;">$1</mark>`
  );
};

export const highlightHTMLSafe = (html: string, term: string) => {
  if (!term || !html) return html;
  const parts = html.split(/(<[^>]+>)/g);
  const re = new RegExp(`(${escapeRegExp(term)})`, "ig");
  return parts
    .map((chunk) =>
      chunk.startsWith("<")
        ? chunk
        : chunk.replace(re, '<mark class="bg-yellow-500/40 px-0.5 rounded">$1</mark>')
    )
    .join("");
};

export const highlightPlainToHTML = (text: string, term: string) => {
  if (!term) return escapeHtml(text);
  const re = new RegExp(`(${escapeRegExp(term)})`, "ig");
  return escapeHtml(text).replace(
    re,
    '<mark class="bg-yellow-500/40 px-0.5 rounded">$1</mark>'
  );
};
