/**
 * Política do canal global de presença `checkpoint_presence_bus`.
 *
 * Esse canal é uma sala única e pública: quem faz `track` nele entrega nome, foto e jogo atual a **todos** os clientes conectados
 * (o filtro por amigos é só no cliente). O app novo **não publica mais nele** (nem `track`, nem `untrack`, nem o broadcast legado)
 * e continua apenas **escutando**, por compatibilidade com o app antigo. A atualização instantânea para amigos segue pelo
 * broadcast na caixa de entrada de cada amigo (`user_inbox_{uid}`) e pelo polling de `/api/friends/status`.
 *
 * Efeito colateral intencional: sem `track`, este cliente deixa de gerar eventos `leave` para quem ainda é app antigo,
 * o que também remove uma fonte de "offline" falso (hipóteses H2/H8 do diagnóstico de presença).
 *
 * Reverter sem lançar versão: localStorage.setItem("pherielium_presence_global_bus", "1").
 */
import { isFlagOn, type FlagStorage } from "../lib/featureFlags";

export function shouldPublishToGlobalPresenceBus(storage?: FlagStorage | null): boolean {
  return isFlagOn("presence_global_bus", false, storage);
}
