import React, { createContext, useContext } from "react";
import type { MediaTransport } from "../../../services/voiceCall/feedAudioPolicy";

/**
 * Transporte de mídia da chamada, para que todo `VideoRenderer` aplique a mesma regra de áudio
 * (ver services/voiceCall/feedAudioPolicy.ts): sob LiveKit o `<video>` nunca toca; o `<audio>` do `attach()` é o único audível.
 * O padrão `none` mantém o comportamento anterior fora de uma chamada.
 */
const MediaTransportContext = createContext<MediaTransport>("none");

export const MediaTransportProvider: React.FC<{ transport: MediaTransport; children: React.ReactNode }> = ({
  transport,
  children,
}) => <MediaTransportContext.Provider value={transport}>{children}</MediaTransportContext.Provider>;

export const useMediaTransport = (): MediaTransport => useContext(MediaTransportContext);
