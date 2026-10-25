# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jogadores de PC no Windows, abrindo o app para escolher e iniciar um jogo, ver o que os amigos
estão fazendo e acompanhar o próprio progresso. Três perfis confirmados:

- **Jogador com várias lojas:** tem jogos em Steam, Epic, GOG e instalações locais e quer um só
  lugar para abri-los.
- **Jogador social:** joga com amigos; usa voz, chat de texto, convites e "noites de jogo".
- **Caçador de conquistas e mods:** quer troféus (inclusive em jogos com emulador Steam) e mods
  instalados sem abrir pastas.

Navegação por controle (gamepad) e por teclado é requisito, mas "jogador no sofá, só de controle"
não foi apontado como perfil principal.

## Product Purpose

O Pherielium é um hub de jogos no estilo Gaming OS para Windows: reúne a biblioteca de todas as
lojas, os amigos, a voz e o chat, as conquistas e os mods numa única experiência de console no PC.
Sucesso é o jogador abrir o app, chegar ao jogo e iniciar em poucos passos, sem voltar a vários
launchers.

## Positioning

Quatro coisas que um lançador comum não faz junto, confirmadas como o diferencial:

- **Troféus com pop-up em qualquer jogo**, inclusive jogos com emulador Steam, com tiers (platina,
  ouro, prata, bronze).
- **Tudo num lugar só:** biblioteca universal, voz (LiveKit), chat, amigos, mods, notch e overlay.
- **Experiência de console no PC:** navegação por controle, temas e sons de console (PS, Xbox,
  GameCube e outros).
- **Mods sem abrir pastas:** baixa e instala o arquivo principal mais recente da Nexus, com backup
  e desfazer.

## Operating Context

App de desktop (Tauri 2 + React + TypeScript, Rust no backend) só para Windows, com Supabase,
uma API própria no Render e LiveKit para voz. Integra Steam, Epic, GOG, Xbox e outras lojas,
Discord e Nexus Mods. Roda ao lado de jogos: há um overlay e um notch que aparecem por cima do
jogo. É distribuído como projeto **open source**, então o código deve ser legível por quem chega.

## Capabilities and Constraints

- Só Windows. Sem versão web ou mobile planejada.
- **Não é uma loja:** nunca propor compra, preço, "Comprar" ou recomendação de compra. O botão
  principal de um jogo é Jogar ou Continuar.
- Teclado e controle completos: toda tela precisa funcionar sem mouse, com foco bem visível.
- Interface em português do Brasil como idioma principal; há outros idiomas nas preferências.
- Notch, mascote, overlay, conquistas e o módulo de controle são áreas sensíveis: só mexer quando
  o pedido for explícito (regra do `CLAUDE.md`).
- Decisões de design usam só os tokens existentes em `src/index.css`.

## Brand Commitments

- Nome: **Pherielium**. Slogan do README: "Seus jogos. Seu mundo. Seu Pherielium."
- Logo: o blob com um ponto (`src/assets/Pherielium_logo.svg`); tiers de troféu em bronze, prata,
  ouro e platina (`src/assets/Pherielium_Tier_*.png`).
- Mascote e notch fazem parte da identidade (o mascote é "Pherie").

## Evidence on Hand

- Site: https://pherielium.netlify.app e repositório no GitHub (`Guilhermesttt/Checkpoint---Launcher`).
- Documentação de produto e decisões em `docs/` (por exemplo `docs/redesign-plan.md`,
  `docs/design-direction.md`, `docs/ui-principles.md`).
- Não há depoimentos, números de usuários nem dados de mercado registrados: não inventar.

## Product Principles

1. **O jogo vem primeiro.** Toda tela leva a jogar ou continuar; nada compete com isso.
2. **Hub, não loja.** Juntar o que o jogador já tem; nunca vender.
3. **Console no PC.** Foco, controle, som e movimento se comportam como num shell de console.
4. **Social sem sair do app.** Amigos, voz e convites ficam a um gesto, inclusive com amigos
   offline.
5. **Seguro por padrão.** Mods, sessão e chaves tratados com cuidado (backup, desfazer, cofre do
   Windows).

## Accessibility & Inclusion

Navegação completa por teclado e controle, foco visível, respeito a "reduzir movimento" e
contraste legível sobre fundos escuros. Interface multilíngue, com português como base.
