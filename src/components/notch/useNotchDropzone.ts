import { useCallback, useEffect, useRef, useState } from "react";
import {
  distanceToRect,
  dragPositionToCss,
  isDragNearNotch,
  summarizeImport,
  type CursorMotion,
} from "../../mascot/cursorReactions";
import { hasTauriRuntime } from "../../mascot/useVoiceLevel";

export interface NotchDropzone {
  /** arrastando algo (botão pressionado) perto do notch */
  armed: boolean;
  /** o arquivo está sobre a janela do overlay */
  over: boolean;
  importing: boolean;
  /** resultado ("2 imagens salvas...") por alguns segundos */
  message: string | null;
  /** algum estado da dropzone visível: o notch abre o painel "Solte aqui" */
  active: boolean;
}

interface DragPayload {
  paths?: string[];
  position?: { x: number; y: number };
}

interface ImportResult {
  imported: unknown[];
  skipped: number;
}

const RESULT_MS = 2800;

function notchRect(): DOMRect | null {
  return document.querySelector<HTMLElement>("[data-notch-root]")?.getBoundingClientRect() ?? null;
}

/**
 * Dropzone do notch: ao ARRASTAR algo até o topo, o notch abre "Solte aqui" e, ao soltar,
 * as imagens são copiadas para a pasta de capturas (comando Rust `capture_import_files`).
 *
 * O overlay é click-through; o hit-test do OverlayApp captura o cursor quando ele está
 * sobre o retângulo do notch (que cresce ao armar), o que torna a janela um alvo de drop
 * válido. Os eventos `tauri://drag-*` chegam depois disso.
 */
export function useNotchDropzone(opts: {
  enabled: boolean;
  cursor: Pick<CursorMotion, "x" | "y" | "dragging"> & { t: number };
  gameTitle: string | null;
  onImported?: (imported: number) => void;
}): NotchDropzone {
  const { enabled, cursor, gameTitle, onImported } = opts;
  const [armed, setArmed] = useState(false);
  const [over, setOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const live = useRef({ armed, over, gameTitle, onImported, enabled });
  live.current = { armed, over, gameTitle, onImported, enabled };
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // arma/desarma pela posição do cursor com o botão pressionado
  useEffect(() => {
    if (!enabled) {
      setArmed(false);
      return;
    }
    const rect = notchRect();
    if (isDragNearNotch(cursor, rect, window.innerWidth)) setArmed(true);
    else if (!cursor.dragging) setArmed(false);
  }, [cursor, enabled]);

  const finish = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), RESULT_MS);
  }, []);

  // eventos nativos de arrastar/soltar do Tauri
  useEffect(() => {
    if (!enabled || !hasTauriRuntime()) return;
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    void import("@tauri-apps/api/event").then(({ listen }) => {
      const on = (event: string, handler: (p: DragPayload) => void) =>
        listen<DragPayload>(event, (e) => handler(e.payload ?? {})).then((fn) => {
          if (cancelled) fn();
          else unlisteners.push(fn);
        });

      void on("tauri://drag-enter", () => setOver(true));
      void on("tauri://drag-over", () => setOver(true));
      void on("tauri://drag-leave", () => {
        setOver(false);
        setArmed(false);
      });
      void on("tauri://drag-drop", (payload) => {
        const wasOver = live.current.over;
        const wasArmed = live.current.armed;
        setOver(false);
        setArmed(false);
        const paths = (payload.paths ?? []).filter(Boolean);
        if (paths.length === 0) return;

        // só vale se foi solto sobre o notch (ou ele estava armado/sobre)
        let inside = wasOver || wasArmed;
        if (!inside && payload.position) {
          const css = dragPositionToCss(payload.position, window.devicePixelRatio || 1);
          inside = distanceToRect(css.x, css.y, notchRect(), window.innerWidth) <= 80;
        }
        if (!inside) return;

        setImporting(true);
        void import("@tauri-apps/api/core")
          .then(({ invoke }) =>
            invoke<ImportResult>("capture_import_files", { paths, gameTitle: live.current.gameTitle }),
          )
          .then((result) => {
            const imported = result.imported?.length ?? 0;
            finish(summarizeImport(imported, result.skipped ?? 0));
            if (imported > 0) live.current.onImported?.(imported);
          })
          .catch(() => finish("Não foi possível salvar o arquivo"))
          .finally(() => setImporting(false));
      });
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [enabled, finish]);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  return { armed, over, importing, message, active: armed || over || importing || message !== null };
}
