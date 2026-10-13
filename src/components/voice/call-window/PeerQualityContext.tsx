import React, { createContext, useContext, useMemo } from "react";
import type { LinkQuality } from "../../../services/voiceCall/livekitHealth";

/** Qualidade de conexão por participante (meu enlace e o dos outros, via LiveKit). */
interface PeerQualityValue {
  local: LinkQuality;
  peers: Record<string, LinkQuality>;
}

const PeerQualityContext = createContext<PeerQualityValue>({ local: "unknown", peers: {} });

export const PeerQualityProvider: React.FC<{
  local: LinkQuality;
  peers: Record<string, LinkQuality>;
  children: React.ReactNode;
}> = ({ local, peers, children }) => {
  const value = useMemo(() => ({ local, peers }), [local, peers]);
  return <PeerQualityContext.Provider value={value}>{children}</PeerQualityContext.Provider>;
};

/** Qualidade do participante do cartão: o próprio cartão local usa o meu enlace. */
export const usePeerLinkQuality = (feed: { isLocal: boolean; peerId?: string }): LinkQuality => {
  const { local, peers } = useContext(PeerQualityContext);
  if (feed.isLocal) return local;
  return (feed.peerId ? peers[feed.peerId] : undefined) ?? "unknown";
};
