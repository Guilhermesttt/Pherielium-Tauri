# Amigos do Discord no Pherielium: adicionar e convidar

Quem conecta o Discord já traz a lista de amigos para o app (`profiles.discord_friends`). Esta feature cruza essa lista com as contas do Pherielium.

## O que o usuário vê
Em **Amigos**, cada amigo do Discord mostra a situação ao selecionar (painel à direita) e um rótulo na lista:

| Situação | Rótulo | Ação |
| --- | --- | --- |
| Tem conta e ainda não é amigo | Tem conta | **Adicionar no Pherielium** (envia o pedido) |
| Já é amigo | Já é amigo | nenhuma |
| Pedido enviado por você | Pedido enviado | nenhuma |
| Pedido enviado por ele | Quer ser seu amigo | aceitar na aba Solicitações |
| Sem conta (ou conta que não quer ser achada) | Sem conta | **Copiar convite** |

O app **não envia DM no Discord**. "Copiar convite" põe na área de transferência uma mensagem com o link de download (`https://pherielium.netlify.app/download`, o mesmo do README); a pessoa cola numa conversa do Discord.

## Como funciona
- Migration `supabase/migrations/20261024120000_match_discord_friends.sql` (**o dono aplica**): coluna `profiles.discord_discoverable` (padrão `true`) e o RPC `security definer` `match_discord_friends(text[])`.
- O RPC devolve só `uid`, `discord_id`, `display_name`, `photo_url`. Exclui o próprio usuário, perfis `private` e quem desligou a descoberta. Máximo de 200 ids por chamada (o cliente divide em lotes).
- `discord_id` continua ilegível por outros usuários (`20261009110000_profiles_privacy`); o RPC é a única porta.
- Código: `src/services/discordFriendMatch.ts` (RPC), `src/components/friends/discordFriendGroups.ts` (agrupamento puro e texto do convite), `src/hooks/useDiscordFriendMatches.ts`, UI em `FriendsRoster.tsx`.
- Se o RPC falhar (por exemplo, migration ainda não aplicada), todos aparecem como "Sem conta/Convidar" e um aviso vai para o console; o resto da lista funciona.

## Privacidade
- Configurações → Privacidade → **Ser encontrado pelo Discord** liga/desliga `discord_discoverable`.
- O RPC só responde para ids que o chamador já tem na própria lista de amigos do Discord, então não serve para varrer a base.

## Decisões em aberto
1. **Opt-out (atual) ou opt-in** para a descoberta. Foi escolhido opt-out porque o vínculo já existe no Discord e perfis privados ficam de fora. Para opt-in, basta mudar o `default` da coluna para `false` numa migration nova.
2. **Texto e link do convite**: o texto está em `buildInviteMessage`; o link é a página de download do README. Troque se houver um link com rastreio ou convite por usuário.
3. Convites não são contados nem verificados (sem código de indicação).

## Como testar
1. Aplique a migration. Conecte o Discord em duas contas de teste que sejam amigas no Discord.
2. Conta A em Amigos: B aparece como "Tem conta" com **Adicionar**; clique e confira o pedido na conta B.
3. Em B, desligue "Ser encontrado pelo Discord": A passa a ver B como "Sem conta".
4. Deixe B com perfil privado: mesmo efeito.
5. Amigo do Discord sem conta: **Copiar convite** e cole em qualquer campo de texto.
