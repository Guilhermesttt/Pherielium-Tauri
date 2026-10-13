import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, MicOff, Monitor, PhoneOff, Video, Settings2, Search } from "lucide-react";
import { NodeDot, RefinedButton, Segmented, SettingRow, Surface, Toggle } from "../components/ui/refined";
import tierGold from "../assets/Pherielium_Tier_Ouro.png";
import tierPlatinum from "../assets/Pherielium_Tier_Platina.png";
import tierSilver from "../assets/Pherielium_Tier_Prata.png";
import logo from "../assets/Pherielium_logo.png";
import { useSearchParams } from "react-router-dom";
import { ScreenPickerModal } from "../components/voice/ScreenPickerModal";
import callVideo from "../assets/BG-Video-Calling.webm";

/**
 * Laboratório de design (só em desenvolvimento: rota `#/design-lab`).
 * Mostra as peças do Pherielium Refined com conteúdo real do hub, para revisar o visual sem precisar de conta.
 * Nada aqui é ligado a dados de verdade.
 */

type Quality = "720p" | "1080p" | "source";
type Fps = "30" | "60";

const PEOPLE = [
  { name: "Ana", state: "live" as const, note: "Falando", speaking: true },
  { name: "Bia", state: "idle" as const, note: "Conectada", speaking: false },
  { name: "Caio", state: "away" as const, note: "Mudo", speaking: false },
  { name: "Duda", state: "live" as const, note: "Transmitindo · 2 assistindo", speaking: false },
];

const TROPHIES = [
  { title: "Sem deixar rastro", game: "Hollow Knight", rarity: 2.1, tier: tierPlatinum, tierName: "Platina" },
  { title: "Mestre das trilhas", game: "Celeste", rarity: 11.4, tier: tierGold, tierName: "Ouro" },
  { title: "Primeiro chefe", game: "Elden Ring", rarity: 38.9, tier: tierSilver, tierName: "Prata" },
];

const MODS = [
  { game: "Skyrim Special Edition", mods: 42, active: 37, folder: true },
  { game: "Stardew Valley", mods: 12, active: 12, folder: true },
  { game: "Cyberpunk 2077", mods: 0, active: 0, folder: false },
];

const ProgressRing: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={label}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--tone-3)" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="70" textAnchor="middle" fill="var(--ink)" style={{ font: "600 22px var(--font-display)" }}>
        {value}%
      </text>
    </svg>
  );
};

/** Entrada de cada bloco: sobe 24px com opacidade, uma vez, com a mola do sistema; sem deslocamento se o sistema pede menos movimento. */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay }}
    >
      {children}
    </motion.div>
  );
};

