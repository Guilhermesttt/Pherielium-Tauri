import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import { PHERIELIUM_LOGO_PATH, EPIC_GAMES_ICON_PATH } from "../../constants/assets";

const integrations = [
  {
    name: "Steam",
    icon: faSteam,
    description: "Sincronização automática da sua biblioteca original",
    color: "from-blue-500/10",
    iconColor: "text-white",
    statusLabel: "Disponível e funcionando",
    statusClassName: "text-green-500",
    dotClassName: "bg-green-500",
  },
  {
    name: "Epic Games",
    image: EPIC_GAMES_ICON_PATH,
    description: "Busque jogos no catálogo da Epic para preencher capas, descrições e links",
    statusLabel: "Disponível e funcionando",
    statusClassName: "text-green-500",
    dotClassName: "bg-green-500",
  },
  {
    name: "Jogos Locais",
    icon: null,
    description: "Adicione e organize jogos instalados manualmente",
    color: "from-green-500/10",
    iconColor: "text-green-500",
    statusLabel: "Disponível e funcionando",
    statusClassName: "text-green-500",
    dotClassName: "bg-green-500",
  },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="integrations"
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-12 h-px bg-foreground/30" />
              Fontes
            </span>
            <h2
              className={`text-5xl md:text-6xl lg:text-7xl font-display tracking-tight leading-[0.9] transition-all duration-1000 ${isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
                }`}
            >
              De onde vêm
              <br />
              <span className="text-muted-foreground">seus jogos?</span>
            </h2>
          </div>
          <div className="lg:col-span-6 flex items-end">
            <p
              className={`text-lg text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
                }`}
            >
              O Phelierium reúne Steam, entradas assistidas da Epic e jogos locais
              em uma única interface premium para organizar sua biblioteca.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto lg:mx-0">
          {integrations.map((integration, i) => {
            return (
              <div
                key={integration.name}
                className={`relative p-8 border transition-all duration-700 group border-foreground/10 hover:border-foreground/30 cursor-pointer ${isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
                  } bg-linear-to-br ${integration.color} to-transparent`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div
                  className={`mb-6 flex items-center justify-start ${integration.iconColor}`}
                >
                  {integration.icon ? (
                    <FontAwesomeIcon
                      icon={integration.icon}
                      className="text-[64px]"
                    />
                  ) : integration.image ? (
                    <img
                      src={integration.image}
                      alt="Epic Games"
                      className="h-15 w-15 object-contain invert"
                    />
                  ) : (
                    <img src={PHERIELIUM_LOGO_PATH} alt="Phelierium" className="h-16 w-16 object-contain opacity-80" />
                  )}
                </div>
                <h3 className="text-2xl font-display mb-2">
                  {integration.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {integration.description}
                </p>
                <div className={`mt-6 flex items-center gap-2 text-xs font-mono ${integration.statusClassName}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${integration.dotClassName}`} />
                  {integration.statusLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
