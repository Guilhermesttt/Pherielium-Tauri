# Pherielium 1.0.3-rc.5: notas da versão de teste

**Versão de teste, não publicada.** Enviada direto aos testadores; os dois lados da conversa precisam do rc. Roteiro: `docs/TESTES-RC1.md`. Procedimento de geração: `docs/release-rc.md`.
Este build inclui o DevTools (F12) para os testes; o instalador oficial não terá.

## O que entra

| Área | O que muda | Onde ler |
| --- | --- | --- |
| Áudio da transmissão (F-áudio) | A captura do áudio do PC (tudo menos o Pherielium) passa a iniciar de fato; antes a ativação falhava e a tela inteira saía muda | `docs/backend-audit/08-f0-audio-ativacao.md` |
| Áudio da transmissão (getDisplayMedia) | O navegador nunca é fonte de áudio (evita a voz da chamada voltar em eco); sem áudio nativo, um aviso único | commit `60e8321` |
| Texto da caixa de áudio | "Áudio do PC (todos os apps, menos o Pherielium)" | commit `ed78d87` |
| Volume (V-fix) | O slider da transmissão e o da voz passam a funcionar de 0 a 100%: nenhum `<video>` toca áudio de LiveKit; o `<audio>` do slider é o único audível; voltar a saída para "Padrão" funciona | `docs/backend-audit/09-v-volume-transmissao.md` |
| Chamadas 1:1 (D1) | Até 3 tentativas de conectar ao LiveKit; sem fallback silencioso para P2P; convite enviado em paralelo; motivo da falha registrado | `docs/decisions/0006-*.md`, `docs/protocol-compat.md` |
| Compatibilidade (A1) | Versão de protocolo (`pv`) nas mensagens de presença e convite; DM entre apps novos sem o texto no canal público; o app novo deixa de publicar no canal global de presença; filtros de eventos de chamada em modo `log` | `docs/protocol-compat.md` |
| Diagnóstico | Presença (B0), áudio/transmissão, `displaySurface`, falhas de chamada e relatório dos filtros, todos atrás de flags | `docs/presence-diagnostics.md` |
| Convite de call como notificação (I0 + N-invite) | Convite vira notificação (toast, notch e overlay do jogo), sem toque, com expiração local de 15 min; **desligado por padrão** | `docs/invite-notifications.md` |
| Instalação | `drivers:fetch` verifica SHA-256 e assinatura Authenticode dos drivers; o instalador agora detecta drivers já instalados (antes sempre achava que faltavam) e usa os switches do Advanced Installer, o que elimina as janelas "Invalid command line" | `docs/release-rc.md`, `docs/backend-audit/12-drivers-invalid-command-line.md` |

## O que NÃO entra

- **Canais Realtime privados (A2, ADR-0001):** os canais continuam públicos; a mitigação é parcial (A1).
- **Convite e canais privados salvos autoritativos (I e R):** dependem do schema e do código da API; só existe a versão local e não autoritativa (I0).
- **Atualização automática (updater, ADR 0010):** não configurada; a troca de versão é manual.
- **Detecção ambiente de jogos (C)** e mitigações de presença (B1): aguardam os resultados de P-1 a P-3.
- **F1** (excluir só a árvore do WebView2 da captura): condicional ao P-10 refeito.
- Chamada 1:1 como canal efêmero, mensagens offline (E), heartbeat nativo (B4), reordenação da captura por superfície.

## Flags e padrões (`localStorage`, prefixo `pherielium_`)

| Flag | Padrão | Efeito |
| --- | --- | --- |
| `invite_notifications` | **ligada** (desde o rc.4) | `0` volta ao toque/modal de ligação; ligada, convites (inclusive a ligação 1:1) chegam como notificação |
| `event_guards` | `log` | `enforce` descarta eventos rejeitados; `off` desliga |
| `dm_ping_only` | ligada | `0` volta a enviar o texto da DM no canal público |
| `presence_global_bus` | desligada | `1` volta a publicar no canal global de presença |
| `call_invite_first` | ligada | `0` envia o convite só depois da mídia |
| `channel_invite_ring` | desligada | remetente: `1` volta a tocar como ligação no convite de canal; desligada, só o cartão no chat |
| `p2p_fallback` | desligada | `1` permite cair para P2P se o LiveKit falhar |
| `stream_debug` | desligada | diagnóstico de transmissão, áudio e `displaySurface` |
| `presence_debug` | desligada | diagnóstico de presença |

Blocos para ligar e desligar as flags de teste: início de `docs/TESTES-RC1.md`.

## Limitações conhecidas

1. **O app antigo (1.0.2) não se atualiza sozinho** e continua em canais públicos; os filtros do rc só barram abuso casual.
2. **Convite como notificação é local:** expira 15 min após chegar (relógio do receptor), reiniciar o app perde os pendentes, e quem tem a hora do PC errada vê expirações cedo ou tarde. Recusar só dispensa localmente (não avisa quem convidou). Sem cartão local para o convite 1:1 antigo.
3. **Com a flag de convite ligada, o notch reage ao convite como a um toque** (mascote animado, notch aparece sozinho, sem espiar). Isso é intencional nesta rodada e fica isolado no commit `d94f8ad`.
4. **Som do convite:** com o overlay disponível, o aviso é o do overlay (não o som de mensagem); o toast fica mudo. Se o overlay não exibir, o convite chega mudo (anotar no teste).
5. **Áudio de janela única:** o áudio nativo é "todos os apps, menos o Pherielium", então compartilhar uma janela também envia músicas e notificações de outros apps. Política por superfície aguarda a medição do `displaySurface`.
6. **P2P e eco local:** o `<video>` toca o áudio do stream e a saída de áudio escolhida não vale para ele (só relevante com `p2p_fallback`).
7. **Presença:** a causa de "amigo offline enquanto joga" não está provada; este rc só mede. Jogo aberto fora do hub não é detectado (item C do backlog).
8. **Volume acima de 100%** (boost) não funciona: o elemento de áudio é limitado a 1,0; o slider da transmissão vai até 100%.
9. **Instalador não assinado:** o SmartScreen avisa na instalação (Mais informações > Executar assim mesmo).
10. **Notificação nativa do Windows** para o hub oculto não foi implementada: o plugin não devolve clique.
11. A verificação de assinatura dos drivers só roda no Windows; fora dele só vale o SHA-256.
