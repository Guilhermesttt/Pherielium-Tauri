/**
 * Registro dos botões do controle: quem quer ouvir cada botão e com que prioridade.
 *
 * Um aperto vai para TODOS os ouvintes da maior prioridade registrada para aquele botão, e só
 * para eles. Dois ouvintes na mesma prioridade respondem juntos: foi assim que o X clicava duas
 * vezes no item em foco (a Home e a página, ambas na prioridade 0) e o L1/R1 trocava a aba da
 * página e a da Home ao mesmo tempo. Quem fica por cima de quem é decidido aqui, pelos nomes.
 */
export const GAMEPAD_PRIORITY = {
  /** A Home (biblioteca, atalhos gerais). */
  base: 0,
  /** A página aberta sobre a Home (Amigos, Perfil, Troféus, Mods...): o X e o O dela vencem os da Home. */
  page: 1,
  /** Atalhos de aba da página (L1/R1 em Amigos) e a página de Ajustes. */
  pageTabs: 10,
  /** Painéis por cima da página, como a tela do jogo: vencem a página e a Home. */
  overlay: 20,
  /** Menu aberto sobre um painel (Opções da tela do jogo): vence o próprio painel. */
  overlayMenu: 21,
  /** Modais e teclado virtual usam 100 ou mais (ver ModalShell e VirtualKeyboard). */
  modal: 100,
} as const;

export interface GamepadSubscriber {
  callback: () => void;
  priority: number;
}

const registry = new Map<string, Set<GamepadSubscriber>>();

/** Registra um ouvinte do botão; devolve a função que o remove. */
export function registerGamepadSubscriber(button: string, subscriber: GamepadSubscriber): () => void {
  const subscribers = registry.get(button) ?? new Set<GamepadSubscriber>();
  subscribers.add(subscriber);
  registry.set(button, subscribers);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && registry.get(button) === subscribers) registry.delete(button);
  };
}

/** Os ouvintes que respondem a um aperto: todos os da maior prioridade. */
export function pickSubscribers(subscribers: readonly GamepadSubscriber[]): GamepadSubscriber[] {
  if (subscribers.length === 0) return [];
  const highest = Math.max(...subscribers.map((subscriber) => subscriber.priority));
  return subscribers.filter((subscriber) => subscriber.priority === highest);
}

const warnedTies = new Set<string>();

/** Dispara o botão para os ouvintes certos. Devolve quantos responderam. */
export function fireGamepadButton(button: string): number {
  const targets = pickSubscribers(Array.from(registry.get(button) ?? []));
  if (import.meta.env?.DEV && targets.length > 1 && !warnedTies.has(button)) {
    warnedTies.add(button);
    console.warn(
      `[gamepad] ${targets.length} ouvintes respondem juntos ao ${button} (prioridade ${targets[0].priority}). ` +
        "Se são telas diferentes, o botão vai agir duas vezes: dê prioridades diferentes (GAMEPAD_PRIORITY).",
    );
  }
  targets.forEach((target) => target.callback());
  return targets.length;
}

/** Só para teste: esvazia o registro. */
export function resetGamepadSubscribers(): void {
  registry.clear();
  warnedTies.clear();
}
