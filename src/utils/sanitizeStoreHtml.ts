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
  return String(DOMPurify.sanitize(value.slice(0, 200_000), config));
};
