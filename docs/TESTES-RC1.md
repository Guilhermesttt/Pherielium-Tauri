# Folha de testes: 1.0.3-rc.5

Uma folha só, na ordem. Duas contas (A e B) em dois PCs ou duas sessões Windows, **cada conta com UM app aberto** (dois apps na mesma conta geram "sessão expirada" e resultados falsos). **Os dois lados instalam o rc.** Para os blocos de convivência (f), uma terceira conta com o **1.0.2**.

Convenções: **A** = quem joga/compartilha/convida; **B** = quem observa/recebe; **C** = conta no 1.0.2. DevTools: **F12** (só existe neste build). Cole os relatórios no registro de cada bloco; os UIDs saem com 4 caracteres.

## Antes de tudo: flags de teste

Cole no console (F12) **em A e B**. Liga `stream_debug`, `presence_debug` e `event_guards=log`, e recarrega. (No rc.4 `invite_notifications` já é padrão; para testar o fluxo antigo use `localStorage.setItem("pherielium_invite_notifications","0")`.)

```js
["stream_debug", "presence_debug"].forEach((f) => localStorage.setItem("pherielium_" + f, "1"));
localStorage.setItem("pherielium_event_guards", "log");
location.reload();
```

Para **desligar** tudo ao terminar (volta aos padrões da release):

```js
["stream_debug", "presence_debug", "invite_notifications", "event_guards", "presence_global_bus", "p2p_fallback"].forEach((f) => localStorage.removeItem("pherielium_" + f));
location.reload();
```

Se algum diagnóstico não aparecer depois do reload, feche o app pelo ícone da bandeja e abra de novo. Valores atuais das flags: `Object.keys(localStorage).filter((k) => k.startsWith("pherielium_")).map((k) => k + "=" + localStorage[k])`.

Padrões da release (sem nenhuma flag): `invite_notifications` **ligada** (rc.4), `channel_invite_ring` desligada, `event_guards=log`, `presence_global_bus` desligada, `dm_ping_only` ligada, `call_invite_first` ligada, `p2p_fallback` desligada, `stream_debug` e `presence_debug` desligadas.

---

## (a) Instalação e conferência
**Quem:** A e B. **Flags:** nenhuma ainda.

1. Receba o `.exe` direto. Confira o SHA-256: `Get-FileHash .\Pherielium_1.0.3-rc.5_x64-setup.exe` (esperado para o build gerado em 2026-10-12: `72C1C1C8E367061C3BAABCCD91EDDF89412ADB7981DE060F51F7B3F14E1862A5`, 133.086.917 bytes, ~126,9 MB).
2. Execute. O SmartScreen avisa porque o instalador não é assinado: **Mais informações > Executar assim mesmo**.
3. Se existir a 1.0.2, o instalador atualiza por cima (instalação por usuário, sem administrador). Abra o app e faça login.
4. **Versão:** rode, em F12, `await window.pherieliumAudioInventory()` depois de ligar as flags (a primeira linha traz a versão), ou confira em Configurações do Windows > Aplicativos > Pherielium.
5. **Windows:** `winver` (anote versão e build).
6. **F12** abre o DevTools. Se não abrir, o instalador foi gerado sem `--features devtools`: pare e avise.

**Esperado:** versão `1.0.3-rc.5`; F12 funciona; login normal.

| Registro | A | B |
| --- | --- | --- |
| Quem / conta | | |
| Versão do app (texto exato) | | |
| `winver` (versão e build) | | |
| SHA-256 do instalador confere? | | |
| F12 abre? | | |
| Flags ligadas (lista do console) | | |
| Horário | | |

---

## (b) Volume da transmissão: V-1 a V-7
**Quem:** A transmite a tela com áudio do PC; B ouve. **Flags:** `stream_debug` em B. **Fonte de áudio:** música tocando em A.

| # | Passo | Esperado |
| --- | --- | --- |
| V-1 | A transmite com áudio; B roda `await window.pherieliumAudioInventory()` | seção "trilhas tocando em mais de um elemento" **vazia**; nenhum `<video>` com `muted=false` |
| V-2 | B move o slider da **transmissão** para **0%** | silêncio total do áudio do PC; a voz de A continua igual |
| V-3 | Slider da transmissão em **50%** e **100%** | volume proporcional; sem dobro nem eco em 100% |
| V-4 | Slider da **voz** de A em 0%, 50%, 100% (transmissão em 100%) | só a voz muda |
| V-5 | Repetir V-2 a V-4 **com a câmera de A ligada** (palco, miniatura, tela cheia) | mesmos resultados; a voz de A não toca em dobro |
| V-6 | B escolhe uma saída de áudio específica e depois **Padrão** | o áudio vai ao dispositivo e **volta** ao padrão |
| V-7 | B muta só a transmissão e depois só a voz de A | mute independente; ao desmutar volta o volume anterior |

