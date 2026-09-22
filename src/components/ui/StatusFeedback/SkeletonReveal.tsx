import React, { useEffect, useState, useRef } from "react";

export interface SkeletonRevealProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  skeletonClassName?: string;
  contentClassName?: string;
  isPulsing?: boolean;
}

/**
 * SkeletonReveal
 * Transitions.dev — Skeleton loader and reveal
 * Smooth cross-fade transition from a pulsating skeleton to the loaded content.
 */
export const SkeletonReveal: React.FC<SkeletonRevealProps> = ({
  isLoading,
  skeleton,
  children,
  className = "",
  skeletonClassName = "",
  contentClassName = "",
  isPulsing = true,
}) => {
  const [isRevealed, setIsRevealed] = useState(!isLoading);
  const [isResetting, setIsResetting] = useState(false);
  const prevLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      // Data arrived: reveal content with cross-fade & un-blur
      setIsResetting(false);
      setIsRevealed(true);
    } else if (!prevLoadingRef.current && isLoading) {
      // Re-entering loading state: snap back immediately without reverse animation
      setIsResetting(true);
      setIsRevealed(false);
      const raf = requestAnimationFrame(() => {
        setIsResetting(false);
      });
      return () => cancelAnimationFrame(raf);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading]);

  return (
    <div
      className={`t-skel ${isRevealed ? "is-revealed" : ""} ${isResetting ? "is-resetting" : ""} ${className}`}
      data-state={isLoading ? "loading" : "loaded"}
    >
      <div
        className={`t-skel-skeleton ${isPulsing ? "is-pulsing" : ""} ${skeletonClassName}`}
        aria-hidden={isRevealed}
      >
        {skeleton}
      </div>
      <div className={`t-skel-content ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
