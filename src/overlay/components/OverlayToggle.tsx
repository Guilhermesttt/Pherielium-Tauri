import React, { useState } from "react";

interface OverlayToggleProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  accent?: string;
  label?: string;
}

/** Same Switch look as the hub (`t-toggle`) without PreferencesProvider. */
export const OverlayToggle: React.FC<OverlayToggleProps> = ({
  checked,
  onCheckedChange,
  accent = "#ffffff",
  label,
}) => {
  const [isInit, setIsInit] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? "checked" : "unchecked"}
      data-on={checked ? "true" : "false"}
      onClick={() => {
        setIsInit(true);
        onCheckedChange(!checked);
      }}
      className={`t-toggle peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        isInit ? "is-init" : ""
      } ${checked ? "" : "bg-white/20"}`}
      style={checked ? { backgroundColor: accent } : undefined}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className="t-toggle-thumb pointer-events-none block h-4 w-4 rounded-full shadow-lg data-[state=checked]:bg-black data-[state=unchecked]:bg-white"
      />
    </button>
  );
};
