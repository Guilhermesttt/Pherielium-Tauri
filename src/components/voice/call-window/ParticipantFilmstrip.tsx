import React from "react";
import type { CallFeed } from "../VoiceCallWindow";
import { ParticipantTile } from "./ParticipantTile";

interface ParticipantFilmstripProps {
  feeds: CallFeed[];
  focusedFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
  onContextMenu: (e: React.MouseEvent, feed: CallFeed) => void;
  onShowAll?: () => void;
}

export const ParticipantFilmstrip: React.FC<ParticipantFilmstripProps> = ({
  feeds,
  focusedFeedId,
  onSelectFeed,
  onContextMenu,
  onShowAll,
}) => {
  // Only display unique people in the filmstrip (exclude screen share duplicate feeds)
  const peopleFeeds = feeds.filter((f) => !f.isScreen);
  const screenFeeds = feeds.filter((f) => f.isScreen && f.stream);

  // If there are more than 7 participants, we show first 6 + an overflow pill
  const MAX_VISIBLE = 6;
  const showOverflow = peopleFeeds.length > MAX_VISIBLE;
  const visibleFeeds = showOverflow ? peopleFeeds.slice(0, MAX_VISIBLE) : peopleFeeds;
  const remainingCount = peopleFeeds.length - MAX_VISIBLE;

  return (
    <div className="w-full flex items-center justify-center px-4 py-2 z-10 shrink-0 select-none">
      <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-1 scrollbar-none">
        {visibleFeeds.map((feed) => {
          const presentingScreen = feed.peerId
            ? screenFeeds.find((s) => s.peerId === feed.peerId)
            : undefined;
          return (
            <ParticipantTile
              key={feed.id}
              feed={feed}
              isFocused={focusedFeedId === feed.id}
              isPresenting={Boolean(presentingScreen)}
              onSelect={() => onSelectFeed(feed.id)}
              onContextMenu={(e) => onContextMenu(e, feed)}
            />
          );
        })}

        {showOverflow && (
          <button
            type="button"
            title={`${remainingCount} outros participantes na chamada (clique para ver todos)`}
            aria-label={`Ver mais ${remainingCount} participantes na chamada`}
            onClick={onShowAll}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className="flex items-center justify-center h-[52px] px-3.5 rounded-[18px] bg-[#0F0F0F]/80 border border-[#161616] text-xs font-semibold text-white/75 shrink-0 hover:bg-[#151515] hover:text-white transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            +{remainingCount}
          </button>
        )}

      </div>
    </div>
  );
};
