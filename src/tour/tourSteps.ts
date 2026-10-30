import type { MascotMood } from "../mascot/moods";

/**
 * Tutorial de boas-vindas: lista de passos e as regras puras (persistência, quais passos pular,
 * onde o balão da Pherie fica). Sem React, para testar.
 */

export type TourAdvance =
  /** o usuário clica em "Próximo" */
  | "next"
  /** o usuário clica no próprio botão em destaque */
  | "click-target"
  /** o usuário faz Alt + rolagem sobre a tela */
  | "alt-scroll"
  /** o alvo sai da tela (ex.: o usuário fecha o painel de filtros) */
  | "target-gone"
  /** a notch (no overlay) abriu: o usuário levou o mouse até o topo da tela */
  | "notch-open"
  /** o próprio painel do passo conclui (ex.: prática com o controle) ou o usuário pula */
  | "practice";

/** Ilustração animada que ensina o gesto, mostrada no cartão da Pherie. */
export type TourVisual = "alt-scroll" | "release-alt" | "notch-hover" | "platforms" | "overlay" | "xinput";

/** Cartão de ajustes dentro do passo (substitui a antiga tela de configuração inicial). */
export type TourPanel = "window-prefs" | "notch-setup" | "controller-connect" | "controller-move" | "controller-hold";

