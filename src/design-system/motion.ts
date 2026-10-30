/**
 * Molas e durações do app (react-spring). Uma família só: o movimento tem o mesmo "peso" em toda
 * parte. Use estes nomes em vez de números soltos.
 *
 * - soft:    padrão para entradas e saídas (assenta sem passar do ponto)
 * - snappy:  respostas diretas ao toque (botões, chips)
 * - bouncy:  confirmação de algo que o usuário acabou de fazer (passa um pouco do ponto)
 * - gentle:  elementos grandes (painéis, hero) e movimento ambiente
 */
export const SPRINGS = {
  soft: { tension: 380, friction: 24, mass: 0.9 },
  snappy: { tension: 420, friction: 28, mass: 0.8 },
  bouncy: { tension: 330, friction: 17, mass: 0.9 },
  gentle: { tension: 220, friction: 26, mass: 1 },
} as const;

export type SpringName = keyof typeof SPRINGS;

/** Durações (ms) para o que não é mola: fades e cores. */
export const DURATIONS = { instant: 90, quick: 150, base: 220, slow: 360 } as const;

/**
 * Presets de framer-motion para modais e dropdowns, no mesmo ritmo do CSS (`.t-modal`, `.t-dropdown`
 * em src/index.css, transitions-dev): abre mais devagar (250ms) do que fecha (150ms), curva
 * smooth-out, só escala e opacidade. Espalhe no `motion.div`: `<motion.div {...modalMotion} />`.
 * "Reduzir movimento" é tratado pelo `MotionConfig` do App.
 */
const APPLE_EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const MODAL_OPEN = { duration: 0.22, ease: APPLE_EASE_OUT } as const;
const MODAL_CLOSE = { duration: 0.14, ease: APPLE_EASE_OUT } as const;
const DROPDOWN_OPEN = { duration: 0.20, ease: APPLE_EASE_OUT } as const;
const DROPDOWN_CLOSE = { duration: 0.12, ease: APPLE_EASE_OUT } as const;

export const OPEN = MODAL_OPEN;
export const CLOSE = MODAL_CLOSE;

/** Cartão de modal: de 0.96 a 1 (220ms Apple Motion); ao fechar volta a 0.98 mais rápido (140ms). */
export const modalMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: MODAL_OPEN },
  exit: { opacity: 0, scale: 0.98, transition: MODAL_CLOSE },
} as const;

/**
 * Troca de página (Home → Amigos → Ajustes...): a nova sobe 8px enquanto aparece (240ms), a que sai
 * só apaga (120ms). Sem blur nem escala: a página inteira é grande demais para filtros caros, e o
 * app roda ao lado de um jogo. As páginas não animam a própria entrada: só este preset.
 */
export const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: APPLE_EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: APPLE_EASE_OUT } },
} as const;

/**
 * Molas do framer-motion para a tela do jogo (ConsoleGameScreen). Uma mola não tem duração fixa:
 * o movimento termina quando a energia acaba, e um pouco de sobra (amortecimento abaixo de 1)
 * dá a sensação de peso quando algo se reorganiza. Quanto maior a massa e menor a rigidez, mais
 * "pesado" é o elemento: a arte de fundo é a mais lenta, os textos a mais rápida.
 */
export const screenSprings = {
  /** Blocos que trocam de lugar (abas, título) quando a lista abre ou fecha. */
  layout: { type: "spring", stiffness: 300, damping: 24, mass: 0.9 },
  /** A arte de fundo, grande e pesada: desliza e amplia sem pressa. */
  art: { type: "spring", stiffness: 150, damping: 22, mass: 1.1 },
  /** O painel escuro que sobe cobrindo a coluna da esquerda. */
  panel: { type: "spring", stiffness: 240, damping: 26, mass: 1 },
  /** Entrada dos blocos quando a tela abre. */
  enter: { type: "spring", stiffness: 260, damping: 20, mass: 0.9 },
} as const;

/** Fundo do modal: só opacidade, no mesmo tempo do cartão. */
export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: MODAL_OPEN },
  exit: { opacity: 0, transition: MODAL_CLOSE },
} as const;

/** Dropdown/popover: cresce de 0.97 a 1 a partir da origem; fecha encolhendo só até 0.99. */
export const dropdownMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: DROPDOWN_OPEN },
  exit: { opacity: 0, scale: 0.99, transition: DROPDOWN_CLOSE },
} as const;

/**
 * Molas ao estilo Apple (WWDC "Designing Fluid Interfaces"), no framer-motion.
 *
 * A Apple descreve uma mola por DOIS números: amortecimento (1.0 = assenta sem passar do ponto;
 * abaixo de 1 passa e oscila) e resposta (em segundos, o quanto demora a chegar). No framer-motion
 * isso é `duration` (resposta) + `bounce` (≈ 1 − amortecimento). Padrão da casa: amortecimento 1.0
 * em tudo; só há sobra quando o gesto traz momento (soltar uma gaveta) ou numa comemoração rara.
 * Molas partem do valor atual e carregam a velocidade, então podem ser interrompidas a qualquer hora.
 */
export function appleSpring(damping: number, response: number) {
  const clampedDamping = Math.min(1, Math.max(0, damping));
  return { type: "spring", bounce: Math.round((1 - clampedDamping) * 100) / 100, duration: response } as const;
}

export const appleSprings = {
  /** Mover/reposicionar (a tabela da Apple: amortecimento 1.0, resposta 0.4). */
  move: appleSpring(1, 0.4),
  /** Resposta direta a um toque: botões, chips, cartões que entram. */
  snap: appleSpring(1, 0.3),
  /** Gaveta/folha solta com momento (amortecimento 0.8, resposta 0.3). */
  sheet: appleSpring(0.8, 0.3),
  /** Comemoração rara (conquista, tarefa concluída): um pouco mais de sobra. */
  delight: appleSpring(0.7, 0.5),
} as const;

/** Curvas fortes (CSS) para o que não é mola; o mesmo valor está em `--ease-out-strong` / `--ease-drawer`. */
export const APPLE_EASE = {
  outStrong: [0.23, 1, 0.32, 1],
  drawer: [0.32, 0.72, 0, 1],
} as const;

/** Distância entre itens de um grupo que entra (ms). Decorativo: nunca bloqueia a interação. */
export const STAGGER_MS = 40;

/**
 * "Materializar": uma superfície de vidro chega crescendo e focando ao mesmo tempo (desfoque e escala
 * juntos), em vez de só aparecer. Desfoque curto (8px): filtros grandes custam caro, sobretudo no Safari.
 * Sai pelo mesmo caminho, mais rápido.
 */
export const materialize = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: appleSprings.move },
  exit: { opacity: 0, scale: 0.98, filter: "blur(6px)", transition: { duration: 0.18, ease: APPLE_EASE.outStrong } },
} as const;
