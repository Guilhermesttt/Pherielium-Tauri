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
  | "alt-scroll";

export interface TourStep {
  id: string;
  /** seletor CSS do alvo; `null` = passo sem alvo (cartão central) */
  selector: string | null;
  title: string;
  text: string;
  mood: MascotMood;
  advanceOn: TourAdvance;
  /** mostra a dica visual "Alt + rolagem" no balão */
  altScrollHint?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "add-game",
    selector: '[aria-label="Adicionar jogo"]',
    title: "Adicione seus jogos",
    text: "Clique no + para adicionar um jogo da sua máquina. Escolha o executável e pronto: ele entra na biblioteca com capa e tempo de jogo.",
    mood: "excited",
    advanceOn: "click-target",
  },
  {
    id: "sync",
    selector: '[aria-label="Sincronizar jogos Steam e Epic"]',
    title: "Traga Steam e Epic",
    text: "Este botão sincroniza seus jogos da Steam e da Epic de uma vez. Conecte as contas no perfil e sua biblioteca se monta sozinha.",
    mood: "happy",
    advanceOn: "next",
  },
  {
    id: "platform-filter",
    selector: '[aria-label="Abas da Biblioteca"]',
    title: "Filtre por plataforma",
    text: "Segure Alt e role o mouse para trocar de plataforma rapidinho. Tente agora!",
    mood: "curious",
    advanceOn: "alt-scroll",
    altScrollHint: true,
  },
  {
    id: "custom-filter",
    selector: '[aria-label="Criar filtro personalizado"]',
    title: "Crie seus filtros",
    text: "Quer uma aba só com jogos de terror ou cooperativos? Crie um filtro personalizado e ele vira uma aba sua.",
    mood: "wink",
    advanceOn: "next",
  },
  {
    id: "profile",
    selector: '[data-tour="profile"]',
    title: "Seu perfil, do seu jeito",
    text: "Aqui você edita foto, banner e nome, e personaliza o notch e a Pherie: cores, chapéus e expressões.",
    mood: "proud",
    advanceOn: "next",
  },
  {
    id: "friends",
    selector: '[data-sidebar-item="FRIENDS"]',
    title: "Amigos, chamadas e conversas",
    text: "Adicione amigos, converse por texto e entre em salas de voz. Dá até para criar a sua, com banner e senha.",
    mood: "happy",
    advanceOn: "next",
  },
  {
    id: "mods",
    selector: '[data-sidebar-item="MODS"]',
    title: "Mods",
    text: "Abra um jogo suportado, escolha um mod e clique em instalar. Eu cuido do resto: download, pasta e atualização.",
    mood: "attentive",
    advanceOn: "next",
  },
  {
    id: "done",
    selector: null,
    title: "Bem-vindo ao Pherielium!",
    text: "Está tudo pronto. Se quiser rever este tutorial, ele fica nas configurações. Divirta-se!",
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
): number | null {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (s.selector === null || hasTarget(s.selector)) return i;
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
