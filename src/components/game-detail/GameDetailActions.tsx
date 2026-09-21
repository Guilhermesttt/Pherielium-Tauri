import React from "react";
import DOMPurify from "dompurify";
import { Play } from "lucide-react";
import psCross from "../../assets/PlayStation Series/Vector/playstation_button_cross.svg?raw";
import xboxA from "../../assets/Xbox Series/Vector/xbox_button_a.svg?raw";
import { ShinyButton } from "../ui/shiny-button";
import type { GameDetailCopy } from "../../types/gameDetail";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

interface GameDetailActionsProps {
  isLaunching: boolean;
  isRunning: boolean;
  launchError: string | null;
  activeInputType: "keyboard" | "gamepad" | "mouse";
  isGamepadConnected: boolean;
  gamepadFamily: "playstation" | "xbox" | "generic";
  copy: GameDetailCopy;
  onLaunch: () => void;
  playSound: (type: SoundEffectType) => void;
}

export const GameDetailActions: React.FC<GameDetailActionsProps> = React.memo(({
  isLaunching,
  isRunning,
  launchError,
  activeInputType,
  isGamepadConnected,
  gamepadFamily,
  copy,
  onLaunch,
  playSound,
}) => {
  const controllerGlyphSvg = React.useMemo(() => {
    const raw = gamepadFamily === "xbox" ? xboxA : psCross;
    let svg = raw;
    if (!svg.includes("viewBox=")) {
      svg = svg.replace(
        /<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/,
        '<svg$1$3$5 viewBox="0 0 $2 $4">'
      );
    }
    return DOMPurify.sanitize(
      svg
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "")
        .replace("<svg ", '<svg style="width:100%;height:100%;display:block" '),
      { USE_PROFILES: { svg: true } }
    );
  }, [gamepadFamily]);

  return (
    <div className="w-full">
      <ShinyButton
        onClick={onLaunch}
        disabled={isLaunching || isRunning}
        onMouseEnter={() => playSound("hover")}
        className="!w-full !flex !items-center !justify-center cursor-pointer"
      >
        {activeInputType === "gamepad" && isGamepadConnected ? (
          <span
            className="w-5 h-5 rounded-full bg-black border border-white/15 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-110 transition-transform [&>svg]:w-[14px] [&>svg]:h-[14px] [&>svg]:object-contain"
            dangerouslySetInnerHTML={{ __html: controllerGlyphSvg }}
          />
        ) : (
          <Play
            className={`w-4 h-4 fill-white text-white shrink-0 transition-transform duration-300 group-hover:scale-115 ${
              isLaunching ? "animate-pulse" : ""
            }`}
          />
        )}
        <span className="font-display font-black tracking-widest text-white text-sm ml-1.5">
          {isLaunching ? copy.launching : isRunning ? copy.running : copy.launch}
        </span>
      </ShinyButton>
      {launchError && (
        <p className="mt-2 text-[10px] text-white/80 max-w-[220px] text-center font-medium">
          {launchError}
        </p>
      )}
    </div>
  );
});

GameDetailActions.displayName = "GameDetailActions";