export interface TourStep {
  id: string;
  /** seletor CSS do alvo; `null` = passo sem alvo (cartão central) */
  selector: string | null;
  title: string;
  text: string;
  mood: MascotMood;
  advanceOn: TourAdvance;
  /** a tarefa que o usuário precisa fazer; aparece como uma etiqueta que marca ✓ ao concluir */
  task?: string;
  visual?: TourVisual;
  panel?: TourPanel;
  /**
   * O alvo só aparece depois de uma ação do passo anterior (ex.: abrir o seletor de filtros): em vez de
   * pular o passo, espera até este tempo (ms) pelo alvo.
   */
  waitForTargetMs?: number;
  /** Cena em tela cheia (sem alvo): fundo opaco, Pherie grande e transição entre cenas. */
  scene?: boolean;
  /** só faz sentido com um controle: some do roteiro se a pessoa disser que não tem um */
  requiresController?: boolean;
  /** abre a gaveta lateral enquanto o passo está na tela (e a fecha depois) */
  sidebar?: boolean;
  /** `target-gone`: se o alvo sumir antes deste tempo (ms), o passo não conta e o tutorial volta ao anterior */
  minOpenMs?: number;
  /** onde o cartão da Pherie fica: no fundo, no centro, longe do que o usuário está usando (ex.: o seletor de filtros) */
  coachAt?: "bottom-center";
  /** o usuário precisa mexer na tela por baixo (ex.: no seletor de filtros): o tutorial só escurece e não bloqueia cliques */
  interactive?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    scene: true,
    selector: null,
    title: "Oi! Eu sou a Pherie",
    text: "Vou te mostrar o hub em poucos passos. Em cada um você faz uma pequena tarefa, e eu acendo o que importa.",
    mood: "excited",
    advanceOn: "next",
  },
  {
    id: "universal",
    scene: true,
    selector: null,
    title: "Um hub para todos os seus jogos",
    text: "Steam, Epic e todas as lojas que você usa num lugar só. Conecte a Steam e a Epic no perfil ou adicione qualquer jogo local pelo executável.",
    mood: "excited",
    advanceOn: "next",
    visual: "platforms",
  },
  {
    id: "window-prefs",
    scene: true,
    selector: null,
    title: "Como a janela se comporta",
    text: "Escolha agora. Dá para mudar depois em Configurações.",
    mood: "attentive",
    advanceOn: "next",
    panel: "window-prefs",
  },
  {
    id: "add-game",
    selector: '[aria-label="Adicionar jogo"]',
    title: "Adicione seus jogos",
    text: "Clique no + para adicionar um jogo da sua máquina. Escolha o executável e ele entra na biblioteca com capa e tempo de jogo.",
    mood: "excited",
    advanceOn: "click-target",
    task: "Clique no botão +",
  },
  {
    id: "sync",
    selector: '[aria-label="Sincronizar jogos Steam e Epic"]',
    title: "Traga Steam e Epic",
    text: "Este botão sincroniza seus jogos da Steam e da Epic de uma vez. Conecte as contas no perfil e a biblioteca se monta sozinha.",
    mood: "happy",
    advanceOn: "next",
  },
  {
    id: "platform-filter",
    selector: '[aria-label="Abas da Biblioteca"]',
    title: "Plataformas e filtros",
    text: "Segure o Alt e role o mouse. Continue segurando o Alt: é ele que mantém a roda de plataformas aberta, com os filtros ao lado.",
    mood: "curious",
    advanceOn: "alt-scroll",
    task: "Segure Alt e role",
    visual: "alt-scroll",
  },
  {
    id: "release-alt",
    selector: "[data-filter-panel]",
    title: "Agora solte o Alt",
    text: "Gire até a plataforma que quiser (favoritos, conquistas, gêneros e ordem ficam ao lado). Quando ela estiver no centro, solte o Alt para escolher.",
    mood: "wink",
    advanceOn: "target-gone",
    task: "Solte o Alt",
    visual: "release-alt",
    waitForTargetMs: 2500,
    minOpenMs: 1500,
    interactive: true,
    coachAt: "bottom-center",
  },
  {
    id: "notch",
    selector: null,
    title: "A notch, no topo da tela",
    text: "Leve o mouse ao meio do topo da tela e espere ela abrir: música com letra, calendário, clima e o seu jogo.",
    mood: "curious",
    advanceOn: "notch-open",
    task: "Abra a notch",
    visual: "notch-hover",
  },
  {
    id: "notch-setup",
    scene: true,
    selector: null,
    title: "Monte a sua notch",
    text: "Escolha o que ela mostra ao abrir. Dá para mudar quando quiser em Configurações.",
    mood: "happy",
    advanceOn: "next",
    panel: "notch-setup",
  },
  {
    id: "pherie",
    selector: '[data-tour="pherie"]',
    title: "Essa sou eu!",
    text: "Eu vivo aqui no hub e te acompanho. Me cutuca para ver o que acontece.",
    mood: "happy",
    advanceOn: "click-target",
    task: "Clique na Pherie",
  },
  {
    id: "controller-connect",
    scene: true,
    selector: null,
    title: "Você tem um controle?",
    text: "Conecte por USB ou Bluetooth e eu mostro como usar o Pherielium só com ele. Sem controle, tudo funciona com mouse e teclado.",
    mood: "curious",
    advanceOn: "practice",
    task: "Conecte o controle",
    panel: "controller-connect",
  },
  {
    id: "controller-move",
    scene: true,
    requiresController: true,
    selector: null,
    title: "Navegue com o direcional",
    text: "O direcional e o analógico andam pela biblioteca. Os gatilhos e botões de cima trocam de aba e abrem a roda de plataformas.",
    mood: "happy",
    advanceOn: "practice",
    task: "Mova o direcional",
    panel: "controller-move",
  },
  {
    id: "controller-hold",
    scene: true,
    requiresController: true,
    selector: null,
    title: "Segure X para iniciar",
    text: "Para abrir um jogo você segura o botão. O controle vibra mais forte conforme a barra enche. Experimente.",
    mood: "gaming",
    advanceOn: "practice",
    task: "Segure X até encher",
    panel: "controller-hold",
  },
  {
    id: "overlay",
    scene: true,
    selector: null,
    title: "O overlay dentro do jogo",
    text: "Sem sair da partida: aperte Ctrl + Shift + O, ou o botão do meio do controle (Guide/PS), para abrir conquistas, amigos, chat e capturas.",
    mood: "attentive",
    advanceOn: "next",
    visual: "overlay",
  },
  {
    id: "xinput",
    scene: true,
    selector: null,
    title: "Emulação de controle Xbox",
    text: "Jogos que só entendem controle Xbox (XInput) passam a funcionar com o seu controle, inclusive o PlayStation. Ative por jogo em “Controle deste jogo”. Ela só fica ligada enquanto o jogo está aberto; ao fechar, o controle volta ao normal.",
    mood: "proud",
    advanceOn: "next",
    visual: "xinput",
  },
  {
    id: "profile",
    selector: '[data-tour="profile"]',
    title: "Seu perfil, do seu jeito",
    text: "Aqui você edita foto, banner e nome, e ajusta a notch e a Pherie.",
    mood: "proud",
    advanceOn: "next",
  },
  {
    id: "friends",
    sidebar: true,
    selector: '[data-sidebar-item="FRIENDS"]',
    title: "Amigos, chamadas e conversas",
    text: "Adicione amigos, converse por texto e entre em salas de voz. Dá até para criar a sua, com banner e senha.",
    mood: "happy",
    advanceOn: "next",
  },
  {
    id: "mods",
    sidebar: true,
    selector: '[data-sidebar-item="MODS"]',
    title: "Mods",
    text: "Abra um jogo suportado, escolha um mod e clique em instalar. Eu cuido do resto: download, pasta e atualização.",
    mood: "attentive",
    advanceOn: "next",
  },
  {
    id: "done",
    scene: true,
    selector: null,
    title: "Tudo pronto!",
    text: "Se quiser rever este tutorial, ele fica nas configurações. Divirta-se!",
    mood: "excited",
    advanceOn: "next",
  },
] as const;

// ── persistência ──────────────────────────────────────────────────────────────

export interface TourState {
  step: number;
  done: boolean;
}

