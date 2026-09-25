import DOMPurify from "dompurify";

const config = {
  ALLOWED_TAGS: ["b", "br", "em", "i", "li", "ol", "p", "strong", "ul"],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  FORBID_TAGS: ["style", "script", "svg", "math", "iframe", "object", "embed", "form", "a", "img"],
  RETURN_TRUSTED_TYPE: false,
};

export const sanitizeStoreHtml = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  let text = value.slice(0, 200_000);

  // Se o texto não possui tags HTML de estrutura, formata quebras de linha em parágrafos
  if (!/<(?:p|br|div|ul|ol|li|h[1-6])\b/i.test(text)) {
    text = text
      .split(/\r?\n\r?\n+/)
      .map((paragraph) => `<p>${paragraph.trim().replace(/\r?\n/g, "<br />")}</p>`)
      .join("");
  }

  return String(DOMPurify.sanitize(text, config));
};
