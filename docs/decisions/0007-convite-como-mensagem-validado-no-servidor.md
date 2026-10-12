# ADR-0007: Convite de call como mensagem, validado no servidor

- Status: **Proposto** (decisão de produto do dono em 2026-10-12; aguarda aprovação do plano e o schema). Detalhes em `docs/backend-audit/PLAN.md` §17.3.

## Contexto
Hoje há dois mecanismos paralelos: o aviso `call:invite` por broadcast público (abre o modal de atender, sem validade nem estado) e uma mensagem de chat com JSON `{"__type":"call_invite"}` que vira um card.
O card é um **retrato** do envio (`isPrivate`, `roomName`, `createdAt`): um canal tornado privado depois mostra selos diferentes em convites diferentes, e nada impede entrar com um convite velho.
Não há limite de tentativas de senha no `join_voice_room`.

## Decisão
1. **Convidar = gravar uma mensagem de convite** no chat, por uma RPC atômica (`voice_invite_create`) que cria o convite e a mensagem na mesma transação. O `id` é gerado no cliente (idempotência) e o `expires_at` é definido **pelo servidor** (15 min).
2. **Sem modal de atender.** O destinatário recebe uma notificação de mensagem; offline, o convite fica no histórico.
3. **Entrar = RPC no servidor** (`voice_channel_join`) que valida: o convite é do usuário, está no prazo e, se privado, a senha. Estados `pendente`, `aceito`, `expirado` (derivado), `cancelado`. A contagem regressiva do card é só visual; o servidor decide.
4. O card **consulta o estado** (`voice_invite_get`, que devolve `server_now`) em vez de confiar no retrato do texto.
5. **Compatibilidade:** o texto da mensagem mantém o formato antigo (`__type: "call_invite"`) mais `inviteId`; o app novo trata o aviso antigo de "tocar" como notificação comum, nunca como modal.

## Alternativas
- Manter o broadcast e adicionar validade no cliente: forjável e sem verdade no servidor. Rejeitada.
- Tabela de convites sem mensagem: o convite não aparece no histórico offline. Rejeitada.

## Consequências
Convites com validade e estado confiáveis; some a duplicação visual (cada convite tem `id` único). Depende do schema real e do código da API (que pode escrever com `service_role`).
O ciclo antigo de "tocar/atender/perdida" só pode ser removido depois do corte do app 1.0.2 (ADR-0009).