Perguntas fixas: **o convite chegou mudo?** não se aplica aqui. Anote qualquer passo que falhe com o inventário daquele estado.

| Registro | Valor |
| --- | --- |
| Quem transmite / quem observa | |
| Versões (A / B) | |
| Flags | |
| Windows / build (A / B) | |
| Passos que falharam (V-n) | |
| Horários | |
| Colar: inventário de V-1 (B) | |
| Colar: inventário de V-5 (B) | |

---

## (c) Áudio da tela inteira (P-10) e `displaySurface`
**Quem:** A transmite; B ouve. **Flags:** `stream_debug` em A. Antes: confirme o texto da caixa no modal: **"Áudio do PC (todos os apps, menos o Pherielium)"**, marcada.

### P-10: três cenários (tela inteira, com áudio)
| Cenário | Passo | Esperado |
| --- | --- | --- |
| (a) | jogo aberto **pelo hub** | B ouve o jogo; no console de A, `desktop-audio-level` com `rms > 0` |
| (b) | o mesmo jogo aberto **fora do hub** | B ouve; `rms > 0` |
| (c) | vídeo no navegador | B ouve; `rms > 0` |

Em cada um, com **A falando na chamada**: a voz de A **não volta** no áudio da transmissão (sem eco) e a voz continua nítida. Se (a) ficar com `silentPackets == packets` enquanto (b) e (c) têm som, a hipótese da árvore excluída se confirma (isso libera a F1). Se `[stream-debug:desktop-audio-started]` não aparecer ou aparecer "Áudio do PC indisponível", cole o erro.

### displaySurface: três linhas (tela, janela, aba)
Em A, inicie a transmissão **três vezes** (tela inteira, uma janela, uma aba do Edge/navegador) e copie do console a linha `[stream-debug:capture-surface] ...` de cada uma.

| Superfície | Linha colada (`displaySurface=… cursor=… LxA@fps`) |
| --- | --- |
| Tela inteira | |
| Janela | |
| Aba | |

Uma linha com `displaySurface=(ausente)` significa que o WebView2 não informa o campo para aquela superfície.

| Registro | Valor |
| --- | --- |
| Quem transmite / quem ouve | |
| Versões / flags | |
| Windows / build | |
| Jogo usado em (a) e (b) | |
| Horários | |
| Colar: trecho `desktop-audio-level` de (a), (b), (c) | |

---

## (d) Convites: I0 e N-invite
**Quem:** A convida; B recebe. **Flags:** nenhuma (no rc.4 `invite_notifications` é padrão). A pode ser o 1.0.2 para os passos de receptor; para o 1:1 como convite, **A e B no rc.4**. Detalhes e motivos: `docs/invite-notifications.md`.

Execute os 9 passos. **Em todos, anote: o convite chegou mudo? (sim/não) e quantos sons ouviu (esperado: 1).**

| # | Passo | Esperado |
| --- | --- | --- |
| 1 | B com **jogo em tela cheia** e o hub minimizado/atrás. A convida (canal ou 1:1) | cartão/barra de chamada no **overlay do jogo**; **um** som; sem toque; sem modal |
| 2 | Com o notch ligado e depois desligado (Configurações) | notch: barra atender/recusar; desligado: cartão de chamada |
| 3 | B clica **Aceitar** no overlay | entra na call (mesmo fluxo de atender); o cartão some |
| 4 | Novo convite; B clica **Recusar** | o cartão some; A **não** recebe aviso |
| 5 | Novo convite; A **encerra a chamada** antes de B aceitar | some do overlay, do notch e o toast fecha; o cartão do chat vira "Convite cancelado" |
| 6 | Novo convite; B espera 15 min | some de tudo sozinho; o cartão do chat vira "Convite expirado"; clicar mostra "Convite inválido ou expirado." |
| 7 | Dois convites seguidos (de A e de outra conta) | o notch mostra o mais antigo; o outro fica no toast/overlay |
| 8 | **Hub visível, sem jogo** | mesmo comportamento; o toast fica mudo e o som vem do overlay (um som só) |
| 9 | Desligue a flag em B (bloco "desligar") e A convida | fluxo **antigo**: toque, modal, "chamada perdida" em 35 s, igual à 1.0.2 |

Repetir o convite em menos de 10 s: nenhuma segunda notificação.

| Registro | Valor |
| --- | --- |
| Quem convida / quem recebe | |
| Versões (A / B) | |
| Flags em B | |
| Windows / build | |
| Notch ligado? Jogo usado? | |
| Resultado por passo (1 a 9) e "chegou mudo?" | |
| Horários | |
| Colar: `await window.pherieliumGuardReport()` em B | |

---

## (e) D1: chamada 1:1 sem fallback P2P silencioso
**Quem:** A liga para B. **Flags:** nenhuma extra (`p2p_fallback` desligada, `call_invite_first` ligada).

Bloqueie o servidor de token em **A**: F12 > Network > menu **⋮ > More tools > Network request blocking** (ou Ctrl+Shift+P, "Show Network request blocking") > adicione o padrão `*livekit-token*` e marque **Enable request blocking**.

