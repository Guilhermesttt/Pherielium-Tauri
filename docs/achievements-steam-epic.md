# Conquistas de jogos Steam e Epic: como são detectadas e o que foi corrigido

## Como funciona hoje [VERIFICADO: `src/hooks/useGamePresence.ts`]
1. **Só há detecção enquanto o hub considera que o jogo está rodando** (`currentPresenceGame`). Jogo aberto fora do hub, ou detectado tarde, não é acompanhado (backlog C).
2. Com o jogo rodando, o app consulta a API (Render) **a cada 15 s** (`/api/steam/achievements` para Steam; `fetchEpicAchievements` para Epic). O primeiro retorno vira o "baseline"; o que aparecer desbloqueado depois disso é "novo".
3. Cada conquista nova chama `unlockAchievement` (Rust `achievement_unlock`), que grava o progresso, emite `achievement:realtime-unlock` e manda o evento ao overlay. O modal de detalhes (`useGameDetailAsync`) escuta esse evento e marca a conquista.
4. O **tier** vem da raridade global (porcentagem): ≤ 5% platina, ≤ 20% ouro, ≤ 50% prata, senão bronze.
5. O app local só lê **arquivos de save de emuladores** (`achievement_watcher.rs`); para jogos oficiais da Steam/Epic a fonte é sempre a API do servidor.

## O que foi corrigido (rc.5)
| Sintoma | Causa | Correção |
| --- | --- | --- |
| Conquista aparecia como **platina** | Se o servidor devolvia porcentagem **0** (sem dado), `0 <= 5` virava platina | `tierFromGlobalPercent`: ausente, inválida ou ≤ 0 é "desconhecida" e vira **bronze** (teste de regressão) |
| **Modal de detalhes** mostrando a lista antiga | Ao abrir, usava o cache de **até 15 min** | O modal aceita cache de no máximo **60 s** (`maxAgeMs`); o polling já ignorava o cache |

## O que NÃO está provado e como medir
O atraso de ~40 min até o aviso **não** foi reproduzido. As causas possíveis ficam fora do app:
- **Servidor da API** (cache na rota `/api/steam/achievements`; o código não está neste repositório);
- **Steam Web API**: alguns jogos só gravam a conquista na Steam ao fechar ou em intervalos;
- **Jogo não detectado como "rodando"** pelo hub (o polling nem começa).

Para medir onde está o atraso, ligue a flag e acompanhe o console (F12) do jogador enquanto joga um jogo Steam pelo hub:

```js
localStorage.setItem("pherielium_stream_debug", "1"); location.reload();
```
Aparecem, a cada 15 s, linhas `[stream-debug:achievement-poll]` (jogo, `fetchMs`, total e desbloqueadas) e, quando detecta, `[stream-debug:achievement-detected]` (conquista, porcentagem, tier e **hora da detecção**).
**Teste:** desbloqueie uma conquista, anote a hora real; compare com a hora de `achievement-detected`. Se `unlocked` só sobe 30 a 40 min depois, a demora está na API/Steam, não no app; se nunca aparece `achievement-poll`, o jogo não foi detectado como rodando.

## Pendências
- Ler/medir o servidor (cache da rota) e o comportamento da Steam por jogo.
- Epic: o desenho é o mesmo (polling de 15 s); depende da resposta de `fetchEpicAchievements`.
- Jogo aberto fora do hub: detecção ambiente (backlog C).
