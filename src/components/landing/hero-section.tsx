import { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import { EPIC_GAMES_ICON_PATH, PHERIELIUM_LOGO_PATH } from "../../constants/assets";

const words = ["organizar", "lançar", "descobrir", "jogar"];

function BlurWord({ word, trigger }: { word: string; trigger: number }) {
  const letters = word.split("");
  const STAGGER = 45;
  const DURATION = 500;
  const GRADIENT_HOLD = STAGGER * letters.length + DURATION + 200;

  const [letterStates, setLetterStates] = useState<{ opacity: number; blur: number }[]>(
    letters.map(() => ({ opacity: 0, blur: 20 }))
  );
  const [showGradient, setShowGradient] = useState(true);
  const framesRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    framesRef.current.forEach(cancelAnimationFrame);
    timersRef.current.forEach(clearTimeout);
    framesRef.current = [];
    timersRef.current = [];
    setLetterStates(letters.map(() => ({ opacity: 0, blur: 20 })));
    setShowGradient(true);

    letters.forEach((_, i) => {
      const t = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setLetterStates(prev => {
            const next = [...prev];
            next[i] = { opacity: eased, blur: 20 * (1 - eased) };
            return next;
          });
          if (progress < 1) {
            const id = requestAnimationFrame(tick);
            framesRef.current.push(id);
          }
        };
        const id = requestAnimationFrame(tick);
        framesRef.current.push(id);
      }, i * STAGGER);
      timersRef.current.push(t);
    });

    const gt = setTimeout(() => setShowGradient(false), GRADIENT_HOLD);
    timersRef.current.push(gt);

    return () => {
      framesRef.current.forEach(cancelAnimationFrame);
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const gradientColors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa"];

  return (
    <>
      {letters.map((char, i) => {
        const colorIndex = (i / Math.max(letters.length - 1, 1)) * (gradientColors.length - 1);
        const lower = Math.floor(colorIndex);
        const upper = Math.min(lower + 1, gradientColors.length - 1);
        const t = colorIndex - lower;
        const hex2rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
        const [r1, g1, b1] = hex2rgb(gradientColors[lower]);
        const [r2, g2, b2] = hex2rgb(gradientColors[upper]);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: letterStates[i]?.opacity ?? 0,
              filter: `blur(${letterStates[i]?.blur ?? 20}px)`,
              color: showGradient ? `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})` : "white",
              transition: "color 0.4s ease",
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => { setIsVisible(true); }, []);
  useEffect(() => {
    const interval = setInterval(() => setWordIndex(prev => (prev + 1) % words.length), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-start overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(139,92,246,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
      </div>

      <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none opacity-10">
        {[...Array(8)].map((_, i) => (
          <div key={`h-${i}`} className="absolute h-px bg-white/20" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }} />
        ))}
        {[...Array(12)].map((_, i) => (
          <div key={`v-${i}`} className="absolute w-px bg-white/20" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }} />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
        <div className="lg:max-w-[60%]">
          <div className={`mb-8 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-white/60">
              <img src={PHERIELIUM_LOGO_PATH} alt="Phelierium" className="h-4 w-4 object-contain opacity-80" />
              O launcher definitivo para sua biblioteca de jogos
            </span>
          </div>

          <div className="mb-8">
            <h1
              className={`text-left text-[clamp(2.5rem,7vw,7.5rem)] font-display leading-[0.92] tracking-tight text-white transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
            >
              <span className="block whitespace-nowrap">Sua biblioteca,</span>
              <span className="block whitespace-nowrap">
                pronta para{" "}
                <span className="relative inline-block">
                  <BlurWord word={words[wordIndex]} trigger={wordIndex} />
                </span>
              </span>
            </h1>
          </div>

          <div className={`transition-all duration-700 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <p className="text-xl text-white/50 leading-relaxed mb-10 max-w-xl">
              Sincronize Steam, enriqueça jogos da Epic com capas e detalhes, adicione jogos locais e organize tudo em um hub com estética de console premium.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/download"
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black px-8 py-4 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Baixar Launcher
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 px-8 py-4 rounded-full text-sm transition-all"
              >
                Ver Recursos
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={`absolute bottom-12 left-0 right-0 px-6 lg:px-12 transition-all duration-700 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="max-w-[1400px] mx-auto flex items-start gap-10 lg:gap-20">
          {[
            { value: "100%", label: "gratuito para usar" },
            {
              value: (
                <span className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faSteam} className="text-3xl lg:text-4xl" />
                  <img
                    width={96}
                    height={96}
                    src={EPIC_GAMES_ICON_PATH}
                    alt="Epic Games"
                    className="h-9 w-9 object-contain invert"
                  />
                </span>
              ),
              label: "Steam library + Epic catalog",
            },
            { value: "<1s", label: "para lançar um jogo" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-2">
              <span className="text-3xl lg:text-4xl font-display text-white">{stat.value}</span>
              <span className="text-xs text-white/50 leading-tight">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
