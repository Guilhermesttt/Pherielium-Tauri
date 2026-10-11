/**
 * Bloqueio da navegação do launcher pelo controle.
 *
 * Dois donos diferentes usam isto, e antes eram um só booleano — o último a
 * escrever vencia:
 *  - o overlay in-game / telas de boot, que ligam e desligam o bloqueio de fora
 *    (`setLauncherInputLocked`);
 *  - as ferramentas de teste do controle, que precisam do bloqueio só enquanto
 *    rodam (`acquireLauncherInputLock`).
 *
 * Agora o launcher está bloqueado se QUALQUER dono pedir. Uma ferramenta que
 * termina devolve só a sua concessão: não destrava o que o overlay ainda segura.
 */
let externalLock = false;
let leases = 0;

export function setLauncherInputLocked(locked: boolean): void {
  externalLock = locked;
}

/** Pede o bloqueio. Devolve a função que o desfaz (idempotente). */
export function acquireLauncherInputLock(): () => void {
  leases += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    leases = Math.max(0, leases - 1);
  };
}

export function isLauncherInputLocked(): boolean {
  return externalLock || leases > 0;
}
