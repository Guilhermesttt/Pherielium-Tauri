import React, { useEffect, useRef, useState } from "react";

export interface TextSwapProps {
  text: string;
  className?: string;
}

/** Duração da saída do texto antigo; igual a `--text-swap-dur` em src/index.css. */
const SWAP_MS = 150;

/**
 * Troca o texto no lugar (transitions-dev "text states swap"): o antigo sai para cima com desfoque,
 * o novo entra por baixo. Três fases: `is-exit` → troca o texto e posiciona abaixo (`is-enter-start`,
 * sem transição) → solta, e o novo desliza até o repouso. Com "reduzir movimento" o CSS corta a transição.
 */
export const TextSwap: React.FC<TextSwapProps> = ({ text, className }) => {
  const [shown, setShown] = useState(text);
  const [phase, setPhase] = useState<"rest" | "exit" | "enter-start">("rest");
  const target = useRef(text);

  useEffect(() => {
    if (text === target.current) return;
    target.current = text;
    setPhase("exit");
    const swap = window.setTimeout(() => {
      setShown(target.current);
      setPhase("enter-start");
      // um quadro depois o texto novo é solto e anima até o repouso
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setPhase("rest")));
    }, SWAP_MS);
    return () => window.clearTimeout(swap);
  }, [text]);

  return (
    <span
      className={`t-text-swap${phase === "exit" ? " is-exit" : ""}${phase === "enter-start" ? " is-enter-start" : ""}${className ? ` ${className}` : ""}`}
    >
      {shown}
    </span>
  );
};

export default TextSwap;
