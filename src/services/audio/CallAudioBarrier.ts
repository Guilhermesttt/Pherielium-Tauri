/**
 * CallAudioBarrier — Barreira de Áudio da Chamada para Transmissão de Tela
 * 
 * Impede que as vozes dos participantes da chamada (amigos) vazem no áudio da stream/transmissão.
 * 
 * Arquitetura de 2 camadas:
 * 1. Sidechain Band-Pass VCA: Monitora em tempo real a energia RMS dos participantes da chamada.
 *    Quando algum amigo fala na chamada, a faixa espectral da voz (300Hz - 3400Hz) da captura de desktop
 *    é atenuada dinamicamente via sidechain em até -26dB, impedindo que a voz do amigo seja capturada e retransmitida.
 * 2. Transparência Dinâmica: Quando ninguém na chamada está falando, todo o espectro do jogo/computador
 *    passa 100% inalterado com fidelidade cristalina.
 */

export interface CallAudioBarrierInstance {
  processedTrack: MediaStreamTrack;
  destroy: () => void;
}

export function createCallAudioBarrier(
  rawTrack: MediaStreamTrack,
  getRemoteStreams: () => MediaStream[],
): CallAudioBarrierInstance {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const ctx = new AudioCtx({ sampleRate: 48000, latencyHint: "interactive" });

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { });
  }

  // 1. Entrada do áudio da tela capturada
  const screenInputStream = new MediaStream([rawTrack]);
  const screenSource = ctx.createMediaStreamSource(screenInputStream);

  // 2. Filtros de crossover espectral para o áudio da tela
  // Caminho A: Graves (sub-graves e explosões do jogo < 280Hz)
  const lowPass = ctx.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.setValueAtTime(280, ctx.currentTime);
  lowPass.Q.setValueAtTime(0.707, ctx.currentTime);

  // Caminho B: Agudos (efeitos sonoros altos do jogo > 3500Hz)
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(3500, ctx.currentTime);
  highPass.Q.setValueAtTime(0.707, ctx.currentTime);

  // Caminho C: Faixa de Voz Humana (300Hz - 3400Hz)
  const voiceBandLow = ctx.createBiquadFilter();
  voiceBandLow.type = "highpass";
  voiceBandLow.frequency.setValueAtTime(280, ctx.currentTime);

  const voiceBandHigh = ctx.createBiquadFilter();
  voiceBandHigh.type = "lowpass";
  voiceBandHigh.frequency.setValueAtTime(3500, ctx.currentTime);

  // VCA Dinâmico para a faixa de voz
  const voiceBandGain = ctx.createGain();
  voiceBandGain.gain.setValueAtTime(1.0, ctx.currentTime);

  // 3. Conexões de áudio da tela
  screenSource.connect(lowPass);
  screenSource.connect(highPass);

  screenSource.connect(voiceBandLow);
  voiceBandLow.connect(voiceBandHigh);
  voiceBandHigh.connect(voiceBandGain);

  // 4. Somador para a saída processada
  const destination = ctx.createMediaStreamDestination();
  lowPass.connect(destination);
  highPass.connect(destination);
  voiceBandGain.connect(destination);

  // 5. Monitoramento Sidechain das vozes dos amigos na chamada
  const callMonitorGain = ctx.createGain();
  callMonitorGain.gain.setValueAtTime(1.0, ctx.currentTime);

  const callAnalyser = ctx.createAnalyser();
  callAnalyser.fftSize = 256;
  callAnalyser.smoothingTimeConstant = 0.3;
  callMonitorGain.connect(callAnalyser);

  const remoteSources = new Map<MediaStream, MediaStreamAudioSourceNode>();

  const dataArray = new Uint8Array(callAnalyser.frequencyBinCount);
  let isDestroyed = false;
  let animId: number | null = null;

  const updateRemoteAudioSources = () => {
    if (isDestroyed) return;
    try {
      const activeStreams = getRemoteStreams();
      const currentActiveSet = new Set(activeStreams);

      // Remover streams que já não existem
      remoteSources.forEach((sourceNode, st) => {
        if (!currentActiveSet.has(st)) {
          try {
            sourceNode.disconnect();
          } catch { }
          remoteSources.delete(st);
        }
      });

      // Adicionar novas streams ativas da chamada ao monitor
      activeStreams.forEach((st) => {
        if (!remoteSources.has(st) && st.getAudioTracks().length > 0) {
          try {
            const node = ctx.createMediaStreamSource(st);
            node.connect(callMonitorGain);
            remoteSources.set(st, node);
          } catch { }
        }
      });
    } catch { }
  };

  // Loop de monitoramento de energia e atenuação sidechain (a cada ~16ms)
  let lastRemoteSync = 0;

  const processLoop = () => {
    if (isDestroyed) return;

    const now = performance.now();
    if (now - lastRemoteSync > 500) {
      lastRemoteSync = now;
      updateRemoteAudioSources();
    }

    callAnalyser.getByteFrequencyData(dataArray);

    // Calcular energia RMS da voz dos amigos
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Se a energia da chamada for significativa (> threshold), alguém na call está falando
    // e nós atenuamos a faixa de voz no áudio da stream para não vazar a voz deles!
    const isCallActive = rms > 12; // ~ -36dBFS
    const targetGain = isCallActive ? 0.05 : 1.0; // -26dB quando falando, 0dB quando em silêncio

    const rampTime = isCallActive ? 0.015 : 0.06; // Ataque rápido (15ms), release suave (60ms)
    try {
      voiceBandGain.gain.setTargetAtTime(targetGain, ctx.currentTime, rampTime);
    } catch {
      voiceBandGain.gain.value = targetGain;
    }

    animId = requestAnimationFrame(processLoop);
  };

  animId = requestAnimationFrame(processLoop);

  const destroy = () => {
    if (isDestroyed) return;
    isDestroyed = true;

    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    remoteSources.forEach((node) => {
      try {
        node.disconnect();
      } catch { }
    });
    remoteSources.clear();

    try {
      screenSource.disconnect();
      lowPass.disconnect();
      highPass.disconnect();
      voiceBandLow.disconnect();
      voiceBandHigh.disconnect();
      voiceBandGain.disconnect();
      callMonitorGain.disconnect();
      callAnalyser.disconnect();
    } catch { }

    try {
      destination.stream.getTracks().forEach((t) => t.stop());
    } catch { }

    try {
      if (ctx.state !== "closed") {
        void ctx.close();
      }
    } catch { }
  };

  const processedTrack = destination.stream.getAudioTracks()[0] || rawTrack;

  return {
    processedTrack,
    destroy,
  };
}
