import { useCallback, useEffect, useState } from "react";
import {
  getReleaseHighlights,
  LATEST_RELEASE,
  type ReleaseHighlights,
} from "../releases/releaseHighlights";

const LAST_SEEN_RELEASE_KEY = "checkpoint:last-seen-release";
const dismissedThisSession = new Set<string>();

const readLastSeenRelease = () => {
  try {
    return window.localStorage.getItem(LAST_SEEN_RELEASE_KEY);
  } catch {
    return null;
  }
};

export const useWhatsNewRelease = (enabled: boolean) => {
  const [release, setRelease] = useState<ReleaseHighlights | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      return () => {
        active = false;
      };
    }

    const resolveRelease = async () => {
      let installedVersion = LATEST_RELEASE.version;
      try {
        installedVersion = await window.electronAPI?.getVersion?.() || LATEST_RELEASE.version;
      } catch {
        installedVersion = LATEST_RELEASE.version;
      }

      if (!active) return;
      const installedRelease = getReleaseHighlights(installedVersion);
      const alreadySeen = readLastSeenRelease() === installedVersion
        || dismissedThisSession.has(installedVersion);
      setRelease(installedRelease && !alreadySeen ? installedRelease : null);
      setIsReady(true);
    };

    void resolveRelease();
    return () => {
      active = false;
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setRelease((currentRelease) => {
      if (!currentRelease) return null;
      dismissedThisSession.add(currentRelease.version);
      try {
        window.localStorage.setItem(LAST_SEEN_RELEASE_KEY, currentRelease.version);
      } catch {
        // A memoria da sessao impede que o modal entre em loop sem armazenamento.
      }
      return null;
    });
  }, []);

  return {
    release: enabled ? release : null,
    isReady: enabled && isReady,
    dismiss,
  };
};
