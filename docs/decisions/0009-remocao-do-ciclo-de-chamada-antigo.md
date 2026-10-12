# ADR-0009: Remoção do ciclo antigo de chamada (tocar, atender, perdida, ocupado)

- Status: **Proposto**, para uma fatia **posterior** (depois da fatia I e do corte do app 1.0.2). Nada será removido agora. Mapa completo em `docs/backend-audit/PLAN.md` §17.3.5.

## Contexto
Com o convite como mensagem validada no servidor (ADR-0007), o ciclo do `useVoiceCall` fica sem uso para convites de canal e para chamadas iniciadas pelo app novo: `ringing-in` e o modal de atender, o toque e o timer de 35 s, `answerCall`/`rejectCall`/`call:answer`,
`onAnswer` esperando `mediaPendingRef` (D1), `ringing-out` e o timer "não atendeu", `call:end` com `timeout/busy/rejected`, o envio do convite nos dois canais e o dedupe de convites.
Esses caminhos continuam vivos enquanto houver amigos no 1.0.2.

## Decisão (proposta)
Remover o ciclo antigo em uma fatia própria, **somente quando**: (1) o convite como mensagem estiver em produção há pelo menos um release; (2) o v1 tiver sido cortado (critério de `docs/backend-audit/PLAN.md` §15.3); (3) o notch deixar de depender de `callState === "ringing-in"`.
A remoção entra em commits separados dos de correção, com os testes de caracterização da decomposição do `useVoiceCall` (PLAN §8) rodando antes e depois.

## Alternativas
- Remover agora: quebra a chamada com quem está no 1.0.2. Rejeitada.
- Manter para sempre: o `useVoiceCall` (~4.900 linhas) continua carregando um ciclo que ninguém usa. Rejeitada.

## Consequências
`useVoiceCall` encolhe de forma relevante e as flags `call_invite_first` e `p2p_fallback` perdem sentido. O código P2P só é apagado se o dono decidir (hoje fica atrás de flag, ADR-0006).
