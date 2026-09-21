export type Platform = "steam" | "epic";

export type PlatformConnectingPhase = "opening-login" | "authenticating";

export type PlatformSyncingPhase =
  | "reading-library"
  | "enriching-games"
  | "saving-games"
  | "refreshing-profile";

export type PlatformDisconnectingPhase =
  | "revoking-account"
  | "removing-local-data"
  | "removing-cloud-data"
  | "refreshing-profile";

export type PlatformOperationKind = "connect" | "sync" | "disconnect";

export type PlatformOperationState =
  | { status: "idle" }
  | {
      status: "connecting";
      operationId: string;
      phase: PlatformConnectingPhase;
    }
  | {
      status: "syncing";
      operationId: string;
      phase: PlatformSyncingPhase;
      completed?: number;
      total?: number;
    }
  | {
      status: "disconnecting";
      operationId: string;
      phase: PlatformDisconnectingPhase;
    }
  | {
      status: "error";
      operationId: string;
      operation: PlatformOperationKind;
      message: string;
    };

export type PlatformOperationsState = Record<Platform, PlatformOperationState>;

export type PlatformOperationAction =
  | {
      type: "START_CONNECT";
      platform: Platform;
      operationId: string;
      phase?: PlatformConnectingPhase;
    }
  | {
      type: "START_SYNC";
      platform: Platform;
      operationId: string;
      phase?: PlatformSyncingPhase;
      total?: number;
    }
  | {
      type: "START_DISCONNECT";
      platform: Platform;
      operationId: string;
      phase?: PlatformDisconnectingPhase;
    }
  | {
      type: "UPDATE_PHASE";
      platform: Platform;
      operationId: string;
      phase:
        | PlatformConnectingPhase
        | PlatformSyncingPhase
        | PlatformDisconnectingPhase;
      completed?: number;
      total?: number;
    }
  | {
      type: "FINISH_SUCCESS";
      platform: Platform;
      operationId: string;
    }
  | {
      type: "FAIL_ERROR";
      platform: Platform;
      operationId: string;
      operation: PlatformOperationKind;
      message: string;
    }
  | {
      type: "RESET";
      platform: Platform;
    };
