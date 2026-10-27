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
const SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const OPEN = { duration: 0.25, ease: SMOOTH_OUT } as const;
const CLOSE = { duration: 0.15, ease: SMOOTH_OUT } as const;

/** Cartão de modal: de 0.96 a 1; ao fechar volta a 0.96, mais rápido. */
export const modalMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: OPEN },
  exit: { opacity: 0, scale: 0.96, transition: CLOSE },
} as const;

/**
 * Troca de página (Home → Amigos → Ajustes...): a nova sobe 8px enquanto aparece (250ms), a que sai
 * só apaga (150ms). Sem blur nem escala: a página inteira é grande demais para filtros caros, e o
 * app roda ao lado de um jogo. As páginas não animam a própria entrada: só este preset.
 */
export const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: OPEN },
  exit: { opacity: 0, y: 0, transition: CLOSE },
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
  animate: { opacity: 1, transition: OPEN },
  exit: { opacity: 0, transition: CLOSE },
} as const;

/** Dropdown/popover: cresce de 0.97 a 1 a partir da origem; fecha encolhendo só até 0.99. */
export const dropdownMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: OPEN },
  exit: { opacity: 0, scale: 0.99, transition: CLOSE },
} as const;
