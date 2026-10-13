# Convite de call como notificação (fatia I0)

Fatia **front-only e não autoritativa**: não há validação no servidor. A versão com servidor (expiração e cancelamento autoritativos, `server_now`) é a fatia I (`docs/backend-audit/PLAN.md` §17), ainda bloqueada por schema e código da API.

## Convite de canal: só o cartão no chat, sem ligação (remetente)

Relato (rc.2): o amigo, mesmo na versão mais recente, recebia o convite de canal **como chamada** (toque e modal de atender), em vez de só o cartão no chat.
Causa [VERIFICADA em `ChannelInviteModal.tsx`]: o remetente sempre enviava duas coisas, o cartão (mensagem de chat) **e** o aviso de ligação em tempo real (`call:invite`). Quem recebe trata o aviso como ligação, a menos que tenha a flag `invite_notifications` ligada (padrão desligada).

Correção: flag **`pherielium_channel_invite_ring`**, padrão **desligada**, lida **no remetente**. Desligada, o convite de canal vai só como **cartão no chat** (mais a notificação de mensagem do receptor, que agora mostra "📞 Convidou você para uma call" em vez do JSON cru). Vale para qualquer receptor, inclusive o 1.0.2. Ligada (`localStorage.setItem("pherielium_channel_invite_ring","1")`), volta o aviso de ligação antigo.
- **A ligação 1:1** não muda (`startCall` continua enviando o aviso).
- **Efeito sobre a N-invite:** o convite como notificação/notch/overlay reage ao aviso `call:invite`. Com `channel_invite_ring` desligada, o convite de **canal** não gera esse aviso, então só aparece o cartão e a notificação de mensagem. A N-invite continua valendo para quem usar `channel_invite_ring=1` e para convites que ainda chegam como aviso.
- **Testar:** convide um amigo para um canal (receptor no rc ou 1.0.2): não deve tocar nem abrir o modal; o cartão aparece no chat e a notificação diz "Convidou você para uma call". Com a flag em `1` no remetente, volta o toque.

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

## N-invite: notch e overlay do jogo (mesma flag)

Com `pherielium_invite_notifications` ligada, o convite pendente aparece também no **notch** e no **overlay do jogo**, reaproveitando a UI de atender que já existia (nenhum componente visual, estilo ou arquivo do mascote foi editado).

| Superfície | Como aparece | Fonte |
| --- | --- | --- |
| Toast do hub | "Convite de call" com botão **Entrar** | `useVoiceCall` (`notify`) |
| Notch (hub) | barra de atender/recusar existente | `DesktopNotch.tsx:938`: `hubInvite` = `incomingInvite` (toque antigo) **ou** `pendingInvite` (primeiro convite pendente, só ocioso) |
| Overlay do jogo | cartão/barra `incoming-call` existente, **15 min** | `VoiceCallContext` envia `showNotificationOverlay`; some por `dismissNotificationOverlay` ao aceitar, dispensar, cancelar ou expirar (um efeito compara a lista de pendentes com o que já foi enviado: `diffInviteOverlay`) |

- **Aceitar/recusar pelo overlay** envia `panelAction({ kind: "voice-accept" | "voice-reject", notificationId })`; o hub (`Home.tsx`) valida o id (`invite:...`) e chama `acceptPendingInvite(chave)` / `dismissPendingInvite(chave)`. Sem id válido segue o caminho antigo (`answerCall()` / `rejectCall()`).
- **Notch**: Aceitar chama `answerCall()` sem argumento, que agora atende o **primeiro convite pendente**; Recusar chama `rejectCall()`, que só **dispensa** o convite localmente (não envia nada a quem convidou, que pode estar numa sala).
- **Expiração:** um temporizador poda a lista no vencimento (15 min após o recebimento) e todas as superfícies retiram o convite.
- **Uma fonte sonora por convite:** o overlay toca o seu aviso ao exibir `incoming-call`; o notch não toca nada. Por isso, **com o overlay disponível o toast do hub fica mudo**; sem overlay (navegador/dev) o toast toca o som de mensagem (`inviteToastShouldPlaySound`). Observação: com overlay, o som é o do overlay (aviso de chamada do tema), não o de mensagem.

### O que muda no mascote (efeito do estado já existente)
O notch deriva `incomingInvite` de `hubInvite`. Com um convite pendente, as mesmas leituras que existiam para um toque passam a valer. **Antes** (flag ligada, só I0): nada disso acontecia. **Depois:**
1. Humor `excited` (`mascotMood`, `DesktopNotch.tsx:~958`).
2. `moodHasOwnSound` verdadeiro: a "voz" da Pherie não toca (evita som duplicado).
3. `busy` e `liveKind = incomingCall`: a barra assume a largura do estado "chamada recebendo" e o notch deixa de ficar em pílula ociosa.
4. `revealNotch()`: o notch aparece sozinho mesmo escondido por outra janela.
5. `ringing` do mascote verdadeiro (`:1197` e `:1231`; o `MascotView` usa para a animação de "tocando" e para não dançar), e o mascote não "espia" na borda enquanto há convite (`:1031`).
Com a flag desligada, nenhum desses efeitos ocorre (`pendingInvite` é sempre `null`).

**Linhas exatas em `src/components/notch/DesktopNotch.tsx`** (o que muda é só a linha 939-940; as demais passam a reagir porque leem `incomingInvite`):

