# Convite de call como notificação (fatia I0)

Fatia **front-only e não autoritativa**: não há validação no servidor. A versão com servidor (expiração e cancelamento autoritativos, `server_now`) é a fatia I (`docs/backend-audit/PLAN.md` §17), ainda bloqueada por schema e código da API.

## O que muda (só com a flag ligada)

Flag **`pherielium_invite_notifications`**, **desligada** na primeira release. Desligada, nada muda.

| Antes (ciclo antigo) | Com a flag ligada |
| --- | --- |
| `call:invite` coloca o app em `ringing-in`, toca o toque e abre o modal de atender | **sem toque, sem modal, sem timer de 35 s** |
| "Chamada perdida" após 35 s | notificação **persistente** "[nome] está te convidando para uma call", com o **som de mensagem**, até o convite expirar (15 min) ou o usuário dispensar |
| Aceitar = botão do modal | botão **Entrar** na notificação (chama `answerCall(convite)`) |
| `call:end` do convidante derruba o modal | `call:end` do convidante cancela o convite pendente e fecha a notificação |

Vale também para pares v1 (1.0.2): **nenhum toque**, mesmo vindo de app antigo.
Quem já está em chamada continua com o fluxo antigo (auto-aceite de reconexão, resposta `busy`).

### Estados e validade (`src/services/voiceCall/inviteState.ts`)
- **Convite ao vivo:** `pendente` até (instante em que chegou, no relógio do receptor) + 15 min, depois `expirado`. Não depende do relógio de quem convidou.
- **Cartão do chat (histórico):** conta a partir do `created_at` da mensagem (servidor), com tolerância de **2 min** a favor do usuário (expira em 17 min) e para casar o cartão com o aviso ao vivo.
- **Limitação:** quem decide "agora" continua sendo o relógio do receptor. PC com a hora errada vê convites vencerem cedo ou tarde; a correção real é o `server_now` da fatia I.
- `cancelado` quando chega `call:end` do mesmo convidante para a mesma conversa.
- Clicar em convite que não está pendente: "Convite inválido ou expirado." (na notificação e no cartão de chat).
- **Deduplicação:** chave `conversa|convidante|canal` (no 1:1 antigo o canal é a própria conversa) **mais** janela de 10 s. Um convite repetido não gera segunda notificação.
- O cartão de convite do chat (`CallInviteCard`) mostra "Entrar na Chamada", "Convite expirado" ou "Convite cancelado" (mesmas classes, só `opacity-50`).

## Como ligar em desenvolvimento

No console do app (DevTools, ver `docs/release-rc.md`) e reiniciar:

```js
localStorage.setItem("pherielium_invite_notifications", "1")   // "0" ou removeItem para desligar
```

## Como testar só o lado receptor (sem o remetente novo)

O receptor é quem tem a flag. O remetente pode ser o **app 1.0.2 ou qualquer build**, porque o aviso `call:invite` é o mesmo:
1. Receptor (rc, flag ligada, ocioso); remetente convida pelo menu de convite de canal ou liga 1:1.
2. Esperado: sem toque; toast fixo "Convite de call" com **Entrar**; som de mensagem uma vez.
3. Convidar de novo em menos de 10 s: nenhuma segunda notificação.
4. Remetente encerra a chamada antes de entrar: a notificação some e o cartão no chat mostra "Convite cancelado".
5. Deixar 15 min: o toast some sozinho e o cartão mostra "Convite expirado"; clicar mostra "Convite inválido ou expirado."
6. Clicar **Entrar** dentro do prazo: entra na chamada como no atender antigo.
7. Receptor já em chamada: o convidante recebe `busy`, como antes.

## Chamadores de `notify` com `action` (NotificationCenter)
O campo `action` era ignorado no caminho do toast; agora vira o botão do toast. Busca em `src/` (`action: { label ... }`): **o único chamador é o convite de call (`useVoiceCall.ts`)**. Nenhum outro `notify` passa `action`, então nenhum toast existente muda (teste: `notificationToast.test.ts`, sem `action` não há botão). O caminho do overlay já encaminhava `action` antes.

## Hub oculto (jogo em tela cheia)
O toast é invisível e só o som toca. Não há notificação nativa do Windows em uso (plugin registrado, permissão concedida, pacote JS já instalado, zero chamadas). Ver `docs/backend-audit/11-notch-overlay-convite-desenho.md`: o overlay do jogo é o caminho principal e a notificação nativa é o plano B (sem dependência nova).

## Regressões conhecidas (flag ligada)

1. **Notch não mostra mais o convite como ligação.** O notch depende de `callState === "ringing-in"` (`DesktopNotch.tsx:938`, `hubInvite`); com a flag o app nunca entra nesse estado. **Não foi tocado, por decisão.**
   - O notch **já mostra notificações de mensagem** (`NotchEventKind` `message`, 3,8 s, via `announceNotchEvent` em `notchEvent.ts`, e o `NotificationCenter` suprime o toast de `message` quando o notch está ligado). Portanto cabe uma **fatia pequena e separada**: novo tipo `call-invite` no notch (persistente até expirar, botão Entrar), sem mexer em mascote/overlay. Aguarda aprovação.
2. **O overlay de jogo** (`showNotificationOverlay` `incoming-call`) deixa de ser disparado pelo `VoiceCallContext` (também depende de `ringing-in`). Mesma fatia futura.
3. **Sem cartão local para o convite 1:1 antigo** (sem mensagem de chat). Decidido: vale só a notificação.
4. Expiração e cancelamento são **locais**: reiniciar o app perde os convites pendentes (a notificação some; o cartão do chat continua calculando pela data da mensagem).

## Fora do escopo do I0
Validação no servidor, RPCs, senha, o 1:1 como canal efêmero, remoção do ciclo antigo (ADR 0009), notch/overlay.
