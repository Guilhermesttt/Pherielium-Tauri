// ─── Configuração de Download e Links de Releases ────────────────

export const CURRENT_LAUNCHER_VERSION = "1.0.0";

/** owner/repo used by the in-app GitHub updater */
export const GITHUB_REPO_SLUG = "Guilhermesttt/Pherielium-Tauri";

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_SLUG}`;

export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;

export const GITHUB_LATEST_RELEASE_URL = `${GITHUB_REPO_URL}/releases/latest`;

export const GITHUB_API_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO_SLUG}/releases/latest`;

/** Prefer NSIS setup asset naming from `tauri build` */
export const GITHUB_DIRECT_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/latest/download/Pherielium_1.0.0_x64-setup.exe`;

export const LAUNCHER_EXE_FILENAME = `Pherielium_${CURRENT_LAUNCHER_VERSION}_x64-setup.exe`;
