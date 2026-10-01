export type VoiceTransportContext = "start-call" | "answer-call" | "join-room" | "join-invite";

export const isLiveKitGloballyDisabled = (error: unknown): boolean => {
  const msg = String((error as Error)?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("não habilitado") ||
    msg.includes("nao habilitado") ||
    msg.includes("disabled") ||
    msg.includes("livekit não habilitado")
  );
};

/**
 * P2P fallback is only allowed when LiveKit is globally off, or for the
 * initial 1:1 caller before anyone else joins. Individual SFU failures must
 * not silently isolate one client on P2P while others stay on the SFU.
 */
export const shouldUseP2PFallback = (
  context: VoiceTransportContext,
  livekitError?: unknown,
): boolean => {
  if (context === "start-call") return true;
  return isLiveKitGloballyDisabled(livekitError);
};