export const tourKey = (uid: string) => `pherielium_onboarding_tour_v1:${uid}`;
/** "refazer tutorial" nas configurações: ignora a regra de veterano uma vez */
export const tourForceKey = (uid: string) => `pherielium_tour_force:${uid}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadTourState(uid: string, store: Store, total = TOUR_STEPS.length): TourState {
  try {
    const raw = store.getItem(tourKey(uid));
    if (!raw) return { step: 0, done: false };
    const v = JSON.parse(raw) as Partial<TourState>;
    const step = Number.isInteger(v.step) ? Math.min(Math.max(0, v.step as number), total - 1) : 0;
    return { step, done: v.done === true };
  } catch {
    return { step: 0, done: false };
  }
}

export function saveTourState(uid: string, state: TourState, store: Store): void {
  try {
    store.setItem(tourKey(uid), JSON.stringify(state));
  } catch {
    /* sem storage: o tour só não retoma */
  }
}

export function restartTour(uid: string, store: Store): void {
  try {
    store.removeItem(tourKey(uid));
    store.setItem(tourForceKey(uid), "1");
  } catch {
    /* ignora */
  }
}

/**
 * Deixa a conta como a de um usuário novo (só para desenvolvimento): apaga o progresso do tutorial,
 * a marca de "primeiros passos" e o aviso de boas-vindas, e força o tutorial na próxima abertura.
 */
export function resetOnboardingForUser(uid: string, store: Store): void {
  try {
    store.removeItem(tourKey(uid));
    store.removeItem(`checkpoint_onboarding_${uid}`);
    store.removeItem(`phelierium_welcome_modal_seen_${uid}`);
    store.setItem(tourForceKey(uid), "1");
  } catch {
    /* sem storage: nada a reiniciar */
  }
}

/**
 * Posição do passo `id` entre os passos que a pessoa de fato vai ver (sem os pulados, ex.: as etapas do
 * controle de quem não tem um). Evita a barra "ETAPA 9 DE 20" com segmentos que nunca enchem.
 */
export function progressOf(
  steps: readonly TourStep[],
  id: string,
  isSkipped: (step: TourStep) => boolean = () => false,
): { index: number; total: number } {
  const visible = steps.filter((s) => s.id === id || !isSkipped(s));
  return { index: Math.max(0, visible.findIndex((s) => s.id === id)), total: visible.length };
}

// ── navegação entre passos ────────────────────────────────────────────────────

/**
 * Próximo passo a partir de `from` (na direção `dir`) cujo alvo existe. Passos sem alvo
 * (`selector: null`) sempre valem. Devolve `null` quando acabam os passos.
 */
export function stepIndexFrom(
  from: number,
  dir: 1 | -1,
  steps: readonly TourStep[],
  hasTarget: (selector: string) => boolean,
  isSkipped: (step: TourStep) => boolean = () => false,
): number | null {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (isSkipped(s)) continue;
    // passos que esperam o alvo aparecer (depois de uma ação do passo anterior) valem mesmo sem ele
    if (s.selector === null || (s.waitForTargetMs ?? 0) > 0 || hasTarget(s.selector)) return i;
  }
  return null;
}

// ── posição do balão da Pherie ───────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CoachSide = "bottom" | "top" | "right" | "left" | "center";

/**
 * Onde o cartão (Pherie + balão) fica em relação ao alvo: prefere embaixo, depois em cima, à
 * direita e à esquerda, o primeiro lugar em que cabe; sempre dentro da janela.
 */
export function coachPlacement(
  target: Rect | null,
  viewport: { width: number; height: number },
  coach: { width: number; height: number },
  gap = 18,
  margin = 16,
): { x: number; y: number; side: CoachSide } {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  if (!target) {
    return {
      x: (viewport.width - coach.width) / 2,
      y: (viewport.height - coach.height) / 2,
      side: "center",
    };
  }
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const fitsBottom = target.y + target.height + gap + coach.height <= viewport.height - margin;
  const fitsTop = target.y - gap - coach.height >= margin;
  const fitsRight = target.x + target.width + gap + coach.width <= viewport.width - margin;
  const fitsLeft = target.x - gap - coach.width >= margin;

  const place = (side: CoachSide, x: number, y: number) => ({
    side,
    x: clamp(x, margin, viewport.width - coach.width - margin),
    y: clamp(y, margin, viewport.height - coach.height - margin),
  });

  if (fitsBottom) return place("bottom", cx - coach.width / 2, target.y + target.height + gap);
  if (fitsTop) return place("top", cx - coach.width / 2, target.y - gap - coach.height);
  if (fitsRight) return place("right", target.x + target.width + gap, cy - coach.height / 2);
  if (fitsLeft) return place("left", target.x - gap - coach.width, cy - coach.height / 2);
  return place("bottom", cx - coach.width / 2, viewport.height - coach.height - margin);
}
