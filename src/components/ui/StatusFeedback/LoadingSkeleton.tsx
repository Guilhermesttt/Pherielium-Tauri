import React from "react";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-xl bg-white/[0.07] backdrop-blur-sm ${className}`}
  />
);

export const GameCardSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 1,
  className = "",
}) => (
  <>
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className={`flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/30 p-3 backdrop-blur-xl ${className}`}
      >
        {/* Cover image placeholder */}
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        {/* Title and metadata */}
        <div className="space-y-2 px-1">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-1/4 rounded-md" />
          </div>
        </div>
      </div>
    ))}
  </>
);

export const ListRowSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className = "",
}) => (
  <div className={`space-y-2.5 ${className}`}>
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.03] p-3.5 backdrop-blur-lg"
      >
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2 rounded-md" />
          <Skeleton className="h-2.5 w-1/3 rounded-md" />
        </div>
        <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
      </div>
    ))}
  </div>
);

export const PageHeaderSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`space-y-3 pb-6 ${className}`}>
    <Skeleton className="h-4 w-28 rounded-md" />
    <Skeleton className="h-8 w-64 rounded-xl" />
    <Skeleton className="h-3.5 w-96 max-w-full rounded-md" />
  </div>
);
