import React, { useEffect, useRef } from "react";
import bgVideo from "../assets/karavanbraam_pindown.io.webm";

const MainVideoBackground: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isGameRunning = false;

    const pauseVideo = () => {
      if (video && !video.paused) {
        video.pause();
      }
    };

    const playVideo = () => {
      if (video && video.paused && !document.hidden && document.hasFocus() && !isGameRunning) {
        video.play().catch(() => undefined);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseVideo();
      } else {
        playVideo();
      }
    };

    const handleGameLaunch = () => {
      isGameRunning = true;
      pauseVideo();
    };

    const handleGameStop = () => {
      isGameRunning = false;
      playVideo();
    };

    window.addEventListener("focus", playVideo);
    window.addEventListener("blur", pauseVideo);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    window.addEventListener("checkpoint:game-stop", handleGameStop);

    return () => {
      window.removeEventListener("focus", playVideo);
      window.removeEventListener("blur", pauseVideo);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
      window.removeEventListener("checkpoint:game-stop", handleGameStop);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050507]">
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute left-1/2 top-1/2 h-[100vw] w-[100vh] max-w-none object-cover opacity-75 transition-opacity duration-1000"
          style={{
            transform: "translate(-50%, -50%) rotate(90deg)",
          }}
        >
          <source src={bgVideo} type="video/mp4" />
        </video>
      </div>

      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(circle at center, transparent 0%, rgba(5, 5, 7, 0.4) 100%), linear-gradient(to bottom, rgba(5, 5, 7, 0.3), rgba(5, 5, 7, 0.6))",
        }}
      />

      {/* Optimized static dark noise texture overlay (replaces feTurbulence SVG render filter) */}
      <div
        className="absolute inset-0 opacity-[0.02] z-20 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
};

export default MainVideoBackground;
