import React from "react";
import { MascotView, type MascotViewProps } from "../../mascot/MascotView";

// Humores e persistência vivem em src/mascot/moods.ts (sem dependência de React);
// reexportados aqui para manter os imports existentes (SettingsPage, DesktopNotch).
export {
  MASCOT_MOODS,
  getMascotBaseMood,
  setMascotBaseMood,
  type MascotMood,
} from "../../mascot/moods";
export type { MascotPointer } from "../../mascot/MascotView";

export type PherieMascotProps = MascotViewProps;

/**
 * Pherie — mascote do launcher. Renderizada pelo engine do bloub (src/mascot/engine,
 * MIT) com boca, fone, orelhas e extras próprios. A API é a mesma do mascote SVG
 * antigo; `pointer` (cursor global) substitui o antigo `gaze` e `level`/`levelRef`
 * fazem a boca acompanhar a voz.
 */
export const PherieMascot: React.FC<PherieMascotProps> = (props) => <MascotView {...props} />;
