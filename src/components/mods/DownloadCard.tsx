import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  PackageOpen,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { NexusDownloadState } from "../../services/nexus";
import {
  canCancel,
  canPause,
  canResume,
  downloadPhase,
  formatCountdown,
  formatEta,
  formatSpeed,
  isFinished,
  percentOf,
  type DownloadPhase,
} from "../../services/downloadView";
import { formatFileSize } from "../../services/nexusFiles";
import { IconSwap } from "../ui/IconSwap";
import { TextSwap } from "../ui/TextSwap";
import { FreeDownloadSteps } from "./FreeDownloadSteps";

export interface DownloadCardProps {
  download: NexusDownloadState;
  /** Relógio da tela (ms): muda a cada segundo para a contagem e a validade do pedido. */
  now: number;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  /** Abre a página do arquivo na Nexus de novo (pedido que expirou ou foi fechado sem querer). */
  onReopenPage?: (download: NexusDownloadState) => void;
  onOpenFolder: (download: NexusDownloadState) => void;
  onRemove: (id: string) => void;
}

const bytesLabel = (value: number | undefined): string => (value ? formatFileSize(value / 1024) : "0 KB");

const STATUS_TEXT: Record<DownloadPhase, string> = {
  waiting: "Esperando o link da Nexus",
  expired: "O pedido expirou",
  resolving: "Preparando o download",
  downloading: "Baixando",
  paused: "Pausado",
  installing: "Instalando",
  done: "Concluído",
  error: "Falhou",
  cancelled: "Cancelado",
};

const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--node)] bg-[var(--tone-3)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-40";

/**
 * Um download na aba Downloads: o que é, em que fase está e o que dá para fazer agora (pausar,
 * retomar, cancelar). Para a conta grátis, enquanto espera o link, mostra os passos do fluxo.
 */
export const DownloadCard: React.FC<DownloadCardProps> = ({
  download,
  now,
  onPause,
  onResume,
  onCancel,
  onReopenPage,
  onOpenFolder,
  onRemove,
}) => {
  const id = download.id ?? "";
  const phase = downloadPhase(download, now);
  const percent = percentOf(download.receivedBytes, download.totalBytes);
  const speed = formatSpeed(download.speedBps);
  const eta = formatEta(download.receivedBytes, download.totalBytes, download.speedBps);
  const showsBar = phase === "downloading" || phase === "paused";
  const waitingForLink = phase === "waiting" || phase === "expired";

  return (
    <article className="flex flex-col gap-3 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-4" data-phase={phase}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--node)] bg-[var(--tone-3)]">
          {download.pictureUrl ? (
            <img src={download.pictureUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <PackageOpen className="h-5 w-5 text-[var(--ink-faint)]" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
              {download.modName || `Mod #${download.modId}`}
            </h3>
            {download.version && <span className="font-metric shrink-0 text-[length:var(--step-0)] text-[var(--ink-faint)]">v{download.version}</span>}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[length:var(--step-0)] text-[var(--ink-muted)]" aria-live="polite">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
              {phase === "resolving" || phase === "installing" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : phase === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--live)]" aria-hidden />
              ) : phase === "error" || phase === "expired" ? (
                <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
              ) : null}
              <TextSwap text={phase === "done" && download.installed ? "Instalado" : STATUS_TEXT[phase]} />
            </span>
            {phase === "waiting" && <span className="font-metric">expira em {formatCountdown(download.expiresAt, now)}</span>}
            {showsBar && (
              <span className="font-metric">
                {bytesLabel(download.receivedBytes)} de {bytesLabel(download.totalBytes)}
                {phase === "downloading" && speed && ` · ${speed}`}
                {phase === "downloading" && eta && ` · faltam ${eta}`}
              </span>
            )}
            {phase === "error" && (
              <span className="min-w-0 truncate text-[var(--ink-muted)]">{download.error || download.installationError || "Tente de novo."}</span>
            )}
            {phase === "done" && !download.installed && download.installationError && (
              <span className="min-w-0 truncate text-[var(--danger)]">{download.installationError}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {(canPause(phase) || canResume(phase)) && (
            <button
              type="button"
              onClick={() => (canPause(phase) ? onPause(id) : onResume(id))}
              aria-label={canPause(phase) ? "Pausar download" : "Retomar download"}
              title={canPause(phase) ? "Pausar" : "Retomar"}
              className={ICON_BUTTON}
            >
              <IconSwap active={phase === "paused"} a={<Pause className="h-4 w-4" />} b={<Play className="h-4 w-4" />} />
            </button>
          )}
          {canCancel(phase) && (
            <button type="button" onClick={() => onCancel(id)} aria-label="Cancelar download" title="Cancelar" className={ICON_BUTTON}>
              <X className="h-4 w-4" />
            </button>
          )}
          {phase === "expired" && onReopenPage && (
            <button
              type="button"
              onClick={() => onReopenPage(download)}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--node)] bg-[var(--ink)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition-opacity hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Tentar de novo
            </button>
          )}
          {isFinished(phase) && download.filePath && (
            <button type="button" onClick={() => onOpenFolder(download)} aria-label="Abrir a pasta do arquivo" title="Abrir a pasta" className={ICON_BUTTON}>
              <FolderOpen className="h-4 w-4" />
            </button>
          )}
          {(isFinished(phase) || phase === "expired") && (
            <button type="button" onClick={() => onRemove(id)} aria-label="Remover da lista" title="Remover da lista" className={ICON_BUTTON}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showsBar && (
        <div
          role="progressbar"
          aria-label="Progresso do download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tone-4)]"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${phase === "paused" ? "bg-[var(--ink-faint)]" : "bg-[var(--ink)]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {waitingForLink && (
        <div className="rounded-[var(--corner-sm)] bg-[var(--tone-1)] p-4">
          <FreeDownloadSteps phase={phase} />
          {phase === "waiting" && onReopenPage && (
            <button
              type="button"
              onClick={() => onReopenPage(download)}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Abrir a página da Nexus de novo
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default DownloadCard;
