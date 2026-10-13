import React from "react";
import { ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { useControllerProfile } from "../../hooks/useControllerProfile";
import { usePadPresence } from "../../hooks/usePadPresence";
import {
  CONTROLLER_PRESETS,
  CURVE_OPTIONS,
  EMULATION_BLOCK_HINT,
  HIDHIDE_RELEASE_URL,
  PRESET_LABELS,
  VIGEM_RELEASE_URL,
  clearGameControllerProfile,
  emulationBlock,
  listGamesWithControllerProfile,
  resetGlobalControllerProfile,
  type PresetName,
} from "../../services/controllerProfile";
import { openExternal } from "../../utils/openExternal";
import ControllerTools from "../controller/ControllerTools";
import { ResponseGraph, Row, Segmented, Slider, Toggle } from "../controller/ControllerProfileFields";
import { GhostSelect } from "../ui/GhostSelect";
import LiveControllerCard from "./LiveControllerCard";
import { SettingsCard as Card } from "./SettingsCard";

const GLOBAL_SCOPE = "__global__";

interface LibraryGame {
  id: string;
  title: string;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

const DriverRow: React.FC<{
  name: string;
  installed: boolean | undefined;
  url: string;
  detail: string;
}> = ({ name, installed, url, detail }) => (
  <Row label={name} hint={detail}>
    <span
      className={`rounded-[var(--radius-badge)] border px-2 py-1 text-[length:var(--fs-label)] ${
        installed
          ? "border-[color:var(--edge-selected)] text-white"
          : "border-[color:var(--edge-subtle)] text-[var(--ink-muted)]"
      }`}
      data-driver={name}
      data-installed={installed ? "true" : "false"}
    >
      {installed === undefined ? "Desconhecido" : installed ? "Instalado" : "Ausente"}
    </span>
    {installed === false && (
      <button
        type="button"
        onClick={() => void openExternal(url)}
        className="inline-flex cursor-pointer items-center gap-1 text-[length:var(--fs-label)] text-[var(--ink)] underline underline-offset-2 hover:text-white"
      >
        Baixar
        <ExternalLink className="h-3 w-3" />
      </button>
    )}
  </Row>
);

export const ControllerSettingsSection: React.FC<{
  uid: string | null | undefined;
  /** Jogo que já abre selecionado (vindo do botão de controle do detalhe). */
  initialGameId?: string;
}> = ({ uid, initialGameId }) => {

  const [scope, setScope] = React.useState<string>(initialGameId ?? GLOBAL_SCOPE);
  const scopeGameId = scope === GLOBAL_SCOPE ? undefined : scope;
  const profile = useControllerProfile(uid, scopeGameId);
  const { settings, origin, update, replace } = profile;

  // O controle do card ao vivo e o das ferramentas é o mesmo: o fixado na lista,
  // ou o primeiro conectado. Este hook só muda quando um controle entra ou sai.
  const [pinnedIndex, setPinnedIndex] = React.useState<number | null>(null);
  const { connected, getPad } = usePadPresence(pinnedIndex);

  const applyDeadzone = React.useCallback(
    (stick: "left" | "right", value: number) =>
      update(stick === "left" ? { deadzoneLeft: value } : { deadzoneRight: value }),
    [update],
  );

  const [games, setGames] = React.useState<LibraryGame[]>([]);
  const [withProfile, setWithProfile] = React.useState<string[]>([]);

  // Jogos da biblioteca, só para dar nome aos perfis por jogo.
  React.useEffect(() => {
    let alive = true;
    const load = window.electronAPI?.listLocalGames;
    if (!uid || !load) return undefined;
    void load(uid)
      .then((list) => {
        if (alive) setGames(list.map((g) => ({ id: g.id, title: g.title })));
      })
      .catch(() => {
        if (alive) setGames([]);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  // Recarrega a lista de perfis quando algo é gravado ou removido.
  React.useEffect(() => {
    let alive = true;
    if (!uid) return undefined;
    void listGamesWithControllerProfile(uid)
      .then((ids) => {
        if (alive) setWithProfile(ids);
      })
      .catch(() => {
        if (alive) setWithProfile([]);
      });
    return () => {
      alive = false;
    };
  }, [uid, profile.saving, origin, scope]);

  const titleOf = React.useCallback(
    (id: string) => games.find((g) => g.id === id)?.title ?? id,
    [games],
  );

  const scopeOptions = React.useMemo(
    () => [
      { value: GLOBAL_SCOPE, label: "Global (todos os jogos)" },
      ...games.map((g) => ({
        value: g.id,
        label: withProfile.includes(g.id) ? `${g.title} • perfil próprio` : g.title,
      })),
    ],
    [games, withProfile],
  );


  const block = emulationBlock(profile.drivers);
  const resetting = scopeGameId === undefined ? "Restaurar padrão" : "Usar perfil global";

  const handleReset = async () => {
    if (!uid) return;
    if (scopeGameId === undefined) {
      await resetGlobalControllerProfile(uid);
      await profile.refresh();
    } else {
      await profile.resetToGlobal();
    }
  };

  const handleDeleteGameProfile = async (id: string) => {
    if (!uid) return;
    await clearGameControllerProfile(uid, id);
    setWithProfile((current) => current.filter((g) => g !== id));
    if (id === scopeGameId) await profile.refresh();
  };

  return (
    <div className="space-y-[var(--space-6)]" data-section="controller-settings">
      {/* Controle ao vivo: isolado, é o único pedaço que muda a cada quadro */}
      <LiveControllerCard
        deadzoneLeft={settings.deadzoneLeft}
        deadzoneRight={settings.deadzoneRight}
        pinnedIndex={pinnedIndex}
        onPin={setPinnedIndex}
      />

      {/* Ferramentas de teste: vibração, drift e circularidade */}
      <Card
        title="Ferramentas de teste"
        hint="Mede o controle sem mexer no perfil. Durante as medições a navegação do launcher fica pausada."
      >
        <ControllerTools
          getPad={getPad}
          connected={connected}
          rumbleIntensity={settings.rumble}
          onApplyDeadzone={applyDeadzone}
        />
      </Card>

      {/* Perfil */}
      <Card
        title="Perfil do controle"
        hint={
          scopeGameId === undefined
            ? "Vale para todos os jogos que não tiverem perfil próprio."
            : origin === "game"
              ? "Este jogo tem perfil próprio."
              : "Este jogo usa o perfil global. Mexer em qualquer ajuste cria um perfil próprio."
        }
        action={
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={scopeGameId !== undefined && origin !== "game"}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-1.5 text-[length:var(--fs-label)] text-[var(--ink-muted)] transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting}
          </button>
        }
      >
        <Row label="Aplicar a" hint="Escolha um jogo para ajustar só ele.">
          <GhostSelect
            value={scope}
            onChange={setScope}
            options={scopeOptions}
            className="w-[260px]"
          />
        </Row>

        <div className="flex flex-wrap gap-[var(--gap-inline)] py-[var(--space-3)]">
          {(Object.keys(CONTROLLER_PRESETS) as PresetName[]).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => replace({ ...CONTROLLER_PRESETS[name] })}
              className="cursor-pointer rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-1.5 text-[length:var(--fs-label)] font-medium text-[var(--ink-muted)] transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white"
            >
              {PRESET_LABELS[name]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-[var(--space-6)]">
          <div className="min-w-[320px] flex-1">
            <Row label="Zona morta — stick esquerdo" hint="Quanto o stick anda antes de valer.">
              <Slider
                label="Zona morta do stick esquerdo"
                value={settings.deadzoneLeft}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => update({ deadzoneLeft: v })}
                format={percent}
              />
            </Row>
            <Row label="Zona morta — stick direito">
              <Slider
                label="Zona morta do stick direito"
                value={settings.deadzoneRight}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => update({ deadzoneRight: v })}
                format={percent}
              />
            </Row>
            <Row label="Curva de resposta" hint="Como o movimento do stick vira velocidade.">
              <Segmented
                label="Curva de resposta"
                value={settings.curve}
                options={CURVE_OPTIONS}
                onChange={(v) => update({ curve: v })}
              />
            </Row>
            <Row label="Sensibilidade">
              <Slider
                label="Sensibilidade"
                value={settings.sensitivity}
                min={0.25}
                max={3}
                step={0.05}
                onChange={(v) => update({ sensitivity: v })}
                format={(v) => `${v.toFixed(2)}×`}
              />
            </Row>
            <Row label="Limiar dos gatilhos" hint="Abaixo disto o gatilho não conta.">
              <Slider
                label="Limiar dos gatilhos"
                value={settings.triggerThreshold}
                min={0}
                max={0.9}
                step={0.01}
                onChange={(v) => update({ triggerThreshold: v })}
                format={percent}
              />
            </Row>
            <Row label="Inverter eixo Y">
              <Toggle label="Inverter eixo Y" checked={settings.invertY} onChange={(v) => update({ invertY: v })} />
            </Row>
            <Row label="Trocar A/B (layout Nintendo)">
              <Toggle label="Trocar A e B" checked={settings.swapAb} onChange={(v) => update({ swapAb: v })} />
            </Row>
            <Row label="Intensidade da vibração">
              <Slider
                label="Intensidade da vibração"
                value={settings.rumble}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => update({ rumble: v })}
                format={percent}
              />
            </Row>
            <Row
              label="Emular Xbox 360"
              hint={block === null ? "O jogo passa a ver um controle Xbox padrão." : EMULATION_BLOCK_HINT[block]}
            >
              <Toggle
                label="Emular Xbox 360"
                checked={settings.emulateXinput && block === null}
                disabled={block !== null}
                onChange={(v) => update({ emulateXinput: v })}
              />
            </Row>
          </div>

          <div className="flex gap-[var(--space-4)]">
            <ResponseGraph settings={settings} kind="stick" title="Stick" />
            <ResponseGraph settings={settings} kind="trigger" title="Gatilho" />
          </div>
        </div>

        <p className="mt-[var(--space-3)] text-[length:var(--fs-label)] text-[var(--ink-faint)]">
          {profile.saving ? "Salvando…" : "Salvo automaticamente"}
        </p>
        {profile.error && (
          <p className="mt-1 text-[length:var(--fs-label)] text-red-400" role="alert">
            {profile.error}
          </p>
        )}
      </Card>

      {/* Drivers */}
      <Card
        title="Drivers de emulação"
        hint="Necessários para o jogo enxergar um controle Xbox 360 sem receber a entrada duplicada."
      >
        <DriverRow
          name="ViGEmBus"
          installed={profile.drivers?.vigem.installed}
          url={VIGEM_RELEASE_URL}
          detail="Cria o controle Xbox 360 virtual."
        />
        <DriverRow
          name="HidHide"
          installed={profile.drivers?.hidHide.installed}
          url={HIDHIDE_RELEASE_URL}
          detail="Esconde o controle físico do jogo para a entrada não duplicar."
        />
      </Card>

      {/* Perfis por jogo */}
      <Card title="Perfis por jogo" hint="Jogos com ajustes próprios, que valem no lugar do perfil global.">
        {withProfile.length === 0 ? (
          <p className="py-[var(--space-3)] text-[length:var(--fs-caption)] text-[var(--ink-faint)]" data-empty="game-profiles">
            Nenhum jogo tem perfil próprio ainda. Escolha um jogo em “Aplicar a” e ajuste.
          </p>
        ) : (
          <ul>
            {withProfile.map((id) => (
              <li key={id}>
                <Row label={titleOf(id)}>
                  <button
                    type="button"
                    onClick={() => setScope(id)}
                    className="cursor-pointer rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] px-3 py-1.5 text-[length:var(--fs-label)] text-[var(--ink-muted)] transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteGameProfile(id)}
                    aria-label={`Excluir o perfil de ${titleOf(id)}`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)] p-1.5 text-[var(--ink-muted)] transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:border-[color:var(--edge-strong)] hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Row>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ControllerSettingsSection;
