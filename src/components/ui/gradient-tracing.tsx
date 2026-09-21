import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GradientTracingProps {
  width: number;
  height: number;
  viewBox?: string;
  baseColor?: string;
  gradientColors?: [string, string, string];
  animationDuration?: number;
  strokeWidth?: number;
  path?: string;
  paths?: string[];
  fill?: string;
  children?: React.ReactNode;
  className?: string;
}

export const GradientTracing: React.FC<GradientTracingProps> = ({
  width,
  height,
  viewBox,
  baseColor = "rgba(255, 255, 255, 0.15)",
  gradientColors = ["#ffffff", "#ffffff", "#ffffff"],
  animationDuration = 2.4,
  strokeWidth = 1.5,
  path,
  paths,
  fill = "none",
  children,
  className,
}) => {
  const gradientId = React.useId();

  const allPaths = React.useMemo(() => {
    if (paths && paths.length > 0) return paths;
    if (path) return [path];
    return [`M0,${height / 2} L${width},${height / 2}`];
  }, [path, paths, height, width]);

  const computedViewBox = viewBox ?? `0 0 ${width} ${height}`;
  const viewBoxWidth = React.useMemo(() => {
    const parts = computedViewBox.split(" ");
    return parts.length >= 3 ? Number(parts[2]) || width : width;
  }, [computedViewBox, width]);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={computedViewBox}
        fill="none"
        className="w-full h-full pointer-events-none"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <motion.linearGradient
            initial={{ x1: "0", y1: "0", x2: "0", y2: "0" }}
            animate={{
              x1: ["0", String(viewBoxWidth * 2)],
              x2: ["0", String(viewBoxWidth)],
            }}
            transition={{
              duration: animationDuration,
              repeat: Infinity,
              ease: "linear",
            }}
            id={gradientId}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={gradientColors[0]} stopOpacity="0" />
            <stop stopColor={gradientColors[1]} stopOpacity="1" />
            <stop offset="1" stopColor={gradientColors[2]} stopOpacity="0" />
          </motion.linearGradient>
        </defs>

        {/* Base faint tracks with optional body fill */}
        {allPaths.map((d, i) => (
          <path
            key={`base-${i}`}
            d={d}
            fill={fill}
            stroke={baseColor}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Subtle luminous halo */}
        {allPaths.map((d, i) => (
          <path
            key={`glow-${i}`}
            d={d}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth * 2.2}
            vectorEffect="non-scaling-stroke"
            className="blur-[2px] opacity-60"
          />
        ))}

        {/* Razor-sharp laser core trace */}
        {allPaths.map((d, i) => (
          <path
            key={`laser-${i}`}
            d={d}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {children}
    </div>
  );
};

export default GradientTracing;
