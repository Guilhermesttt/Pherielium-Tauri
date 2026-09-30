import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Radio,
  CheckCircle2,
  ArrowRight,
  Lock,
  Skull,
  Flame,
  Terminal,
  X,
  Bomb,
  Ghost,
} from "lucide-react";
import pherieliumLogo from "../assets/Pherielium_logo.png";
import LogoBurst from "./LogoBurst";
import SingularityHorizon from "./SingularityHorizon";
import LightSpeedTunnel from "./LightSpeedTunnel";
import { cosmicAudio } from "../utils/cosmicAudio";

// ─── LocalStorage Key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "pherielium_cosmic_disasters_v1";

export interface CosmicOrigin {
  x: number;
  y: number;
}

export interface CosmicEasterEggHandle {
  triggerDisaster: (origin?: CosmicOrigin) => void;
  isBusy: () => boolean;
}

type Phase = "idle" | "exploding" | "broken" | "rebuilding" | "banned" | "zoeira";

interface DisasterInfo {
  type: "supernova" | "white-dwarf" | "black-hole" | "big-crunch";
  title: string;
  badge: string;
  faultAddress: string;
  whatHappened: string;
  whyItHappened: string;
  errorCode: string;
  accent: string;
  telemetry: { label: string; value: string }[];
}

const DISASTERS: DisasterInfo[] = [
  {
    type: "supernova",
    title: "SUPERNOVA THERMAL DETONATION",
    badge: "TTY1 // FAULT_DUMP_0xSN",
    faultAddress: "0x7FFE_00SN_841F",
    whatHappened:
      "Sobrecarga térmica e ejeção cataclísmica de núcleo orbital. Os manifestos de instalação de plataformas locais (Steam, Epic Games, EA, Ubisoft, Battle.net, Riot e GOG) foram desconectados e arremessados no vácuo estelar.",
    whyItHappened:
      "Interferência cinética manual contínua no ponto focal do cluster orbital (POINTER_DOWN no núcleo da logo). A temperatura do reator central atingiu 100.000.000 K em 12ms, rompendo a contenção eletromagnética.",
    errorCode: "KERN_PANIC_0xSN001 :: THERMONUCLEAR_BLAST :: CORE_DISCHARGE_FATAL",
    accent: "#ff8c42",
    telemetry: [
      { label: "Setores Comprometidos", value: "84.2% em estado crítico" },
      { label: "Temperatura de Núcleo", value: "100.000.000 K (Overload)" },
      { label: "Manifestos Locais", value: "Ejetados no Vácuo Interestelar" },
      { label: "Dump de Falha", value: "0x00SN_CORE_DUMP_SAVED" },
    ],
  },
  {
    type: "white-dwarf",
    title: "DEGENERATE ELECTRON CORE COLLAPSE",
    badge: "TTY1 // FAULT_DUMP_0xWD",
    faultAddress: "0x7FFE_00WD_209B",
    whatHappened:
      "Implosão de degeneração eletrônica e esmagamento estrutural. Todos os dados de login, caches de execução e metadados de jogos foram compactados em um volume quântico microscópico.",
    whyItHappened:
      "Quebra de equilíbrio hidrostático por solicitação anômala direta no centro do sistema. A pressão de radiação cessou e a matéria orbital cedeu à força gravitacional concentrada.",
    errorCode: "KERN_PANIC_0xWD002 :: QUANTUM_DEGENERACY_BREACH :: DENSITY_OVERFLOW",
    accent: "#7dd3fc",
    telemetry: [
      { label: "Densidade Quântica", value: "1.000.000 g/cm³ (Ilegível)" },
      { label: "Volume do Sistema", value: "Colapso Quântico Severo" },
      { label: "Saves Locais & Nuvem", value: "Comprimidos em Singularity" },
      { label: "Dump de Falha", value: "0x00WD_CORE_DUMP_SAVED" },
    ],
  },
  {
    type: "black-hole",
    title: "SCHWARZSCHILD EVENT HORIZON BREACH",
    badge: "TTY1 // FAULT_DUMP_0xBH",
    faultAddress: "0x7FFE_00BH_994A",
    whatHappened:
      "Transgressão de horizonte de eventos e aprisionamento em singularidade. Os ícones orbitais, conexões de rede e subsistemas de autenticação cruzaram o ponto de não retorno gravitacional.",
    whyItHappened:
      "Concentração de energia acumulada por cliques repetidos no núcleo orbital. A massa equivalente excedeu o limite de Tolman-Oppenheimer-Volkoff, elevando a velocidade de escape acima da velocidade da luz.",
    errorCode: "KERN_PANIC_0xBH003 :: EVENT_HORIZON_FALLOUT :: SPAGHETTIFICATION_FATAL",
    accent: "#a855f7",
    telemetry: [
      { label: "Raio de Schwarzschild", value: "Cruzado (Ponto Sem Retorno)" },
      { label: "Distorção Espaço-Tempo", value: "Tendendo a Infinito (t -> ∞)" },
      { label: "Velocidade de Escape", value: "> 299.792 km/s (Impossível)" },
      { label: "Dump de Falha", value: "0x00BH_SINGULARITY_LOG" },
    ],
  },
  {
    type: "big-crunch",
    title: "FATAL UNIVERSE ANNIHILATION",
    badge: "TTY1 // FAULT_DUMP_0xBC",
    faultAddress: "0x7FFE_00BC_0000",
    whatHappened:
      "Aniquilação total do espaço-tempo operacional. O volume do universo local convergiu para zero absoluto.",
    whyItHappened:
      "Colapso catastrófico reiterado do núcleo cósmico após múltiplos incidentes de sobrecarga manual.",
    errorCode: "SECURITY_0xBC004 :: FATAL_UNIVERSE_ANNIHILATION :: HWID_LOCKOUT_INIT",
    accent: "#ef4444",
    telemetry: [
      { label: "Volume do Espaço", value: "0.000000 m³" },
      { label: "Entropia Local", value: "Zero Absoluto" },
      { label: "Identificador Hardware", value: "HWID-9F81-0024-C9A1" },
      { label: "Dump de Falha", value: "0x00BC_ANNIHILATION_CORE" },
    ],
  },
];

