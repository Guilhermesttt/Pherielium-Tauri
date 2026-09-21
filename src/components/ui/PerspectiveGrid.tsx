import React from "react";

interface PerspectiveGridProps {
  className?: string;
  dotSize?: number;
  gap?: number;
  opacity?: number;
}

export const PerspectiveGrid: React.FC<PerspectiveGridProps> = ({
  className = "",
  dotSize = 1.25,
  gap = 24,
  opacity = 0.25,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      style={{
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%)",
      }}
    >
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, ${opacity}) ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${gap}px ${gap}px`,
        }}
      />
    </div>
  );
};