1. A liga para B. Esperado: o app tenta **3 vezes** (esperas de 1 s e 2 s) e **encerra com mensagem clara** ("não conseguiu conectar ao servidor de voz" ou equivalente). **Não** cai silenciosamente para P2P.
2. B vê o convite/aviso e depois "Chamada finalizada" (motivo `error`). Nenhuma chamada fica pendurada.
3. Em A: `await window.pherieliumCallFailures()` mostra o motivo (`token_unauthorized`, `token_timeout`, `network`...), as tentativas e o papel.
4. Remova o bloqueio e repita: a chamada conecta normalmente e o convite chega **antes** da mídia terminar de conectar.
5. Opcional: `localStorage.setItem("pherielium_p2p_fallback","1")`, recarregar, repetir o bloqueio: agora é permitido cair para P2P (anote o resultado; é caminho de contingência).

| Registro | Valor |
| --- | --- |
| Quem liga / quem recebe | |
| Versões / flags | |
| Windows / build | |
| Nº de tentativas e tempo até desistir | |
| Mensagem exibida em A e em B | |
| Horários | |
| Colar: `pherieliumCallFailures()` de A | |

---

## (f) DMs: novo↔novo e novo↔antigo
**Quem:** A (rc) conversa com B (rc) e com C (1.0.2). **Flags:** `event_guards=log` em A e B.

| # | Passo | Esperado |
| --- | --- | --- |
| DM-1 | A envia texto para B (rc↔rc); B com o chat aberto | B recebe (pelo banco/Postgres Changes; pode levar um pouco mais que antes) |
| DM-2 | B responde; A edita e reage a uma mensagem | edição e reação chegam |
| DM-3 | A envia para **C** (1.0.2) | C recebe normalmente (o fast-path leva o texto completo para quem é v1) |
| DM-4 | C envia para A | A recebe |
| DM-5 | Chamada 1:1 e convite de canal entre A e B, depois entre A e C | funcionam; C vê o modal antigo |
| DM-6 | Ao fim, em A e B: `await window.pherieliumGuardReport()` | em uso legítimo, **zero `would-drop`**; se houver, o motivo diz o que ajustar antes de ligar `enforce` |

| Registro | Valor |
| --- | --- |
| Contas / versões (A, B, C) | |
| Flags | |
| Windows / build | |
| Mensagens que não chegaram (qual par, quando) | |
| Horários | |
| Colar: `pherieliumGuardReport()` de A e de B | |

---

## (g) Presença: P-1, P-2, P-3 e linha de base do `global_bus`
**Quem:** A joga; B observa. **Flags:** `presence_debug=1` em A e B. Uma instância por conta. Guia: `docs/presence-diagnostics.md`.

Em A, no SQL Editor do Supabase, a cada ~30 s por 10 min: `select status, playing, presence_updated_at, now() as agora from profiles where uid = '<uid de A>';`

| Teste | Passo | Esperado |
| --- | --- | --- |
| P-1 | A abre um jogo **pelo hub** e joga 10 min | B vê "jogando" sem cair para offline |
| P-2 | A abre o jogo **fora do hub** (hub visível) | B vê o jogo (hoje a detecção por fora do hub é limitada: **anote** o que B vê) |
| P-3 | A minimiza o hub, sem jogo, 10 min | B continua vendo A online |
| P-10 | ver bloco (c) | |

Ao fim de cada teste: `await window.pherieliumPresenceReport()` em A e em B; anote o horário em que B viu "offline".

### Linha de base do `global_bus`
Esta release **não publica** mais no canal global de presença (`checkpoint_presence_bus`); só escuta (para o app antigo). Para ter a linha de base:
1. Rode P-1 a P-3 **com o padrão** (flag ausente) e guarde os relatórios como **"bus desligado (padrão)"**.
2. Repita P-1 com `localStorage.setItem("pherielium_presence_global_bus","1")` + reload em A e B, guardando como **"bus ligado"**. Depois remova a flag.
3. Compare: quantos `presence_leave_raw`, instâncias vistas, ticks/acks de heartbeat e o horário do "offline" falso (se houver).

| Registro | Valor |
| --- | --- |
| Quem joga / quem observa | |
| Versões (A / B) | |
| Flags | |
| Windows / build | |
| Jogo e como foi aberto | |
| Horário de início e fim; horário em que B viu offline | |
| Colar: `pherieliumPresenceReport()` de A e B (bus desligado) | |
| Colar: `pherieliumPresenceReport()` de A e B (bus ligado) | |
| Saída das consultas SQL | |

---

## Ao terminar
1. Rode o bloco "desligar" em A e B.
2. Envie: esta folha preenchida e os textos colados. Não envie capturas com tokens; os relatórios já truncam UIDs.
3. Para voltar à versão oficial: desinstale o rc e instale a 1.0.2.
