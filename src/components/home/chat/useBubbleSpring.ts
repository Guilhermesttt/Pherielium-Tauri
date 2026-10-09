import { useReducedMotion } from "framer-motion";
import { useSpring } from "@react-spring/web";
import { BUBBLE_REST, RECEIVE_SPRING, SEND_SPRING, bubbleFrom } from "./bubbles";

/**
 * Entrada física de um balão novo (react-spring): ele "pousa" com uma mola — o enviado vem de
 * perto do campo de texto e passa um pouco do ponto; o recebido aparece mais contido. Mensagens
 * do histórico (`enabled = false`) e quem prefere menos movimento entram direto no lugar.
 */
export function useBubbleSpring(isMe: boolean, enabled: boolean) {
  const reduce = useReducedMotion();
  const animate = enabled && !reduce;
  return useSpring({
    from: animate ? bubbleFrom(isMe) : BUBBLE_REST,
    to: BUBBLE_REST,
    config: isMe ? SEND_SPRING : RECEIVE_SPRING,
  });
}
