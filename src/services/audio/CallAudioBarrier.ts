/**
 * @deprecated Removed from the screen-share pipeline.
 *
 * Spectral sidechain attenuation is not reliable capture isolation and depended on
 * requestAnimationFrame. Screen share now uses display-media constraints via
 * screenShareAudioBarrierConstraints() in voiceCall/screenShare.ts.
 */

export interface CallAudioBarrierInstance {
  processedTrack: MediaStreamTrack;
  destroy: () => void;
}

/** @deprecated No-op stub kept for backward compatibility with older imports. */
export function createCallAudioBarrier(
  rawTrack: MediaStreamTrack,
): CallAudioBarrierInstance {
  void rawTrack;
  return {
    processedTrack: rawTrack,
    destroy: () => undefined,
  };
}
