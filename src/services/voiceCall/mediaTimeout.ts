/**
 * Corre uma promessa contra um prazo. Se o prazo vencer primeiro, rejeita com `MediaTimeoutError`
 * em vez de deixar quem chamou travado para sempre.
 *
 * Por quê: `navigator.mediaDevices.getUserMedia()` pode travar sem nunca resolver nem rejeitar —
 * acontece de verdade no Windows quando o driver de áudio engasga ou a permissão de microfone
 * fica presa. Sem isto, `await acquireAudioStream()` nunca retorna, o `try` de `answerCall`/
 * `joinRoom` nunca chega ao `catch`, `cleanUpCall()` nunca roda e `callState` fica preso fora de
 * "idle" — toda tentativa seguinte de atender ou entrar em qualquer chamada mostra
 * "Você já está em uma chamada." até reiniciar o app. Esse foi o bug recorrente relatado.
 */
export class MediaTimeoutError extends Error {
  constructor(label: string) {
    super(`Tempo esgotado: ${label}`);
    this.name = "MediaTimeoutError";
  }
}

export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new MediaTimeoutError(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
