/** Epic sibling modes / spin-offs that must not hydrate the base game entry. */
export const EPIC_SIBLING_QUALIFIERS = [
  "lego",
  "odyssey",
  "rocket",
  "racing",
  "festival",
  "metal",
  "storm",
  "reload",
  "creative",
  "blitz",
  "save",
  "world",
  "party",
  "zero",
  "build",
] as const;

export interface EpicDetailsMatchInput {
  expectedTitle?: string | null;
  expectedCatalogId?: string | null;
  expectedLaunchId?: string | null;
  expectedProductSlug?: string | null;
  resultTitle?: string | null;
  resultCatalogId?: string | null;
  resultProductSlug?: string | null;
  resultAppName?: string | null;
}

const normalizeEpicKey = (value?: string | null) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const tokenizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const catalogTail = (value?: string | null) => {
  if (!value) return "";
  const decoded = decodeURIComponent(value);
  const parts = decoded.split(":");
  return parts.length >= 2 ? parts[parts.length - 1] : decoded;
};

const hasConflictingQualifiers = (expectedTitle: string, resultTitle: string) => {
  const expectedTokens = new Set(tokenizeTitle(expectedTitle));
  const resultTokens = tokenizeTitle(resultTitle);

  return resultTokens.some((token) => {
    const isQualifier = EPIC_SIBLING_QUALIFIERS.some(
      (qualifier) => token === qualifier || token.includes(qualifier) || qualifier.includes(token),
    );
    if (!isQualifier) return false;
    return !expectedTokens.has(token);
  });
};

/**
 * Returns true when Epic store metadata belongs to the same owned library item.
 * Rejects sibling products (e.g. LEGO Fortnite hydrating base Fortnite).
 */
export function epicStoreDetailsMatch(input: EpicDetailsMatchInput): boolean {
  const expectedTitle = (input.expectedTitle || "").trim();
  const resultTitle = (input.resultTitle || "").trim();

  const expectedCatalog = normalizeEpicKey(catalogTail(input.expectedCatalogId));
  const resultCatalog = normalizeEpicKey(catalogTail(input.resultCatalogId));
  if (expectedCatalog && resultCatalog) {
    return expectedCatalog === resultCatalog;
  }

  const expectedLaunch = (input.expectedLaunchId || "").trim().toLowerCase();
  const resultLaunch = (input.resultAppName || "").trim().toLowerCase();
  if (expectedLaunch && resultLaunch && expectedLaunch === resultLaunch) {
    return true;
  }

  const expectedSlug = (input.expectedProductSlug || "").trim().toLowerCase();
  const resultSlug = (input.resultProductSlug || "").trim().toLowerCase();
  if (expectedSlug && resultSlug && expectedSlug === resultSlug) {
    return true;
  }

  if (!expectedTitle || !resultTitle) {
    return !expectedTitle;
  }

  if (hasConflictingQualifiers(expectedTitle, resultTitle)) {
    return false;
  }

  const expectedNorm = tokenizeTitle(expectedTitle).join("");
  const resultNorm = tokenizeTitle(resultTitle).join("");
  if (!expectedNorm || !resultNorm) return false;
  if (expectedNorm === resultNorm) return true;

  const [shorter, longer] = expectedNorm.length <= resultNorm.length
    ? [expectedNorm, resultNorm]
    : [resultNorm, expectedNorm];

  return shorter.length >= 3 && longer.startsWith(shorter);
}
