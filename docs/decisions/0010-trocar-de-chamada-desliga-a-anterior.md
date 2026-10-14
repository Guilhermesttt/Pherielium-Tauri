# ADR-0010: Atender/entrar numa chamada nova desliga a atual (estilo Discord)

- Status: **Aceito** (pedido do dono, 2026-10-14).

## Contexto
`startCall` (ligar para alguém) já desligava a chamada atual antes de ligar para outra pessoa
(`if (callState !== "idle") cleanUpCall();`). Os outros três pontos de entrada — atender um
convite pendente (`acceptPendingInviteRef`), entrar numa sala persistente (`joinRoom`) e entrar
por um cartão de convite no chat (`joinActiveCall`) — faziam o oposto: mostravam "Você já está em
uma chamada." e recusavam, em vez de trocar. Resultado relatado: impossível atender uma segunda
ligação estando em outra, diferente do Discord (que desconecta da atual e entra na nova sem pedir).

Investigando o bug relacionado ("o erro aparecia com recorrência"), a causa raiz encontrada foi
outra: `acquireAudioStream()` (captura do microfone, `getUserMedia`) é aguardada sem prazo em
`answerCall`/`joinRoom`/`joinActiveCall`. Se travar — driver de áudio preso ou prompt de permissão
do Windows sem resposta, ambos observados em produção —, o `try` nunca chega ao `catch`,
`cleanUpCall()` nunca roda, e `callState` fica preso fora de `"idle"` até o app reiniciar: toda
tentativa seguinte de atender ou entrar em qualquer chamada mostra o aviso, repetidamente.

## Decisão
1. **`getUserMedia` com prazo de 12 s** (`src/services/voiceCall/mediaTimeout.ts`,
   `withTimeout`/`MediaTimeoutError`). Estourou o prazo: mensagem específica, sem tentar de novo
   (se travou uma vez, tentar de novo com constraints relaxadas só prolongaria o travamento) —
   segue sem microfone (mutado) em vez de travar o fluxo inteiro.
2. **Os quatro pontos de entrada passam a desligar a chamada atual antes de prosseguir**, em vez
   de recusar: `answerCall`, `acceptPendingInviteRef`, `joinRoom`, `joinActiveCall` — mesmo padrão
   que `startCall` já usava. `joinRoom` mantém o caso "já está nesta mesma sala": aí só reabre a
   janela, não desliga nada.
3. **Exceção em `answerCall`:** `callState === "ringing-in"` não conta como "outra chamada" — é o
   próprio convite tocando sendo atendido agora, não uma segunda ligação. Desligar ali derrubaria a
   notificação que a pessoa está tentando atender. Essa exceção é só de `answerCall`: em `joinRoom`/
   `joinActiveCall`, um convite tocando enquanto se entra numa sala diferente é mesmo outra coisa, e
   desliga normalmente.
4. Os quatro pontos chamam `cleanUpCall()` de forma redundante entre si quando um delega para o
   outro (ex.: `joinActiveCall` → `joinRoom`). Isso é proposital e inofensivo: `cleanUpCall()` já é
   seguro de chamar em cima de um estado já limpo (cada passo interno tem sua própria guarda).

## Alternativas
- Pedir confirmação antes de trocar ("Desligar a chamada atual?"): mais seguro contra cliques
  acidentais, mas é o oposto do que o Discord faz e do que foi pedido; fica como possível ajuste
  futuro se usuários reclamarem de trocas acidentais.
- Um contador de geração (epoch) para invalidar tentativas de conexão superadas, em vez de confiar
  em `mediaCancelledRef`/`rejoinEpochRef` (já existentes) via `cleanUpCall()`: mais robusto para
  corridas entre duas tentativas de conexão simultâneas, mas é uma mudança bem maior em código de
  chamada que já funciona (transmissão, reconexão automática, mesh P2P) — fora do escopo pedido
  ("não mexa nas transmissões e nem nas calls que já estão funcionando corretamente").

## Consequências
- Atender uma chamada nova, ou entrar numa sala/convite novo, sempre desliga a chamada atual
  primeiro — sem exigir que a pessoa saia manualmente antes.
- Uma captura de microfone travada não trava mais permanentemente o estado de chamada do app.
- Não corrigido aqui (fora do alcance deste repositório): o limite de participantes de canais de
  voz (`voice_rooms.max_participants`) ainda pode estar em 4 no banco Supabase em produção, mesmo
  com o cliente e a função RPC já pedindo 10 — a migration que corrige a constraint
  (`supabase/migrations/20261009140000_voice_rooms_max_participants.sql`) existe no repositório mas
  precisa ser **aplicada** ao projeto Supabase (este agente não roda comandos contra o banco de
  produção). O limite de participantes de chamadas 1:1/P2P expandidas já é 10 no cliente
  (`MAX_CALL_PARTICIPANTS`, `src/services/voiceCall/limits.ts`); se ainda aparecer 4 na prática, o
  teto está sendo aplicado pelo backend do LiveKit (fora deste repositório).
