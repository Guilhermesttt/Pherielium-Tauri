import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FolderOpen,
  HardDrive,
  KeyRound,
  LoaderCircle,
  LogOut,
  PackageOpen,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Game } from "../../types/domain";
import { getAntiCheatInfo } from "../../constants/anticheat-games";
import {
  adoptNexusInstalledMod,
  cancelNexusDownload,
  connectNexusPersonalKey,
  disconnectNexus,
  fetchAuthenticatedNexusCatalog,
  fetchNexusModDetails,
  fetchNexusModFiles,
  fetchNexusTrendingMods,
  getNexusDownloadState,
  getNexusConnection,
  installNexusDownloadedMod,
  listNexusDownloadedFiles,
  listNexusDownloads,
  onNexusDownloadState,
  openNexusDownloadLocation,
  pauseNexusDownload,
  prepareNexusFreeDownload,
  getNexusNxmStatus,
  registerNexusNxm,
  removeNexusInstalledMod,
  resumeNexusDownload,
  validateNexusConnection,
  type NexusConnection,
  type NexusDownloadState,
  type NexusModFile,
  type NexusModSummary,
} from "../../services/nexus";
import { Switch } from "../ui/switch";
import { paginate } from "../../services/pagination";
import { checkModScriptLog } from "../../services/nexus";
import { describeScriptIssues, requirementSearchUrl, type ScriptIssue } from "../../services/scriptLog";
import { DownloadCard } from "./DownloadCard";
import { FreeDownloadSteps } from "./FreeDownloadSteps";
import { downloadPhase, isFinished } from "../../services/downloadView";
import { usePreferences } from "../../context/PreferencesContext";
import { formatFileSize, groupNexusFiles } from "../../services/nexusFiles";
import { useSoundEffects } from "../../hooks/useSoundEffects";

export interface InstalledModEntry {
  id: string;
  name: string;
  author: string;
  pictureUrl: string;
  version: string;
  enabled: boolean;
  status?: "downloaded" | "installed";
  nexusFileId?: string;
  filePath?: string;
  installationError?: string;
  manifestPath?: string;
}

interface ModGameDetailPanelProps {
  game: Game | null;
  isOpen: boolean;
  gameFolder: string;
  gameDomain: string;
  installedMods: InstalledModEntry[];
  onClose: () => void;
  onChooseFolder: () => Promise<void>;
  onSaveDomain: (domain: string) => void;
  onToggleMod: (modId: string, enabled: boolean) => void;
  onRemoveMod: (modId: string) => void;
  onDownloadRecorded: (mod: InstalledModEntry) => void;
}

type PanelTab = "discover" | "installed" | "downloads" | "setup";
type CatalogSort = "featured" | "recent" | "downloads" | "endorsements" | "name";

/** Mods por página no catálogo. */
const CATALOG_PAGE_SIZE = 15;

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const cleanDomain = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);

const getModIdFromPageUrl = (value: string) => {
  try {
    return new URL(value).pathname.match(/\/mods\/([1-9][0-9]*)\/?$/)?.[1] || "";
  } catch {
    return "";
  }
};

const parseNexusModPageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !/^(?:www\.)?nexusmods\.com$/i.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/([a-z0-9-]{2,80})\/mods\/([1-9][0-9]*)\/?$/i);
    return match ? { gameDomain: match[1].toLowerCase(), modId: match[2] } : null;
  } catch {
    return null;
  }
};

