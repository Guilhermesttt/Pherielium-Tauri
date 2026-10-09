import React from "react";
import { Gamepad2 } from "../../../design-system/sf-symbols/lucideCompat";
import { BRAND_LABEL, type ControllerBrand, type ControllerState } from "../controllerState";
import { BatteryMeter } from "./BatteryMeter";

const LINK_LABEL = { usb: "USB", bluetooth: "Bluetooth", unknown: "" } as const;

/** Selo da marca: símbolos do PlayStation, "X" do Xbox ou um controle genérico. */
const BrandBadge: React.FC<{ brand: ControllerBrand }> = ({ brand }) => {
  if (brand === "playstation") {
    return (
      <span className="flex h-7 items-center gap-[3px] rounded-full bg-[#1f3a8a]/40 px-2 text-[11px] font-bold leading-none" aria-hidden>
        <span className="text-[#7dd3fc]">△</span>
        <span className="text-[#fca5a5]">○</span>
        <span className="text-[#f9a8d4]">□</span>
        <span className="text-[#a5b4fc]">✕</span>
      </span>
    );
  }
  if (brand === "xbox") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#107c10]/35 text-[13px] font-black text-[#7ee07e]" aria-hidden>
        X
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.10] text-white/70" aria-hidden>
      <Gamepad2 size={15} />
    </span>
  );
};

/**
 * Aba "Controle" do notch: a Pherie com o controle (e o fone), o tipo (Xbox, PlayStation ou
 * genérico), se está conectado e a bateria.
 */
export const ControllerTab: React.FC<{ state: ControllerState; mascot: React.ReactNode }> = ({ state, mascot }) => {
  const link = LINK_LABEL[state.link];
  return (
    <section
      className="flex items-center gap-4 overflow-hidden rounded-[20px] border border-white/[0.035] bg-[#141518] p-4"
      style={{
        backgroundImage: `radial-gradient(120% 140% at 20% 120%, rgba(${state.connected ? "48,209,88" : "255,255,255"}, ${state.connected ? 0.22 : 0.05}) 0%, transparent 62%)`,
      }}
      aria-label="Controle"
    >
      <div className="shrink-0">{mascot}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <BrandBadge brand={state.brand} />
          <p className="truncate text-[15px] font-semibold text-white">
            {state.connected ? `Controle ${BRAND_LABEL[state.brand]}` : "Nenhum controle"}
          </p>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/60">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: state.connected ? "#30d158" : "#ef4444" }}
            aria-hidden
          />
          {state.connected ? `Conectado${link ? ` · ${link}` : ""}` : "Desconectado"}
        </p>
        {state.connected && state.name && <p className="mt-0.5 truncate text-[11px] text-white/35">{state.name}</p>}
        {state.connected && (
          <div className="mt-3 flex items-center gap-3">
            {state.battery != null ? (
              <>
                <BatteryMeter level={state.battery} charging={state.charging} approximate={state.approximate} width={110} />
                <span className="text-[11px] text-white/50">{state.charging ? "Carregando" : "Bateria"}</span>
              </>
            ) : (
              <span className="text-[11px] text-white/40">Bateria indisponível</span>
            )}
          </div>
        )}
        {!state.connected && <p className="mt-3 text-[11.5px] leading-snug text-white/40">Conecte um controle por cabo ou Bluetooth.</p>}
      </div>
    </section>
  );
};
