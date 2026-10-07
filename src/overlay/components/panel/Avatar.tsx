import React from "react";

/** Avatar redondo: imagem ou, sem ela, o ícone/fallback passado. */
export const Avatar: React.FC<{
  src?: string | null;
  size?: number;
  fallback: React.ReactNode;
  className?: string;
}> = ({ src, size = 36, fallback, className = "" }) => (
  <span
    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.09] text-white/70 ${className}`}
    style={{ width: size, height: size }}
  >
    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : fallback}
  </span>
);
