import type {
  Platform,
  PlatformOperationAction,
  PlatformOperationsState,
  PlatformOperationState,
} from "../types/platformOperations";

export const createInitialPlatformOperationsState = (): PlatformOperationsState => ({
  steam: { status: "idle" },
  epic: { status: "idle" },
});

export const isPlatformBusy = (
  state: PlatformOperationsState,
  platform: Platform,
): boolean => {
  const current = state[platform];
  return current.status !== "idle" && current.status !== "error";
};

const platformName = (platform: Platform) =>
  platform === "steam" ? "Steam" : "Epic";

export const getPlatformPhaseLabel = (
  phase: string,
  _language: string = "pt-BR",
): string => {
  switch (phase) {
    case "opening-login":
      return "Abrindo tela de login...";
    case "authenticating":
      return "Autenticando conta...";
    case "reading-library":
      return "Lendo biblioteca de jogos...";
    case "reading-achievements":
      return "Lendo conquistas...";
    case "enriching-games":
      return "Obtendo detalhes dos jogos...";
    case "saving-games":
      return "Salvando jogos na biblioteca...";
    case "revoking-account":
      return "Revogando conta...";
    case "removing-local-data":
      return "Removendo dados locais...";
    case "removing-cloud-data":
      return "Removendo dados da nuvem...";
    case "refreshing-profile":
      return "Atualizando perfil...";
    default:
      return "Processando...";
  }
};

export const platformOperationReducer = (
  state: PlatformOperationsState,
  action: PlatformOperationAction,
): PlatformOperationsState => {
  const { platform } = action;
  const current = state[platform];

  switch (action.type) {
    case "START_CONNECT": {
      if (isPlatformBusy(state, platform)) {
        return state;
      }
      return {
        ...state,
        [platform]: {
          status: "connecting",
          operationId: action.operationId,
          phase: action.phase || "opening-login",
        },
      };
    }

    case "START_SYNC": {
      if (isPlatformBusy(state, platform)) {
        return state;
      }
      return {
        ...state,
        [platform]: {
          status: "syncing",
          operationId: action.operationId,
          phase: action.phase || "reading-library",
          total: action.total,
          completed: 0,
        },
      };
    }

    case "START_DISCONNECT": {
      if (isPlatformBusy(state, platform)) {
        return state;
      }
      return {
        ...state,
        [platform]: {
          status: "disconnecting",
          operationId: action.operationId,
          phase: action.phase || "revoking-account",
        },
      };
    }

    case "UPDATE_PHASE": {
      if (
        current.status === "idle" ||
        current.status === "error" ||
        current.operationId !== action.operationId
      ) {
        return state;
      }

      if (current.status === "syncing") {
        return {
          ...state,
          [platform]: {
            ...current,
            phase: action.phase as any,
            completed:
              typeof action.completed === "number"
                ? Math.max(0, action.completed)
                : current.completed,
            total:
              typeof action.total === "number"
                ? Math.max(0, action.total)
                : current.total,
          },
        };
      }

      return {
        ...state,
        [platform]: {
          ...current,
          phase: action.phase as any,
        },
      };
    }

    case "FINISH_SUCCESS": {
      if (
        current.status === "idle" ||
        (current.status !== "error" && current.operationId !== action.operationId)
      ) {
        return state;
      }
      return {
        ...state,
        [platform]: { status: "idle" },
      };
    }

    case "FAIL_ERROR": {
      if (
        current.status !== "idle" &&
        current.status !== "error" &&
        current.operationId !== action.operationId
      ) {
        return state;
      }
      return {
        ...state,
        [platform]: {
          status: "error",
          operationId: action.operationId,
          operation: action.operation,
          message: action.message,
        },
      };
    }

    case "RESET": {
      return {
        ...state,
        [platform]: { status: "idle" },
      };
    }

    default:
      return state;
  }
};
