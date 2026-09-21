import React from "react";

const CARD_WIDTH = 168;
const CARD_HEIGHT = 252;

const skeletonCards = [-2, -1, 0, 1, 2];

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="w-full flex-1 flex flex-col justify-between overflow-hidden select-none pointer-events-none">
      {/* Top Hero Stage Skeleton */}
      <div className="px-10 pb-4 shrink-0 flex items-end justify-between gap-8 mt-auto">
        <div className="space-y-3 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-28 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
          <div className="h-10 md:h-12 w-72 md:w-96 rounded-2xl bg-white/[0.08] animate-pulse shadow-sm" />
          <div className="flex items-center gap-2.5 pt-1">
            <div className="h-6 w-20 rounded-full bg-[#16171c]/90 border border-white/[0.08] animate-pulse" />
            <div className="h-6 w-24 rounded-full bg-[#16171c]/70 border border-white/[0.06] animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-[#16171c]/90 border border-white/[0.08] animate-pulse" />
          </div>
        </div>
        <div className="shrink-0">
          <div className="h-12 w-36 rounded-full bg-white/[0.08] border border-white/[0.12] animate-pulse flex items-center justify-center shadow-lg" />
        </div>
      </div>

      {/* Game Cards Carousel Skeleton - matches GameRow layout */}
      <div className="shrink-0 pb-8">
        <div className="relative w-full flex flex-col" style={{ gap: 0 }}>
          <div className="overflow-visible pb-2">
            <div
              className="flex items-center"
              style={{
                gap: 12,
                paddingLeft: "calc(50vw - 89px)",
                paddingRight: "calc(50vw - 89px)",
              }}
            >
              {skeletonCards.map((offset) => {
                const isCenter = offset === 0;
                return (
                  <div
                    key={offset}
                    className="shrink-0"
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl bg-[#090A0D]/90 border backdrop-blur-xl p-3 flex flex-col justify-between"
                      style={{
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        transform: isCenter ? "scale(1.05) translateY(-8px)" : "scale(0.95)",
                        borderColor: isCenter ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.06)",
                        boxShadow: isCenter
                          ? "0 20px 50px rgba(0,0,0,0.95), 0 0 30px rgba(255,255,255,0.15)"
                          : "0 10px 28px rgba(0,0,0,0.7)",
                        opacity: isCenter ? 1 : 0.6,
                        zIndex: isCenter ? 20 : 10,
                      }}
                    >
                      {/* Image area */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02]" />
                      {/* Top Badges */}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="h-5 w-14 rounded-full bg-white/[0.08] animate-pulse" />
                        {isCenter && <div className="h-5 w-5 rounded-full bg-white/[0.08] animate-pulse" />}
                      </div>
                      {/* Shimmer overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite] pointer-events-none" />
                      {/* Bottom Title Skeleton */}
                      <div className="space-y-1.5 z-10 mt-auto relative">
                        <div className="h-3.5 w-3/4 rounded-md bg-white/[0.12] animate-pulse" />
                        <div className="h-2.5 w-1/2 rounded-md bg-white/[0.06] animate-pulse" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination dots */}
          <div className="flex justify-center mt-6 gap-1.5">
            <div className="h-[3px] w-7 rounded-full bg-white/60 animate-pulse" />
            <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
            <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
            <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
            <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
