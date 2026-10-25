import React from "react";
import { animate, motion, useMotionValue, type Transition } from "framer-motion";

/**
 * Bloco que muda de lugar na tela e vai até o novo lugar com mola (a técnica FLIP: mede onde estava,
 * deixa o layout pular, e devolve o bloco ao lugar antigo por uma transformação que a mola zera).
 *
 * Existe porque o `layout` do framer-motion não animava aqui: o bloco fica num contêiner `fixed`
 * que troca de `justify-end` para rolagem, e o framer media a posição antiga errada (o título pulava
 * direto para o fim). Aqui a posição é medida na mão, só no eixo vertical, que é o único que muda.
 *
 * `dep` é o que faz o bloco mudar de lugar (o modo lista aberto ou fechado).
 */
export const FlipBlock: React.FC<{
  dep: unknown;
  spring: Transition;
  className?: string;
  children: React.ReactNode;
}> = ({ dep, spring, className, children }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const lastNaturalTop = React.useRef<number | null>(null);
  const springRef = React.useRef(spring);
  springRef.current = spring;

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // posição sem a transformação em andamento: a do layout "de verdade"
    const naturalTop = element.getBoundingClientRect().top - y.get();
    const previous = lastNaturalTop.current;
    if (previous !== null && Math.abs(naturalTop - previous) > 1) {
      // onde o bloco estava na tela um instante antes: continua visível ali e a mola o traz
      const visualBefore = previous + y.get();
      y.set(visualBefore - naturalTop);
      animate(y, 0, springRef.current);
    }
    lastNaturalTop.current = naturalTop;
  }, [dep, y]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
};
