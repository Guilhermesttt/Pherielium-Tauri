import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CallFeed } from "../VoiceCallWindow";
import { ScreenShareStage } from "./ScreenShareStage";
import { VoiceOnlyStage } from "./VoiceOnlyStage";
import { stageEnter } from "./motionTokens";

import type { CallState } from "../../../types/domain";

interface CallStageProps {
  feeds: CallFeed[];
  focusedFeedId: string | null;
  videoFitMode: "contain" | "cover";
  onToggleFitMode: () => void;
  onTogglePip: () => void;
  onRequestFullscreen: () => void;
  onSelectFeed: (feedId: string) => void;
  isStreamFocused?: boolean;
  onToggleStreamFocus?: () => void;
  onOpenInvite?: () => void;
  streamerVolume?: number;
  onChangeStreamerVolume?: (vol: number) => void;
  localScreenStream?: MediaStream | null;
  notify?: (msg: string, type: "success" | "error" | "info") => void;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  callState?: CallState;
  onContextMenu?: (e: React.MouseEvent, feed: CallFeed) => void;
  activeMenuFeedId?: string | null;
  onVideoElement?: (el: HTMLVideoElement | null) => void;
}

export const CallStage: React.FC<CallStageProps> = ({
  feeds,
  focusedFeedId,
  videoFitMode,
  onToggleFitMode,
  onTogglePip,
  onRequestFullscreen,
  onSelectFeed,
  isStreamFocused = true,
  onOpenInvite,
  streamerVolume,
  onChangeStreamerVolume,
  localScreenStream,
  notify,
  localStream,
  remoteStream,
  callState,
  onContextMenu,
  activeMenuFeedId,
  onVideoElement,
}) => {
  const screenFeeds = feeds.filter((f) => f.isScreen && f.stream);
  const focusedFeed = feeds.find((f) => f.id === focusedFeedId) || null;
  const activeScreenFeed =
    (focusedFeed?.isScreen && focusedFeed.stream ? focusedFeed : null) ||
    screenFeeds.find((f) => f.id === focusedFeedId) ||
    screenFeeds[0] ||
    null;
  const focusedPerson = focusedFeed && !focusedFeed.isScreen ? focusedFeed : null;

  const handleFocusScreen = (feedId: string) => {
    // handleSelectFeed already turns stream focus on. Toggling here raced
    // and cancelled the click on "Focar tela".
    onSelectFeed(feedId);
  };

  const isScreenStageActive = Boolean(activeScreenFeed && isStreamFocused && (!focusedFeed || focusedFeed.isScreen));
  const isPersonStageActive = Boolean(focusedPerson && isStreamFocused);
  const stageKey = isScreenStageActive ? `screen:${activeScreenFeed?.id}` : isPersonStageActive ? `person:${focusedPerson?.id}` : "grid";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stageKey}
        initial={stageEnter.initial}
        animate={stageEnter.animate}
        exit={stageEnter.exit}
        transition={stageEnter.transition}
        className="relative w-full h-full"
      >
        {isScreenStageActive && activeScreenFeed ? (
          <ScreenShareStage
            feed={activeScreenFeed}
            fitMode={videoFitMode}
            onToggleFitMode={onToggleFitMode}
            onTogglePip={onTogglePip}
            onRequestFullscreen={onRequestFullscreen}
            isFocused={true}
            onToggleFocus={() => onSelectFeed(activeScreenFeed.id)}
            streamerVolume={streamerVolume}
            onChangeStreamerVolume={onChangeStreamerVolume}
            localScreenStream={localScreenStream}
            notify={notify}
            onVideoElement={onVideoElement}
          />
        ) : (
          <VoiceOnlyStage
            feeds={isPersonStageActive && focusedPerson ? [focusedPerson] : feeds}
            onOpenInvite={onOpenInvite}
            localStream={localStream}
            remoteStream={remoteStream}
            callState={callState}
            onRefocusStream={activeScreenFeed ? () => handleFocusScreen(activeScreenFeed.id) : undefined}
            isScreenActive={Boolean(activeScreenFeed)}
            onContextMenu={onContextMenu}
            screenFeeds={isPersonStageActive ? [] : screenFeeds}
            onFocusScreen={handleFocusScreen}
            activeMenuFeedId={activeMenuFeedId}
            onVideoElement={onVideoElement}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
