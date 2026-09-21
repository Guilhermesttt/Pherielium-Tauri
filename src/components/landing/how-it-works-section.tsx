import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Conecte",
    subtitle: "sua conta",
    description: "Entre com Google e vincule sua conta Steam. O Phelierium importa toda sua biblioteca automaticamente.",
    code: `// Autenticação simples
await signInWithGoogle();
await linkSteamAccount(steamId);

// Biblioteca sincronizada!
// 247 jogos importados`,
  },
  {
    number: "02",
    title: "Organize",
    subtitle: "seus jogos",
    description: "Categorize por gênero, adicione jogos locais, marque favoritos e personalize com imagens da Steam.",
    code: `// Adicione jogos locais
await addGame({
  title: "Meu Jogo",
  executablePath: "C:/Games/...",
  category: "ACTION",
  cardImage: steamCoverUrl
});`,
  },
  {
    number: "03",
    title: "Jogue",
    subtitle: "& acompanhe",
    description: "Lance qualquer jogo com um clique. Acompanhe horas jogadas, conquistas e mantenha tudo sincronizado na nuvem.",
    code: `// Lançamento instantâneo
await launchGame(game);

// Estatísticas automáticas
// Horas jogadas: 142h 30m
// Conquistas: 47/80`,
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveStep(prev => (prev + 1) % steps.length), 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[oklch(0.09_0.01_260)] text-white overflow-hidden"
    >
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-blue-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="relative mb-0 lg:mb-0 grid lg:grid-cols-2 gap-4 lg:gap-12 items-end">
          <div className="overflow-hidden pb-0 lg:pb-32">
            <div className={`transition-all duration-1000 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}>
              <span className="inline-flex items-center gap-3 text-sm font-mono text-white/40 mb-8">
                <span className="w-12 h-px bg-white/20" />
                Como Funciona
              </span>
            </div>

            <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.85] transition-all duration-1000 delay-100 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}>
              <span className="block">Conecte.</span>
              <span className="block text-white/30">Organize.</span>
              <span className="block text-white/10">Jogue.</span>
            </h2>
          </div>

          <div className={`relative h-[320px] lg:h-[580px] transition-all duration-1000 delay-200 ${isVisible ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-white/30 font-mono">phelierium.ts</span>
              </div>
              <pre className="p-6 text-sm font-mono text-green-400/80 leading-relaxed overflow-hidden">
                {steps[activeStep].code}
              </pre>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mt-8">
          {steps.map((step, index) => (
            <button
              key={step.number}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`relative text-left p-8 lg:p-12 border transition-all duration-500 ${
                activeStep === index
                  ? "bg-[#000000] border-white/60"
                  : "bg-[#000000] border-white/25 hover:border-white/50"
              }`}
            >
              <div className="flex items-center gap-4 mb-8">
                <span className={`text-4xl font-display transition-colors duration-300 ${activeStep === index ? "text-blue-400" : "text-white/20"}`}>
                  {step.number}
                </span>
                <div className="flex-1 h-px bg-white/10 overflow-hidden">
                  {activeStep === index && (
                    <div
                      className="h-full bg-blue-400/50"
                      style={{ animation: "progress 6s linear forwards" }}
                    />
                  )}
                </div>
              </div>

              <h3 className="text-3xl lg:text-4xl font-display mb-2">{step.title}</h3>
              <span className="text-xl text-white/40 font-display block mb-6">{step.subtitle}</span>
              <p className={`text-white/60 leading-relaxed transition-opacity duration-300 ${activeStep === index ? "opacity-100" : "opacity-60"}`}>
                {step.description}
              </p>

              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-blue-400 transition-transform duration-500 origin-left ${activeStep === index ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