| Linha | O que lê o convite |
| --- | --- |
| 939-940 | **a única edição**: `hubInvite` passa a incluir `voiceCall.pendingInvite` |
| 954 | `busy` do humor da situação |
| 960 | humor `excited` |
| 978 | `moodHasOwnSound` (a "voz" da Pherie não toca) |
| 1009 | `incomingCall` da atividade ao vivo (largura da barra) |
| 1023 | `revealNotch()` (aparece sozinho) |
| 1033 | o mascote não "espia" enquanto há convite |
| 1199, 1233 | `ringing` do mascote |

**Isolamento:** essa edição está **sozinha** no commit `d94f8ad` (`feat(notch): show the pending invite in the notch`). `git revert d94f8ad` remove todos os efeitos no mascote e o resto da N-invite (toast e overlay) continua funcionando. O restante da N-invite está em `97cd417`.

### Roteiro de teste: hub oculto, jogo em tela cheia
Receptor com o rc, flag ligada (`localStorage.setItem("pherielium_invite_notifications","1")`, reiniciar), jogo em tela cheia, hub minimizado ou atrás do jogo. O remetente pode ser o 1.0.2.
1. **Chega:** remetente convida (canal ou 1:1). Esperado: cartão/barra de chamada no overlay do jogo, **um único som**, sem toque; nada de modal.
2. **Notch ligado:** a barra de atender/recusar aparece no notch do overlay; **desligado:** cartão de chamada.
3. **Aceitar no overlay:** o hub entra na call (mesmo fluxo de atender) e o cartão some.
4. **Recusar:** o cartão some; o remetente não recebe aviso.
5. **Cancelar:** remetente encerra a chamada antes de aceitar: o cartão some do overlay, do notch e o toast fecha.
6. **Expirar:** deixar 15 min: some de tudo sozinho; clicar antes disso ainda entra.
7. **Dois convites:** o notch mostra o mais antigo; o segundo fica no toast/overlay.
8. **Hub visível, sem jogo:** o mesmo vale; o toast fica mudo e o aviso vem do overlay (um som só).
9. **Flag desligada:** o fluxo antigo (toque, modal, 35 s) é idêntico ao da 1.0.2 (regressão).

**Em todos os passos, registre: "o convite chegou mudo?" (sim/não) e quantos sons ouviu (esperado: 1).** Com o overlay disponível o toast do hub é mudo de propósito; se o overlay não exibir, o convite chega mudo.

### Plano B: notificação nativa do Windows (somente avaliação)
- `tauri-plugin-notification` 2.4.0 está registrado e com permissão, e `@tauri-apps/plugin-notification` já está instalado: **não precisa de dependência nova**.
- **Devolve clique? Não.** [VERIFICADO na fonte do plugin, `src/desktop.rs` do crate 2.4.0 no cache do cargo: o desktop chama `notification.show()` dentro de `spawn` e descarta o resultado; não há `on_activated` nem `wait_for_action`, e não existe ouvinte de clique em JS no desktop.] A biblioteca de baixo (`tauri-winrt-notification` 0.7.3) tem `on_activated`, mas o plugin não a usa.
- Detalhe: o `app_id` só é definido no app instalado; em `target/debug|release` o toast aparece com a identidade do PowerShell.
- **Não foi testado rodando** (exige sessão gráfica interativa). [INFERIDO] Jogos em tela cheia exclusiva e o Assistente de Foco do Windows podem suprimir o toast, então ele não substitui o overlay.
- Conclusão: serviria só como aviso ("abra o Pherielium"); sem ação de aceitar. Para clique seria preciso código nativo próprio (Rust com `on_activated`), o que é uma fatia nova. **Não implementado.**

### Chamadores de `answerCall()` / `rejectCall()` sem argumento, e prova de que a flag desligada não muda nada
Chamadores sem argumento (busca em `src/`, fora dos testes):

| Arquivo | Uso |
| --- | --- |
| `DesktopNotch.tsx:1253-1254` | barra de atender/recusar (notch compacto) |
| `DesktopNotch.tsx:1615, 1623` | atender/recusar no painel expandido |
| `VoiceCallContext.tsx:301-302` | `IncomingCallModal` (`onAccept` / `onReject`; o modal os chama sem argumentos, `IncomingCallModal.tsx:119,124`) |
| `Home.tsx:2967, 2976` | ação `voice-accept` / `voice-reject` do overlay **sem id de convite** (caminho antigo) |

Com argumento: `acceptPendingInviteRef` chama `answerCall(entry.invite)` (`useVoiceCall.ts`), e o overlay chama `acceptPendingInvite(chave)` / `dismissPendingInvite(chave)`.

**Prova por teste** (`src/services/voiceCall/inviteSurfaces.test.ts`, bloco "flag OFF keeps the previous behavior"): a decisão foi extraída para funções puras usadas pelo hook.
- `inviteHandling({ flagOn: false, callState })` é `"legacy"` em **todos** os estados, então o ramo que cria convites pendentes nunca roda e `pendingCount` é sempre 0.
- `resolveAnswerSource` / `resolveRejectSource` com `pendingCount = 0` devolvem exatamente o que o código anterior fazia (`override || incoming || nada` e `incoming || nada`).
- Convites pendentes só são usados quando nada está tocando.
O teste cobre as regras de decisão; o hook em si não tem teste de componente.

## Fora do escopo do I0
Validação no servidor, RPCs, senha, o 1:1 como canal efêmero, remoção do ciclo antigo (ADR 0009), notch/overlay.
