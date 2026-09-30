import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion, useAnimationControls } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Check, Monitor } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import battleNetLogo from "../assets/brands/battle-net.png";
import eaLogo from "../assets/brands/ea.png";
import epicLogo from "../assets/brands/epic-games.png";
import gogLogo from "../assets/brands/gog.png";
import riotLogo from "../assets/brands/riot.png";
import rockstarLogo from "../assets/brands/rockstar.png";
import ubisoftLogo from "../assets/brands/ubisoft.png";
import pherieliumLogo from "../assets/Pherielium_logo.png";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { LoadingState } from "../components/ui/loading-state";
import PlasmaHeroBackground from "../components/PlasmaHeroBackground";
import LightSpeedTunnel from "../components/LightSpeedTunnel";
import BlackHoleHeroSection from "../components/BlackHoleHeroSection";

// Variantes de entrada escalonada para os campos do formulário
const formContainerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.55 },
  },
};

const formItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// Overlay de sucesso — celebra a conclusão do login com um "estouro" de luz e colapso orbital
const SuccessOverlay = ({ message }: { message: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
      className="fixed inset-0 z-50 bg-[#030405] flex items-center justify-center overflow-hidden"
    >
      {/* Onda de luz expandindo a partir do centro */}
      <motion.div
        initial={{ scale: 0, opacity: 0.9 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute w-[70vmax] h-[70vmax] rounded-full bg-white blur-[100px] pointer-events-none"
      />

      {/* Anéis colapsando para dentro, indicando que a órbita "fechou" com sucesso */}
      <motion.div
        initial={{ scale: 2.4, opacity: 0.5, rotate: 0 }}
        animate={{ scale: 0.9, opacity: 0, rotate: 90 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border border-white/20"
      />
      <motion.div
        initial={{ scale: 3, opacity: 0.35, rotate: 0 }}
        animate={{ scale: 0.85, opacity: 0, rotate: -70 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="absolute w-96 h-96 md:w-[28rem] md:h-[28rem] rounded-full border border-dashed border-white/15"
      />

      {/* Núcleo: logo com brilho intenso + selo de confirmação */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-white blur-[60px]"
          />
          <img
            src={pherieliumLogo}
            alt="Pherielium"
            className="relative w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.85)]"
            draggable={false}
          />
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.6)]"
          >
            <Check size={18} strokeWidth={3.5} className="text-black" />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-semibold text-lg md:text-xl tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent"
        >
          {message}
        </motion.p>
      </div>
    </motion.div>
  );
};

// ─── Orbital Platform Icons — Keplerian physics ──────────────────────────────
// Each icon orbits on a circular ring. Speed varies within the orbit: the icon
// accelerates near the "perihelion" (bottom — closest visual point) and slows
// near the "aphelion" (top), simulating Kepler's Second Law.
// The icon container rotates; each icon counter-rotates so it stays upright.
//
// Perihelion flare: when the icon passes the bottom of its orbit, a brief
// glow/scale flare fires — like a body catching solar light at closest approach.

const KEPLER_TIMES = [0, 0.15, 0.30, 0.65, 1.0] as const;

interface OrbitIconProps {
  /** angle in degrees where this icon sits on its ring at t=0 */
  startAngle: number;
  /** orbit radius in px */
  radius: number;
  /** full rotation duration in seconds (positive = CW, negative = CCW) */
  duration: number;
  /** 0-based index for entrance stagger */
  index: number;
  label?: string;
  children: React.ReactNode;
}

const OrbitIcon: React.FC<OrbitIconProps> = ({
  startAngle,
  radius,
  duration,
  index,
  label,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReduced = useReducedMotion();
  const glowControls = useAnimationControls();

  const orbitDir = duration > 0 ? 360 : -360;
  const counterDir = duration > 0 ? -360 : 360;
  const absDuration = Math.abs(duration);

  // Perihelion moment: icon reaches bottom of orbit
  const linearFraction = ((180 - startAngle + 360) % 360) / 360;
  const perihelionDelay = linearFraction * absDuration * 0.6;

  useEffect(() => {
    if (prefersReduced) return;

    const triggerFlare = () => {
      glowControls.start({
        scale: [1, 1.28, 1],
        filter: [
          "brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))",
          "brightness(1.8) drop-shadow(0 0 12px rgba(255,255,255,0.9))",
          "brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))",
        ],
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
      });
    };

    const firstTimer = setTimeout(triggerFlare, perihelionDelay * 1000);
    const interval = setInterval(triggerFlare, absDuration * 1000);
    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [absDuration, perihelionDelay, prefersReduced, glowControls]);

  // Keyframe arrays for Keplerian rotation (5 evenly spaced angle keyframes)
  const orbitKeyframes = [
    startAngle,
    startAngle + orbitDir * 0.25,
    startAngle + orbitDir * 0.5,
    startAngle + orbitDir * 0.75,
    startAngle + orbitDir,
  ];
  const counterKeyframes = [
    -startAngle,
    -startAngle + counterDir * 0.25,
    -startAngle + counterDir * 0.5,
    -startAngle + counterDir * 0.75,
    -startAngle + counterDir,
  ];

  if (prefersReduced) {
    // Accessibility: static icons, no motion
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="absolute pointer-events-auto"
          style={{
            transform: `rotate(${startAngle}deg) translateY(-${radius}px) rotate(${-startAngle}deg)`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ rotate: startAngle }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, rotate: orbitKeyframes }}
      transition={{
        opacity: { duration: 0.5, delay: 0.6 + index * 0.09 },
        rotate: {
          duration: absDuration,
          times: [...KEPLER_TIMES],
          repeat: Infinity,
          ease: "linear",
        },
      }}
    >
      {/* Radial translation wrapper */}
      <div className="absolute" style={{ transform: `translateY(-${radius}px)` }}>
        {/* Counter-rotate / upright wrapper */}
        <motion.div
          initial={{ rotate: -startAngle }}
          animate={{ rotate: counterKeyframes }}
          transition={{
            rotate: {
              duration: absDuration,
              times: [...KEPLER_TIMES],
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {/* Perihelion flare & interactive platform hover wrapper */}
          <motion.div
            animate={glowControls}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.25 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.25 }}
            className="relative pointer-events-auto cursor-pointer"
          >
            {children}

            {/* Platform name tooltip badge */}
            <AnimatePresence>
              {isHovered && label && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: 1, y: -26, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.8 }}
                  transition={{ type: "spring", bounce: 0.25, duration: 0.2 }}
                  className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#121216]/95 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium font-body shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] whitespace-nowrap pointer-events-none flex items-center gap-1.5 z-50 select-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span>{label}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

// AAA Minimalist Floating Logo with Celestial Orbital Platform Icons
interface AnimatedPherieliumLogoProps {
  onLogoClick?: () => void;
  onHoverChange?: (isHovered: boolean) => void;
  isBlackHoleActive?: boolean;
}

const AnimatedPherieliumLogo: React.FC<AnimatedPherieliumLogoProps> = ({
  onLogoClick,
  onHoverChange,
  isBlackHoleActive = false,
}) => {
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 120 };
  const rotateX = useSpring(useTransform(mouseY, [-200, 200], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-10, 10]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Outer ring icons: 5 platforms, CW 44s
  const outerIcons: Array<{ src?: string; node?: React.ReactNode; alt: string; startAngle: number }> = [
    {
      node: <FontAwesomeIcon icon={faSteam} className="w-5 h-5 text-white" />,
      alt: "Steam",
      startAngle: 0,
    },
    { src: epicLogo, alt: "Epic Games", startAngle: 72 },
    { src: battleNetLogo, alt: "Battle.net", startAngle: 144 },
    { src: ubisoftLogo, alt: "Ubisoft Connect", startAngle: 216 },
    { src: rockstarLogo, alt: "Rockstar Games", startAngle: 288 },
  ];

  // Inner ring icons: 4 platforms, CCW 28s
  const innerIcons: Array<{ src?: string; node?: React.ReactNode; alt: string; startAngle: number }> = [
    { src: riotLogo, alt: "Riot Games", startAngle: 45 },
    { src: eaLogo, alt: "EA App", startAngle: 135 },
    { src: gogLogo, alt: "GOG Galaxy", startAngle: 225 },
    { node: <Monitor size={22} color="white" strokeWidth={1.5} />, alt: "Jogos Locais", startAngle: 315 },
  ];

  const outerRadius = 185;
  const innerRadius = 125;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center select-none"
      style={{ width: 440, height: 440 }}
    >
      {/* Celestial Orbits & Platform Icons — hidden smoothly when black hole singularity is active */}
      <AnimatePresence>
        {!isBlackHoleActive && (
          <motion.div
            key="celestial-orbits"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {/* Decorative orbit ring lines */}
            <div
              className="absolute rounded-full border border-white/[0.08]"
              style={{ width: outerRadius * 2, height: outerRadius * 2 }}
            />
            <div
              className="absolute rounded-full border border-white/[0.07] border-dashed"
              style={{ width: innerRadius * 2, height: innerRadius * 2 }}
            />

            {/* Outer orbit icons */}
            {outerIcons.map((item, i) => (
              <OrbitIcon
                key={item.alt}
                startAngle={item.startAngle}
                radius={outerRadius}
                duration={44}
                index={i}
                label={item.alt}
              >
                <div
                  className="flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:border-white/35 backdrop-blur-sm border border-white/15 shadow-lg transition-all"
                  style={{ width: 40, height: 40 }}
                >
                  {item.node ? (
                    item.node
                  ) : (
                    <img
                      src={item.src}
                      alt={item.alt}
                      draggable={false}
                      className="w-5 h-5 object-contain"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  )}
                </div>
              </OrbitIcon>
            ))}

            {/* Inner orbit icons */}
            {innerIcons.map((item, i) => (
              <OrbitIcon
                key={item.alt}
                startAngle={item.startAngle}
                radius={innerRadius}
                duration={-24}
                index={i + outerIcons.length}
                label={item.alt}
              >
                <div
                  className="flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:border-white/35 backdrop-blur-sm border border-white/15 shadow-lg transition-all"
                  style={{ width: 36, height: 36 }}
                >
                  {item.node ? (
                    item.node
                  ) : (
                    <img
                      src={item.src}
                      alt={item.alt}
                      draggable={false}
                      className="w-5 h-5 object-contain"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  )}
                </div>
              </OrbitIcon>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central floating logo — click to activate black hole */}
      <AnimatePresence>
        {!isBlackHoleActive && (
          <motion.div
            key="central-logo"
            ref={logoContainerRef}
            style={{ rotateX, rotateY }}
            initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
            animate={{
              opacity: 1,
              scale: 1,
              scaleX: 1,
              scaleY: 1,
              rotate: 0,
              y: [-8, 8, -8],
              filter: "brightness(1) blur(0px)",
            }}
            exit={{
              opacity: 0,
              scale: 0.2,
              filter: "blur(8px)",
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{
              opacity: { duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.9, delay: 0.15, type: "spring", stiffness: 90, damping: 11 },
              rotate: { duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.1 },
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            onClick={() => onLogoClick?.()}
            className="relative z-10 cursor-pointer group"
            title="Ativar horizonte de eventos"
          >
            <img
              src={pherieliumLogo}
              alt="Pherielium"
              className="object-contain transition-all duration-500 group-hover:scale-105 drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]"
              style={{ width: 192, height: 192 }}
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Floating-label input wrapper
interface FloatInputProps {
  id: string;
  type: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rightSlot?: React.ReactNode;
  placeholder?: string;
}

const FloatInput: React.FC<FloatInputProps> = ({ id, type, label, value, onChange, required, rightSlot, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        placeholder={lifted ? (placeholder ?? "") : ""}
        className={`w-full bg-white/[0.05] border rounded-2xl px-4 pt-5 pb-2.5 ${
          rightSlot ? "pr-11" : ""
        } text-sm font-body text-white placeholder:text-white/25 outline-none transition-[border-color,box-shadow] duration-200 ${
          focused
            ? "border-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
            : "border-white/[0.18] hover:border-white/35"
        }`}
      />
      <motion.label
        htmlFor={id}
        animate={lifted ? { y: -10, scale: 0.78, color: focused ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" } : { y: 0, scale: 1, color: "rgba(255,255,255,0.4)" }}
        transition={{ type: "spring", bounce: 0, duration: 0.28 }}
        style={{ originX: 0 }}
        className="absolute left-4 top-[50%] -translate-y-1/2 text-sm font-body pointer-events-none"
      >
        {label}
      </motion.label>
      {rightSlot && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
    </div>
  );
};

const LoginContent: React.FC = () => {
  const { user, signInWithGoogle, cancelGoogleBrowserAuth, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isWarping, setIsWarping] = useState(false);
  const [isBlackHoleActive, setIsBlackHoleActive] = useState(false);
  const shakeControls = useAnimationControls();

  const handleLogoClick = useCallback(() => {
    setIsBlackHoleActive((prev) => !prev);
  }, []);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isGoogleCancelledRef = useRef(false);

  const handleCancelGoogleLogin = useCallback(() => {
    isGoogleCancelledRef.current = true;
    cancelGoogleBrowserAuth();
    setIsGoogleLoading(false);
    setError(null);
  }, [cancelGoogleBrowserAuth]);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/app", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Listener para cancelar com tecla Escape caso o usuário desista ou feche o navegador
  useEffect(() => {
    if (!isGoogleLoading) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelGoogleLogin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGoogleLoading, handleCancelGoogleLogin]);

  // Se o usuário alternar de volta para a janela após abrir o navegador,
  // damos uma tolerância e, se não autenticar, cancelamos automaticamente para não travar a tela.
  useEffect(() => {
    if (!isGoogleLoading) return;
    let focusReturnTimer: any = null;

    const handleWindowFocus = () => {
      if (!focusReturnTimer) {
        focusReturnTimer = setTimeout(() => {
          handleCancelGoogleLogin();
        }, 15_000);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      if (focusReturnTimer) clearTimeout(focusReturnTimer);
    };
  }, [isGoogleLoading, handleCancelGoogleLogin]);

  if (authLoading && !user) {
    return (
      <div className="min-h-screen w-full bg-[#030405] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <PlasmaHeroBackground opacity={0.45} />
        <div className="relative z-10 flex flex-col items-center gap-6 p-8 md:p-10 rounded-[32px] border border-white/[0.08] bg-[#08090C]/80 backdrop-blur-2xl shadow-2xl">
          <img src={pherieliumLogo} alt="Pherielium" className="w-16 h-16 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] animate-pulse" />
          <LoadingState label="Verificando sessão..." variant="breathing" />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      setIsLoading(false);
      setLoginSuccess(true);
      setTimeout(() => navigate("/app", { replace: true }), 1500);
      return;
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential" ||
        err.code === "invalid_credentials" ||
        msg.includes("invalid login credentials") ||
        msg.includes("invalid credential")
      ) {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use" || msg.includes("already registered") || msg.includes("already in use")) {
        setError("Este e-mail já está em uso.");
      } else if (err.code === "auth/weak-password" || msg.includes("password should be at least")) {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      // Trigger form shake on error
      shakeControls.start({
        x: [0, -9, 9, -6, 6, -3, 3, 0],
        transition: { duration: 0.48, ease: "easeInOut" },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    isGoogleCancelledRef.current = false;
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      if (isGoogleCancelledRef.current) {
        return;
      }
      setIsGoogleLoading(false);
      setLoginSuccess(true);
      setTimeout(() => navigate("/app", { replace: true }), 1500);
      return;
    } catch (err: any) {
      if (isGoogleCancelledRef.current) return;
      console.error("[Login] Erro no login Google:", err);
      setError(err?.message || "Falha ao entrar com Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="min-h-screen w-full bg-[#030405] text-white flex flex-col md:flex-row items-center justify-between p-6 md:p-14 lg:p-20 relative overflow-hidden font-sans selection:bg-white selection:text-black"
    >
      {/* Overlay de sucesso — some assim que o login/cadastro é confirmado */}
      <AnimatePresence>
        {loginSuccess && (
          <SuccessOverlay
            message={mode === "login" ? "Bem-vindo de volta" : "Conta criada com sucesso"}
          />
        )}
      </AnimatePresence>

      {/* Background WebGL Plasma Shader with Film Grain (21st.dev hero by @silvestrefrigeriopro) */}
      {!isBlackHoleActive && <PlasmaHeroBackground opacity={0.45} />}

      {/* Black Hole Singularity WebGL Shader Hero (activated on logo click) */}
      <AnimatePresence>
        {isBlackHoleActive && (
          <motion.div
            key="black-hole-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <BlackHoleHeroSection
              distance={22}
              elevation={-6}
              azimuth={0}
              orbitSpeed={0}
              roll={-18}
              fov={42}
              diskInner={3}
              diskOuter={14}
              diskThickness={0.24}
              diskDensity={1.05}
              brightness={1.1}
              spinSpeed={0.06}
              grain={0.5}
              doppler={0.4}
              hotColor="#FFF3DE"
              midColor="#FF9838"
              coolColor="#8E3A0B"
              starBrightness={0.4}
              glow={1.2}
              exposure={0.95}
              vignette={0.32}
              steps={260}
              resolution={0.8}
              maxDpr={1.5}
              focus={typeof window !== "undefined" && window.innerWidth >= 768 ? [0.26, 0.5] : [0.5, 0.35]}
              scrim="right"
              scrimStrength={0.65}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Light-Speed Warp Drive Starfield (21st.dev by @rahil1202) */}
      <LightSpeedTunnel
        isWarping={isWarping}
        originX={typeof window !== "undefined" ? (window.innerWidth >= 768 ? window.innerWidth * 0.25 : window.innerWidth * 0.5) : undefined}
        originY={typeof window !== "undefined" ? window.innerHeight * 0.5 : undefined}
      />

      {/* Ambient Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(3,4,5,0.8)_100%)] pointer-events-none" />

      {/* Singularity Indicator Pill */}
      <AnimatePresence>
        {isBlackHoleActive && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#121216]/90 backdrop-blur-xl border border-white/15 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] text-xs select-none"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF9838] shadow-[0_0_8px_#FF9838] animate-pulse" />
            <span className="font-ui text-white/90 font-medium">Singularidade Ativa</span>
            <button
              type="button"
              onClick={() => setIsBlackHoleActive(false)}
              className="text-[11px] text-white/50 hover:text-white underline ml-1 cursor-pointer transition-colors"
            >
              Desativar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP LEFT BRAND NAME (Space Grotesk) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="absolute top-8 left-8 md:top-12 md:left-14 z-20 flex items-center gap-1.5 select-none"
        title="Pherielium Hub"
      >
        <span className="font-display font-semibold text-xl md:text-xl tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent">
          Pherielium
        </span>
        <span className="text-[30px] text-white/40 font-mono align-top">®</span>
      </motion.div>

      {/* BOTTOM LEFT COPYRIGHT (Inter) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute bottom-8 left-8 md:bottom-12 md:left-14 z-20 text-[11px] text-white/35 font-body tracking-wide"
      >
        © Pherielium 2026. Todos os direitos reservados.
      </motion.div>

      {/* LEFT COLUMN: Large Animated Celestial Logo (or click anywhere to restore) */}
      <div
        onClick={() => {
          if (isBlackHoleActive) {
            handleLogoClick();
          }
        }}
        className={`w-full md:w-1/2 h-full flex items-center justify-center z-10 py-12 md:py-0 ${
          isBlackHoleActive ? "cursor-pointer" : ""
        }`}
        title={isBlackHoleActive ? "Clique para restaurar a logo e as órbitas" : undefined}
      >
        <AnimatedPherieliumLogo
          onLogoClick={handleLogoClick}
          onHoverChange={setIsWarping}
          isBlackHoleActive={isBlackHoleActive}
        />
      </div>

      {/* RIGHT COLUMN: Opaque Blur Card with Space Grotesk Titles & Inter Body */}
      <div className="w-full md:w-1/2 flex items-center justify-center md:justify-end z-10">
        <motion.div
          initial={{ opacity: 0, x: 25, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-[#0A0B0F]/90 backdrop-blur-3xl border border-white/20 rounded-[36px] p-8 md:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18),0_0_0_1px_rgba(255,255,255,0.06)] relative flex flex-col justify-between"
        >
          {/* Header — AnimatePresence for smooth mode switch */}
          <div className="space-y-2 mb-8 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              >
                <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent">
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </h1>
                <p className="mt-1.5 text-xs md:text-sm font-body text-white/45 leading-relaxed">
                  {mode === "login"
                    ? "Acesse seu hub universal de jogos e mods."
                    : "Crie sua conta Pherielium e sincronize sua biblioteca."}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Form — shake wrapper: outer motion.div drives the horizontal shake
              imperatively via shakeControls; the form itself is never remounted */}
          <motion.div animate={shakeControls}>
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            variants={formContainerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Email Field — floating label */}
            <motion.div variants={formItemVariants} className="space-y-1.5">
              <FloatInput
                id="login-email"
                type="email"
                label="E-mail"
                value={email}
                onChange={setEmail}
                required
              />
            </motion.div>

            {/* Password Field — floating label + show/hide toggle */}
            <motion.div variants={formItemVariants} className="space-y-1.5">
              <FloatInput
                id="login-password"
                type={showPassword ? "text" : "password"}
                label="Senha"
                value={password}
                onChange={setPassword}
                required
                rightSlot={
                  <motion.button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                    onClick={() => setShowPassword(!showPassword)}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.25 }}
                    className="text-white/40 hover:text-white transition-colors p-1"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={showPassword ? "hide" : "show"}
                        initial={{ opacity: 0, rotate: -15, scale: 0.7 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 15, scale: 0.7 }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
                        className="flex"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                }
              />
            </motion.div>

            {/* Options Row */}
            <motion.div variants={formItemVariants} className="flex items-center justify-between pt-1">
              <label
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2.5 cursor-pointer text-white/65 hover:text-white select-none transition-colors group"
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${rememberMe
                    ? "border-white bg-white text-black"
                    : "border-white/35 bg-transparent group-hover:border-white/60"
                    }`}
                >
                  {rememberMe && <Check size={10} strokeWidth={3.5} />}
                </div>
                <span className="text-xs font-body">
                  {mode === "login" ? "Lembrar-me" : "Concordo com os Termos e a Política de Privacidade"}
                </span>
              </label>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => alert("Recuperação de senha: entre em contato com o suporte ou entre via Google.")}
                  className="text-xs font-body text-white/45 hover:text-white transition-colors"
                >
                  Esqueceu?
                </button>
              )}
            </motion.div>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key={error}
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className="flex items-center gap-2 text-red-400 text-xs py-1 font-body overflow-hidden"
                >
                  <motion.span
                    initial={{ rotate: -15, scale: 0.5 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  </motion.span>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Action Button */}
            <motion.div variants={formItemVariants} className="pt-2">
              <motion.button
                whileHover={{
                  scale: 1.012,
                  boxShadow: "0 0 30px rgba(255,255,255,0.22), 0 10px 30px rgba(255,255,255,0.15)",
                }}
                whileTap={{ scale: 0.965 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                type="submit"
                disabled={isLoading || isGoogleLoading || authLoading}
                className="w-full bg-white text-black font-body font-semibold text-sm rounded-2xl py-3.5 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:bg-white/95 cursor-pointer disabled:opacity-50"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isLoading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                    >
                      <LoadingState
                        label={mode === "login" ? "Entrando..." : "Criando conta..."}
                        variant="connecting"
                        dark
                        size="sm"
                      />
                    </motion.span>
                  ) : (
                    <motion.span
                      key={mode + "-label"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                    >
                      {mode === "login" ? "Entrar" : "Criar conta"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>

            {/* Divider */}
            <motion.div variants={formItemVariants} className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/[0.14]" />
              <span className="flex-shrink mx-3 text-white/35 text-[11px] font-body">
                {mode === "login" ? "ou entre com" : "ou cadastre-se com"}
              </span>
              <div className="flex-grow border-t border-white/[0.14]" />
            </motion.div>

            {/* Social Login Button */}
            <motion.div variants={formItemVariants}>
              {isGoogleLoading ? (
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 bg-white/[0.05] border border-white/[0.18] text-white/85 rounded-2xl text-xs font-body font-medium">
                    <LoadingState label="Aguardando no navegador..." variant="connecting" size="sm" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelGoogleLogin}
                    className="py-3 px-4 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.22] hover:border-white/40 text-white/85 hover:text-white rounded-2xl text-xs font-medium transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Cancelar tentativa de login (Esc)"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading || authLoading}
                  whileHover={{ scale: 1.012, borderColor: "rgba(255,255,255,0.35)" }}
                  whileTap={{ scale: 0.965 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.18] text-white/85 hover:text-white rounded-2xl text-xs font-body font-medium disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <GoogleIcon />
                  <span>Google</span>
                </motion.button>
              )}
            </motion.div>

            {/* Bottom Toggle Text — AnimatePresence for smooth swap */}
            <motion.div variants={formItemVariants} className="text-center pt-3 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={mode + "-toggle"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                  className="text-xs font-body text-white/45"
                >
                  {mode === "login" ? (
                    <>
                      Não tem uma conta?{" "}
                      <motion.button
                        type="button"
                        onClick={() => { setMode("signup"); setError(null); }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.22 }}
                        className="text-white font-medium cursor-pointer underline-offset-2 hover:underline"
                      >
                        Cadastre-se
                      </motion.button>
                    </>
                  ) : (
                    <>
                      Já tem uma conta?{" "}
                      <motion.button
                        type="button"
                        onClick={() => { setMode("login"); setError(null); }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.22 }}
                        className="text-white font-medium cursor-pointer underline-offset-2 hover:underline"
                      >
                        Entrar
                      </motion.button>
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </motion.form>
          </motion.div>{/* end shake wrapper */}
        </motion.div>
      </div>
    </motion.div>
  );
};

const Login: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  </NotificationProvider>
);

export default Login;
