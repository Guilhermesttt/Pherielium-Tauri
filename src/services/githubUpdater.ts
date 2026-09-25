/**
 * GitHub Releases updater — compares installed version to latest release
 * on Guilhermesttt/Pherielium-Tauri and drives the existing Settings/Home UI.
 */

import {
  GITHUB_API_LATEST_RELEASE_URL,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_REPO_SLUG,
} from "../constants/downloads";

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "dev";

export type AppUpdateInfo = {
  version: string;
  downloadUrl?: string;
  releaseUrl?: string;
  notes?: string;
};

export type AppUpdateState = {
  status: AppUpdateStatus;
  info: AppUpdateInfo | null;
  progress: { percent?: number } | null;
  error: string;
};

type MessageCb = (message: string, data?: AppUpdateInfo | string) => void;
type ProgressCb = (progress: { percent?: number }) => void;

let state: AppUpdateState = {
  status: "idle",
  info: null,
  progress: null,
  error: "",
};

const messageListeners = new Set<MessageCb>();
const progressListeners = new Set<ProgressCb>();

function emitMessage(message: string, data?: AppUpdateInfo | string) {
  for (const cb of messageListeners) {
    try {
      cb(message, data);
    } catch (err) {
      console.warn("[updater] listener error", err);
    }
  }
}

function emitProgress(progress: { percent?: number }) {
  for (const cb of progressListeners) {
    try {
      cb(progress);
    } catch (err) {
      console.warn("[updater] progress listener error", err);
    }
  }
}

function setState(patch: Partial<AppUpdateState>, message?: string, data?: AppUpdateInfo | string) {
  state = { ...state, ...patch };
  if (message) emitMessage(message, data);
}

export function getAppUpdateState(): AppUpdateState {
  return { ...state, info: state.info ? { ...state.info } : null };
}

export function onAppUpdateMessage(cb: MessageCb): () => void {
  messageListeners.add(cb);
  return () => {
    messageListeners.delete(cb);
  };
}

export function onAppDownloadProgress(cb: ProgressCb): () => void {
  progressListeners.add(cb);
  return () => {
    progressListeners.delete(cb);
  };
}

/** Normalize "v1.0.0" / "1.0.0-beta" → [1,0,0] */
export function parseSemver(raw: string): number[] {
  const core = String(raw || "0.0.0")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split("+")[0];
  return core
    .split(".")
    .slice(0, 3)
    .map((part) => {
      const n = parseInt(part.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : 0;
    });
}

export function isRemoteNewer(remote: string, local: string): boolean {
  const a = parseSemver(remote);
  const b = parseSemver(local);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

function pickSetupAsset(release: GithubRelease): string | undefined {
  const assets = release.assets ?? [];
  const byName = (re: RegExp) =>
    assets.find((a) => a.name && re.test(a.name) && a.browser_download_url)?.browser_download_url;

  return (
    byName(/setup.*\.exe$/i) ||
    byName(/\.exe$/i) ||
    byName(/\.msi$/i) ||
    undefined
  );
}

let checkInFlight: Promise<AppUpdateState> | null = null;

export async function checkGithubUpdates(getInstalledVersion: () => Promise<string>): Promise<AppUpdateState> {
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    setState({ status: "checking", error: "" }, "checking-for-update");

    try {
      const installed = await getInstalledVersion();
      const res = await fetch(GITHUB_API_LATEST_RELEASE_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub API ${res.status} (${GITHUB_REPO_SLUG})`);
      }

      const release = (await res.json()) as GithubRelease;
      const remoteTag = String(release.tag_name || "").trim();
      if (!remoteTag) {
        throw new Error("Release sem tag_name");
      }

      if (!isRemoteNewer(remoteTag, installed)) {
        setState(
          { status: "not-available", info: null, progress: null, error: "" },
          "update-not-available",
        );
        return getAppUpdateState();
      }

      const info: AppUpdateInfo = {
        version: remoteTag.replace(/^v/i, ""),
        downloadUrl: pickSetupAsset(release) || GITHUB_LATEST_RELEASE_URL,
        releaseUrl: release.html_url || GITHUB_LATEST_RELEASE_URL,
        notes: release.body,
      };

      setState({ status: "available", info, progress: null, error: "" }, "update-available", info);
      return getAppUpdateState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao verificar atualizações";
      setState({ status: "error", error: message }, "error", message);
      return getAppUpdateState();
    } finally {
      checkInFlight = null;
    }
  })();

  return checkInFlight;
}

export async function openUpdateDownload(
  openExternal: (url: string) => Promise<unknown>,
): Promise<AppUpdateState> {
  const url = state.info?.downloadUrl || state.info?.releaseUrl || GITHUB_LATEST_RELEASE_URL;
  setState({ status: "downloading", progress: { percent: 0 } }, "download-started", state.info || undefined);
  emitProgress({ percent: 10 });

  try {
    await openExternal(url);
    emitProgress({ percent: 100 });
    // User installs via the downloaded setup; mark as available guidance (downloaded = open installer)
    setState(
      { status: "downloaded", progress: { percent: 100 } },
      "update-downloaded",
      state.info || undefined,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível abrir o download";
    setState({ status: "error", error: message }, "error", message);
  }

  return getAppUpdateState();
}

export async function openReleaseAndQuitHint(
  openExternal: (url: string) => Promise<unknown>,
): Promise<void> {
  const url = state.info?.downloadUrl || state.info?.releaseUrl || GITHUB_LATEST_RELEASE_URL;
  await openExternal(url);
}
