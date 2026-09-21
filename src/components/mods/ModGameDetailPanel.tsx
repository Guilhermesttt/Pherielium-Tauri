import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
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
  onNexusDownloadState,
  openNexusDownloadLocation,
  prepareNexusFreeDownload,
  removeNexusInstalledMod,
  validateNexusConnection,
  type NexusConnection,
  type NexusDownloadState,
  type NexusModFile,
  type NexusModSummary,
} from "../../services/nexus";
import { Switch } from "../ui/switch";
import { usePreferences } from "../../context/PreferencesContext";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import { HudCornerMarkers } from "../ui/HudPanel";

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

const CATALOG_PAGE_SIZE = 30;

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
  const [visibleCount, setVisibleCount] = React.useState(CATALOG_PAGE_SIZE);
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
  const [installedActionError, setInstalledActionError] = React.useState("");
  const [downloadState, setDownloadState] = React.useState<NexusDownloadState | null>(null);
  const [downloadHistory, setDownloadHistory] = React.useState<NexusDownloadState[]>([]);
  const [awaitingFileId, setAwaitingFileId] = React.useState("");
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
        setVisibleCount(CATALOG_PAGE_SIZE);
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
      const isTerminal = state.status === "completed" || state.status === "error";
      if (
        isTerminal
        && sessionStorage.getItem("checkpoint_hidden_nexus_download_notice") === noticeKey
      ) return;
      setDownloadState(state);
      // limpa awaiting para qualquer status ativo, não só terminal
      if (state.fileId) setAwaitingFileId((cur) => cur === state.fileId ? "" : cur);
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

  const visibleMods = filteredMods.slice(0, visibleCount);
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
    try {
      await prepareNexusFreeDownload({
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
    // Fallback: se NXM não disparar em 30s, libera botão
    setTimeout(() => setAwaitingFileId((cur) => cur === file.id ? "" : cur), 30000);
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
      setVisibleCount(CATALOG_PAGE_SIZE);
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-white/35">
                    <PackageOpen className="h-3.5 w-3.5" />
                    Nexus Mods
                  </div>
                  <h1 className="truncate text-2xl font-display font-black tracking-tight text-white sm:text-3xl">{game.title}</h1>
                </div>
              </div>

              <div className="flex w-full shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/45 p-1.5 backdrop-blur-xl thin-scrollbar xl:w-auto xl:gap-2">
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
                    className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[9px] font-black uppercase tracking-wider transition sm:px-4 sm:text-[10px] xl:flex-none ${
                      activeTab === id
                        ? "bg-white/12 text-white shadow-lg"
                        : "text-white/35 hover:bg-white/[0.06] hover:text-white/65"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_100px_rgba(0,0,0,0.55)] flex flex-col transform-gpu"
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
                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-white/8 p-4 sm:p-5 xl:border-b-0 xl:border-r xl:p-6">
                      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
                        <div className="relative min-w-60 flex-1">
                          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                          <input
                            value={searchTerm}
                            onChange={(event) => {
                              setSearchTerm(event.target.value);
                              setUrlImportError("");
                              setVisibleCount(CATALOG_PAGE_SIZE);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && pastedModUrl) {
                                event.preventDefault();
                                void importModFromUrl();
                              }
                            }}
                            placeholder="Pesquisar ou colar a URL de um mod"
                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
                          />
                        </div>
                        {pastedModUrl && (
                          <button
                            type="button"
                            onClick={() => void importModFromUrl()}
                            disabled={urlImportLoading}
                            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-sky-400/15 bg-sky-400/[0.08] px-4 text-[9px] font-black uppercase tracking-wider text-sky-100/65 transition hover:bg-sky-400/[0.14] disabled:opacity-40"
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
                            setVisibleCount(CATALOG_PAGE_SIZE);
                          }}
                          aria-label="Ordenar catálogo"
                          className="h-12 rounded-2xl border border-white/10 bg-[#111114] px-4 text-[10px] font-black uppercase tracking-wider text-white/55 outline-none focus:border-white/25"
                        >
                          <option value="featured">Destaques</option>
                          <option value="recent">Mais recentes</option>
                          <option value="downloads">Mais baixados</option>
                          <option value="endorsements">Mais apoiados</option>
                          <option value="name">Nome A–Z</option>
                        </select>
                        <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-black uppercase tracking-wider text-white/35">
                          {loading
                            ? "Carregando"
                            : searchTerm.trim()
                              ? `${filteredMods.length} de ${mods.length}`
                              : `${mods.length} mods`}
                        </span>
                      </div>
                      {!loading && mods.length > 0 && (
                        <p className="mb-4 shrink-0 text-[9px] leading-relaxed text-white/25 xl:mb-5">
                          {catalogScope === "recent-30-days"
                            ? "Catálogo recente: destaques e mods com atividade nos últimos 30 dias. O arquivo histórico completo exige acesso de aplicativo aprovado pela Nexus."
                            : catalogScope === "curated-feeds"
                              ? "Exibindo os feeds oficiais disponíveis para esta chave."
                              : "Prévia pública limitada aos mods em alta. Conecte sua conta Nexus para ampliar o catálogo."}
                        </p>
                      )}
                      {urlImportError && (
                        <p className="mb-4 shrink-0 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-100/55">
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
                              <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]" />
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
                          <div className="pb-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                            {visibleMods.map((mod) => (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => {
                                  playSound("select");
                                  selectMod(mod);
                                }}
                                className={`group overflow-hidden rounded-2xl border text-left transition ${
                                  selectedMod?.id === mod.id
                                    ? "border-white/30 bg-white/[0.10] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                                    : "border-white/8 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.07]"
                                }`}
                              >
                                <div className="relative h-32 overflow-hidden bg-white/[0.04]">
                                  {mod.pictureUrl ? (
                                    <img
                                      src={mod.pictureUrl}
                                      alt=""
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <PackageOpen className="h-7 w-7 text-white/15" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                                  <span className="absolute bottom-2 left-2 rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white/55">
                                    {mod.feed || "Nexus"}
                                  </span>
                                  {installedMods.find((entry) => entry.id === mod.id) && (
                                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-950/85 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-200/80">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {installedMods.find((entry) => entry.id === mod.id)?.status === "installed"
                                        ? "Instalado"
                                        : "Baixado"}
                                    </span>
                                  )}
                                </div>
                                <div className="p-3.5">
                                  <h3 className="line-clamp-1 text-sm font-black text-white/85">{mod.name}</h3>
                                  <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-relaxed text-white/35">
                                    {mod.summary || "Sem descrição."}
                                  </p>
                                  {mod.author && (
                                    <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-white/25">
                                      <UserRound className="h-3 w-3" /> Por {mod.author}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))}
                            </div>
                            {visibleCount < filteredMods.length && (
                              <button
                                type="button"
                                onClick={() => setVisibleCount((count) => count + CATALOG_PAGE_SIZE)}
                                className="mx-auto mt-5 flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 text-[9px] font-black uppercase tracking-wider text-white/45 transition hover:bg-white/10 hover:text-white"
                              >
                                Carregar mais ({filteredMods.length - visibleCount})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </section>

                    <aside className="min-h-0 flex-1 xl:flex-1 overflow-y-auto p-4 sm:p-5 xl:p-6 thin-scrollbar border-t border-white/8 xl:border-t-0">
                      {selectedMod ? (
                        <motion.div key={selectedMod.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                            {selectedMod.pictureUrl ? (
                              <img src={selectedMod.pictureUrl} alt="" className="h-48 w-full object-cover" />
                            ) : (
                              <div className="flex h-48 items-center justify-center">
                                <PackageOpen className="h-8 w-8 text-white/15" />
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                            Mod em destaque
                          </p>
                          <h2 className="mt-2 text-2xl font-black leading-tight text-white">{selectedMod.name}</h2>
                          {selectedMod.author && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/35">
                              <UserRound className="h-3.5 w-3.5" />
                              Por {selectedMod.author}
                            </p>
                          )}
                          <p className="mt-5 text-sm leading-relaxed text-white/55">
                            {selectedMod.summary || "Este mod não possui uma descrição curta."}
                          </p>

                          <div className={`mt-6 rounded-2xl border p-4 ${
                            nexusConnection.connected
                              ? "border-emerald-400/15 bg-emerald-400/[0.06]"
                              : "border-amber-400/15 bg-amber-400/[0.06]"
                          }`}>
                            <div className={`flex items-center gap-2 text-xs font-bold ${
                              nexusConnection.connected ? "text-emerald-100/70" : "text-amber-100/70"
                            }`}>
                              <ShieldCheck className={`h-4 w-4 ${
                                nexusConnection.connected ? "text-emerald-300/75" : "text-amber-300/75"
                              }`} />
                              {nexusConnection.connected
                                ? `Conectado como ${nexusConnection.account?.name || "usuário Nexus"}`
                                : "Conexão Nexus necessária"}
                            </div>
                            <p className={`mt-2 text-[10px] leading-relaxed ${
                              nexusConnection.connected ? "text-emerald-100/35" : "text-amber-100/35"
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
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
                            >
                              {filesLoading
                                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                              Listar arquivos no Phelierium
                            </button>
                            <button
                              type="button"
                              onClick={() => openModPage(selectedMod)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-white/40 transition hover:bg-white/10 hover:text-white"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir página na Nexus
                            </button>
                          </div>

                          {awaitingFileId && (
                            <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-3 py-3">
                              <p className="text-[10px] font-bold text-sky-100/70">
                                Escolha o download gratuito na Nexus
                              </p>
                              <p className="mt-1 text-[9px] leading-relaxed text-sky-100/35">
                                Na tela aberta, clique em Slow download. Após a contagem, permita que o navegador abra o Phelierium pelo link NXM.
                              </p>
                            </div>
                          )}

                          {downloadState
                            && (!downloadState.gameDomain || downloadState.gameDomain === gameDomain) && (
                            <div className={`mt-3 rounded-xl border px-3 py-3 ${
                              downloadState.status === "error"
                                ? "border-red-400/15 bg-red-400/[0.06]"
                                : downloadState.status === "completed"
                                  ? "border-emerald-400/15 bg-emerald-400/[0.06]"
                                  : "border-sky-400/15 bg-sky-400/[0.06]"
                            }`}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-[10px] font-bold text-white/70">
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
                                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-sky-300/70" />
                                )}
                              </div>
                              {downloadState.status === "downloading" && (
                                <>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                                    <div
                                      className="h-full rounded-full bg-sky-300/70 transition-[width]"
                                      style={{
                                        width: downloadState.totalBytes
                                          ? `${Math.min(100, (downloadState.receivedBytes || 0) / downloadState.totalBytes * 100)}%`
                                          : "15%",
                                      }}
                                    />
                                  </div>
                                  <p className="mt-1.5 text-xs text-white/60">
                                    {formatBytes(downloadState.receivedBytes || 0)}
                                    {downloadState.totalBytes
                                      ? ` de ${formatBytes(downloadState.totalBytes)}`
                                      : ""}
                                  </p>
                                </>
                              )}
                              {downloadState.status === "error" && (
                                <div className="mt-2.5 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-left">
                                  <p className="text-xs leading-relaxed text-red-200/90 font-medium">
                                    {downloadState.error || "Falha durante o download do mod."}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedMod && modFiles.length > 0) {
                                          void requestFreeNexusDownload(modFiles[0]);
                                        }
                                      }}
                                      className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40"
                                    >
                                      Tentar novamente
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void onChooseFolder()}
                                      className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10"
                                    >
                                      Verificar pasta
                                    </button>
                                  </div>
                                </div>
                              )}
                              {downloadState.status === "completed"
                                && downloadState.installationError && (
                                <div className="mt-2.5 rounded-lg border border-white/15 bg-white/5 p-2.5 text-left">
                                  <p className="text-xs leading-relaxed text-white/85 font-medium">
                                    {downloadState.installationError}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void onChooseFolder()}
                                      className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
                                    >
                                      Definir pasta do jogo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void openNexusDownloadLocation()}
                                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:text-white"
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
                                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
                                >
                                  <FolderOpen className="h-3.5 w-3.5" />
                                  Mostrar arquivo
                                </button>
                              )}
                            </div>
                          )}

                          {filesError && (
                            <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-red-200/65">
                              {filesError}
                            </p>
                          )}

                          {modFiles.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                                  Arquivos disponíveis
                                </p>
                                <span className="text-[9px] font-bold text-white/25">{modFiles.length}</span>
                              </div>
                              {modFiles.slice(0, 8).map((file) => (
                                (() => {
                                  const downloadedEntry = installedMods.find((mod) =>
                                    mod.id === `${gameDomain}:${getModIdFromPageUrl(selectedMod.modPageUrl)}`
                                    && mod.nexusFileId === file.id);
                                  const isDownloaded = downloadedFileIds.has(file.id)
                                    || Boolean(downloadedEntry);
                                  const isInstalled = downloadedEntry?.status === "installed";
                                  return (
                                <div
                                  key={file.id}
                                  className="rounded-xl border border-white/8 bg-white/[0.035] p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-bold text-white/65">
                                        {file.name}
                                      </p>
                                      <p className="mt-1 text-[9px] text-white/30">
                                        {file.version || "Sem versão"} · {file.category || "Arquivo"}
                                      </p>
                                    </div>
                                    {file.primary && (
                                      <span className="shrink-0 rounded-md bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-300/70">
                                        Principal
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <p className="text-[9px] text-white/25">
                                      {file.sizeKb >= 1024
                                        ? `${(file.sizeKb / 1024).toFixed(1)} MB`
                                        : `${Math.round(file.sizeKb)} KB`}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playSound("select");
                                        void requestFreeNexusDownload(file);
                                      }}
                                      disabled={awaitingFileId === file.id || isDownloaded}
                                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider transition disabled:cursor-default ${
                                        isDownloaded
                                          ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300/65"
                                          : "border-white/10 bg-white/[0.05] text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
                                      }`}
                                    >
                                      {awaitingFileId === file.id
                                        ? <LoaderCircle className="h-3 w-3 animate-spin" />
                                        : isDownloaded
                                          ? <CheckCircle2 className="h-3 w-3" />
                                          : <Download className="h-3 w-3" />}
                                      {isInstalled
                                        ? "Instalado"
                                        : isDownloaded
                                          ? "Baixado"
                                          : "Instalar grátis"}
                                    </button>
                                  </div>
                                </div>
                                  );
                                })()
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <div className="flex min-h-full flex-col items-center justify-center text-center">
                          <Sparkles className="mb-3 h-7 w-7 text-white/15" />
                          <p className="text-sm font-bold text-white/45">Selecione um mod</p>
                          <p className="mt-1 text-xs text-white/25">As informações aparecerão aqui.</p>
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
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">Gerenciamento local</p>
                          <h2 className="mt-2 text-2xl font-black text-white">Meus mods</h2>
                          <p className="mt-1 text-xs text-white/35">Acompanhe downloads e gerencie os mods já instalados.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playSound("select");
                              void openDownloadedModsFolder();
                            }}
                            disabled={folderActionBusy}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {folderActionBusy
                              ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              : <FolderOpen className="h-3.5 w-3.5" />}
                            Abrir pasta dos mods
                          </button>
                          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-white/35">
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
                          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-300 backdrop-blur-md">
                            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                                Aviso de Proteção Anti-Cheat ({acInfo.antiCheatEngine})
                              </h4>
                              <p className="mt-1 text-xs text-amber-300/80 leading-relaxed">
                                {acInfo.warningNotice}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* AVISO DE CONFLITO DE ARQUIVOS */}
                      {modConflicts.length > 0 && (
                        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 backdrop-blur-md">
                          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-red-200">
                              Conflito de Arquivos Detectado ({modConflicts.length} arquivo{modConflicts.length === 1 ? "" : "s"} afetado{modConflicts.length === 1 ? "" : "s"})
                            </h4>
                            <p className="mt-1 text-xs text-red-300/80 leading-relaxed">
                              Múltiplos mods ativos modificam o mesmo arquivo no jogo. O arquivo do último mod ativado sobrescreverá os anteriores.
                            </p>
                            <div className="mt-2 space-y-1">
                              {modConflicts.slice(0, 3).map((c, i) => (
                                <div key={i} className="text-[10px] font-mono text-red-200/60 truncate">
                                  • {c.relativePath} ({c.mods.map((m) => m.name).join(" vs ")})
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* GERENCIAMENTO DE PERFIS DE MODS */}
                      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-white/50" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">Perfil de Mods:</span>
                          {modProfiles.length === 0 ? (
                            <span className="text-xs text-white/40">Padrão</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {modProfiles.map((prof) => (
                                <button
                                  key={prof.id}
                                  type="button"
                                  onClick={() => void handleApplyModProfile(prof)}
                                  className="cursor-pointer rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-white/20 active:scale-95"
                                >
                                  {prof.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {showProfileSave ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newProfileName}
                              onChange={(e) => setNewProfileName(e.target.value)}
                              placeholder="Nome do perfil"
                              className="h-8 rounded-lg border border-white/15 bg-black/50 px-2.5 text-xs text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveModProfile()}
                              className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-[10px] font-black uppercase text-black transition hover:bg-white/90"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowProfileSave(false)}
                              className="cursor-pointer text-[10px] text-white/40 hover:text-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowProfileSave(true)}
                            className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:text-white"
                          >
                            + Salvar como Novo Perfil
                          </button>
                        )}
                      </div>

                      {folderActionError && (
                        <p className="mb-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-red-200/65">
                          {folderActionError}
                        </p>
                      )}

                      {installedActionError && (
                        <p className="mb-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-red-200/65">
                          {installedActionError}
                        </p>
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
                            <div key={mod.id} className="group relative flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-3.5 transition-all hover:border-white/20 hover:bg-[#151515] sm:flex-nowrap sm:gap-4">
                              <HudCornerMarkers className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#171717]">
                                {mod.pictureUrl && <img src={mod.pictureUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-white/35 font-bold text-xs select-none">[</span>
                                  <h3 className="truncate text-xs md:text-sm font-bold text-white tracking-tight">{mod.name}</h3>
                                  <span className="text-white/40 text-xs">▶</span>
                                  <span className="text-white/35 font-bold text-xs select-none">]</span>
                                </div>
                                <p className="mt-1 font-mono text-[10px] text-white/35">
                                  {[
                                    mod.author ? `AUTHOR: ${mod.author.toUpperCase()}` : null,
                                    mod.version ? `VER: ${mod.version}` : null,
                                  ].filter(Boolean).join(" | ")}
                                </p>
                              </div>
                              <div className="ml-auto flex items-center gap-3 font-mono">
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  displayedEnabled && mod.manifestPath
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : displayedEnabled
                                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                    : mod.status === "downloaded"
                                      ? "border-white/10 bg-white/[0.04] text-white/50"
                                      : "border-white/10 bg-white/[0.04] text-white/30"
                                }`}>
                                  {isBusy
                                    ? displayedEnabled ? "ATIVANDO..." : "DESATIVANDO..."
                                    : displayedEnabled
                                    ? mod.manifestPath ? "ACTIVE" : "VERIFY"
                                    : mod.status === "downloaded"
                                      ? "DOWNLOADED"
                                      : "DISABLED"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void removeInstalledMod(mod)}
                                  disabled={isBusy}
                                  aria-label={`Remover ${mod.name}`}
                                  title="Remover do jogo e apagar o download"
                                  className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/35 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-wait disabled:opacity-40"
                                >
                                  {isBusy
                                    ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
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
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div>
                        <h2 className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white sm:text-xl">
                          <Download className="h-5 w-5 text-white/70" />
                          Gerenciador de Downloads
                        </h2>
                        <p className="mt-0.5 text-xs text-white/40">
                          Acompanhe em tempo real os downloads e instalações de mods acionados na Nexus.
                        </p>
                      </div>

                      {downloadHistory.some((item) => item.status === "completed") && (
                        <button
                          type="button"
                          onClick={handleClearCompletedDownloads}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          Limpar Concluídos
                        </button>
                      )}
                    </div>

                    {downloadHistory.length === 0 ? (
                      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                        <Download className="mb-3 h-10 w-10 text-white/15" />
                        <p className="text-sm font-black text-white/60">Nenhum download registrado</p>
                        <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/30">
                          Ao iniciar um download na Nexus Mods, o progresso e o status de instalação aparecerão aqui automaticamente.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {downloadHistory.map((item) => {
                          const isDownloading = item.status === "downloading" || item.status === "resolving";
                          const isInstalling = item.status === "installing";
                          const isCompleted = item.status === "completed";
                          const isError = item.status === "error";

                          const total = item.totalBytes || 0;
                          const received = item.receivedBytes || 0;
                          const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

                          return (
                            <div
                              key={item.id}
                              className="group relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                  {item.pictureUrl ? (
                                    <img src={item.pictureUrl} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <PackageOpen className="h-5 w-5 text-white/30" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="truncate text-sm font-black text-white">
                                      {item.modName || `Mod #${item.modId}`}
                                    </h3>
                                    {item.version && (
                                      <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-white/50">
                                        v{item.version}
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-0.5 text-xs text-white/40">
                                    {item.modAuthor ? `por ${item.modAuthor}` : `ID: ${item.modId}`}
                                  </p>

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {item.status === "resolving" && (
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        Obtendo servidor...
                                      </span>
                                    )}

                                    {item.status === "downloading" && (
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                                        <Download className="h-3.5 w-3.5 animate-bounce" />
                                        Baixando ({percent}%) • {formatBytes(received)} / {formatBytes(total)}
                                      </span>
                                    )}

                                    {isInstalling && (
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        Instalando mod...
                                      </span>
                                    )}

                                    {isCompleted && (
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {item.installed ? "Instalado com sucesso" : "Download concluído"}
                                      </span>
                                    )}

                                    {isError && (
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        {item.error || item.installationError || "Falha no download"}
                                      </span>
                                    )}
                                  </div>

                                  {isDownloading && (
                                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {item.filePath && (
                                  <button
                                    type="button"
                                    onClick={() => void openNexusDownloadLocation(item.gameDomain || gameDomain)}
                                    title="Abrir pasta do arquivo"
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
                                  >
                                    <FolderOpen className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.id) handleRemoveDownloadCard(item.id);
                                  }}
                                  title="Remover do histórico"
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-red-500/20 hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">Preparação do jogo</p>
                        <h2 className="mt-2 text-2xl font-black text-white">Configurar integração</h2>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/55">
                            <KeyRound className="h-4 w-4" /> Conta Nexus de desenvolvimento
                          </div>
                          {nexusConnection.connected && (
                            <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300/75">
                              Conectado
                            </span>
                          )}
                        </div>

                        {connectionLoading ? (
                          <div className="flex h-20 items-center justify-center gap-2 text-xs text-white/35">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Verificando conexão
                          </div>
                        ) : nexusConnection.connected ? (
                          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-black text-emerald-100/80">
                                  {nexusConnection.account?.name || "Chave pessoal validada"}
                                </p>
                                <p className="mt-1 text-[10px] leading-relaxed text-emerald-100/35">
                                  A chave está criptografada pelo Windows e permanece somente neste computador.
                                </p>
                                {nexusConnection.account?.rateLimit.dailyRemaining !== null
                                  && nexusConnection.account?.rateLimit.dailyRemaining !== undefined && (
                                  <p className="mt-2 text-[9px] font-bold text-white/25">
                                    {nexusConnection.account.rateLimit.dailyRemaining} requisições diárias restantes
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeNexusConnection()}
                                disabled={connectionBusy}
                                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-[9px] font-black uppercase tracking-wider text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
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
                            <p className="mb-4 text-xs leading-relaxed text-white/35">
                              Durante a avaliação, cada pessoa usa sua própria chave pessoal. Ela não é enviada ao Render,
                              Netlify, Supabase ou aos servidores do Phelierium.
                            </p>
                            {!nexusConnection.encryptionAvailable ? (
                              <p className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3 text-xs text-red-200/65">
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
                                    className="h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 pr-11 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPersonalKey((visible) => !visible)}
                                    aria-label={showPersonalKey ? "Ocultar chave" : "Mostrar chave"}
                                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
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
                                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  {connectionBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                  Validar e salvar
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={openNexusApiKeys}
                              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-white/35 transition hover:text-white/65"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir página de chaves pessoais da Nexus
                            </button>
                          </>
                        )}

                        {connectionError && (
                          <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-red-200/65">
                            {connectionError}
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/55">
                          <FolderOpen className="h-4 w-4" /> Pasta do jogo
                        </div>
                        <button
                          type="button"
                          onClick={() => void onChooseFolder()}
                          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 text-left transition hover:bg-white/[0.06]"
                        >
                          <HardDrive className="h-4 w-4 shrink-0 text-white/35" />
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-white/60">
                            {gameFolder || "Selecionar pasta do jogo"}
                          </span>
                          {gameFolder && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                        </button>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/55">
                          <PackageOpen className="h-4 w-4" /> Domínio Nexus
                        </div>
                        <p className="mb-4 text-xs leading-relaxed text-white/35">
                          É o trecho da URL antes de <code className="text-white/55">/mods</code>.
                          Exemplo: <code className="text-white/55">skyrimspecialedition</code>.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            value={domainDraft}
                            onChange={(event) => setDomainDraft(cleanDomain(event.target.value))}
                            placeholder="dominio-do-jogo"
                            className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
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
                            className="h-12 rounded-xl bg-white px-5 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-35"
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
  <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-6 text-center">
    <PackageOpen className="mb-3 h-7 w-7 text-white/15" />
    <p className="text-sm font-black text-white/55">{title}</p>
    <p className="mt-1 max-w-md text-xs leading-relaxed text-white/30">{description}</p>
    <button
      type="button"
      onClick={onAction}
      className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[9px] font-black uppercase tracking-wider text-white/45 transition hover:bg-white/10 hover:text-white"
    >
      Continuar
    </button>
  </div>
);

export default ModGameDetailPanel;