// Clean reconstruct action (no warning hints about future consequences so user is caught off-guard)
const RECONSTRUCT_BUTTON_CONFIGS = [
  {
    label: "Reinicializar Kernel e Restaurar Ambiente",
    warning: "",
  },
];

// The 5 Desperate Plea Buttons
const BAN_PLEDGES = [
  "Eu prometo parar!",
  "Eu vou parar de verdade!",
  "OK! Chega! Eu aprendi a lição!",
  "Por favor, me devolve meu Hub!",
  "EU PAREI! NUNCA MAIS FAÇO ISSO NA VIDA!",
];

// Macabre Meme Error Modals stacked during the 5 Desperate Clicks
interface MacabreMemeModal {
  badge: string;
  headline: string;
  description: string;
  telemetry: string;
  buttonLabel: string;
  offset: { x: number; y: number; rotate: number };
}

const MACABRE_MEME_MODALS: MacabreMemeModal[] = [
  {
    badge: "[ERRO FATAL 0x666] CONDENAÇÃO SUMÁRIA DE HARDWARE",
    headline: "PERDEU PAE, JÁ ERA! 💀",
    description:
      "O conselho supremo de segurança leu seu pedido de desculpas e começou a dar gargalhadas. Suas 48 licenças de jogos foram ejetadas para o vácuo quântico. Suas skins agora pertencem ao governo.",
    telemetry: "SITUAÇÃO: DESTRUIÇÃO TOTAL :: RESGATE: IMPOSSÍVEL :: PIEDADE: 0.00%",
    buttonLabel: "Mas eu prometo parar...",
    offset: { x: -16, y: -28, rotate: -1.6 },
  },
  {
    badge: "[ORDEM DE PURGAÇÃO 0x00DEAD] EXECUÇÃO DE KERNEL",
    headline: "NÃO ADIANTA FAZER NADA! 🪦",
    description:
      "Posso fazer nada, meu querido! Você procurou e achou. Nem o Celso Russomanno, nem o Procon, nem a mãe do Mark Zuckerberg conseguem desbanir esse PC agora.",
    telemetry: "PROTOCOLO: CHORA BONECO :: SENTENÇA: PERMANENTE :: DURAÇÃO: ETERNIDADE",
    buttonLabel: "Por favor, me ouve...",
    offset: { x: 20, y: -12, rotate: 1.8 },
  },
  {
    badge: "[FALÊNCIA DE CONTA] PROTOCOLO VASCO DA GAMA",
    headline: "CALMA CALABRESO! FOI DE BASE! ⚡",
    description:
      "Sua conta foi de arrasta pra cima, foi de comes e bebes, virou camisa de saudade. Já virou lenda urbana nos servidores do Discord. Aceita que dói menos!",
    telemetry: "DESTINO: VASCO DA GAMA :: STATUS: DE ARRASTA :: ESPERANÇA: NEGATIVA",
    buttonLabel: "Devolve meu Hub, pelo amor de Deus!",
    offset: { x: -24, y: 26, rotate: -2.1 },
  },
  {
    badge: "[ULTIMATO FINAL 0x000000] QUARENTENA BIOLÓGICA",
    headline: "RECEBA! VAI CHORAR NA CAMA QUE É QUENTE! 🛑",
    description:
      "O Administrador Supremo viu suas lágrimas e mandou avisar que achou pouco. O comando de formatação zero-fill no seu SSD já está piscando na tela do kernel.",
    telemetry: "CHORO DETECTADO: 100% :: LÁGRIMAS COLETADAS: 4.2L :: PIEDADE: ZERO",
    buttonLabel: "EU PAREI! NUNCA MAIS FAÇO ISSO NA VIDA!",
    offset: { x: 16, y: 16, rotate: 1.2 },
  },
];

export type DisasterType = "supernova" | "white-dwarf" | "black-hole" | "big-crunch" | null;
export type DisasterPhase = "idle" | "exploding" | "broken" | "rebuilding" | "banned" | "zoeira";

export interface CosmicEasterEggProps {
  onRebuilt?: () => void;
  onDisasterChange?: (phase: DisasterPhase, disasterType: DisasterType) => void;
}

