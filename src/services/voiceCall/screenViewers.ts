/**
 * Quem está assistindo a minha transmissão. Cada espectador avisa pelo `call:state` (`isWatchingScreen`); quem transmite conta
 * os avisos dos participantes que ainda estão na chamada. Puro (testado); a ligação com a interface fica em `useVoiceCall`.
 */

/** Estou vendo a transmissão de outra pessoa? Janela aberta, alguém transmitindo e a tela dela em foco. */
export function isWatchingRemoteScreen(input: {
  windowOpen: boolean;
  remoteSharing: boolean;
  focusedFeedId: string | null;
}): boolean {
  return input.windowOpen && input.remoteSharing && Boolean(input.focusedFeedId?.startsWith("remote-screen"));
}

/** Quantas pessoas, além de mim, estão assistindo. `activeUids` evita contar quem já saiu da chamada. */
export function countScreenViewers(
  states: ReadonlyMap<string, { isWatchingScreen?: boolean }>,
  selfUid: string | undefined,
  activeUids: ReadonlySet<string>,
): number {
  let count = 0;
  for (const [uid, state] of states) {
    if (uid === selfUid || !state.isWatchingScreen) continue;
    if (activeUids.size > 0 && !activeUids.has(uid)) continue;
    count += 1;
  }
  return count;
}

/** Texto do contador ("1 pessoa assistindo", "3 pessoas assistindo"); vazio quando ninguém assiste. */
export function viewersLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 pessoa assistindo" : `${count} pessoas assistindo`;
}
