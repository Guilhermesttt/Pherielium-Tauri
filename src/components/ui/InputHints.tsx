import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Mouse, MouseRight, Plus, Settings, UserPlus } from "lucide-react";
import DOMPurify from "dompurify";
import { useGamepad, type GamepadButtonName } from "../../context/GamepadContext";

import psCross from "../../assets/PlayStation Series/Vector/playstation_button_cross.svg?raw";
import psCircle from "../../assets/PlayStation Series/Vector/playstation_button_circle.svg?raw";
import psSquare from "../../assets/PlayStation Series/Vector/playstation_button_square.svg?raw";
import psTriangle from "../../assets/PlayStation Series/Vector/playstation_button_triangle.svg?raw";
import psL1 from "../../assets/PlayStation Series/Vector/playstation_trigger_l1.svg?raw";
import psR1 from "../../assets/PlayStation Series/Vector/playstation_trigger_r1.svg?raw";
import psL2 from "../../assets/PlayStation Series/Vector/playstation_trigger_l2.svg?raw";
import psR2 from "../../assets/PlayStation Series/Vector/playstation_trigger_r2.svg?raw";
import psOptions from "../../assets/PlayStation Series/Vector/playstation5_button_options.svg?raw";
import psShare from "../../assets/PlayStation Series/Vector/playstation5_button_create.svg?raw";
import psDpadHorizontal from "../../assets/PlayStation Series/Vector/playstation_dpad_horizontal_outline.svg?raw";
import psRightStickVertical from "../../assets/PlayStation Series/Vector/playstation_stick_r_vertical.svg?raw";

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
import xboxDpadHorizontal from "../../assets/Xbox Series/Vector/xbox_dpad_horizontal_outline.svg?raw";
import xboxRightStickVertical from "../../assets/Xbox Series/Vector/xbox_stick_r_vertical.svg?raw";

type ExtraHintButton = "L1_R1" | "L2_R2" | "DPAD" | "CONTEXT" | "SCROLL";

export interface InputHintProps {
  hints: Array<{
    button: GamepadButtonName | ExtraHintButton;
    label: string;
  }>;
}

const KeyboardHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="min-w-6 rounded-md border border-white/20 px-1.5 py-0.5 text-center font-sans text-[10px] font-bold">
    {children}
  </kbd>
);

const GamepadIcon: React.FC<{ svg: string; label: string; className?: string }> = ({
  svg,
  label,
  className = "h-5 w-5",
}) => {
  const markup = React.useMemo(
    () => {
      const withViewBox = svg.includes("viewBox=")
        ? svg
        : svg.replace(/<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/, '<svg$1$3$5 viewBox="0 0 $2 $4">');

      return withViewBox
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "")
        .replace(
          "<svg ",
          '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
        );
    },
    [svg],
  );

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center text-white opacity-85 ${className}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true } }) }}
    />
  );
};

const getPCHint = (button: string) => {
  switch (button) {
    case "X":
      return <CornerDownLeft className="h-3.5 w-3.5" />;
    case "O":
      return <KeyboardHint>ESC</KeyboardHint>;
    case "SQUARE":
      return <KeyboardHint>F</KeyboardHint>;
    case "TRIANGLE":
      return <Plus className="h-3.5 w-3.5" />;
    case "L1":
    case "R1":
    case "L1_R1":
    case "L2_R2":
      return <KeyboardHint>TAB</KeyboardHint>;
    case "OPTIONS":
      return <Settings className="h-3.5 w-3.5" />;
    case "SHARE":
      return <UserPlus className="h-3.5 w-3.5" />;
    case "DPAD":
      return <span className="text-[12px] font-bold">{"\u2190 \u2192"}</span>;
    case "SCROLL":
      return (
        <span className="flex items-center gap-1">
          <Mouse className="h-3.5 w-3.5" />
          <span className="text-[12px] font-bold">{"\u2195"}</span>
        </span>
      );
    case "CONTEXT":
      return <MouseRight className="h-3.5 w-3.5" />;
    default:
      return <KeyboardHint>{button}</KeyboardHint>;
  }
};