const ModGameDetailPanel: React.FC<ModGameDetailPanelProps> = ({
  game,
  isOpen,
  gameFolder,
  gameDomain,
  installedMods,
  onClose,
  onChooseFolder,
  onSaveDomain,
  onToggleMod,
  onRemoveMod,
  onDownloadRecorded,
}) => {
  const { effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );

  const [activeTab, setActiveTab] = React.useState<PanelTab>("discover");
  const [domainDraft, setDomainDraft] = React.useState(gameDomain || "");

  React.useEffect(() => {
    setDomainDraft(gameDomain || "");
  }, [gameDomain, isOpen]);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortMode, setSortMode] = React.useState<CatalogSort>("featured");
  const [catalogPage, setCatalogPage] = React.useState(1);
  const [scriptIssues, setScriptIssues] = React.useState<ScriptIssue[]>([]);

  const gridTopRef = React.useRef<HTMLDivElement>(null);
  const [catalogScope, setCatalogScope] = React.useState<
    "recent-30-days" | "curated-feeds" | "public"
  >("public");
  const [mods, setMods] = React.useState<NexusModSummary[]>([]);
  const [selectedMod, setSelectedMod] = React.useState<NexusModSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [nexusConnection, setNexusConnection] = React.useState<NexusConnection>({
    connected: false,
    encryptionAvailable: true,
  });
  const [connectionLoading, setConnectionLoading] = React.useState(true);
  const [connectionBusy, setConnectionBusy] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState("");
  const [personalKey, setPersonalKey] = React.useState("");
  const [showPersonalKey, setShowPersonalKey] = React.useState(false);
  const [modFiles, setModFiles] = React.useState<NexusModFile[]>([]);
  const [filesLoading, setFilesLoading] = React.useState(false);
  const [filesError, setFilesError] = React.useState("");
  const [urlImportLoading, setUrlImportLoading] = React.useState(false);
  const [urlImportError, setUrlImportError] = React.useState("");
  const [folderActionError, setFolderActionError] = React.useState("");
  const [folderActionBusy, setFolderActionBusy] = React.useState(false);
  const [modActionIds, setModActionIds] = React.useState<Set<string>>(() => new Set());
  const [optimisticModStates, setOptimisticModStates] = React.useState<Record<string, boolean>>({});

  // O jogo compila os scripts dos mods ao abrir; o log desse início diz se algum mod não achou
  // outro de que depende. Lê de novo ao abrir "Meus mods" e quando um mod é ativado ou removido.
  const enabledSignature = installedMods.map((m) => `${m.id}:${optimisticModStates[m.id] ?? m.enabled}`).join("|");
  React.useEffect(() => {
    if (activeTab !== "installed" || !gameFolder) {
      setScriptIssues([]);
      return;
    }
    let cancelled = false;
    checkModScriptLog(gameFolder)
      .then((report) => {
        if (!cancelled) setScriptIssues(describeScriptIssues(report.errors ?? []));
      })
      .catch(() => {
        // jogo sem REDscript ou sem log: não há o que avisar
        if (!cancelled) setScriptIssues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, gameFolder, enabledSignature]);
  const [installedActionError, setInstalledActionError] = React.useState("");
  const [downloadState, setDownloadState] = React.useState<NexusDownloadState | null>(null);
  const [downloadHistory, setDownloadHistory] = React.useState<NexusDownloadState[]>([]);
  const [awaitingFileId, setAwaitingFileId] = React.useState("");
  // null = ainda não sei; o Pherielium só instala sozinho quem usa Premium ou deixa ele abrir links nxm://
  const [nxmRegistered, setNxmRegistered] = React.useState<boolean | null>(null);
  const [nxmBusy, setNxmBusy] = React.useState(false);
  const [downloadedFileIds, setDownloadedFileIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const recordedDownloadsRef = React.useRef(new Set<string>());
  const downloadScanKeyRef = React.useRef("");
  const downloadNoticeTimerRef = React.useRef<number | null>(null);

  const [modConflicts, setModConflicts] = React.useState<Array<{ relativePath: string; mods: Array<{ name: string }> }>>([]);
  const [modProfiles, setModProfiles] = React.useState<Array<{ id: string; name: string; activeInstallIds: string[] }>>([]);
  const [newProfileName, setNewProfileName] = React.useState("");
  const [showProfileSave, setShowProfileSave] = React.useState(false);

  React.useEffect(() => {
    if (!window.electronAPI?.detectModConflicts) return;
    const manifestRoot = installedMods.find((m) => m.manifestPath)?.manifestPath?.split(/[/\\]/).slice(0, -1).join("/") || "";
    if (!manifestRoot) {
      setModConflicts([]);
      return;
    }
    window.electronAPI.detectModConflicts(manifestRoot)
      .then((conflicts) => setModConflicts(Array.isArray(conflicts) ? conflicts : []))
      .catch(() => setModConflicts([]));
  }, [installedMods, optimisticModStates]);

  React.useEffect(() => {
    if (!game?.id || !window.electronAPI?.loadModProfiles) return;
    window.electronAPI.loadModProfiles(game.id)
      .then((profs: any) => setModProfiles(Array.isArray(profs) ? profs : []))
      .catch(() => setModProfiles([]));
  }, [game?.id]);

  const handleSaveModProfile = async () => {
    if (!game?.id || !newProfileName.trim() || !window.electronAPI?.saveModProfile) return;
    const activeIds = installedMods.filter((m) => (optimisticModStates[m.id] ?? m.enabled)).map((m) => m.id);
    try {
      const updated = await window.electronAPI.saveModProfile({
        gameId: game.id,
        profileName: newProfileName.trim(),
        activeInstallIds: activeIds,
      });
      setModProfiles(updated || []);
      setNewProfileName("");
      setShowProfileSave(false);
    } catch {
      // Ignora erro de gravação do perfil
    }
  };

  const handleApplyModProfile = async (profile: { activeInstallIds: string[] }) => {
    const activeSet = new Set(profile.activeInstallIds);
    for (const mod of installedMods) {
      const shouldEnable = activeSet.has(mod.id);
      const currentEnabled = optimisticModStates[mod.id] ?? mod.enabled;
      if (shouldEnable !== currentEnabled) {
        await changeInstalledModState(mod, shouldEnable);
      }
    }
  };

  React.useEffect(() => {
    if (!isOpen || !gameDomain) return;

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoading(true);
      setError("");
      try {
        let items: NexusModSummary[];
        let nextScope: "recent-30-days" | "curated-feeds" | "public" = "public";
        if (nexusConnection.connected) {
          try {
            const catalog = await fetchAuthenticatedNexusCatalog(gameDomain);
            items = catalog.mods;
            nextScope = catalog.scope;
          } catch {
            items = await fetchNexusTrendingMods(gameDomain);
          }
        } else {
          items = await fetchNexusTrendingMods(gameDomain);
        }
        if (cancelled) return;
        setCatalogScope(nextScope);
        setMods(items);
        setCatalogPage(1);
        setSelectedMod((current) =>
          items.find((item) => item.id === current?.id) || items[0] || null);
      } catch (fetchError) {
        if (cancelled) return;
        setMods([]);
        setSelectedMod(null);
        setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar mods.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameDomain, isOpen, nexusConnection.connected]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setConnectionLoading(true);
      setConnectionError("");
      try {
        const localStatus = await getNexusConnection();
        if (cancelled) return;
        if (!localStatus.connected) {
          setNexusConnection(localStatus);
          return;
        }
        const validated = await validateNexusConnection();
        if (!cancelled) setNexusConnection(validated);
      } catch (connectionFailure) {
        if (cancelled) return;
        setConnectionError(
          connectionFailure instanceof Error
            ? connectionFailure.message
            : "Não foi possível verificar a conexão Nexus.",
        );
      } finally {
        if (!cancelled) setConnectionLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (downloadState?.status !== "completed" || !downloadState.id || !selectedMod) return;
    if (recordedDownloadsRef.current.has(downloadState.id)) return;
    const selectedModId = getModIdFromPageUrl(selectedMod.modPageUrl);
    if (
      downloadState.gameDomain !== gameDomain
      || downloadState.modId !== selectedModId
    ) return;
    const downloadedFile = modFiles.find((file) => file.id === downloadState.fileId);
    recordedDownloadsRef.current.add(downloadState.id);
    onDownloadRecorded({
      id: `${downloadState.gameDomain}:${downloadState.modId}`,
      name: downloadState.modName || selectedMod.name,
      author: downloadState.modAuthor || selectedMod.author,
      pictureUrl: downloadState.pictureUrl || selectedMod.pictureUrl,
      version: downloadState.version || downloadedFile?.version || selectedMod.version || "",
      enabled: Boolean(downloadState.installed),
      status: downloadState.installed ? "installed" : "downloaded",
      nexusFileId: downloadState.fileId,
      filePath: downloadState.filePath,
      installationError: downloadState.installationError,
      manifestPath: downloadState.manifestPath,
    });
  }, [downloadState, gameDomain, modFiles, onDownloadRecorded, selectedMod]);

  React.useEffect(() => {
    if (!isOpen || !gameDomain) return;
    const scanKey = `${gameDomain}:${mods.length}`;
    if (downloadScanKeyRef.current === scanKey) return;
    downloadScanKeyRef.current = scanKey;
    let cancelled = false;
    void listNexusDownloadedFiles(gameDomain)
      .then((downloads) => {
        if (cancelled) return;
        downloads.forEach((download) => {
          const catalogMod = mods.find((mod) => mod.id === `${gameDomain}:${download.modId}`);
          onDownloadRecorded({
            id: download.id,
            name: catalogMod?.name
              || download.filename.replace(/\.(?:zip|rar|7z)$/i, ""),
            author: catalogMod?.author || "Nexus Mods",
            pictureUrl: catalogMod?.pictureUrl || "",
            version: catalogMod?.version || "",
            enabled: false,
            status: "downloaded",
            ...(download.fileId ? { nexusFileId: download.fileId } : {}),
            filePath: download.filePath,
          });
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameDomain, isOpen, mods, onDownloadRecorded]);

  React.useEffect(() => {
    if (!isOpen || !window.electronAPI?.onNexusDownloadState) return;
    let cancelled = false;
    const showDownloadNotice = (state: NexusDownloadState) => {
      if (downloadNoticeTimerRef.current) {
        window.clearTimeout(downloadNoticeTimerRef.current);
        downloadNoticeTimerRef.current = null;
      }
      const noticeKey = `${state.id || "download"}:${state.updatedAt}:${state.status}`;
      const isTerminal = state.status === "completed" || state.status === "error" || state.status === "cancelled";
      if (
        isTerminal
        && sessionStorage.getItem("checkpoint_hidden_nexus_download_notice") === noticeKey
      ) return;
      setDownloadState(state);
      // limpa awaiting para qualquer status ativo, não só terminal
      if (state.fileId) setAwaitingFileId((cur) => cur === state.fileId ? "" : cur);
      if (state.status === "cancelled") {
        // cancelado não fica na lista: some junto com o arquivo parcial
        setDownloadHistory((prev) => prev.filter((item) => item.id !== state.id));
        return;
      }
      setDownloadHistory((prev) => {
        const index = prev.findIndex(
          (item) => item.id === state.id || (item.fileId && item.fileId === state.fileId && item.gameDomain === state.gameDomain),
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = state;
          return updated;
        }
        return [state, ...prev];
      });
      if (state.status === "completed" && state.fileId) {
        setDownloadedFileIds((current) => new Set(current).add(state.fileId as string));
      }
      if (state.status === "error" && state.error) {
        setFilesError(state.error);
      }
      if (isTerminal) {
        downloadNoticeTimerRef.current = window.setTimeout(() => {
          sessionStorage.setItem("checkpoint_hidden_nexus_download_notice", noticeKey);
          setDownloadState((current) => current?.updatedAt === state.updatedAt ? null : current);
          downloadNoticeTimerRef.current = null;
        }, 6_000);
      }
    };
    void getNexusDownloadState()
      .then((state) => {
        if (!cancelled && state) showDownloadNotice(state);
      })
      .catch(() => {});
    const unsubscribe = onNexusDownloadState((state) => {
      if (cancelled) return;
      showDownloadNotice(state);
    });
    return () => {
      cancelled = true;
      if (downloadNoticeTimerRef.current) {
        window.clearTimeout(downloadNoticeTimerRef.current);
        downloadNoticeTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [isOpen]);

  const filteredMods = React.useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("pt-BR");
    const matches = query ? mods.filter((mod) =>
      [mod.name, mod.author, mod.summary]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query)) : [...mods];

    const feedPriority = new Map([
      ["Em alta", 0],
      ["Atualizados", 1],
      ["Novos", 2],
      ["Últimos 30 dias", 3],
    ]);
    return matches.sort((left, right) => {
      if (sortMode === "recent") {
        return (right.updatedAt || 0) - (left.updatedAt || 0);
      }
      if (sortMode === "downloads") {
        return (right.downloads || 0) - (left.downloads || 0);
      }
      if (sortMode === "endorsements") {
        return (right.endorsements || 0) - (left.endorsements || 0);
      }
      if (sortMode === "name") {
        return left.name.localeCompare(right.name, "pt-BR");
      }
      return (feedPriority.get(left.feed || "") ?? 4)
        - (feedPriority.get(right.feed || "") ?? 4);
    });
  }, [mods, searchTerm, sortMode]);

  const catalogSlice = paginate(filteredMods, catalogPage, CATALOG_PAGE_SIZE);
  const visibleMods = catalogSlice.items;

  const goToCatalogPage = (page: number) => {
    setCatalogPage(page);
    gridTopRef.current?.scrollIntoView({ block: "start" });
  };
  const pastedModUrl = parseNexusModPageUrl(searchTerm);

  const openModPage = (mod: NexusModSummary) => {
    if (window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(mod.modPageUrl);
    } else {
      window.open(mod.modPageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const openNexusApiKeys = () => {
    const url = "https://www.nexusmods.com/settings/api-keys";
    if (window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const openDownloadedModsFolder = async () => {
    setFolderActionError("");
    setFolderActionBusy(true);
    try {
      await openNexusDownloadLocation(gameDomain || undefined);
    } catch (folderError) {
      setFolderActionError(
        folderError instanceof Error
          ? folderError.message
          : "Não foi possível abrir a pasta dos mods baixados.",
      );
    } finally {
      setFolderActionBusy(false);
    }
  };

  const getInstalledModId = (mod: InstalledModEntry) =>
    mod.id.match(/:([1-9][0-9]*)$/)?.[1] || "";

  const adoptExistingMod = async (mod: InstalledModEntry, modId: string) => {
    if (!gameFolder || !mod.filePath) {
      throw new Error("Selecione a pasta do jogo antes de vincular.");
    }
    // Suporta zips/rar/7z via staging pipeline
    if (!/\.(zip|rar|7z|tar|gz)$/i.test(mod.filePath)) {
      throw new Error("Este formato não pode ser vinculado automaticamente. Remova-o manualmente.");
    }
    const adoption = await adoptNexusInstalledMod({
      gameDomain,
      modId,
      fileId: mod.nexusFileId || modId,
      filePath: mod.filePath,
      gameFolder,
      modName: mod.name,
    });
    return adoption.manifestPath;
  };

  const changeInstalledModState = async (mod: InstalledModEntry, enabled: boolean) => {
    if (modActionIds.has(mod.id)) return;
    setInstalledActionError("");
    const modId = getInstalledModId(mod);
    if (!modId) {
      setInstalledActionError("Não foi possível identificar este mod.");
      return;
    }
    if (enabled && !mod.filePath) {
      setInstalledActionError("Arquivo do mod não encontrado. Baixe novamente.");
      return;
    }
    if (enabled && !gameFolder) {
      setInstalledActionError("Configure primeiro a pasta raiz do jogo em Configurar.");
      return;
    }
    // verify file still exists (user may have deleted download folder)
    if (enabled && mod.filePath) {
      try {
        // Check via download listing will be done in main; just ensure extension valid
        if (!/\.(zip|rar|7z|tar|gz)$/i.test(mod.filePath)) {
          setInstalledActionError(`Formato não suportado: ${mod.filePath.split(".").pop()}`);
          return;
        }
      } catch {}
    }
    setOptimisticModStates((current) => ({ ...current, [mod.id]: enabled }));
    setModActionIds((current) => new Set(current).add(mod.id));
    try {
      if (enabled) {
        const result = await installNexusDownloadedMod({
          gameDomain,
          modId,
          fileId: mod.nexusFileId || modId,
          filePath: mod.filePath || "",
          gameFolder,
          modName: mod.name,
        });
        onDownloadRecorded({
          ...mod,
          enabled: true,
          status: "installed",
          manifestPath: result.manifestPath,
          installationError: "",
        });
        setInstalledActionError("");
      } else {
        // Desativar: prefere manifest salvo; se não existe tenta adotar ou só desliga
        let manifestPath = mod.manifestPath;
        if (!manifestPath && mod.filePath) {
          try {
            manifestPath = await adoptExistingMod(mod, modId);
          } catch (adoptErr) {
            // Se não conseguiu adotar (já desinstalado manualmente), apenas desativa localmente
            console.warn("[mods] adopt failing on disable, falling back to local toggle:", adoptErr);
          }
        }
        if (manifestPath) {
          await removeNexusInstalledMod({
            manifestPath,
            filePath: mod.filePath,
            removeArchive: false,
          });
        }
        onToggleMod(mod.id, false);
      }
    } catch (actionError) {
      setInstalledActionError(
        actionError instanceof Error ? actionError.message : "A operação com o mod falhou.",
      );
    } finally {
      setOptimisticModStates((current) => {
        const next = { ...current };
        delete next[mod.id];
        return next;
      });
      setModActionIds((current) => {
        const next = new Set(current);
        next.delete(mod.id);
        return next;
      });
    }
  };

  const removeInstalledMod = async (mod: InstalledModEntry) => {
    if (modActionIds.has(mod.id)) return;
    setInstalledActionError("");
    if (!window.confirm(`Remover ${mod.name} do jogo e apagar o arquivo baixado?`)) return;
    if (!mod.manifestPath && !mod.filePath) {
      setInstalledActionError("Nenhum arquivo gerenciado foi encontrado para este mod.");
      return;
    }

    setModActionIds((current) => new Set(current).add(mod.id));
    try {
      const modId = getInstalledModId(mod);
      const manifestPath = mod.enabled && !mod.manifestPath
        ? await adoptExistingMod(mod, modId)
        : mod.manifestPath;
      await removeNexusInstalledMod({
        manifestPath,
        filePath: mod.filePath,
        removeArchive: true,
      });
      onRemoveMod(mod.id);
    } catch (actionError) {
      setInstalledActionError(
        actionError instanceof Error ? actionError.message : "Não foi possível remover o mod.",
      );
    } finally {
      setModActionIds((current) => {
        const next = new Set(current);
        next.delete(mod.id);
        return next;
      });
    }
  };

  // Relógio de 1 s só enquanto há download não terminado: a contagem do pedido que espera o link
  // e a validade dele dependem disso.
  const [now, setNow] = React.useState(() => Date.now());
  const hasLiveDownload = downloadHistory.some((item) => !isFinished(downloadPhase(item, now)));
  React.useEffect(() => {
    if (!hasLiveDownload) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasLiveDownload]);

  // Ao abrir: recupera o que ainda está em andamento (esperando o link, baixando ou pausado)
  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void listNexusDownloads()
      .then((active) => {
        if (cancelled || active.length === 0) return;
        setDownloadHistory((prev) => [...active.filter((item) => !prev.some((known) => known.id === item.id)), ...prev]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const reportDownloadAction = (error: unknown, fallback: string) => {
    setFilesError(error instanceof Error ? error.message : fallback);
  };

  const handlePauseDownload = (id: string) => {
    playSound("select");
    void pauseNexusDownload(id).catch((error) => reportDownloadAction(error, "Não foi possível pausar o download."));
  };

  const handleResumeDownload = (id: string) => {
    playSound("select");
    void resumeNexusDownload(id).catch((error) => reportDownloadAction(error, "Não foi possível retomar o download."));
  };

  const handleCancelDownload = (id: string) => {
    playSound("back");
    const target = downloadHistory.find((item) => item.id === id);
    if (target?.fileId) setAwaitingFileId((current) => (current === target.fileId ? "" : current));
    void cancelNexusDownload(id).catch((error) => reportDownloadAction(error, "Não foi possível cancelar o download."));
  };

  /** Abre a página do arquivo na Nexus. Pedido que expirou é preparado de novo antes (o Rust o esqueceu). */
  const handleReopenDownloadPage = async (download: NexusDownloadState) => {
    if (!download.gameDomain || !download.modId || !download.fileId) return;
    const expired = downloadPhase(download, Date.now()) === "expired";
    try {
      if (expired) {
        if (download.id) setDownloadHistory((prev) => prev.filter((item) => item.id !== download.id));
        await prepareNexusFreeDownload({
          gameDomain: download.gameDomain,
          modId: download.modId,
          fileId: download.fileId,
          gameFolder: gameFolder || "",
          modName: download.modName ?? "",
          modAuthor: download.modAuthor ?? "",
          pictureUrl: download.pictureUrl ?? "",
          version: download.version ?? "",
        });
      }
      const pageUrl = `https://www.nexusmods.com/${download.gameDomain}/mods/${download.modId}?tab=files&file_id=${download.fileId}&nmm=1`;
      if (window.electronAPI?.openExternalUrl) await window.electronAPI.openExternalUrl(pageUrl);
      else window.open(pageUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      reportDownloadAction(error, "Não foi possível abrir a página da Nexus.");
    }
  };

  const handleClearCompletedDownloads = () => {
    playSound("select");
    setDownloadHistory((prev) => prev.filter((item) => item.status !== "completed"));
  };

  const handleRemoveDownloadCard = (id: string) => {
    playSound("select");
    setDownloadHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const selectMod = (mod: NexusModSummary) => {
    setSelectedMod(mod);
    setModFiles([]);
    setFilesError("");
  };

  const connectPersonalKey = async () => {
    setConnectionBusy(true);
    setConnectionError("");
    try {
      const connection = await connectNexusPersonalKey(personalKey);
      setNexusConnection(connection);
      setPersonalKey("");
      setShowPersonalKey(false);
    } catch (connectionFailure) {
      setConnectionError(
        connectionFailure instanceof Error
          ? connectionFailure.message
          : "A Nexus recusou esta chave.",
      );
    } finally {
      setConnectionBusy(false);
    }
  };

  const removeNexusConnection = async () => {
    setConnectionBusy(true);
    setConnectionError("");
    try {
      setNexusConnection(await disconnectNexus());
      setModFiles([]);
    } catch (connectionFailure) {
      setConnectionError(
        connectionFailure instanceof Error
          ? connectionFailure.message
          : "Não foi possível remover a chave Nexus.",
      );
    } finally {
      setConnectionBusy(false);
    }
  };

  const loadSelectedModFiles = async () => {
    if (!selectedMod) return;
    const modId = getModIdFromPageUrl(selectedMod.modPageUrl);
    if (!modId) {
      setFilesError("O identificador deste mod não pôde ser reconhecido.");
      return;
    }
    setFilesLoading(true);
    setFilesError("");
    try {
      const result = await fetchNexusModFiles(gameDomain, modId);
      setModFiles(result.files);
      if (result.files.length === 0) {
        setFilesError("A Nexus não retornou arquivos disponíveis para este mod.");
      }
    } catch (fileFailure) {
      setFilesError(
        fileFailure instanceof Error
          ? fileFailure.message
          : "Não foi possível carregar os arquivos deste mod.",
      );
    } finally {
      setFilesLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getNexusNxmStatus()
      .then((status) => {
        if (!cancelled) setNxmRegistered(status.registered);
      })
      .catch(() => {
        if (!cancelled) setNxmRegistered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const enableNxm = async () => {
    setNxmBusy(true);
    try {
      const status = await registerNexusNxm();
      setNxmRegistered(status.registered);
      setFilesError("");
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : "Não foi possível ativar a instalação automática.");
    } finally {
      setNxmBusy(false);
    }
  };

  // Instalar pega o arquivo principal mais recente; opcionais e versões antigas ficam recolhidos
  const fileGroups = React.useMemo(() => groupNexusFiles(modFiles), [modFiles]);

  const renderFileCard = (file: NexusModFile, emphasized: boolean) => {
    if (!selectedMod) return null;
    const downloadedEntry = installedMods.find((mod) =>
      mod.id === `${gameDomain}:${getModIdFromPageUrl(selectedMod.modPageUrl)}`
      && mod.nexusFileId === file.id);
    const isDownloaded = downloadedFileIds.has(file.id) || Boolean(downloadedEntry);
    const isInstalled = downloadedEntry?.status === "installed";
    // O estado do botão vem do download desse arquivo (esperando o link, baixando, pausado); a flag
    // local só cobre o instante entre o clique e o primeiro estado do Rust.
    const activeDownload = downloadHistory.find(
      (item) => item.fileId === file.id && item.gameDomain === gameDomain && !isFinished(downloadPhase(item, now)),
    );
    const activePhase = activeDownload ? downloadPhase(activeDownload, now) : null;
    const waiting = awaitingFileId === file.id || activeDownload !== undefined;
    const size = formatFileSize(file.sizeKb);
    return (
      <div
        key={file.id}
        className={`rounded-[var(--corner-md)] bg-[var(--tone-2)] ${emphasized ? "p-4" : "p-3"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`truncate font-semibold text-[var(--ink)] ${emphasized ? "text-[length:var(--step-2)]" : "text-[length:var(--step-1)]"}`}>
              {file.name}
            </p>
            <p className="mt-1 text-[length:var(--step-0)] text-[var(--ink-muted)]">
              <span className="font-metric">{file.version || "Sem versão"}</span>
              {size && <> · <span className="font-metric">{size}</span></>}
              {emphasized && <> · Versão mais recente</>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("select");
              void requestFreeNexusDownload(file);
            }}
            disabled={waiting || isDownloaded}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-[var(--node)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] disabled:cursor-default ${
              emphasized ? "h-11 px-5 text-[length:var(--step-1)]" : "h-9 px-4 text-[length:var(--step-0)]"
            } ${
              isDownloaded
                ? "bg-[var(--tone-3)] text-[var(--live)]"
                : "bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90 disabled:opacity-40"
            }`}
          >
            {waiting
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : isDownloaded
                ? <CheckCircle2 className="h-4 w-4" />
                : <Download className="h-4 w-4" />}
            {isInstalled
              ? "Instalado"
              : isDownloaded
                ? "Baixado"
                : activePhase === "downloading" || activePhase === "resolving"
                  ? "Baixando"
                  : activePhase === "paused"
                    ? "Pausado"
                    : waiting
                      ? "Aguardando"
                      : "Instalar"}
          </button>
        </div>
        {emphasized && (activePhase === "waiting" || (waiting && !activeDownload)) && (
          <div className="mt-3 rounded-[var(--corner-sm)] bg-[var(--tone-1)] p-3">
            <FreeDownloadSteps phase="waiting" />
          </div>
        )}
      </div>
    );
  };

  const requestFreeNexusDownload = async (file: NexusModFile) => {
    if (!selectedMod) return;
    const modId = getModIdFromPageUrl(selectedMod.modPageUrl);
    if (!modId) {
      setFilesError("O identificador deste mod não pôde ser reconhecido.");
      return;
    }
    // gameFolder é opcional para download; se não houver, baixa sem auto-install
    const effectiveFolder = gameFolder || "";
    if (!nexusConnection.connected) {
      setFilesError("Conecte sua conta Nexus em Configurar antes de baixar.");
      return;
    }
    // Conta grátis: a Nexus só entrega o link pelo "Download lento", que volta como nxm://.
    // Sem o Pherielium registrado para esse protocolo, o link iria para outro programa.
    if (!nexusConnection.account?.isPremium && nxmRegistered === false) {
      setFilesError("Ative a instalação automática abaixo para o Pherielium receber o download da Nexus.");
      return;
    }
    let prepared: { prepared: boolean; autoInstall: boolean; expiresAt: number; direct?: boolean };
    try {
      prepared = await prepareNexusFreeDownload({
        gameDomain,
        modId,
        fileId: file.id,
        gameFolder: effectiveFolder,
        modName: selectedMod.name,
        modAuthor: selectedMod.author,
        pictureUrl: selectedMod.pictureUrl,
        version: file.version || selectedMod.version || "",
      });
    } catch (prepareError) {
      const msg = prepareError instanceof Error ? prepareError.message : "Não foi possível preparar o download.";
      // Improve message for missing premium / key issues
      if (msg.toLowerCase().includes("chave")) {
        setFilesError(`${msg} Vá em Configurar → Conectar chave Nexus.`);
      } else {
        setFilesError(msg);
      }
      return;
    }
    // Premium: o download já começou, sem abrir a página da Nexus
    if (prepared.direct) {
      setAwaitingFileId("");
      setFilesError(effectiveFolder ? "" : "Pasta do jogo não configurada: o mod será baixado, mas não instalado. Configure a pasta para instalar sozinho.");
      return;
    }
    const pageUrl = new URL(selectedMod.modPageUrl);
    pageUrl.searchParams.set("tab", "files");
    pageUrl.searchParams.set("file_id", file.id);
    pageUrl.searchParams.set("nmm", "1");
    setAwaitingFileId(file.id);
    setFilesError("");
    if (!effectiveFolder) {
      setFilesError("Pasta do jogo não configurada: o download será feito sem instalação automática. Configure em Configurar para instalar com 1 clique.");
      // clear warning after 6s
      setTimeout(() => setFilesError(""), 6000);
    }
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(pageUrl.toString());
    } else {
      window.open(pageUrl.toString(), "_blank", "noopener,noreferrer");
    }
    // Quem usa conta grátis leva um tempo para clicar em "Download lento": espera até o pedido expirar (15 min)
    setTimeout(() => setAwaitingFileId((cur) => cur === file.id ? "" : cur), 15 * 60 * 1000);
  };

  const importModFromUrl = async () => {
    if (!pastedModUrl) return;
    if (!nexusConnection.connected) {
      setUrlImportError("Conecte sua conta Nexus antes de adicionar um mod pela URL.");
      return;
    }
    if (pastedModUrl.gameDomain !== gameDomain) {
      setUrlImportError(`Esta URL pertence a ${pastedModUrl.gameDomain}, não ao jogo aberto.`);
      return;
    }
    setUrlImportLoading(true);
    setUrlImportError("");
    try {
      const importedMod = await fetchNexusModDetails(
        pastedModUrl.gameDomain,
        pastedModUrl.modId,
      );
      setMods((current) => [
        importedMod,
        ...current.filter((mod) => mod.id !== importedMod.id),
      ]);
      setSelectedMod(importedMod);
      setModFiles([]);
      setFilesError("");
      setSearchTerm("");
      setCatalogPage(1);
    } catch (importError) {
      setUrlImportError(importError instanceof Error
        ? importError.message
        : "Não foi possível adicionar este mod pela URL.");
    } finally {
      setUrlImportLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("back");
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, playSound]);

  if (!game || typeof document === "undefined") return null;
  const heroImage = selectedMod?.pictureUrl || game.backgroundImage || game.image || game.cardImage;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] w-screen h-screen overflow-hidden bg-black/60 backdrop-blur-[32px]"
        >
          <motion.div
            key={heroImage}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55 }}
            className="absolute inset-0"
          >
            {heroImage && (
              <img src={heroImage} alt="" className="h-full w-full object-cover opacity-35" />
            )}
            <div className="absolute inset-0 bg-linear-to-r from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
          </motion.div>

          <div className="relative z-10 flex h-full min-w-0 flex-col p-4 sm:p-5 lg:p-7">
            <header className="mb-4 flex shrink-0 flex-col gap-4 xl:mb-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    playSound("back");
                    onClose();
                  }}
                  aria-label="Voltar para os jogos"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] text-[var(--ink-muted)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-display font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">{game.title}</h1>
                </div>
              </div>

              <div className="flex w-full shrink-0 items-center gap-1 overflow-x-auto rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] p-1.5 backdrop-blur-xl thin-scrollbar xl:w-auto xl:gap-2">
                {([
                  ["discover", "Descobrir", Sparkles],
                  ["installed", `Meus mods ${installedMods.length ? `(${installedMods.length})` : ""}`, PackageOpen],
                  ["downloads", `Downloads ${downloadHistory.length ? `(${downloadHistory.length})` : ""}`, Download],
                  ["setup", "Configurar", Settings2],
                ] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      playSound("navigate");
                      setActiveTab(id);
                    }}
                    className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-[var(--corner-sm)] px-3 py-2.5 text-[length:var(--step-0)] font-semibold transition sm:px-4 sm:text-[length:var(--step-0)] xl:flex-none ${
                      activeTab === id
                        ? "bg-[var(--tone-4)] text-[var(--ink)] shadow-lg"
                        : "text-[var(--ink-faint)] hover:bg-[var(--tone-3)] hover:text-[var(--ink-muted)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--corner-lg)] border border-[color:var(--border-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_100px_rgba(0,0,0,0.55)] flex flex-col transform-gpu"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                contain: "layout paint"
              }}>
              <AnimatePresence mode="wait">
                {activeTab === "discover" && (
                  <motion.div
                    key="discover"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-1 min-h-0 overflow-hidden flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_clamp(320px,25vw,390px)]"
                  >
                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[color:var(--border-subtle)] p-4 sm:p-5 xl:border-b-0 xl:border-r xl:p-6">
                      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
                        <div className="relative min-w-60 flex-1">
                          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
                          <input aria-label="Pesquisar mod ou colar a URL de um mod"
                            value={searchTerm}
                            onChange={(event) => {
                              setSearchTerm(event.target.value);
                              setUrlImportError("");
                              setCatalogPage(1);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && pastedModUrl) {
                                event.preventDefault();
                                void importModFromUrl();
                              }
                            }}
                            placeholder="Pesquisar ou colar a URL de um mod"
                            className="h-12 w-full rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] pl-11 pr-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[color:var(--border-subtle)]"
                          />
                        </div>
                        {pastedModUrl && (
                          <button
                            type="button"
                            onClick={() => void importModFromUrl()}
                            disabled={urlImportLoading}
                            className="flex h-12 items-center justify-center gap-2 rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)] disabled:opacity-40"
                          >
                            {urlImportLoading
                              ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              : <ExternalLink className="h-3.5 w-3.5" />}
                            Adicionar URL
                          </button>
                        )}
                        <select
                          value={sortMode}
                          onChange={(event) => {
                            setSortMode(event.target.value as CatalogSort);
                            setCatalogPage(1);
                          }}
                          aria-label="Ordenar catálogo"
                          className="h-12 rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-1)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] outline-none focus:border-[color:var(--border-subtle)]"
                        >
                          <option value="featured">Destaques</option>
                          <option value="recent">Mais recentes</option>
                          <option value="downloads">Mais baixados</option>
                          <option value="endorsements">Mais apoiados</option>
                          <option value="name">Nome A–Z</option>
                        </select>
                        <span className="rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-3 text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
                          {loading
                            ? "Carregando"
                            : searchTerm.trim()
                              ? `${filteredMods.length} de ${mods.length}`
                              : `${mods.length} mods`}
                        </span>
                      </div>
                      {!loading && mods.length > 0 && (
                        <p className="mb-4 shrink-0 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)] xl:mb-5">
                          {catalogScope === "recent-30-days"
                            ? "Catálogo recente: destaques e mods com atividade nos últimos 30 dias. O arquivo histórico completo exige acesso de aplicativo aprovado pela Nexus."
                            : catalogScope === "curated-feeds"
                              ? "Mostrando os mods em alta, atualizados e novos da Nexus. Para achar outro, cole o link dele na busca."
                              : "Prévia pública limitada aos mods em alta. Conecte sua conta Nexus para ampliar o catálogo."}
                        </p>
                      )}
                      {urlImportError && (
                        <p className="mb-4 shrink-0 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] text-[var(--danger)]">
                          {urlImportError}
                        </p>
                      )}

                      <div className="min-h-0 flex-1 overflow-y-auto xl:pr-2 thin-scrollbar">
                        {!gameDomain ? (
                          <EmptyCatalog
                            title="Vincule este jogo à Nexus"
                            description="Abra Configurar e informe o domínio presente na URL do jogo na Nexus Mods."
                            onAction={() => setActiveTab("setup")}
                          />
                        ) : loading ? (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <div key={index} className="h-56 animate-pulse rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)]" />
                            ))}
                          </div>
                        ) : error ? (
                          <EmptyCatalog title="Não foi possível carregar" description={error} onAction={() => setActiveTab("setup")} />
                        ) : filteredMods.length === 0 ? (
                          <EmptyCatalog
                            title={mods.length ? "Nenhum resultado" : "Nenhum mod em alta encontrado"}
                            description={mods.length ? "Tente outro termo." : "Confira o domínio configurado para este jogo."}
                            onAction={() => setActiveTab("setup")}
                          />
                        ) : (
                          <div className="pb-4" ref={gridTopRef}>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                            {visibleMods.map((mod) => (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => {
                                  playSound("select");
                                  selectMod(mod);
                                }}
                                className={`group overflow-hidden rounded-[var(--corner-md)] border text-left transition ${
                                  selectedMod?.id === mod.id
                                    ? "border-[color:var(--border-strong)] bg-[var(--tone-4)] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                                    : "border-[color:var(--border-subtle)] bg-[var(--tone-2)] hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-[var(--tone-3)]"
                                }`}
                              >
                                <div className="relative h-32 overflow-hidden bg-[var(--tone-3)]">
                                  {mod.pictureUrl ? (
                                    <img
                                      src={mod.pictureUrl}
                                      alt=""
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <PackageOpen className="h-7 w-7 text-[var(--ink-faint)]" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                                  <span className="absolute bottom-2 left-2 rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                                    {mod.feed || "Nexus"}
                                  </span>
                                  {installedMods.find((entry) => entry.id === mod.id) && (
                                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-[10px] border border-[color:color-mix(in_srgb,var(--live)_35%,transparent)] bg-[var(--tone-3)] px-2 py-1 text-[length:var(--step-0)] font-semibold text-[var(--live)]">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {installedMods.find((entry) => entry.id === mod.id)?.status === "installed"
                                        ? "Instalado"
                                        : "Baixado"}
                                    </span>
                                  )}
                                </div>
                                <div className="p-3.5">
                                  <h3 className="line-clamp-1 text-sm font-semibold text-[var(--ink)]">{mod.name}</h3>
                                  <p className="mt-1 line-clamp-2 min-h-8 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)]">
                                    {mod.summary || "Sem descrição."}
                                  </p>
                                  {mod.author && (
                                    <p className="mt-2 flex items-center gap-1 text-[length:var(--step-0)] font-bold text-[var(--ink-faint)]">
                                      <UserRound className="h-3 w-3" /> Por {mod.author}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))}
                            </div>
                            {catalogSlice.pageCount > 1 && (
                              <nav aria-label="Páginas do catálogo" className="mt-5 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    playSound("select");
                                    goToCatalogPage(catalogSlice.page - 1);
                                  }}
                                  disabled={catalogSlice.page <= 1}
                                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-[var(--tone-3)] disabled:hover:text-[var(--ink-muted)]"
                                >
                                  <ChevronLeft className="h-4 w-4" aria-hidden />
                                  Anterior
                                </button>
                                <p className="font-metric text-[length:var(--step-0)] text-[var(--ink-muted)]" aria-live="polite">
                                  {catalogSlice.from}–{catalogSlice.to} de {filteredMods.length} · página {catalogSlice.page} de {catalogSlice.pageCount}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playSound("select");
                                    goToCatalogPage(catalogSlice.page + 1);
                                  }}
                                  disabled={catalogSlice.page >= catalogSlice.pageCount}
                                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-[var(--tone-3)] disabled:hover:text-[var(--ink-muted)]"
                                >
                                  Próxima
                                  <ChevronRight className="h-4 w-4" aria-hidden />
                                </button>
                              </nav>
                            )}
                          </div>
                        )}
                      </div>
                    </section>

                    <aside className="min-h-0 flex-1 xl:flex-1 overflow-y-auto p-4 sm:p-5 xl:p-6 thin-scrollbar border-t border-[color:var(--border-subtle)] xl:border-t-0">
                      {selectedMod ? (
                        <motion.div key={selectedMod.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="mb-5 overflow-hidden rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)]">
                            {selectedMod.pictureUrl ? (
                              <img src={selectedMod.pictureUrl} alt="" className="h-48 w-full object-cover" />
                            ) : (
                              <div className="flex h-48 items-center justify-center">
                                <PackageOpen className="h-8 w-8 text-[var(--ink-faint)]" />
                              </div>
                            )}
                          </div>
                          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[var(--ink)]">{selectedMod.name}</h2>
                          {selectedMod.author && (
                            <p className="mt-2 flex items-center gap-1.5 text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
                              <UserRound className="h-3.5 w-3.5" />
                              Por {selectedMod.author}
                            </p>
                          )}
                          <p className="mt-5 text-sm leading-relaxed text-[var(--ink-muted)]">
                            {selectedMod.summary || "Este mod não possui uma descrição curta."}
                          </p>

                          <div className={`mt-6 rounded-[var(--corner-md)] border p-4 ${
                            nexusConnection.connected
                              ? "border-[color:color-mix(in_srgb,var(--live)_35%,transparent)] bg-[var(--tone-3)]"
                              : "border-[color:color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[var(--tone-3)]"
                          }`}>
                            <div className={`flex items-center gap-2 text-[length:var(--step-0)] font-bold ${
                              nexusConnection.connected ? "text-[var(--live)]" : "text-[var(--warn)]"
                            }`}>
                              <ShieldCheck className={`h-4 w-4 ${
                                nexusConnection.connected ? "text-[var(--live)]" : "text-[var(--warn)]"
                              }`} />
                              {nexusConnection.connected
                                ? `Conectado como ${nexusConnection.account?.name || "usuário Nexus"}`
                                : "Conexão Nexus necessária"}
                            </div>
                            <p className={`mt-2 text-[length:var(--step-0)] leading-relaxed ${
                              nexusConnection.connected ? "text-[var(--live)]" : "text-[var(--warn)]"
                            }`}>
                              {nexusConnection.connected
                                ? "A build de avaliação já pode consultar os arquivos deste mod usando a chave armazenada localmente."
                                : "Abra Configurar para conectar uma chave pessoal durante o desenvolvimento."}
                            </p>
                          </div>

                          <div className="mt-5 space-y-2">
                            <button
                              type="button"
                              onClick={() => void loadSelectedModFiles()}
                              disabled={!nexusConnection.connected || filesLoading}
                              className="flex w-full items-center justify-center gap-2 rounded-[var(--corner-sm)] bg-[var(--ink)] px-3 py-3 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--tone-4)] disabled:text-[var(--ink-faint)]"
                            >
                              {filesLoading
                                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                              Listar arquivos no Phelierium
                            </button>
                            <button
                              type="button"
                              onClick={() => openModPage(selectedMod)}
                              className="flex w-full items-center justify-center gap-2 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-2.5 text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir página na Nexus
                            </button>
                          </div>

                          {awaitingFileId && (
                            <div className="mt-3 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-3">
                              <p className="text-[length:var(--step-0)] font-bold text-[var(--ink)]">
                                Escolha o download gratuito na Nexus
                              </p>
                              <p className="mt-1 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-muted)]">
                                Na tela aberta, clique em Slow download. Após a contagem, permita que o navegador abra o Phelierium pelo link NXM.
                              </p>
                            </div>
                          )}

                          {downloadState
                            && (!downloadState.gameDomain || downloadState.gameDomain === gameDomain) && (
                            <div className={`mt-3 rounded-[var(--corner-sm)] border px-3 py-3 ${
                              downloadState.status === "error"
                                ? "border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)]"
                                : downloadState.status === "completed"
                                  ? "border-[color:color-mix(in_srgb,var(--live)_35%,transparent)] bg-[var(--tone-3)]"
                                  : "border-[color:var(--border-subtle)] bg-[var(--tone-3)]"
                            }`}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                                  {downloadState.status === "resolving"
                                    ? "Validando autorização da Nexus"
                                    : downloadState.status === "downloading"
                                      ? `Baixando ${downloadState.filename || "arquivo"}`
                                      : downloadState.status === "installing"
                                        ? `Instalando ${downloadState.filename || "mod"}`
                                      : downloadState.status === "completed"
                                        ? downloadState.installed
                                          ? `Mod instalado (${downloadState.installedFiles || 0} arquivos)`
                                          : `Download concluído: ${downloadState.filename || "arquivo"}`
                                        : "Falha no download"}
                                </p>
                                {(downloadState.status === "resolving"
                                  || downloadState.status === "downloading"
                                  || downloadState.status === "installing") && (
                                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[var(--ink-muted)]" />
                                )}
                              </div>
                              {downloadState.status === "downloading" && (
                                <>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-base)]">
                                    <div
                                      className="h-full rounded-full bg-[var(--tone-3)] transition-[width]"
                                      style={{
                                        width: downloadState.totalBytes
                                          ? `${Math.min(100, (downloadState.receivedBytes || 0) / downloadState.totalBytes * 100)}%`
                                          : "15%",
                                      }}
                                    />
                                  </div>
                                  <p className="mt-1.5 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                                    {formatBytes(downloadState.receivedBytes || 0)}
                                    {downloadState.totalBytes
                                      ? ` de ${formatBytes(downloadState.totalBytes)}`
                                      : ""}
                                  </p>
                                </>
                              )}
                              {downloadState.status === "error" && (
                                <div className="mt-2.5 rounded-[10px] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] p-2.5 text-left">
                                  <p className="text-[length:var(--step-0)] leading-relaxed text-[var(--danger)] font-medium">
                                    {downloadState.error || "Falha durante o download do mod."}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedMod && fileGroups.main) {
                                          void requestFreeNexusDownload(fileGroups.main);
                                        }
                                      }}
                                      className="rounded-[10px] bg-[var(--tone-4)] px-2.5 py-1 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)] focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)]"
                                    >
                                      Tentar novamente
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void onChooseFolder()}
                                      className="rounded-[10px] border border-[color:var(--border-subtle)] px-2.5 py-1 text-[length:var(--step-0)] font-medium text-[var(--ink)] transition hover:bg-[var(--tone-4)]"
                                    >
                                      Verificar pasta
                                    </button>
                                  </div>
                                </div>
                              )}
                              {downloadState.status === "completed"
                                && downloadState.installationError && (
                                <div className="mt-2.5 rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-2.5 text-left">
                                  <p className="text-[length:var(--step-0)] leading-relaxed text-[var(--ink)] font-medium">
                                    {downloadState.installationError}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void onChooseFolder()}
                                      className="rounded-[10px] bg-[var(--tone-4)] px-2.5 py-1 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)]"
                                    >
                                      Definir pasta do jogo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void openNexusDownloadLocation()}
                                      className="rounded-[10px] border border-[color:var(--border-subtle)] px-2.5 py-1 text-[length:var(--step-0)] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
                                    >
                                      Abrir pasta baixada
                                    </button>
                                  </div>
                                </div>
                              )}
                              {downloadState.status === "completed" && !downloadState.installationError && (
                                <button
                                  type="button"
                                  onClick={() => void openNexusDownloadLocation()}
                                  className="mt-2 flex items-center gap-1.5 rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-2.5 py-1 text-[length:var(--step-0)] font-medium text-[var(--ink)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)]"
                                >
                                  <FolderOpen className="h-3.5 w-3.5" />
                                  Mostrar arquivo
                                </button>
                              )}
                            </div>
                          )}

                          {filesError && (
                            <p className="mt-3 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] leading-relaxed text-[var(--danger)]">
                              {filesError}
                            </p>
                          )}

                          {nxmRegistered === false && !nexusConnection.account?.isPremium && (
                            <div className="mt-4 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-4">
                              <p className="text-[length:var(--step-1)] font-semibold text-[var(--ink)]">Ative a instalação automática</p>
                              <p className="mt-1 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-muted)]">
                                Com a conta grátis, a Nexus envia o download por um link que abre no navegador. Ativando, o
                                Pherielium passa a receber esse link, baixa o mod e coloca os arquivos na pasta do jogo. Isso
                                também tira os links da Nexus de outro gerenciador, como o Vortex.
                              </p>
                              <button
                                type="button"
                                onClick={() => void enableNxm()}
                                disabled={nxmBusy}
                                className="mt-3 flex h-10 cursor-pointer items-center gap-2 rounded-[var(--node)] bg-[var(--ink)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                              >
                                {nxmBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                Ativar instalação automática
                              </button>
                            </div>
                          )}

                          {fileGroups.main && (
                            <div className="mt-4 space-y-3">
                              <p className="text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">Arquivo a instalar</p>
                              {renderFileCard(fileGroups.main, true)}

                              {fileGroups.optional.length > 0 && (
                                <details className="group">
                                  <summary className="cursor-pointer list-none text-[length:var(--step-0)] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]">
                                    Outros arquivos <span className="font-metric">({fileGroups.optional.length})</span>
                                  </summary>
                                  <div className="mt-2 space-y-2">{fileGroups.optional.map((file) => renderFileCard(file, false))}</div>
                                </details>
                              )}

                              {fileGroups.old.length > 0 && (
                                <details className="group">
                                  <summary className="cursor-pointer list-none text-[length:var(--step-0)] font-medium text-[var(--ink-faint)] hover:text-[var(--ink-muted)]">
                                    Versões antigas <span className="font-metric">({fileGroups.old.length})</span>
                                  </summary>
                                  <div className="mt-2 space-y-2">{fileGroups.old.map((file) => renderFileCard(file, false))}</div>
                                </details>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <div className="flex min-h-full flex-col items-center justify-center text-center">
                          <Sparkles className="mb-3 h-7 w-7 text-[var(--ink-faint)]" />
                          <p className="text-sm font-bold text-[var(--ink-faint)]">Selecione um mod</p>
                          <p className="mt-1 text-[length:var(--step-0)] text-[var(--ink-faint)]">As informações aparecerão aqui.</p>
                        </div>
                      )}
                    </aside>
                  </motion.div>
                )}

                {activeTab === "installed" && (
                  <motion.section
                    key="installed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-7 thin-scrollbar"
                  >
                    <div className="mx-auto max-w-5xl">
                      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Meus mods</h2>
                          <p className="mt-1 text-[length:var(--step-0)] text-[var(--ink-faint)]">Acompanhe downloads e gerencie os mods já instalados.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playSound("select");
                              void openDownloadedModsFolder();
                            }}
                            disabled={folderActionBusy}
                            className="flex items-center gap-2 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)] disabled:cursor-wait disabled:opacity-50"
                          >
                            {folderActionBusy
                              ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              : <FolderOpen className="h-3.5 w-3.5" />}
                            Abrir pasta dos mods
                          </button>
                          <span className="rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] font-bold text-[var(--ink-faint)]">
                            {installedMods.filter((mod) =>
                              (optimisticModStates[mod.id] ?? mod.enabled)).length} ativos
                          </span>
                        </div>
                      </div>

                      {/* AVISO DE ANTI-CHEAT */}
                      {(() => {
                        const acInfo = getAntiCheatInfo(game?.id, gameDomain);
                        if (!acInfo) return null;
                        return (
                          <div className="mb-5 flex items-start gap-3 rounded-[var(--corner-md)] border border-[color:color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[var(--tone-3)] p-4 text-[var(--warn)] backdrop-blur-md">
                            <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--warn)] mt-0.5" />
                            <div>
                              <h4 className="text-[length:var(--step-0)] font-bold text-[var(--warn)]">
                                Aviso de Proteção Anti-Cheat ({acInfo.antiCheatEngine})
                              </h4>
                              <p className="mt-1 text-[length:var(--step-0)] text-[var(--warn)] leading-relaxed">
                                {acInfo.warningNotice}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* AVISO DE CONFLITO DE ARQUIVOS */}
                      {modConflicts.length > 0 && (
                        <div className="mb-5 flex items-start gap-3 rounded-[var(--corner-md)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] p-4 text-[var(--danger)] backdrop-blur-md">
                          <AlertCircle className="h-5 w-5 shrink-0 text-[var(--danger)] mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-[length:var(--step-0)] font-bold text-[var(--danger)]">
                              Conflito de Arquivos Detectado ({modConflicts.length} arquivo{modConflicts.length === 1 ? "" : "s"} afetado{modConflicts.length === 1 ? "" : "s"})
                            </h4>
                            <p className="mt-1 text-[length:var(--step-0)] text-[var(--danger)] leading-relaxed">
                              Múltiplos mods ativos modificam o mesmo arquivo no jogo. O arquivo do último mod ativado sobrescreverá os anteriores.
                            </p>
                            <div className="mt-2 space-y-1">
                              {modConflicts.slice(0, 3).map((c, i) => (
                                <div key={i} className="text-[length:var(--step-0)] font-mono text-[var(--danger)] truncate">
                                  • {c.relativePath} ({c.mods.map((m) => m.name).join(" vs ")})
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* GERENCIAMENTO DE PERFIS DE MODS */}
                      <div className="mb-6 rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-[var(--ink-muted)]" />
                          <span className="text-[length:var(--step-0)] font-bold text-[var(--ink)]">Perfil de Mods:</span>
                          {modProfiles.length === 0 ? (
                            <span className="text-[length:var(--step-0)] text-[var(--ink-faint)]">Padrão</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {modProfiles.map((prof) => (
                                <button
                                  key={prof.id}
                                  type="button"
                                  onClick={() => void handleApplyModProfile(prof)}
                                  className="cursor-pointer rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--tone-4)] px-2.5 py-1 text-[length:var(--step-0)] font-bold text-[var(--ink)] transition hover:bg-[var(--tone-4)] active:scale-95"
                                >
                                  {prof.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {showProfileSave ? (
                          <div className="flex items-center gap-2">
                            <input aria-label="Nome do perfil de mods"
                              type="text"
                              value={newProfileName}
                              onChange={(e) => setNewProfileName(e.target.value)}
                              placeholder="Nome do perfil"
                              className="h-8 rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-2.5 text-[length:var(--step-0)] text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)]"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveModProfile()}
                              className="cursor-pointer rounded-[10px] bg-[var(--ink)] px-3 py-1.5 text-[length:var(--step-0)] font-semibold uppercase text-[var(--tone-0)] transition hover:opacity-90"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowProfileSave(false)}
                              className="cursor-pointer text-[length:var(--step-0)] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowProfileSave(true)}
                            className="cursor-pointer rounded-[10px] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-3 py-1.5 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                          >
                            + Salvar como Novo Perfil
                          </button>
                        )}
                      </div>

                      {folderActionError && (
                        <p className="mb-4 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] leading-relaxed text-[var(--danger)]">
                          {folderActionError}
                        </p>
                      )}

                      {installedActionError && (
                        <p className="mb-4 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] leading-relaxed text-[var(--danger)]">
                          {installedActionError}
                        </p>
                      )}

                      {scriptIssues.length > 0 && (
                        <div role="alert" className="mb-4 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] p-3.5">
                          <p className="text-[length:var(--step-1)] font-semibold text-[var(--danger)]">
                            O jogo não conseguiu compilar os scripts dos mods
                          </p>
                          <ul className="mt-2 space-y-2">
                            {scriptIssues.map((issue) => (
                              <li key={issue.modFolder} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                                <span>
                                  {issue.summary}
                                  <span className="block text-[var(--ink-faint)]">Log do jogo: {issue.detail}</span>
                                </span>
                                {issue.requirement && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playSound("select");
                                      void window.electronAPI?.openExternalUrl?.(requirementSearchUrl(gameDomain, issue.requirement ?? ""));
                                    }}
                                    className="cursor-pointer rounded-[var(--corner-sm)] bg-[var(--tone-4)] px-3 py-1.5 font-semibold text-[var(--ink)] transition-opacity hover:opacity-80"
                                  >
                                    Procurar no Nexus
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                            Instale o mod que falta e abra o jogo de novo para o aviso sumir.
                          </p>
                        </div>
                      )}

                      {installedMods.length === 0 ? (
                        <EmptyCatalog
                          title="Nenhum mod baixado"
                          description="Quando um download for concluído, o mod aparecerá aqui com o estado da instalação."
                          onAction={() => setActiveTab("discover")}
                        />
                      ) : (
                        <div className="space-y-3">
                          {installedMods.map((mod) => {
                            const displayedEnabled = optimisticModStates[mod.id] ?? mod.enabled;
                            const isBusy = modActionIds.has(mod.id);
                            return (
                            <div key={mod.id} className="group flex flex-wrap items-center gap-4 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-3.5 transition-colors hover:bg-[var(--tone-3)]">
                              <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--node)] bg-[var(--tone-3)]">
                                {mod.pictureUrl ? (
                                  <img src={mod.pictureUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                ) : (
                                  <PackageOpen className="h-5 w-5 text-[var(--ink-faint)]" aria-hidden />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]" title={mod.name}>{mod.name}</h3>
                                <p className="mt-0.5 truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">
                                  {[
                                    mod.author && mod.author !== "Nexus Mods" ? `por ${mod.author}` : null,
                                    mod.version ? `v${mod.version}` : null,
                                  ].filter(Boolean).join(" · ") || "Arquivo baixado da Nexus"}
                                </p>
                              </div>
                              <div className="ml-auto flex items-center gap-3">
                                <span className={`rounded-full bg-[var(--tone-3)] px-2.5 py-1 text-[length:var(--step-0)] font-semibold ${
                                  displayedEnabled && mod.manifestPath
                                    ? "text-[var(--live)]"
                                    : displayedEnabled
                                      ? "text-[var(--warn)]"
                                      : mod.status === "downloaded"
                                        ? "text-[var(--ink-muted)]"
                                        : "text-[var(--ink-faint)]"
                                }`}>
                                  {isBusy
                                    ? displayedEnabled ? "Ativando…" : "Desativando…"
                                    : displayedEnabled
                                      ? mod.manifestPath ? "Ativo" : "Verificar"
                                      : mod.status === "downloaded"
                                        ? "Baixado"
                                        : "Desativado"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void removeInstalledMod(mod)}
                                  disabled={isBusy}
                                  aria-label={`Remover ${mod.name}`}
                                  title="Remover do jogo e apagar o download"
                                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--node)] bg-[var(--tone-3)] text-[var(--ink-faint)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--danger)] disabled:cursor-default disabled:opacity-40"
                                >
                                  {isBusy
                                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                                <Switch
                                  checked={displayedEnabled}
                                  onCheckedChange={(enabled) => void changeInstalledModState(mod, enabled)}
                                  disabled={isBusy || (!displayedEnabled && !mod.filePath)}
                                  title={!mod.filePath ? "Baixe o arquivo antes de ativar" : !gameFolder ? "Configure a pasta do jogo" : undefined}
                                  aria-label={`${displayedEnabled ? "Desativar" : "Ativar"} ${mod.name}`}
                                />
                              </div>
                            </div>
                          );})}
                        </div>
                      )}
                    </div>
                  </motion.section>
                )}

                {activeTab === "downloads" && (
                  <motion.section
                    key="downloads"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 thin-scrollbar sm:p-6"
                  >
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border-subtle)] pb-4">
                      <div>
                        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--ink)] sm:text-xl">
                          <Download className="h-5 w-5 text-[var(--ink-muted)]" />
                          Gerenciador de Downloads
                        </h2>
                        <p className="mt-0.5 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                          Acompanhe em tempo real os downloads e instalações de mods acionados na Nexus.
                        </p>
                      </div>

                      {downloadHistory.some((item) => item.status === "completed") && (
                        <button
                          type="button"
                          onClick={handleClearCompletedDownloads}
                          className="flex items-center gap-2 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-4 py-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--danger)]" />
                          Limpar Concluídos
                        </button>
                      )}
                    </div>

                    {downloadHistory.length === 0 ? (
                      <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--corner-md)] border border-dashed border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-8 text-center">
                        <Download className="mb-3 h-10 w-10 text-[var(--ink-faint)]" />
                        <p className="text-sm font-semibold text-[var(--ink-muted)]">Nenhum download registrado</p>
                        <p className="mt-1 max-w-sm text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)]">
                          Ao iniciar um download na Nexus Mods, o progresso e o status de instalação aparecerão aqui automaticamente.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {downloadHistory.map((item) => (
                          <DownloadCard
                            key={item.id}
                            download={item}
                            now={now}
                            onPause={handlePauseDownload}
                            onResume={handleResumeDownload}
                            onCancel={handleCancelDownload}
                            onReopenPage={(download) => void handleReopenDownloadPage(download)}
                            onOpenFolder={(download) => void openNexusDownloadLocation(download.gameDomain || gameDomain)}
                            onRemove={handleRemoveDownloadCard}
                          />
                        ))}
                      </div>
                    )}
                  </motion.section>
                )}

                {activeTab === "setup" && (
                  <motion.section
                    key="setup"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-7 thin-scrollbar"
                  >
                    <div className="mx-auto max-w-3xl space-y-5">
                      <div>
                        <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Configurar integração</h2>
                      </div>

                      <div className="rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                            <KeyRound className="h-4 w-4" /> Conta Nexus de desenvolvimento
                          </div>
                          {nexusConnection.connected && (
                            <span className="rounded-[10px] bg-[var(--tone-3)] px-2 py-1 text-[length:var(--step-0)] font-semibold text-[var(--live)]">
                              Conectado
                            </span>
                          )}
                        </div>

                        {connectionLoading ? (
                          <div className="flex h-20 items-center justify-center gap-2 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Verificando conexão
                          </div>
                        ) : nexusConnection.connected ? (
                          <div className="rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--live)_35%,transparent)] bg-[var(--tone-3)] p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[var(--live)]">
                                  {nexusConnection.account?.name || "Chave pessoal validada"}
                                </p>
                                <p className="mt-1 text-[length:var(--step-0)] leading-relaxed text-[var(--live)]">
                                  A chave está criptografada pelo Windows e permanece somente neste computador.
                                </p>
                                {nexusConnection.account?.rateLimit.dailyRemaining !== null
                                  && nexusConnection.account?.rateLimit.dailyRemaining !== undefined && (
                                  <p className="mt-2 text-[length:var(--step-0)] font-bold text-[var(--ink-faint)]">
                                    {nexusConnection.account.rateLimit.dailyRemaining} requisições diárias restantes
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeNexusConnection()}
                                disabled={connectionBusy}
                                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)] transition hover:bg-[var(--tone-3)] hover:text-[var(--ink)] disabled:opacity-40"
                              >
                                {connectionBusy
                                  ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  : <LogOut className="h-3.5 w-3.5" />}
                                Desconectar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mb-4 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)]">
                              Durante a avaliação, cada pessoa usa sua própria chave pessoal. Ela não é enviada ao Render,
                              Netlify, Supabase ou aos servidores do Phelierium.
                            </p>
                            {!nexusConnection.encryptionAvailable ? (
                              <p className="rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-4 py-3 text-[length:var(--step-0)] text-[var(--danger)]">
                                A criptografia segura do sistema operacional não está disponível.
                              </p>
                            ) : (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative min-w-0 flex-1">
                                  <input
                                    type={showPersonalKey ? "text" : "password"}
                                    value={personalKey}
                                    onChange={(event) => setPersonalKey(event.target.value)}
                                    placeholder="Cole sua chave pessoal Nexus"
                                    autoComplete="off"
                                    spellCheck={false}
                                    aria-label="Chave pessoal Nexus"
                                    className="h-12 w-full rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-4 pr-11 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[color:var(--border-subtle)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPersonalKey((visible) => !visible)}
                                    aria-label={showPersonalKey ? "Ocultar chave" : "Mostrar chave"}
                                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-[var(--ink-faint)] transition hover:bg-[var(--tone-3)] hover:text-[var(--ink-muted)]"
                                  >
                                    {showPersonalKey
                                      ? <EyeOff className="h-4 w-4" />
                                      : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void connectPersonalKey()}
                                  disabled={connectionBusy || personalKey.trim().length < 32}
                                  className="flex h-12 items-center justify-center gap-2 rounded-[var(--corner-sm)] bg-[var(--ink)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  {connectionBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                  Validar e salvar
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={openNexusApiKeys}
                              className="mt-3 inline-flex items-center gap-1.5 text-[length:var(--step-0)] font-bold text-[var(--ink-faint)] transition hover:text-[var(--ink-muted)]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir página de chaves pessoais da Nexus
                            </button>
                          </>
                        )}

                        {connectionError && (
                          <p className="mt-3 rounded-[var(--corner-sm)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--tone-3)] px-3 py-2 text-[length:var(--step-0)] leading-relaxed text-[var(--danger)]">
                            {connectionError}
                          </p>
                        )}
                      </div>

                      <div className="rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-5">
                        <div className="mb-3 flex items-center gap-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                          <FolderOpen className="h-4 w-4" /> Pasta do jogo
                        </div>
                        <button
                          type="button"
                          onClick={() => void onChooseFolder()}
                          className="flex min-h-14 w-full items-center gap-3 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-4 text-left transition hover:bg-[var(--tone-3)]"
                        >
                          <HardDrive className="h-4 w-4 shrink-0 text-[var(--ink-faint)]" />
                          <span className="min-w-0 flex-1 truncate text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                            {gameFolder || "Selecionar pasta do jogo"}
                          </span>
                          {gameFolder && <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--live)]" />}
                        </button>
                      </div>

                      <div className="rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] p-5">
                        <div className="mb-3 flex items-center gap-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                          <PackageOpen className="h-4 w-4" /> Domínio Nexus
                        </div>
                        <p className="mb-4 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)]">
                          É o trecho da URL antes de <code className="text-[var(--ink-muted)]">/mods</code>.
                          Exemplo: <code className="text-[var(--ink-muted)]">skyrimspecialedition</code>.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input aria-label="Domínio do jogo no Nexus"
                            value={domainDraft}
                            onChange={(event) => setDomainDraft(cleanDomain(event.target.value))}
                            placeholder="dominio-do-jogo"
                            className="h-12 min-w-0 flex-1 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[color:var(--border-subtle)]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const domain = cleanDomain(domainDraft);
                              onSaveDomain(domain);
                              setDomainDraft(domain);
                              setActiveTab("discover");
                            }}
                            disabled={!domainDraft}
                            className="h-12 rounded-[var(--corner-sm)] bg-[var(--ink)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const EmptyCatalog: React.FC<{
  title: string;
  description: string;
  onAction: () => void;
}> = ({ title, description, onAction }) => (
  <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--corner-md)] border border-dashed border-[color:var(--border-subtle)] bg-[var(--tone-2)] px-6 text-center">
    <PackageOpen className="mb-3 h-7 w-7 text-[var(--ink-faint)]" />
    <p className="text-sm font-semibold text-[var(--ink-muted)]">{title}</p>
    <p className="mt-1 max-w-md text-[length:var(--step-0)] leading-relaxed text-[var(--ink-faint)]">{description}</p>
    <button
      type="button"
      onClick={onAction}
      className="mt-4 rounded-[var(--corner-sm)] border border-[color:var(--border-subtle)] bg-[var(--tone-3)] px-4 py-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
    >
      Continuar
    </button>
  </div>
);

export default ModGameDetailPanel;
