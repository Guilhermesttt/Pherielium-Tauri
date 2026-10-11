import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearGameControllerProfile,
  FACTORY_SETTINGS,
  getControllerDriverStatus,
  resolveControllerProfile,
  saveControllerProfile,
  type ControllerDriverStatus,
  type ControllerSettings,
  type ProfileOrigin,
} from "../services/controllerProfile";

/** Espera entre a última mexida e a gravação. */
const SAVE_DEBOUNCE_MS = 400;

export interface UseControllerProfile {
  settings: ControllerSettings;
  /** De onde vem o que está na tela: perfil do jogo, global ou fábrica. */
  origin: ProfileOrigin;
  loading: boolean;
  /** Há uma gravação pendente ou em voo. */
  saving: boolean;
  error: string | null;
  drivers: ControllerDriverStatus | null;
  /** Altera um campo; grava sozinho depois do debounce. */
  update: (patch: Partial<ControllerSettings>) => void;
  /** Troca o perfil inteiro de uma vez (presets). */
  replace: (next: ControllerSettings) => void;
  /** "Usar global": apaga o override deste jogo. */
  resetToGlobal: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Perfil de controle de um jogo (ou o do launcher, sem `gameId`).
 *
 * A precedência jogo > global > fábrica é resolvida no Rust; aqui só mora a
 * mecânica de UI: estado otimista, debounce de gravação e o estado dos drivers
 * que destrava o toggle de emulação.
 */
export function useControllerProfile(
  uid: string | null | undefined,
  gameId?: string,
): UseControllerProfile {
  const [settings, setSettings] = useState<ControllerSettings>(FACTORY_SETTINGS);
  const [origin, setOrigin] = useState<ProfileOrigin>("factory");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<ControllerDriverStatus | null>(null);

  const timerRef = useRef<number | null>(null);
  // O debounce grava o valor mais recente, não o que existia quando o timer
  // começou: sem isto, mexer em dois controles seguidos perde o primeiro.
  const pendingRef = useRef<ControllerSettings | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const resolved = await resolveControllerProfile(uid, gameId);
      if (!aliveRef.current) return;
      setSettings(resolved.settings);
      setOrigin(resolved.origin);
      setError(null);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : "Não foi possível ler o perfil do controle.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [uid, gameId]);

  useEffect(() => {
    // `loading` só é ligado aqui, fora do corpo do efeito síncrono, para não
    // disparar uma cascata de renders antes da primeira leitura.
    let alive = true;
    const run = async () => {
      if (alive) setLoading(true);
      await refresh();
    };
    void run();
    return () => {
      alive = false;
    };
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    void getControllerDriverStatus()
      .then((status) => {
        if (alive) setDrivers(status);
      })
      .catch(() => {
        // Fora do desktop não há driver nenhum: a UI trata `null` como
        // "emulação indisponível" em vez de quebrar.
        if (alive) setDrivers(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const flush = useCallback(async () => {
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next || !uid) {
      setSaving(false);
      return;
    }
    try {
      const resolved = await saveControllerProfile(uid, next, gameId);
      if (!aliveRef.current) return;
      // O Rust devolve o perfil já saneado: adotar a resposta mantém a tela
      // igual ao que ficou gravado, em vez de um valor fora de faixa.
      setSettings(resolved.settings);
      setOrigin(resolved.origin);
      setError(null);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }, [uid, gameId]);

  const schedule = useCallback(
    (next: ControllerSettings) => {
      setSettings(next);
      pendingRef.current = next;
      setSaving(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Sair da tela com gravação pendente não pode perder a alteração.
  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        void flush();
      }
    },
    [flush],
  );

  const update = useCallback(
    (patch: Partial<ControllerSettings>) => {
      schedule({ ...(pendingRef.current ?? settings), ...patch });
    },
    [schedule, settings],
  );

  const replace = useCallback((next: ControllerSettings) => schedule(next), [schedule]);

  const resetToGlobal = useCallback(async () => {
    if (!uid || !gameId) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    setSaving(true);
    try {
      const resolved = await clearGameControllerProfile(uid, gameId);
      if (!aliveRef.current) return;
      setSettings(resolved.settings);
      setOrigin(resolved.origin);
      setError(null);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : "Não foi possível voltar ao perfil global.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }, [uid, gameId]);

  return { settings, origin, loading, saving, error, drivers, update, replace, resetToGlobal, refresh };
}