const getPSHint = (button: string) => {
  switch (button) {
    case "X":
      return <GamepadIcon svg={psCross} label="Cross" />;
    case "O":
      return <GamepadIcon svg={psCircle} label="Circle" />;
    case "SQUARE":
      return <GamepadIcon svg={psSquare} label="Square" />;
    case "TRIANGLE":
      return <GamepadIcon svg={psTriangle} label="Triangle" />;
    case "L1":
      return <GamepadIcon svg={psL1} label="L1" className="h-6 w-6" />;
    case "R1":
      return <GamepadIcon svg={psR1} label="R1" className="h-6 w-6" />;
    case "L1_R1":
      return (
        <div className="flex items-center gap-0.5">
          <GamepadIcon svg={psL1} label="L1" className="h-6 w-6" />
          <GamepadIcon svg={psR1} label="R1" className="h-6 w-6" />
        </div>
      );
    case "L2_R2":
      return (
        <div className="flex items-center gap-0.5">
          <GamepadIcon svg={psL2} label="L2" className="h-6 w-6" />
          <GamepadIcon svg={psR2} label="R2" className="h-6 w-6" />
        </div>
      );
    case "OPTIONS":
      return <GamepadIcon svg={psOptions} label="Options" className="h-6 w-6" />;
    case "SHARE":
      return <GamepadIcon svg={psShare} label="Create" className="h-6 w-6" />;
    case "DPAD":
      return <GamepadIcon svg={psDpadHorizontal} label="D-pad" className="h-6 w-6" />;
    case "SCROLL":
      return <GamepadIcon svg={psRightStickVertical} label="Right stick vertical" className="h-6 w-6" />;
    default:
      return null;
  }
};

const getXboxHint = (button: string) => {
  switch (button) {
    case "X":
      return <GamepadIcon svg={xboxA} label="A" />;
    case "O":
      return <GamepadIcon svg={xboxB} label="B" />;
    case "SQUARE":
      return <GamepadIcon svg={xboxX} label="X" />;
    case "TRIANGLE":
      return <GamepadIcon svg={xboxY} label="Y" />;
    case "L1":
      return <GamepadIcon svg={xboxLB} label="LB" className="h-6 w-6" />;
    case "R1":
      return <GamepadIcon svg={xboxRB} label="RB" className="h-6 w-6" />;
    case "L1_R1":
      return (
        <div className="flex items-center gap-0.5">
          <GamepadIcon svg={xboxLB} label="LB" className="h-6 w-6" />
          <GamepadIcon svg={xboxRB} label="RB" className="h-6 w-6" />
        </div>
      );
    case "L2_R2":
      return (
        <div className="flex items-center gap-0.5">
          <GamepadIcon svg={xboxLT} label="LT" className="h-6 w-6" />
          <GamepadIcon svg={xboxRT} label="RT" className="h-6 w-6" />
        </div>
      );
    case "OPTIONS":
      return <GamepadIcon svg={xboxMenu} label="Menu" className="h-6 w-6" />;
    case "SHARE":
      return <GamepadIcon svg={xboxView} label="View" className="h-6 w-6" />;
    case "DPAD":
      return <GamepadIcon svg={xboxDpadHorizontal} label="D-pad" className="h-6 w-6" />;
    case "SCROLL":
      return <GamepadIcon svg={xboxRightStickVertical} label="Right stick vertical" className="h-6 w-6" />;
    default:
      return null;
  }
};

const getGenericHint = (button: string) => {
  const genericMap: Record<string, string> = {
    X: "1",
    O: "2",
    SQUARE: "3",
    TRIANGLE: "4",
    L1: "L1",
    R1: "R1",
    L2: "L2",
    R2: "R2",
    L1_R1: "L1/R1",
    L2_R2: "L2/R2",
    DPAD: "D-Pad",
    SCROLL: "RS",
    SHARE: "Select",
    OPTIONS: "Start",
  };

  return <KeyboardHint>{genericMap[button] ?? button}</KeyboardHint>;
};

const InputHints: React.FC<InputHintProps> = ({ hints }) => {
  const { activeInputType, isGamepadConnected, gamepadFamily } = useGamepad();
  const isGamepad = activeInputType === "gamepad" && isGamepadConnected;

  const renderHint = (button: string) => {
    if (!isGamepad) return getPCHint(button);
    if (gamepadFamily === "xbox") return getXboxHint(button);
    if (gamepadFamily === "playstation") return getPSHint(button);
    return getGenericHint(button);
  };

  return (
    <div className="relative flex h-7 items-center gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={isGamepad ? "gamepad" : "pc"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 flex items-center gap-6 whitespace-nowrap"
        >
          {hints.map((hint, idx) => (
            <div key={`${hint.button}-${idx}`} className="flex items-center gap-2">
              <span style={{ color: "rgba(255,255,255,0.4)" }} className="flex items-center">
                {renderHint(hint.button)}
              </span>
              <span
                className="text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                {hint.label}
              </span>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InputHints;
