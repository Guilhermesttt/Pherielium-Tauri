import React from "react";

export const SkeletonCanvas: React.FC = () => (
  <div
    aria-hidden
    className="w-full h-[480px] bg-gradient-to-br from-[#070708] to-[#0c0c0f] rounded-lg animate-pulse"
  />
);

export default SkeletonCanvas;
