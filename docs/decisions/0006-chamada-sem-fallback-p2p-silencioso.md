# ADR-0006: Chamada 1:1 sem fallback silencioso para P2P

- Status: **Aceito** (decisão do dono em 2026-10-12). Implementado na fatia D1.

## Contexto
Em `startCall`, qualquer erro do LiveKit levava quem ligava para o P2P (`transportPolicy.ts`, antes: `start-call` sempre `true`), enquanto quem atendia só ia para P2P se o LiveKit estivesse desligado globalmente.
Resultado: os dois ficavam em transportes diferentes e a chamada ficava muda ("não ouço meu amigo"). Além disso:
- o convite só saía depois de o LiveKit conectar (`useVoiceCall.ts`), então um servidor frio (> 35 s) atrasava o toque no destino;
- sem microfone adquirido, a oferta P2P saía sem seção de mídia e o `setLocalDescription` falhava com `max-bundle configured but session description has no BUNDLE group`.

## Decisão
1. **Até 3 tentativas** de conectar ao LiveKit, com espera de 1 s e 2 s entre elas (`livekitConnectPolicy.ts`). Falhas deliberadas (sessão inválida, sala inválida, LiveKit desligado) não repetem.
2. Se esgotar, a chamada **termina com mensagem clara** nos dois lados (`call:end` com `reason: "error"`) e o **motivo é registrado** (`livekit_disabled`, `token_unauthorized`, `token_timeout`, `network`, `room_invalid`, `media_error`): `window.pherieliumCallFailures()`.
3. O P2P **não é apagado**. Só é usado quando (a) o backend declara o LiveKit desligado (os dois lados recebem a mesma resposta, então ficam no mesmo transporte) ou (b) a flag manual `pherielium_p2p_fallback=1` está ligada (padrão desligada).
4. **Convite em paralelo com a mídia**: o convite sai logo depois do microfone; o cronômetro de "não atendeu" e o toque começam no envio. Se o destino atender antes de o LiveKit conectar, `onAnswer` espera a mídia. Flag `pherielium_call_invite_first=0` restaura a ordem antiga.
5. O teste de ICE (`runIcePreflightCheck`) só roda quando o P2P está habilitado.
6. A oferta P2P garante ao menos uma seção de áudio (`addTransceiver("audio")`), o que elimina o erro de `max-bundle` quando o microfone não foi adquirido.
7. A decisão de fallback das salas para o RPC do Supabase passa a ser por **status HTTP** (`voiceRoomFallbackPolicy.ts`), em commit separado.

## Alternativas
- Manter o P2P como rede de segurança em qualquer falha: reproduz a assimetria. Rejeitada.
- Remover o código P2P: perde a opção de teste e o caminho para quando o LiveKit for desligado. Rejeitada; fica atrás de flag.
- Sincronizar o transporte entre os dois lados por sinalização: exige o estado de sessão do servidor (ADR-0004), fora desta fatia.

## Consequências
- Menos chamadas "mudas": ou conecta nos dois lados, ou termina avisando.
- Um servidor de voz fora do ar passa a impedir chamadas em vez de degradar para P2P (que só funcionava de forma assimétrica).
- Risco: o destino toca antes de o chamador ter mídia pronta; coberto por `onAnswer` aguardando `mediaPendingRef`.
