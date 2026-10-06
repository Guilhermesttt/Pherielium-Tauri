<div align="center">

<img src="src/assets/Pherielium_Desktop_icon.png" alt="Pherielium Logo" width="160" />

# PHERIELIUM

**Seus jogos. Seu mundo. Seu Pherielium.**

Um hub de jogos unificado, construído para trazer a experiência de console definitiva para o seu PC.

[![Landing Page](https://img.shields.io/badge/site-pherielium.netlify.app-000000?style=for-the-badge)](https://pherielium.netlify.app)
[![GitHub](https://img.shields.io/badge/GitHub-repo-black?style=for-the-badge&logo=github)](https://github.com/Guilhermesttt/Checkpoint---Launcher)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blueviolet?style=for-the-badge)
![Version](https://img.shields.io/badge/version-3.2.2-informational?style=for-the-badge)

</div>

---

## 📋 Plano de implementação da auditoria (Qualidade, Performance, UI/UX)

Este plano transforma a auditoria em execução prática, com foco em impacto real para estabilidade, fluidez e retenção de usuários.

### Objetivos

1. Elevar a confiabilidade das funcionalidades principais sem regressões.
2. Reduzir tempo de resposta percebido nas telas mais usadas.
3. Melhorar legibilidade e consistência visual (tipografia, espaçamento e hierarquia).
4. Aumentar engajamento com feedbacks de interface e fluxo mais claro.

### Escopo da implementação

- Qualidade funcional (fluxos críticos, erros, estados vazios e carregamento)
- Performance de frontend (render, carga inicial, uso de recursos)
- Qualidade de código (organização, manutenção, previsibilidade)
- UI/UX (layout, tipografia, densidade visual, microinterações, acessibilidade)

### Fase 1 — Estabilidade e bugs críticos (Semana 1)

**Meta:** reduzir riscos de regressão e comportamentos inconsistentes.

- Mapear e corrigir bugs de maior impacto em fluxos críticos:
  - login/sessão
  - biblioteca e filtros
  - integrações de plataforma
  - chat/voz/notificações
- Padronizar tratamento de erro por tipo (rede, autorização, timeout, regra de negócio).
- Unificar estados de `loading`, `empty` e `error` em componentes compartilhados.

**Entregáveis:**
- Correções aplicadas nos fluxos críticos
- Padrão único de mensagens de erro ao usuário
- Redução de “estados quebrados” entre telas

### Fase 2 — Performance e tempo de resposta (Semana 2)

**Meta:** melhorar fluidez e reduzir latência percebida.

- Otimizar re-render desnecessário nas telas/painéis de maior uso.
- Aplicar memoização em fronteiras corretas (`memo`, `useMemo`, `useCallback`).
- Implementar/ajustar lazy loading para seções abaixo da dobra.
- Revisar efeitos assíncronos para evitar duplicidade de listeners/subscriptions.

**KPIs sugeridos:**
- Menor tempo de primeira interação útil
- Menor custo de render em listas e painéis
- Menos quedas de FPS em telas animadas

### Fase 3 — Refactor estrutural e qualidade de código (Semana 3)

**Meta:** reduzir complexidade e facilitar evolução.

- Dividir componentes “grandes demais” por responsabilidade.
- Mover regra de negócio para hooks/services quando estiver acoplada à UI.
- Definir limites internos de complexidade por arquivo/componente.
- Reforçar consistência de tipos e contratos entre camadas.

**Entregáveis:**
- Componentes mais curtos e previsíveis
- Menos acoplamento entre UI e lógica de domínio
- Base mais segura para novas features

### Fase 4 — UI/UX e retenção (Semana 4)

**Meta:** elevar qualidade percebida e foco do usuário.

- Padronizar escala tipográfica (ex.: 12/14/16/20/24/32).
- Padronizar spacing tokens (ex.: 4/8/12/16/24/32).
- Reforçar hierarquia visual (1 CTA primária por bloco).
- Ajustar densidade de informação para reduzir sobrecarga cognitiva.
- Melhorar microinterações (feedback imediato, transições 150–250ms).
- Revisar acessibilidade prática:
  - foco visível
  - contraste mínimo adequado
  - tamanho mínimo de toque/leitura

**Entregáveis:**
- UI mais consistente entre páginas
- Melhor escaneabilidade de conteúdo
- Aumento de clareza e percepção de qualidade

### Backlog priorizado (ordem de execução)

1. Correções de bugs com impacto funcional direto.
2. Padronização de estados de erro/carregamento/vazio.
3. Otimização de render em telas mais acessadas.
4. Refactor dos componentes com maior complexidade.
5. Ajustes de tipografia, espaçamento e hierarquia.
6. Polimento de microinterações e acessibilidade.

### Critérios de sucesso

- Fluxos principais estáveis e sem regressões relevantes.
- Interface mais rápida e responsiva na navegação diária.
- Código mais simples de manter e evoluir.
- Experiência visual mais consistente, legível e envolvente.

---

## Sobre o projeto

**Pherielium** (antigo *Checkpoint Launcher*) é um hub gamer unificado que reúne biblioteca, controles, conquistas, mods, voz e transmissão em um único lugar — sem depender de um emaranhado de launchers separados. A proposta é simples: trazer a fluidez e a imersão de um console para dentro do seu PC, mantendo tudo local-first, rápido e sob seu controle.

Construído com **Electron + React + TypeScript**, o Pherielium recentemente passou por um rebrand completo: novo nome, nova identidade visual (paleta monocromática em preto puro `#030405`, com uma linguagem visual orgânica de nós e conexões inspirada em constelações) e um novo logo.

---

## ✨ Principais recursos

- **Biblioteca Universal** — Steam, Epic Games, EA App, Ubisoft, Riot Games, Rockstar Games, Xbox, Battle.net, GOG e jogos locais, tudo em um só lugar.
- **Suporte total a controles** — reconhecimento automático de DualSense, Xbox, Switch e controles genéricos, com mapeamento customizado.
- **Conquistas locais & Steam Verde** — sistema próprio de achievements para jogos offline, locais e sem launcher.
- **Mod Manager integrado** — busca e instalação de mods do Nexus Mods com 1 clique, direto pelo launcher.
- **Calls & transmissão 1080p** — salas de voz P2P via WebRTC e compartilhamento de tela Full HD a 60 FPS, sem assinatura.
- **In-Game Overlay** — menu rápido sobreposto ao jogo com conquistas, amigos, chat e call em tempo real.
- **Radar Gamer** — feed de notícias e lançamentos da indústria em tempo real.
- **100% Local-First** — dados, jogos e progresso vivem na sua máquina, sem login forçado.
- **Zero Bloatware** — feito em C++/Rust/TypeScript para máximo desempenho e mínimo consumo de recursos.

---

## 🖥️ Tech Stack

| Camada | Tecnologias |
|---|---|
| Desktop App | Electron, React, TypeScript |
| Landing Page | Next.js / React, Vengeance UI |
| Backend | Node.js (hospedado no Render.com) |
| Comunicação em tempo real | WebRTC (voz, screen share) |
| Integrações | Steam API, RetroAchievements, Nexus Mods, Discord/Google OAuth, Epic Games (manifest local) |

---

## 🗺️ Roadmap

**✅ Disponível agora**
- Hub Gamer Unificado
- Suporte a controles multiplataforma
- Conquistas para jogos locais
- Visual monocromático de console

**🚧 Em desenvolvimento**
- Calls & transmissão 1080p 60fps
- In-Game Overlay completo
- Mod Manager Nexus integrado
- Radar Gamer de notícias

**🔭 No horizonte**
- Sincronização em nuvem opcional
- Temas customizáveis avançados
- Hub de comunidade aberto
- Plugins e extensões da comunidade

---

## 🚀 Rodando localmente

```bash
# Clone o repositório
git clone https://github.com/Guilhermesttt/Checkpoint---Launcher.git
cd Checkpoint---Launcher

# Instale as dependências
npm install

# Rode em modo desenvolvimento
npm run electron:dev
```

> Ajuste os comandos acima conforme os scripts reais definidos no `package.json` do projeto.

---

## 📄 Licença

Código aberto e auditável — transparência total sobre como arquivos e credenciais são manuseados. *(Defina aqui a licença oficial do projeto, ex. MIT.)*

---

<div align="center">

**[Download](https://pherielium.netlify.app/download)** · **[Site](https://pherielium.netlify.app)** · **[GitHub](https://github.com/Guilhermesttt/Checkpoint---Launcher)**

<sub>© 2026 Pherielium — Personal Gaming Hub</sub>

</div>
