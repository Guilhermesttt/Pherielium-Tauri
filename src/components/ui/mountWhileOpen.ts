import React from "react";

/**
 * `true` enquanto o modal está aberto, mais a janela da animação de saída.
 *
 * Um modal FECHADO ainda executava o corpo do componente a cada render do pai:
 * o "Novo filtro" montava a lista de TODOS os jogos da biblioteca no JSX só para
 * o `ModalShell` descartar logo depois. Na Home, que re-renderiza a cada passo do
 * carrossel, isso era trabalho puro desperdiçado. O modal só renderiza o corpo
 * quando este hook devolve `true`.
 */
export function useMountWhileOpen(isOpen: boolean, exitMs = 400): boolean {
  const [lingering, setLingering] = React.useState(isOpen);

  React.useEffect(() => {
    if (isOpen) {
      setLingering(true);
      return;
    }
    const timer = window.setTimeout(() => setLingering(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, exitMs]);

  return isOpen || lingering;
}
