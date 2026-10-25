/**
 * Regras compartilhadas pelas gavetas que abrem ao encostar o mouse na borda (sidebar à esquerda,
 * amigos à direita). Fica fora dos componentes para ser testável.
 */

/** O ponteiro está dentro da faixa de `edgePx` pixels da borda? */
export function isPointerAtEdge(side: "left" | "right", clientX: number, viewportWidth: number, edgePx: number): boolean {
  return side === "left" ? clientX <= edgePx : clientX >= viewportWidth - edgePx;
}

/**
 * A gaveta deve abrir? Nunca com a tela do jogo aberta (`locked`): ela cobre tudo e a pessoa não
 * pode interagir com o que está por baixo. Antes só a camada visual protegia, e o listener global
 * de `mousemove` abria as gavetas por trás da tela.
 */
export function shouldOpenEdgeDrawer(args: {
  locked: boolean;
  side: "left" | "right";
  clientX: number;
  viewportWidth: number;
  edgePx: number;
}): boolean {
  return !args.locked && isPointerAtEdge(args.side, args.clientX, args.viewportWidth, args.edgePx);
}

/**
 * O foco está dentro de uma gaveta/painel que trata as próprias teclas (marcado com
 * `data-captures-keys`)? Então os atalhos globais da Home (Enter abre o jogo, X do controle) não
 * podem agir: antes, Enter no botão "Noite de jogo" abria o jogo selecionado e cancelava o clique.
 */
export function focusCapturesKeys(active: Pick<Element, "closest"> | null | undefined): boolean {
  return Boolean(active?.closest("[data-captures-keys]"));
}