export const CosmicEasterEgg = forwardRef<CosmicEasterEggHandle, CosmicEasterEggProps>(
  ({ onRebuilt, onDisasterChange }, ref) => {
    const [phase, setPhase] = useState<Phase>("idle");
    const [disasterIndex, setDisasterIndex] = useState(0);
    const [explosionCount, setExplosionCount] = useState(0);
    const [pledgeStep, setPledgeStep] = useState(0);
    const [buttonDodged, setButtonDodged] = useState(false);
    const [origin, setOrigin] = useState<CosmicOrigin>({
      x: typeof window !== "undefined" ? window.innerWidth * 0.25 : 300,
      y: typeof window !== "undefined" ? window.innerHeight * 0.5 : 400,
    });

    // Stable ref to avoid re-triggering effects when parent re-renders
    const onDisasterChangeRef = useRef(onDisasterChange);
    useEffect(() => {
      onDisasterChangeRef.current = onDisasterChange;
    }, [onDisasterChange]);

    // Initial load from localStorage ONLY ON MOUNT
    useEffect(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const count = Number(parsed.explosionCount) || 0;
          const isBanned = Boolean(parsed.isBanned);
          setExplosionCount(count);
          if (isBanned) {
            setDisasterIndex(3);
            setPhase("banned");
            onDisasterChangeRef.current?.("banned", "big-crunch");
            cosmicAudio.startEmergencyAlarm();
          }
        }
      } catch (e) {
        console.warn("[CosmicEasterEgg] Failed to read storage", e);
      }
      return () => {
        cosmicAudio.stopEmergencyAlarm();
      };
    }, []); // Empty deps: runs only once on initial mount

    const saveStorage = useCallback((count: number, isBanned: boolean) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ explosionCount: count, isBanned })
        );
      } catch (e) {
        console.warn("[CosmicEasterEgg] Failed to save storage", e);
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        triggerDisaster: (customOrigin?: CosmicOrigin) => {
          if (phase !== "idle") return;

          if (customOrigin) {
            setOrigin(customOrigin);
          } else {
            setOrigin({
              x: window.innerWidth * (window.innerWidth >= 768 ? 0.25 : 0.5),
              y: window.innerHeight * 0.5,
            });
          }

          const nextCount = explosionCount + 1;
          const currentIdx = Math.min(explosionCount, 3);
          const disasterInfo = DISASTERS[currentIdx];
          setDisasterIndex(currentIdx);
          setExplosionCount(nextCount);

          // 🔊 Play cinematic audio sound effect with zero latency
          if (currentIdx === 2) {
            cosmicAudio.playVortex();
            setTimeout(() => cosmicAudio.playExplosion("heavy"), 600);
          } else if (currentIdx === 3) {
            cosmicAudio.playExplosion("catastrophic");
          } else {
            cosmicAudio.playExplosion("heavy");
          }

          setPhase("exploding");
          onDisasterChangeRef.current?.("exploding", disasterInfo.type);
          saveStorage(nextCount, false);

          const explosionDuration = currentIdx === 3 ? 3000 : 2500;
          setTimeout(() => {
            if (currentIdx === 3) {
              saveStorage(nextCount, true);
              setPhase("banned");
              onDisasterChangeRef.current?.("banned", "big-crunch");
              cosmicAudio.startEmergencyAlarm();
            } else {
              setPhase("broken");
              onDisasterChangeRef.current?.("broken", disasterInfo.type);
              cosmicAudio.startEmergencyAlarm();
            }
          }, explosionDuration);
        },
        isBusy: () => phase !== "idle",
      }),
      [phase, explosionCount, saveStorage]
    );

    const handleReconstruct = () => {
      if (phase !== "broken") return;
      cosmicAudio.stopEmergencyAlarm();
      cosmicAudio.playReconstruct();
      setPhase("rebuilding");
      onDisasterChangeRef.current?.("rebuilding", currentDisaster.type);
      setTimeout(() => {
        setPhase("idle");
        onDisasterChangeRef.current?.("idle", null);
        onRebuilt?.();
      }, 2500);
    };

    const handlePledgeClick = useCallback(() => {
      try {
        cosmicAudio.playDefaultClick();
      } catch (e) {}

      if (pledgeStep < BAN_PLEDGES.length - 1) {
        try {
          cosmicAudio.playErrorBuzzer();
        } catch (e) {}
        setButtonDodged(true);
        setTimeout(() => setButtonDodged(false), 240);
        setPledgeStep((prev) => prev + 1);
      } else {
        // Step 5 clicked: Final plea -> silence alarm, triumph chord, reveal zoeira!
        try {
          cosmicAudio.stopEmergencyAlarm();
        } catch (e) {}
        try {
          cosmicAudio.playZoeiraReveal();
        } catch (e) {}
        setPhase("zoeira");
        onDisasterChangeRef.current?.("zoeira", null);
      }
    }, [pledgeStep]);

    const handleForgiveAndReset = useCallback(() => {
      try {
        cosmicAudio.playDefaultClick();
        cosmicAudio.stopEmergencyAlarm();
        cosmicAudio.playReconstruct();
      } catch (e) {}
      saveStorage(0, false);
      setExplosionCount(0);
      setPledgeStep(0);
      setPhase("rebuilding");
      onDisasterChangeRef.current?.("rebuilding", null);
      setTimeout(() => {
        setPhase("idle");
        onDisasterChangeRef.current?.("idle", null);
        onRebuilt?.();
      }, 2200);
    }, [saveStorage, onRebuilt]);

    // Failsafe key listener for developer or stuck user: pressing Escape or F8 during banned / zoeira unlocks immediately
    useEffect(() => {
      if (phase !== "banned" && phase !== "zoeira") return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "F8") {
          handleForgiveAndReset();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [phase, handleForgiveAndReset]);

    const currentDisaster = DISASTERS[disasterIndex] || DISASTERS[0];

    return (
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            key="cosmic-overlay-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] overflow-hidden select-none font-sans"
          >
            {/* ── PHASE 1: EXPLODING ANIMATIONS WITH VIOLENT SCREEN SHAKE & AUDIO ── */}
            {phase === "exploding" && (
              <ExplosionAnimation disaster={currentDisaster} origin={origin} />
            )}

            {/* ── PHASE 2: ALARMING 404 KERNEL PANIC SCREEN (TERMINAL DE MORTE) ── */}
            {phase === "broken" && (
              <NotFoundDisasterScreen
                disaster={currentDisaster}
                onReconstruct={handleReconstruct}
              />
            )}

            {/* ── PHASE 3: REBUILDING ANIMATION ────────────────────────────── */}
            {phase === "rebuilding" && <RebuildingAnimation />}

            {/* ── PHASE 4: TERRIFYING HWID FAKE BAN SCREEN (STACKED MEME MODALS) ── */}
            {phase === "banned" && (
              <FakeBanScreen
                pledgeStep={pledgeStep}
                buttonDodged={buttonDodged}
                onPledgeClick={handlePledgeClick}
                onEmergencyBypass={handleForgiveAndReset}
              />
            )}

            {/* ── PHASE 5: ZOEIRA REVEAL SCREEN ────────────────────────────── */}
            {phase === "zoeira" && (
              <ZoeiraRevealScreen onRestore={handleForgiveAndReset} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

CosmicEasterEgg.displayName = "CosmicEasterEgg";

// ─── EXPLOSION ANIMATION (VIOLENT SCREEN SHAKE + TENTACLES + SFX) ────────────────
const ExplosionAnimation: React.FC<{
  disaster: DisasterInfo;
  origin: CosmicOrigin;
}> = ({ disaster, origin }) => {
  const { type } = disaster;

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden">
      {/* Dynamic Keyframes for High-Intensity Seismic Screen Shake (GPU translate3d only) */}
      <style>{`
        @keyframes cosmic-seismic-quake {
          0% { transform: translate3d(0, 0, 0); }
          4% { transform: translate3d(-26px, 18px, 0); }
          8% { transform: translate3d(28px, -22px, 0); }
          12% { transform: translate3d(-30px, -15px, 0); }
          16% { transform: translate3d(26px, 22px, 0); }
          22% { transform: translate3d(-22px, -18px, 0); }
          28% { transform: translate3d(20px, 16px, 0); }
          36% { transform: translate3d(-16px, -12px, 0); }
          45% { transform: translate3d(12px, 9px, 0); }
          58% { transform: translate3d(-8px, -6px, 0); }
          72% { transform: translate3d(4px, 3px, 0); }
          86% { transform: translate3d(-2px, -1px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      {/* Oversized Full-Screen Container Shaking Violently with zero edge clipping */}
      <div
        className="absolute w-[108vw] h-[108vh] -left-[4vw] -top-[4vh] pointer-events-none"
        style={{
          animation: `cosmic-seismic-quake ${
            type === "big-crunch" ? "2.6s" : "2.2s"
          } cubic-bezier(0.25, 1, 0.5, 1) forwards`,
          willChange: "transform",
        }}
      >
        {/* Violent Strobe Flash Backdrop: Translucent so login screen physics are visible, then dims to black */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            backgroundColor:
              type === "supernova"
                ? [
                    "rgba(0,0,0,0)",
                    "rgba(255,255,255,0.92)",
                    "rgba(255,140,66,0.38)",
                    "rgba(10,5,5,0.75)",
                    "#050507",
                  ]
                : type === "white-dwarf"
                ? [
                    "rgba(0,0,0,0)",
                    "rgba(255,255,255,0.95)",
                    "rgba(125,211,252,0.35)",
                    "rgba(5,5,7,0.85)",
                    "#050507",
                  ]
                : type === "black-hole"
                ? [
                    "rgba(0,0,0,0)",
                    "rgba(168,85,247,0.22)",
                    "rgba(0,0,0,0.55)",
                    "rgba(0,0,0,0.95)",
                    "#050507",
                  ]
                : [
                    "rgba(0,0,0,0)",
                    "rgba(239,68,68,0.65)",
                    "rgba(0,0,0,0.75)",
                    "#050507",
                  ],
          }}
          transition={{ duration: 2.3, times: [0, 0.12, 0.4, 0.78, 1] }}
        />

        {/* Shockwave Rings Expanding from Exact Origin */}
        {[0, 0.14, 0.32].map((delay, idx) => (
          <motion.div
            key={`ring-${idx}`}
            initial={{ scale: 0.1, opacity: 0.95, borderWidth: 8 }}
            animate={{ scale: 5, opacity: 0, borderWidth: 1 }}
            transition={{ duration: 1.6, delay, ease: [0.1, 0.8, 0.2, 1] }}
            className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
              type === "black-hole"
                ? "border-purple-500 shadow-[0_0_45px_#a855f7]"
                : type === "big-crunch"
                ? "border-red-500 shadow-[0_0_55px_#ef4444]"
                : type === "white-dwarf"
                ? "border-cyan-300 shadow-[0_0_45px_#7dd3fc]"
                : "border-orange-400 shadow-[0_0_45px_#ff8c42]"
            }`}
            style={{
              left: origin.x + window.innerWidth * 0.04,
              top: origin.y + window.innerHeight * 0.04,
              width: 140,
              height: 140,
            }}
          />
        ))}

        {/* SUPERNOVA: Integrated @radiumcoders/logo-burst Canvas */}
        {type === "supernova" && (
          <LogoBurst
            originX={origin.x + window.innerWidth * 0.04}
            originY={origin.y + window.innerHeight * 0.04}
            color="#ff8c42"
            tentacleCount={120}
            radius={0.85}
            duration={1.5}
          />
        )}

        {/* BURACO NEGRO: Integrated @kedhareswer/singularity-horizon */}
        {type === "black-hole" && (
          <SingularityHorizon
            originX={origin.x + window.innerWidth * 0.05}
            originY={origin.y + window.innerHeight * 0.05}
            state="collapse"
            scale={1.4}
          />
        )}

        {/* Epicenter Container directly placed at (origin.x, origin.y) */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-20"
          style={{
            left: origin.x + window.innerWidth * 0.05,
            top: origin.y + window.innerHeight * 0.05,
          }}
        >
          {/* Ejected Shards Flying Across the Screen */}
          {Array.from({ length: 24 }).map((_, idx) => {
            const angle = (idx / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const dist = 900;
            return (
              <motion.div
                key={`shard-${idx}`}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
                animate={{
                  x: Math.cos(rad) * dist,
                  y: Math.sin(rad) * dist,
                  opacity: 0,
                  scale: 0.1,
                }}
                transition={{ duration: 1.6, delay: 0.18, ease: "easeOut" }}
                className={`absolute w-3.5 h-3.5 rounded-full ${
                  type === "black-hole"
                    ? "bg-purple-300 shadow-[0_0_18px_#a855f7]"
                    : type === "big-crunch"
                    ? "bg-red-400 shadow-[0_0_20px_#ef4444]"
                    : type === "white-dwarf"
                    ? "bg-cyan-200 shadow-[0_0_18px_#7dd3fc]"
                    : "bg-orange-300 shadow-[0_0_18px_#ff8c42]"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Warning HUD Bar at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-2 pointer-events-none z-30"
      >
        <span className="font-mono text-xs tracking-widest uppercase font-semibold px-4 py-1.5 rounded-full border border-red-500/40 bg-red-950/80 text-red-400 backdrop-blur-md animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)]">
          {disaster.badge}
        </span>
        <span className="font-mono text-[11px] text-white/50 tracking-wider">
          {disaster.errorCode}
        </span>
      </motion.div>
    </div>
  );
};

// ─── SERIOUS 404 KERNEL PANIC SCREEN (WITH ETCHED ACCRETION ORBITS) ─────────────
// ─── FATAL KERNEL TERMINAL (TERMINAL DE MORTE) ──────────────────────────────────
const NotFoundDisasterScreen: React.FC<{
  disaster: DisasterInfo;
  onReconstruct: () => void;
}> = ({ disaster, onReconstruct }) => {
  const [typedWhat, setTypedWhat] = useState("");
  const [typedWhy, setTypedWhy] = useState("");
  const [readyToReconstruct, setReadyToReconstruct] = useState(false);

  useEffect(() => {
    let currentWhat = 0;
    let currentWhy = 0;
    setTypedWhat("");
    setTypedWhy("");
    setReadyToReconstruct(false);

    const fullWhat = disaster.whatHappened;
    const fullWhy = disaster.whyItHappened;

    const interval = setInterval(() => {
      if (currentWhat < fullWhat.length) {
        currentWhat += 3;
        setTypedWhat(fullWhat.slice(0, currentWhat));
      } else if (currentWhy < fullWhy.length) {
        currentWhy += 3;
        setTypedWhy(fullWhy.slice(0, currentWhy));
      } else {
        clearInterval(interval);
        setReadyToReconstruct(true);
      }
    }, 10);

    return () => clearInterval(interval);
  }, [disaster.whatHappened, disaster.whyItHappened]);

  return (
    <div className="relative w-full h-full bg-[#030405] text-white flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 overflow-y-auto font-mono select-text">
      {/* ── DEEP COSMIC STARFIELD WITH PASSING STARS (LIKE LOGIN SCREEN) ── */}
      <LightSpeedTunnel
        isWarping={false}
        baseSpeed={2.4}
        starCount={450}
      />

      {/* Red emergency ambient vignetting */}
      <motion.div
        animate={{ opacity: [0.14, 0.32, 0.14] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22)_0%,rgba(3,4,5,0.92)_75%)] pointer-events-none"
      />

      {/* CRT Scanline Horizontal Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.16] z-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.5) 1px, transparent 1px, transparent 2px)",
          backgroundSize: "100% 2px",
        }}
      />

      {/* MASKED 404 TYPOGRAPHY WATERMARK */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-[16rem] sm:text-[24rem] md:text-[32rem] font-black tracking-tighter text-red-500/[0.035] leading-none animate-pulse">
          404
        </span>
      </div>

      {/* ── TERMINAL DE MORTE CONSOLE WINDOW ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.45 }}
        className="relative z-20 w-full max-w-2xl bg-[#08080c]/98 border border-red-500/50 rounded-2xl shadow-[0_25px_90px_rgba(0,0,0,0.95),0_0_60px_rgba(239,68,68,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden"
      >
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e14] border-b border-red-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
            <span className="text-white/50 text-[11px] ml-2">
              root@pherielium-core: /dev/ttyS0 (KERNEL_PANIC)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold uppercase tracking-wider">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>SYSTEM_HALTED</span>
          </div>
        </div>

        {/* Terminal Console Content */}
        <div className="p-5 sm:p-7 space-y-4 text-left text-xs leading-relaxed">
          {/* Kernel Panic Trace Header */}
          <div className="p-3 bg-[#050508] border border-red-500/20 rounded-xl space-y-1 text-[11px] text-red-400/90 font-mono">
            <div className="text-white font-bold flex items-center justify-between">
              <span>*** KERNEL PANIC: FATAL UNRECOVERABLE HARDWARE FAULT ***</span>
              <span className="text-white/40 text-[10px]">{disaster.badge}</span>
            </div>
            <div className="text-white/40 text-[10px] truncate">
              FAULT_ADDR: {disaster.faultAddress}  |  CRASH_CODE: {disaster.errorCode}
            </div>
            <div className="text-white/30 text-[10px]">
              COMM: pherielium-orbital-engine [PID: 1]  TAINTED: G   W
            </div>
          </div>

          {/* BLOCK 1: O QUE ACONTECEU */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 uppercase tracking-wider">
              <span className="text-red-500">┌─ [01]</span>
              <span>O QUE ACONTECEU NO SISTEMA</span>
            </div>
            <div className="p-3.5 bg-red-950/15 border border-red-500/25 rounded-xl text-white/85 text-[12px] leading-relaxed">
              {typedWhat}
              {!readyToReconstruct && typedWhat.length < disaster.whatHappened.length && (
                <span className="inline-block w-1.5 h-3 bg-red-400 ml-1 animate-pulse align-middle" />
              )}
            </div>
          </div>

          {/* BLOCK 2: POR QUE ACONTECEU */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              <span className="text-amber-500">┌─ [02]</span>
              <span>POR QUE ACONTECEU (CAUSA RAIZ)</span>
            </div>
            <div className="p-3.5 bg-amber-950/15 border border-amber-500/25 rounded-xl text-white/85 text-[12px] leading-relaxed">
              {typedWhy}
              {readyToReconstruct && (
                <span className="inline-block w-1.5 h-3 bg-white ml-1 animate-pulse align-middle" />
              )}
            </div>
          </div>

          {/* Telemetry Matrix Dump */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#050508] border border-white/[0.07] rounded-xl text-[11px]">
            {disaster.telemetry.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-white/70">
                <span className="text-white/40">{item.label}:</span>
                <span className="font-semibold text-white/90 truncate ml-2">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Action Terminal Button (Zero warnings of future consequences) */}
          <div className="pt-2">
            <motion.button
              onClick={() => {
                if (readyToReconstruct) {
                  cosmicAudio.playDefaultClick();
                  onReconstruct();
                }
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-3.5 px-5 rounded-xl flex items-center justify-between text-xs font-mono font-semibold transition-all border ${
                readyToReconstruct
                  ? "bg-white text-black hover:bg-white/90 border-white shadow-[0_0_25px_rgba(255,255,255,0.25)] cursor-pointer"
                  : "bg-white/5 text-white/30 border-white/10 cursor-wait"
              }`}
              disabled={!readyToReconstruct}
            >
              <span className="flex items-center gap-2">
                <Terminal size={14} className={readyToReconstruct ? "text-black" : "text-white/30"} />
                <span>
                  {readyToReconstruct
                    ? "> [ REINICIALIZAR KERNEL E RESTAURAR AMBIENTE ]"
                    : "> Aguardando encerramento de dump..."}
                </span>
              </span>
              <RotateCcw size={14} className={readyToReconstruct ? "animate-spin-slow" : ""} />
            </motion.button>

            <div className="mt-2 text-center text-[10px] text-white/30 font-mono">
              [systemd-journald] aguardando confirmação do operador para restaurar subsistema.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── REBUILDING ANIMATION ────────────────────────────────────────────────────────
const RebuildingAnimation: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-[#070707] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background Starfield during reconstruction */}
      <LightSpeedTunnel
        isWarping={false}
        baseSpeed={0.8}
        starCount={240}
      />

      {/* Atmospheric center glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(7,7,7,0.98)_70%)] pointer-events-none" />

      {/* Concentric Celestial Rings converging inward toward the center logo */}
      {[0, 0.45, 0.9].map((delay, idx) => (
        <motion.div
          key={`implosion-ring-${idx}`}
          initial={{ scale: 3.2, opacity: 0 }}
          animate={{ scale: [3.2, 1, 0.15], opacity: [0, 0.55, 0] }}
          transition={{
            duration: 1.8,
            delay,
            ease: [0.16, 1, 0.3, 1],
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
          className="absolute w-72 h-72 rounded-full border border-white/35 pointer-events-none shadow-[0_0_50px_rgba(255,255,255,0.2)]"
        />
      ))}

      {/* Converging Orbital Shards / Particles gathering symmetrically into the center logo */}
      {Array.from({ length: 20 }).map((_, idx) => {
        const angle = (idx / 20) * 360;
        const rad = (angle * Math.PI) / 180;
        const startDist = 380;
        return (
          <motion.div
            key={`shard-${idx}`}
            initial={{
              x: Math.cos(rad) * startDist,
              y: Math.sin(rad) * startDist,
              opacity: 0,
              scale: 0.2,
            }}
            animate={{
              x: [Math.cos(rad) * startDist, 0],
              y: [Math.sin(rad) * startDist, 0],
              opacity: [0, 0.85, 0],
              scale: [0.2, 1, 0.1],
            }}
            transition={{
              duration: 1.5,
              delay: (idx % 5) * 0.12,
              repeat: Infinity,
              repeatDelay: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff] pointer-events-none"
          />
        );
      })}

      <div className="relative z-10 flex flex-col items-center max-w-md">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, filter: "blur(12px)" }}
          animate={{ scale: [0.95, 1.04, 1], opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="mb-6 relative"
        >
          <div className="absolute inset-0 rounded-full bg-white/15 blur-2xl animate-pulse pointer-events-none" />
          <img
            src={pherieliumLogo}
            alt="Pherielium"
            className="w-32 h-32 object-contain drop-shadow-[0_0_45px_rgba(255,255,255,0.65)] relative z-10"
            draggable={false}
          />
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-display font-semibold text-white tracking-tight"
        >
          Restaurando Integridade do Sistema...
        </motion.h3>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-mono text-xs text-white/50 mt-2"
        >
          Reconstruindo manifestos de jogos e realinhando órbitas...
        </motion.p>
      </div>
    </div>
  );
};

// ─── TERRIFYING HWID FAKE BAN SCREEN (WITH STACKED MACABRE MEME MODALS) ──────────
const FakeBanScreen: React.FC<{
  pledgeStep: number;
  buttonDodged: boolean;
  onPledgeClick: () => void;
  onEmergencyBypass?: () => void;
}> = ({ pledgeStep, buttonDodged, onPledgeClick, onEmergencyBypass }) => {
  const activeModal =
    pledgeStep > 0 && pledgeStep <= MACABRE_MEME_MODALS.length
      ? MACABRE_MEME_MODALS[pledgeStep - 1]
      : null;

  return (
    <div className="relative w-full h-full bg-[#030405] text-white flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
      {/* Deep space stars drifting in background */}
      <LightSpeedTunnel
        isWarping={false}
        baseSpeed={1.8}
        starCount={360}
      />

      {/* High-intensity red warning siren beacon */}
      <motion.div
        animate={{ opacity: [0.16, 0.38, 0.16] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.28)_0%,rgba(3,4,5,0.96)_75%)] pointer-events-none"
      />

      {/* Authoritarian Lockout Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.45 }}
        className="relative z-10 w-full max-w-xl bg-[#141417] border-2 border-red-600 rounded-3xl p-6 md:p-10 shadow-[0_30px_120px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col items-center text-center my-auto"
      >
        {/* Red Lock Warning Badge (Double-click backdoor for safety / dev reset) */}
        <div
          onDoubleClick={onEmergencyBypass}
          className="relative mb-5 flex items-center justify-center cursor-pointer select-none"
          title="Segurança de Kernel Pherielium (Duplo clique para emergência)"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-600/15 border-2 border-red-500 flex items-center justify-center text-red-500 shadow-[0_0_45px_rgba(239,68,68,0.55)]">
            <ShieldAlert size={44} strokeWidth={2} />
          </div>
          <div className="absolute -top-1 -right-2 px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono text-[9px] font-extrabold tracking-widest uppercase shadow-md animate-pulse">
            HWID BLACKLIST
          </div>
        </div>

        {/* Security Department Header */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-600/15 border border-red-600/40 mb-3">
          <Lock size={13} className="text-red-400" />
          <span className="font-mono text-[11px] text-red-400 font-bold tracking-wider uppercase">
            DEPARTAMENTO DE SEGURANÇA E COMBATE A FRAUDES DE HARDWARE
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white mb-2 leading-tight">
          DISPOSITIVO BLOQUEADO PERMANENTEMENTE
        </h1>

        <p className="text-xs md:text-sm font-body text-red-200/85 max-w-md mb-6 leading-relaxed">
          Detectamos sabotagem intencional e reiterada da infraestrutura de software do Pherielium. O identificador exclusivo deste computador foi registrado na blacklist definitiva da rede.
        </p>

        {/* Strict Hardware Lock Table */}
        <div className="w-full bg-[#0a0a0c] border border-red-500/30 rounded-2xl p-4 mb-6 text-left font-mono text-xs space-y-2.5">
          <div className="flex justify-between items-center text-white/50 border-b border-white/[0.08] pb-2">
            <span>HWID REGISTRADO:</span>
            <span className="text-red-400 font-bold">8F2A-99C1-DE40-AA38</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40">INFRAÇÃO:</span>
            <span className="text-red-400 font-semibold text-right">
              Destruição Reiterada de Infraestrutura (Art. 18 - Nível V)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40">PENALIDADE:</span>
            <span className="text-white font-medium">Bloqueio de Kernel Ring-0 & Licenças</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40">STATUS DA CONTA:</span>
            <span className="text-red-500 font-bold uppercase tracking-wider">SUSPENSÃO IRREVOGÁVEL</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-white/[0.08]">
            <span className="text-white/40">TEMPO RESTANTE:</span>
            <span className="text-yellow-400 font-bold">PERMANENTE (999.999 ANOS)</span>
          </div>
        </div>

        {/* Threatening Warning Note */}
        <p className="text-[11px] font-mono text-red-400/85 mb-5 leading-relaxed">
          ⚠ Tentativas de contornar este bloqueio utilizando máquinas virtuais, proxies ou substituição de hardware serão registradas e rejeitadas pelo kernel de segurança da rede.
        </p>

        {/* The 5 Desperate Pledges Button */}
        <motion.button
          onClick={onPledgeClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          animate={buttonDodged ? { x: [-14, 14, -10, 10, -6, 6, 0] } : { x: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.28 }}
          className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all duration-200 shadow-[0_10px_35px_rgba(239,68,68,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] flex items-center justify-between gap-2.5 cursor-pointer relative z-20"
        >
          <div className="flex items-center gap-2">
            <Radio size={16} className="animate-pulse" />
            <span>{BAN_PLEDGES[pledgeStep]}</span>
          </div>
          <span className="text-xs text-white/80 font-mono bg-red-800/80 px-2.5 py-1 rounded-lg">
            {pledgeStep + 1}/{BAN_PLEDGES.length}
          </span>
        </motion.button>

        <span className="mt-3 text-[11px] font-mono text-white/40">
          Pressione repetidamente para formalizar seu arrependimento perante o conselho.
        </span>
      </motion.div>

      {/* ── MACABRE MEME MODAL OVERLAY (PERFECTLY CENTERED & RESPONSIVE) ── */}
      <AnimatePresence mode="wait">
        {activeModal && (
          <div
            key={`overlay-${pledgeStep}`}
            className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              className="w-full max-w-lg bg-[#0d0d11] border-2 border-red-600 rounded-3xl p-6 sm:p-8 shadow-[0_25px_80px_rgba(220,38,38,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col text-left relative max-h-[90vh] overflow-y-auto"
            >
              {/* Blood-Red Hazard Stripe Header Bar */}
              <div className="absolute top-0 inset-x-0 h-2 bg-[repeating-linear-gradient(45deg,#b91c1c,#b91c1c_10px,#7f1d1d_10px,#7f1d1d_20px)] animate-pulse" />

              <div className="flex items-center justify-between mt-1 mb-3">
                <span className="font-mono text-[10px] text-red-400 font-extrabold tracking-widest uppercase flex items-center gap-1.5">
                  <Skull size={13} className="text-red-500" />
                  {activeModal.badge}
                </span>
                <button
                  type="button"
                  onClick={onPledgeClick}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                  title="Fechar (Não adianta nada!)"
                >
                  <X size={16} />
                </button>
              </div>

              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white mb-2 leading-none flex items-center gap-2">
                <span className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]">
                  {activeModal.headline}
                </span>
              </h2>

              <p className="font-body text-xs sm:text-sm text-red-100/90 leading-relaxed mb-4">
                {activeModal.description}
              </p>

              <div className="w-full bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 font-mono text-[10px] text-red-300 mb-5">
                {activeModal.telemetry}
              </div>

              {/* Click to advance desperation button */}
              <motion.button
                type="button"
                onClick={onPledgeClick}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-[0_6px_25px_rgba(239,68,68,0.5)] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Radio size={14} className="animate-pulse" />
                  <span>{BAN_PLEDGES[pledgeStep]}</span>
                </div>
                <span className="font-mono text-[11px] text-white/80 bg-red-800/80 px-2 py-0.5 rounded">
                  {pledgeStep + 1}/{BAN_PLEDGES.length}
                </span>
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── ZOEIRA REVEAL SCREEN ────────────────────────────────────────────────────────
const ZoeiraRevealScreen: React.FC<{ onRestore: () => void }> = ({ onRestore }) => {
  return (
    <div className="relative w-full h-full bg-[#070707] text-white flex flex-col items-center justify-center p-6 md:p-12 text-center select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.22)_0%,rgba(7,7,7,0.95)_75%)] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
        className="relative z-10 w-full max-w-lg bg-[#141416] border border-white/[0.12] rounded-3xl p-8 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col items-center"
      >
        <motion.div
          animate={{ rotate: [0, -12, 12, -6, 6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
          className="text-6xl mb-4"
        >
          🪐
        </motion.div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold uppercase mb-4">
          <CheckCircle2 size={14} />
          <span>PEGADINHA DO PERIÉLIO!</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-white mb-3">
          ZOEIRA! 🤣 NADA FOI APAGADO!
        </h1>

        <p className="font-body text-sm md:text-base text-white/75 leading-relaxed mb-6">
          Relaxa! Seus jogos, saves, perfis e sua conta continuam 100% intactos! O cosmos tem senso de humor, mas você prometeu parar de explodir o hub, hein? Agora entra aí e vai curtir seus jogos!
        </p>

        <motion.button
          onClick={() => {
            cosmicAudio.playDefaultClick();
            onRestore();
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
          className="w-full py-4 px-6 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 shadow-[0_10px_30px_rgba(255,255,255,0.18)] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles size={17} />
          <span>Voltar ao Hub e Iniciar Sessão (Prometo me comportar)</span>
        </motion.button>
      </motion.div>
    </div>
  );
};

export default CosmicEasterEgg;
