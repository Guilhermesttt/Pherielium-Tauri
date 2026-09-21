import { useEffect, useRef, useState } from "react";
import { Gamepad2, Zap, Shield, Star } from "lucide-react";

const features = [
  {
    number: "01",
    icon: Gamepad2,
    title: "Biblioteca Unificada",
    description: "Reúna Steam, jogos locais e entradas assistidas da Epic em uma única interface elegante. Organize tudo sem depender de APIs fechadas.",
    stats: { value: "∞", label: "jogos suportados" },
  },
  {
    number: "02",
    icon: Zap,
    title: "Lançamento Ultra-Rápido",
    description: "Abra qualquer jogo em um clique. Acesso imediato com atalhos de teclado e navegação estilo console.",
    stats: { value: "<1s", label: "tempo de lançamento" },
  },
  {
    number: "03",
    icon: Star,
    title: "Interface Premium",
    description: "Design inspirado no PS5 com glassmorphism, animações fluidas e imagens de fundo dinâmicas para cada jogo.",
    stats: { value: "60fps", label: "animações suaves" },
  },
  {
    number: "04",
    icon: Shield,
    title: "Dados na Nuvem",
    description: "Sua biblioteca sincronizada em todos os dispositivos via Nuvem Segura. Nunca perca suas configurações e progresso.",
    stats: { value: "100%", label: "sincronizado" },
  },
];

function ParticleVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    const COUNT = 70;
    const particles = Array.from({ length: COUNT }, (_, i) => {
      const seed = i * 1.618;
      return {
        bx: ((seed * 127.1) % 1),
        by: ((seed * 311.7) % 1),
        phase: seed * Math.PI * 2,
        speed: 0.4 + (seed % 0.4),
        radius: 1.2 + (seed % 2.2),
      };
    });

    let time = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach((p) => {
        const flowX = Math.sin(time * p.speed * 0.4 + p.phase) * 38;
        const flowY = Math.cos(time * p.speed * 0.3 + p.phase * 0.7) * 24;
        const bx = p.bx * w;
        const by = p.by * h;
        const dx = p.bx - mx;
        const dy = p.by - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist * 2.8);
        const x = bx + flowX + influence * Math.cos(time + p.phase) * 36;
        const y = by + flowY + influence * Math.sin(time + p.phase) * 36;
        const pulse = Math.sin(time * p.speed + p.phase) * 0.5 + 0.5;
        const alpha = 0.08 + pulse * 0.18 + influence * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, p.radius + pulse * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.fill();
      });

      time += 0.016;
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export function FeaturesSection() {
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

  return (
    <section id="features" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="relative mb-24 lg:mb-32">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
                <span className="w-12 h-px bg-foreground/30" />
                Recursos
              </span>
              <h2
                className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                Poderoso.
                <br />
                <span className="text-muted-foreground">Elegante.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pb-4">
              <p className={`text-xl text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}>
                Tudo que você precisa para gerenciar sua biblioteca de jogos em um único lugar, com uma interface que impressiona.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          <div
            className={`lg:col-span-12 relative bg-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-3xl min-h-[500px] overflow-hidden group transition-all duration-700 flex ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            }`}
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <div className="relative flex-1 p-8 lg:p-12">
              <ParticleVisualization />
              <div className="relative z-10">
                <span className="font-mono text-sm text-muted-foreground">{features[0].number}</span>
                <h3 className="text-3xl lg:text-4xl font-display mt-4 mb-6 group-hover:translate-x-2 transition-transform duration-500">
                  {features[0].title}
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
                  {features[0].description}
                </p>
                <div>
                  <span className="text-5xl lg:text-6xl font-display">{features[0].stats.value}</span>
                  <span className="block text-sm text-muted-foreground font-mono mt-2">{features[0].stats.label}</span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex relative w-[42%] shrink-0 overflow-hidden items-center justify-center">
              <div className="text-center p-12">
                <div className="w-48 h-48 mx-auto rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-8">
                  <Gamepad2 className="w-24 h-24 text-white/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/5" />
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#070707] via-transparent to-transparent opacity-80" />
            </div>
          </div>

          {features.slice(1).map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.number}
                className={`lg:col-span-4 relative bg-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-3xl p-8 lg:p-10 overflow-hidden group transition-all duration-700 hover:bg-white/[0.05] ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{
                  transitionDelay: `${(i + 1) * 100}ms`,
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                }}
              >
                <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mt-4 mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-white/60" />
                </div>
                <h3 className="text-2xl font-display mb-4 group-hover:translate-x-1 transition-transform duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {feature.description}
                </p>
                <div>
                  <span className="text-3xl font-display">{feature.stats.value}</span>
                  <span className="block text-xs text-muted-foreground font-mono mt-1">{feature.stats.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
