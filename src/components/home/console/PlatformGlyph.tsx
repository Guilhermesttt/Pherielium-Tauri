import React from "react";
import { Gamepad2 } from "lucide-react";
import type { Game } from "../../../types/domain";
import {
  BattlenetBrandIcon,
  EaBrandIcon,
  EpicBrandIcon,
  GogBrandIcon,
  RiotBrandIcon,
  RockstarBrandIcon,
  SteamBrandIcon,
  UbisoftBrandIcon,
  XboxBrandIcon,
} from "../../Sidebar";
import { platformKey } from "./consoleRows";

/** Ícone da loja do jogo (Steam, Epic...), para ir antes do nome da plataforma. Sem loja: controle. */
export const PlatformGlyph: React.FC<{ game: Pick<Game, "launcherType" | "source">; className?: string }> = ({
  game,
  className = "h-[1.1em] w-[1.1em]",
}) => {
  switch (platformKey(game)) {
    case "steam":
      return <SteamBrandIcon className={className} />;
    case "epic":
      return <EpicBrandIcon className={className} />;
    case "gog":
      return <GogBrandIcon className={className} />;
    case "ea":
      return <EaBrandIcon className={className} />;
    case "ubisoft":
      return <UbisoftBrandIcon className={className} />;
    case "xbox":
      return <XboxBrandIcon className={className} />;
    case "battlenet":
      return <BattlenetBrandIcon className={className} />;
    case "riot":
      return <RiotBrandIcon className={className} />;
    case "rockstar":
      return <RockstarBrandIcon className={className} />;
    default:
      return <Gamepad2 className={className} aria-hidden="true" />;
  }
};

export default PlatformGlyph;
