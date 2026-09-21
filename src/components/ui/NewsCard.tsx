import React from "react";
import { ExternalLink, Newspaper } from "lucide-react";

export interface NewsCardProps {
  title: string;
  source: string;
  publishedAt: string;
  summary?: string;
  imageUrl?: string;
  url?: string;
  readLabel?: string;
  onOpen?: () => void;
  className?: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  title,
  source,
  publishedAt,
  summary,
  imageUrl,
  readLabel = "Ler matéria",
  onOpen,
  className = "",
}) => {
  const [imgError, setImgError] = React.useState(false);

  return (
    <article
      onClick={onOpen}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E0E0E] text-left shadow-[0_16px_50px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-[#151515] ${className}`}
    >
      {/* Fixed aspect ratio thumbnail (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#171717]">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#171717] text-white/15">
            <Newspaper className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E0E] via-transparent to-transparent opacity-80" />

        {/* Source badge on top-left of thumbnail */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-md border border-white/15 bg-black/75 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
            {source}
          </span>
        </div>

        {/* Timestamp on top-right */}
        <div className="absolute right-3 top-3">
          <span className="rounded-md bg-black/60 px-2 py-0.5 font-mono text-[9px] text-white/50 backdrop-blur-md">
            {publishedAt}
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h2 className="line-clamp-2 text-sm md:text-base font-bold leading-snug text-white/90 group-hover:text-white transition-colors">
            {title}
          </h2>
          {summary && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/40 font-body">
              {summary}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/45 group-hover:text-white transition-colors">
            {readLabel}
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </article>
  );
};
