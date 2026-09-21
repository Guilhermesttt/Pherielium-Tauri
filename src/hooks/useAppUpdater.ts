import { useEffect, useState } from "react";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "dev";

export function useAppUpdater() {
  const [currentVersion, setCurrentVersion] = useState<string>("0.0.0");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [newVersionInfo, setNewVersionInfo] = useState<any>(null);

  useEffect(() => {
    // Busca versão inicial
    if ((window as any).electronAPI?.getVersion) {
      (window as any).electronAPI.getVersion().then(setCurrentVersion).catch(console.error);
    }
    if ((window as any).electronAPI?.getUpdateState) {
      (window as any).electronAPI
        .getUpdateState()
        .then((state: any) => {
          if (!state?.status || state.status === "idle") return;
          setUpdateStatus(state.status);
          if (state.info) setNewVersionInfo(state.info);
          if (typeof state.progress?.percent === "number") {
            setDownloadProgress(Math.round(state.progress.percent));
          }
          if (state.error) setErrorMessage(state.error);
        })
        .catch(console.error);
    }

    if ((window as any).electronAPI?.onUpdateMessage) {
      const unsubscribe = (window as any).electronAPI.onUpdateMessage((msg: string, data: any) => {

        if (msg === "checking-for-update") {
          setUpdateStatus("checking");
        } else if (msg === "update-available") {
          setUpdateStatus("available");
          setNewVersionInfo(data);
        } else if (msg === "download-started") {
          setUpdateStatus("downloading");
          setDownloadProgress(0);
        } else if (msg === "update-not-available") {
          setUpdateStatus("not-available");
        } else if (msg === "update-downloaded") {
          setUpdateStatus("downloaded");
          setNewVersionInfo(data);
        } else if (msg === "error") {
          setUpdateStatus("error");
          setErrorMessage(data || "Erro desconhecido ao atualizar.");
        }
      });
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    if ((window as any).electronAPI?.onDownloadProgress) {
      const unsubscribe = (window as any).electronAPI.onDownloadProgress((progressInfo: any) => {
        setUpdateStatus("downloading");
        if (progressInfo && typeof progressInfo.percent === "number") {
          setDownloadProgress(Math.round(progressInfo.percent));
        }
      });
      return unsubscribe;
    }
  }, []);

  const checkForUpdates = async () => {
    if (!(window as any).electronAPI?.checkForUpdates) return;
    setUpdateStatus("checking");
    setErrorMessage("");
    try {
      const res = await (window as any).electronAPI.checkForUpdates();
      if (res && res.status === "development") {
        setUpdateStatus("dev");
      }
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err.message || "Não foi possível buscar atualizações.");
    }
  };

  const installUpdate = () => {
    if ((window as any).electronAPI?.quitAndInstallUpdate) {
      (window as any).electronAPI.quitAndInstallUpdate();
    }
  };

  const downloadUpdate = async () => {
    if (!(window as any).electronAPI?.downloadUpdate) return;
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    setErrorMessage("");
    try {
      await (window as any).electronAPI.downloadUpdate();
    } catch (err) {
      setUpdateStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Não foi possível baixar a atualização.",
      );
    }
  };

  return {
    currentVersion,
    updateStatus,
    downloadProgress,
    errorMessage,
    newVersionInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
