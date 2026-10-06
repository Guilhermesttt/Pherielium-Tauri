import React from "react";
import DOMPurify from "dompurify";
import type { GamepadFamily } from "../../context/GamepadContext";

// Xbox Series SVGs
import xboxA from "../../assets/Xbox Series/Vector/xbox_button_a.svg?raw";
import xboxB from "../../assets/Xbox Series/Vector/xbox_button_b.svg?raw";
import xboxX from "../../assets/Xbox Series/Vector/xbox_button_x.svg?raw";
import xboxY from "../../assets/Xbox Series/Vector/xbox_button_y.svg?raw";
import xboxLB from "../../assets/Xbox Series/Vector/xbox_lb.svg?raw";
import xboxRB from "../../assets/Xbox Series/Vector/xbox_rb.svg?raw";
import xboxLT from "../../assets/Xbox Series/Vector/xbox_lt.svg?raw";
import xboxRT from "../../assets/Xbox Series/Vector/xbox_rt.svg?raw";
import xboxMenu from "../../assets/Xbox Series/Vector/xbox_button_menu.svg?raw";
import xboxView from "../../assets/Xbox Series/Vector/xbox_button_view.svg?raw";
import xboxDpad from "../../assets/Xbox Series/Vector/xbox_dpad_horizontal_outline.svg?raw";

// PlayStation Series SVGs
import psCross from "../../assets/PlayStation Series/Vector/playstation_button_cross.svg?raw";
import psCircle from "../../assets/PlayStation Series/Vector/playstation_button_circle.svg?raw";
import psSquare from "../../assets/PlayStation Series/Vector/playstation_button_square.svg?raw";
import psTriangle from "../../assets/PlayStation Series/Vector/playstation_button_triangle.svg?raw";
import psL1 from "../../assets/PlayStation Series/Vector/playstation_trigger_l1.svg?raw";
import psR1 from "../../assets/PlayStation Series/Vector/playstation_trigger_r1.svg?raw";
import psL2 from "../../assets/PlayStation Series/Vector/playstation_trigger_l2.svg?raw";
import psR2 from "../../assets/PlayStation Series/Vector/playstation_trigger_r2.svg?raw";
import psOptions from "../../assets/PlayStation Series/Vector/playstation5_button_options.svg?raw";
import psCreate from "../../assets/PlayStation Series/Vector/playstation5_button_create.svg?raw";
import psDpad from "../../assets/PlayStation Series/Vector/playstation_dpad_horizontal_outline.svg?raw";

export type ControllerButtonKey =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "L1"
  | "R1"
  | "L2"
  | "R2"
  | "LT"
  | "RT"
  | "MENU"
  | "OPTIONS"
  | "SHARE"
  | "VIEW"
  | "CREATE"
  | "DPAD";

export interface ControllerButtonGlyphProps {
  button: ControllerButtonKey;
  gamepadFamily?: GamepadFamily;
  className?: string;
  size?: number;
}

export const ControllerButtonGlyph: React.FC<ControllerButtonGlyphProps> = ({
  button,
  gamepadFamily = "xbox",
  className = "",
  size = 18,
}) => {
  const isPlaystation = gamepadFamily === "playstation";

  const rawSvg = React.useMemo(() => {
    if (isPlaystation) {
      switch (button) {
        case "A":
          return psCross;
        case "B":
          return psCircle;
        case "X":
          return psSquare;
        case "Y":
          return psTriangle;
        case "LB":
        case "L1":
          return psL1;
        case "RB":
        case "R1":
          return psR1;
        case "LT":
        case "L2":
          return psL2;
        case "RT":
        case "R2":
          return psR2;
        case "MENU":
        case "OPTIONS":
          return psOptions;
        case "VIEW":
        case "SHARE":
        case "CREATE":
          return psCreate;
        case "DPAD":
          return psDpad;
        default:
          return psCross;
      }
    }

    // Xbox / Generic
    switch (button) {
      case "A":
        return xboxA;
      case "B":
        return xboxB;
      case "X":
        return xboxX;
      case "Y":
        return xboxY;
      case "LB":
      case "L1":
        return xboxLB;
      case "RB":
      case "R1":
        return xboxRB;
      case "LT":
      case "L2":
        return xboxLT;
      case "RT":
      case "R2":
        return xboxRT;
      case "MENU":
      case "OPTIONS":
        return xboxMenu;
      case "VIEW":
      case "SHARE":
      case "CREATE":
        return xboxView;
      case "DPAD":
        return xboxDpad;
      default:
        return xboxA;
    }
  }, [button, isPlaystation]);

  const sanitized = React.useMemo(() => {
    if (!rawSvg) return "";
    const withViewBox = rawSvg.includes("viewBox=")
      ? rawSvg
      : rawSvg.replace(/<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/, '<svg$1$3$5 viewBox="0 0 $2 $4">');

    const clean = withViewBox
      .replace(/\swidth="[^"]*"/, "")
      .replace(/\sheight="[^"]*"/, "")
      .replace(
        "<svg ",
        '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
      );

    return DOMPurify.sanitize(clean, { USE_PROFILES: { svg: true } });
  }, [rawSvg]);

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 drop-shadow-sm select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default ControllerButtonGlyph;
