import React, { useEffect, useRef } from "react";

interface VideoRendererProps {
  stream: MediaStream | null;
  fitMode?: "contain" | "cover";
  muted?: boolean;
  className?: string;
  onVideoElement?: (el: HTMLVideoElement | null) => void;
}

/**
 * High-performance VideoRenderer for MediaStream tracks.
 * Handles addtrack, removetrack, unmute and ended events cleanly without tearing down the DOM.
 */
export const VideoRenderer: React.FC<VideoRendererProps> = ({
  stream,
  fitMode = "contain",
  muted = true,
  className = "",
  onVideoElement,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncVideo = () => {
      if (!stream || stream.getVideoTracks().length === 0) {
        video.srcObject = null;
        return;
      }
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay may be deferred until user interaction or muted
        });
      }
    };

    syncVideo();

    if (stream && typeof stream.addEventListener === "function") {
      stream.addEventListener("addtrack", syncVideo);
      stream.addEventListener("removetrack", syncVideo);
      const tracks = typeof stream.getVideoTracks === "function" ? stream.getVideoTracks() : [];
      tracks.forEach((t) => {
        if (typeof t.addEventListener === "function") {
          t.addEventListener("unmute", syncVideo);
          t.addEventListener("ended", syncVideo);
        }
      });

      return () => {
        if (typeof stream.removeEventListener === "function") {
          stream.removeEventListener("addtrack", syncVideo);
          stream.removeEventListener("removetrack", syncVideo);
        }
        tracks.forEach((t) => {
          if (typeof t.removeEventListener === "function") {
            t.removeEventListener("unmute", syncVideo);
            t.removeEventListener("ended", syncVideo);
          }
        });
      };
    }
  }, [stream]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        onVideoElement?.(el);
      }}
      autoPlay
      playsInline
      muted={muted}
      disablePictureInPicture={false}
      className={`h-full w-full ${
        fitMode === "cover" ? "object-cover" : "object-contain"
      } ${className}`}
      style={{
        transform: "translate3d(0,0,0)",
        contain: "layout paint",
        backfaceVisibility: "hidden",
      }}
    />
  );
};