const DesignLab: React.FC = () => {
  const [quality, setQuality] = useState<Quality>("1080p");
  const [fps, setFps] = useState<Fps>("60");
  const [pcAudio, setPcAudio] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [muted, setMuted] = useState(false);
  const [view, setView] = useState<"all" | "active" | "nofolder">("all");

  // `#/design-lab?modal=stream` abre o modal real de transmissão para revisão.
  const [params, setParams] = useSearchParams();
  const streamModalOpen = params.get("modal") === "stream";

  const mods = MODS.filter((m) => (view === "active" ? m.active > 0 : view === "nofolder" ? !m.folder : true));

  return (
    <div className="h-full overflow-y-auto bg-[var(--tone-0)] text-[var(--ink)]">
      <div className="mx-auto max-w-[1180px] px-8 pb-40 pt-16">
        {/* Abertura: o nó do logo em tamanho grande, o nome e uma frase */}
        <header className="flex items-end justify-between gap-10">
          <div>
            <h1 className="font-display text-[clamp(3.5rem,7.5vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
              Pherielium Refined
            </h1>
            <p className="mt-5 max-w-[46ch] text-[length:var(--step-2)] leading-relaxed text-[var(--ink-muted)]">
              O nó do logo vira a forma de cada controle. Superfícies separadas por tom, uma ação por tela e movimento com
              mola.
            </p>
          </div>
          <img src={logo} alt="" width={132} height={132} className="hidden opacity-90 md:block" />
        </header>

        {/* Chamada */}
        <section aria-labelledby="lab-call" className="mt-32">
          <h2 id="lab-call" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">
            Chamada
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-[1.6fr_1fr]">
            <Reveal delay={0} className="h-full"><Surface tone={2} className="h-full relative flex min-h-[420px] flex-col justify-between overflow-hidden p-7">
              <video
                src={callVideo}
                autoPlay
                muted
                loop
                playsInline
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-70"
              />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgba(5,5,5,0.92),transparent)]" />
              <div className="relative flex items-center gap-3 text-[length:var(--step-1)] text-[var(--ink)]">
                <NodeDot state="live" label="Ao vivo" />
                <span>Sala da Ana · 4 pessoas · 32 ms</span>
              </div>
              <div className="relative flex items-end justify-between">
                <div>
                  <div className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">Ana</div>
                  <div className="mt-1 text-[length:var(--step-1)] text-[var(--live)]">Falando</div>
                </div>
                <div className="flex gap-2">
                  <RefinedButton
                    variant="tonal"
                    size="lg"
                    aria-label={muted ? "Ligar microfone" : "Desligar microfone"}
                    onClick={() => setMuted((m) => !m)}
                    icon={muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  />
                  <RefinedButton variant="tonal" size="lg" aria-label="Câmera" icon={<Video className="h-5 w-5" />} />
                  <RefinedButton variant="tonal" size="lg" aria-label="Transmitir tela" icon={<Monitor className="h-5 w-5" />} />
                  <RefinedButton variant="primary" size="lg" icon={<PhoneOff className="h-5 w-5" />}>
                    Sair
                  </RefinedButton>
                </div>
              </div>
            </Surface></Reveal>
            <Reveal delay={0.08} className="h-full"><Surface tone={1} className="h-full p-3">
              <ul className="flex flex-col">
                {PEOPLE.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center gap-3 rounded-[var(--corner-md)] px-4 py-3 transition-colors hover:bg-[var(--tone-2)]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-[var(--node)] bg-[var(--tone-3)] text-[length:var(--step-1)] font-semibold">
                      {p.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:var(--step-1)] font-medium">{p.name}</span>
                      <span className="block truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">{p.note}</span>
                    </span>
                    <NodeDot state={p.state} label={p.note} />
                  </li>
                ))}
              </ul>
            </Surface></Reveal>
          </div>
        </section>

        {/* Transmissão: ajustes em segmentados e linhas */}
        <section aria-labelledby="lab-stream" className="mt-32 grid gap-12 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="lab-stream" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">
              Transmitir a tela
            </h2>
            <p className="mt-4 max-w-[40ch] text-[length:var(--step-2)] leading-relaxed text-[var(--ink-muted)]">
              Qualidade e quadros escolhidos em uma linha cada; o áudio do PC é uma pergunta de sim ou não.
            </p>
          </div>
          <Reveal delay={0} className="h-full"><Surface tone={1} className="h-full px-6 py-2">
            <SettingRow
              title="Qualidade"
              control={() => (
                <Segmented
                  label="Qualidade"
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { value: "720p", label: "720p" },
                    { value: "1080p", label: "1080p" },
                    { value: "source", label: "Fonte" },
                  ]}
                />
              )}
            />
            <SettingRow
              title="Quadros por segundo"
              control={() => (
                <Segmented
                  label="Quadros por segundo"
                  value={fps}
                  onChange={setFps}
                  options={[
                    { value: "30", label: "30" },
                    { value: "60", label: "60" },
                  ]}
                />
              )}
            />
            <SettingRow
              title="Áudio do PC"
              description="Todos os apps, menos o Pherielium."
              control={(id) => <Toggle aria-labelledby={id} checked={pcAudio} onCheckedChange={setPcAudio} />}
            />
            <div className="flex justify-end py-4">
              <RefinedButton variant="primary">Começar a transmitir</RefinedButton>
            </div>
          </Surface></Reveal>
        </section>

        {/* Troféus: o próximo e o progresso */}
        <section aria-labelledby="lab-trophies" className="mt-32">
          <h2 id="lab-trophies" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">
            Troféus
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-[1fr_1.4fr]">
            <Reveal delay={0.08} className="h-full"><Surface tone={2} className="h-full flex items-center gap-8 p-8">
              <ProgressRing value={64} label="64% dos troféus de Hollow Knight" />
              <div>
                <div className="text-[length:var(--step-1)] text-[var(--ink-muted)]">Hollow Knight</div>
                <div className="mt-1 font-display text-[length:var(--step-3)] font-semibold tracking-[-0.02em]">
                  Faltam 9 para a platina
                </div>
                <RefinedButton variant="tonal" size="sm" className="mt-5">
                  Ver os que faltam
                </RefinedButton>
              </div>
            </Surface></Reveal>
            <Reveal delay={0} className="h-full"><Surface tone={1} className="h-full p-3">
              <ul>
                {TROPHIES.map((t) => (
                  <li key={t.title} className="flex items-center gap-4 rounded-[var(--corner-md)] px-4 py-3 hover:bg-[var(--tone-2)]">
                    <img src={t.tier} alt={`Troféu de ${t.tierName}`} width={44} height={44} className="h-11 w-11 object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:var(--step-1)] font-medium">{t.title}</span>
                      <span className="block text-[length:var(--step-0)] text-[var(--ink-muted)]">{t.game}</span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block text-[length:var(--step-1)] font-semibold">{t.rarity.toLocaleString("pt-BR")}%</span>
                      <span className="block text-[length:var(--step-0)] text-[var(--ink-muted)]">dos jogadores</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Surface></Reveal>
          </div>
        </section>

        {/* Mods: filtro em segmentado e lista */}
        <section aria-labelledby="lab-mods" className="mt-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="lab-mods" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">
              Mods
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex h-11 items-center gap-2 rounded-[var(--node)] bg-[var(--tone-2)] px-4 text-[var(--ink-muted)]">
                <Search className="h-4 w-4" aria-hidden="true" />
                <input
                  aria-label="Pesquisar jogos"
                  placeholder="Pesquisar jogos…"
                  className="w-48 bg-transparent text-[length:var(--step-1)] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                />
              </label>
              <Segmented
                label="Mostrar"
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "active", label: "Com mods ativos" },
                  { value: "nofolder", label: "Sem pasta" },
                ]}
              />
            </div>
          </div>
          <Reveal delay={0.08} className="h-full"><Surface tone={1} className="h-full mt-8 p-3">
            <ul>
              {mods.map((m) => (
                <li key={m.game} className="flex items-center gap-4 rounded-[var(--corner-md)] px-4 py-4 hover:bg-[var(--tone-2)]">
                  <span className="min-w-0 flex-1 text-[length:var(--step-2)] font-medium">{m.game}</span>
                  <span className="w-40 text-[length:var(--step-1)] tabular-nums text-[var(--ink-muted)]">
                    {m.mods === 0 ? "Nenhum mod" : `${m.active} de ${m.mods} ativos`}
                  </span>
                  <span className="w-36 text-[length:var(--step-1)] text-[var(--ink-muted)]">
                    {m.folder ? "Pasta vinculada" : "Sem pasta"}
                  </span>
                  <RefinedButton variant={m.folder ? "quiet" : "tonal"} size="sm">
                    {m.folder ? "Abrir" : "Vincular pasta"}
                  </RefinedButton>
                </li>
              ))}
            </ul>
          </Surface></Reveal>
        </section>

        {/* Ajustes */}
        <section aria-labelledby="lab-settings" className="mt-32 grid gap-12 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="lab-settings" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.025em]">
              Ajustes
            </h2>
            <p className="mt-4 max-w-[40ch] text-[length:var(--step-2)] leading-relaxed text-[var(--ink-muted)]">
              Uma linha por ajuste, sem caixas dentro de caixas. O espaço separa as linhas.
            </p>
          </div>
          <Reveal delay={0} className="h-full"><Surface tone={1} className="h-full px-6 py-2">
            <SettingRow
              title="Avisos no notch"
              description="Amigos online, capturas salvas e novos níveis."
              control={(id) => <Toggle aria-labelledby={id} checked={alerts} onCheckedChange={setAlerts} />}
            />
            <SettingRow
              title="Estilo da interface"
              description="O visual anterior continua disponível."
              control={() => (
                <RefinedButton variant="tonal" size="sm" icon={<Settings2 className="h-4 w-4" />}>
                  Clássico
                </RefinedButton>
              )}
            />
          </Surface></Reveal>
        </section>
      </div>
      <ScreenPickerModal isOpen={streamModalOpen} onClose={() => setParams({})} onSelectSource={() => setParams({})} />
    </div>
  );
};

export default DesignLab;
