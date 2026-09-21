import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gamepad2, Zap, Lock } from "lucide-react";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
        >
          <div
            className="absolute inset-0 opacity-5 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(255,255,255,0.2), transparent 40%)`,
            }}
          />

          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
              <div className="flex-1">
                <h2 className="text-6xl md:text-7xl lg:text-[72px] font-display tracking-tight mb-8 leading-[0.95]">
                  Pronto para
                  <br />
                  jogar melhor?
                </h2>

                <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl">
                  Junte-se a milhares de jogadores que já transformaram sua
                  experiência com o Phelierium. Grátis, sem cartão de crédito.
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <a
                    href="/download"
                    className="inline-flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group transition-all"
                  >
                    Baixar launcher
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center h-14 px-8 text-base rounded-full border border-foreground/20 hover:bg-foreground/5 transition-all"
                  >
                    Ver todos os recursos
                  </a>
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-center w-[380px] flex-shrink-0">
                <div className="relative">
                  <div className="w-64 h-80 rounded-3xl bg-foreground/5 border border-foreground/20 flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex justify-center mb-4 text-foreground">
                        <Gamepad2 className="w-16 h-16" />
                      </div>
                      <div className="text-2xl font-display text-foreground/30 font-bold">
                        PHELIERIUM
                      </div>
                      <div className="text-xs font-mono text-muted-foreground mt-2">
                        Seu launcher definitivo
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 w-32 h-20 rounded-2xl bg-background border border-foreground/20 flex items-center justify-center shadow-xl">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    <span className="text-xs font-mono text-muted-foreground ml-2">
                      Rápido
                    </span>
                  </div>
                  <div className="absolute -bottom-6 -left-6 w-32 h-20 rounded-2xl bg-background border border-foreground/20 flex items-center justify-center shadow-xl">
                    <Lock className="w-6 h-6 text-blue-500" />
                    <span className="text-xs font-mono text-muted-foreground ml-2">
                      Seguro
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-foreground/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
