import React from "react";

export interface ShimmerTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string;
  className?: string;
}

/**
 * ShimmerText
 * Transitions.dev — Shimmer text
 * Continuous light-sweep gradient animation across text glyphs.
 */
export const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <span
      className={`t-shimmer ${className}`}
      data-text={children}
      {...props}
    >
      {children}
    </span>
  );
};
