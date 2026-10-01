/**
 * Mutes all launcher-local playback during full-monitor screen share so call
 * audio from the hub does not leak into the captured desktop mix.
 */

type IsolationListener = (active: boolean) => void;

let isolationActive = false;
const listeners = new Set<IsolationListener>();
const liveKitElementVolumes = new WeakMap<HTMLMediaElement, number>();
const mutedElements = new Set<HTMLMediaElement>();

export const isLauncherAudioIsolationActive = () => isolationActive;

export const onLauncherAudioIsolationChange = (listener: IsolationListener) => {
  listeners.add(listener);
  listener(isolationActive);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener(isolationActive);
    } catch {
      // ignore
    }
  });
};

export const applyLauncherPlaybackMuteToElement = (element: HTMLMediaElement) => {
  if (!isolationActive) return;
  if (!liveKitElementVolumes.has(element)) {
    liveKitElementVolumes.set(element, element.volume);
  }
  mutedElements.add(element);
  element.volume = 0;
  void element.pause?.().catch(() => undefined);
};

const restoreMutedElements = () => {
  mutedElements.forEach((element) => {
    const previous = liveKitElementVolumes.get(element);
    if (previous !== undefined) {
      element.volume = previous;
      liveKitElementVolumes.delete(element);
    }
    void element.play?.().catch(() => undefined);
  });
  mutedElements.clear();
};

export const setLauncherAudioIsolation = (active: boolean) => {
  if (isolationActive === active) return;
  isolationActive = active;
  if (!active) {
    restoreMutedElements();
  }
  notifyListeners();
};

export const getLauncherSfxVolumeScale = () => (isolationActive ? 0 : 1);
