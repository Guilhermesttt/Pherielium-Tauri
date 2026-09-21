import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Check } from "lucide-react";

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
import pherieliumLogo from "../assets/Pherielium_logo.png";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { LoadingState } from "../components/ui/loading-state";

// Vertex shader source code
const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

// Fragment shader source code for the smokey background effect
const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.35;

    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    for (float i = 1.0; i < 7.0; i++) {
        distortion.x += 0.35 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.35 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.1, wave);

    fragColor = vec4(u_color * glow, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface SmokeyBackgroundProps {
  backdropBlurAmount?: BlurSize;
  color?: string;
  className?: string;
}

const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

export function SmokeyBackground({
  backdropBlurAmount = "lg",
  color = "#282828",
  className = "",
}: SmokeyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);

  const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    return [r, g, b];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSmokeySource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const iMouseLocation = gl.getUniformLocation(program, "iMouse");
    const uColorLocation = gl.getUniformLocation(program, "u_color");

    const startTime = Date.now();
    const [r, g, b] = hexToRgb(color);
    gl.uniform3f(uColorLocation, r, g, b);

    let animationFrameId: number;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      const currentTime = (Date.now() - startTime) / 1000;
      gl.uniform2f(iResolutionLocation, width, height);
      gl.uniform1f(iTimeLocation, currentTime);

      const isHovering = isHoveringRef.current;
      const mouseX = mousePositionRef.current.x;
      const mouseY = mousePositionRef.current.y;

      gl.uniform2f(
        iMouseLocation,
        isHovering ? mouseX : width / 2,
        isHovering ? height - mouseY : height / 2,
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    const handleMouseEnter = () => {
      isHoveringRef.current = true;
    };
    const handleMouseLeave = () => {
      isHoveringRef.current = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [color]);

  const finalBlurClass = blurClassMap[backdropBlurAmount] || blurClassMap["lg"];

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute inset-0 ${finalBlurClass}`} />
    </div>
  );
}

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

// AAA Minimalist Floating Logo with Celestial Orbital Nodes — sem moldura, ao vivo no espaço
const AnimatedPherieliumLogo = () => {
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

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center p-8 select-none perspective-1000"
    >
      {/* Outer Orbit Rings — entram em fade/scale e depois giram continuamente */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, rotate: 360 }}
        transition={{
          opacity: { duration: 0.8, delay: 0.3 },
          scale: { duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
          rotate: { duration: 48, repeat: Infinity, ease: "linear", delay: 0 },
        }}
        className="absolute w-96 h-96 md:w-[30rem] md:h-[30rem] rounded-full border border-white/[0.07]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, rotate: -360 }}
        transition={{
          opacity: { duration: 0.8, delay: 0.4 },
          scale: { duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] },
          rotate: { duration: 32, repeat: Infinity, ease: "linear" },
        }}
        className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full border border-white/[0.09] border-dashed"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, rotate: 360 }}
        transition={{
          opacity: { duration: 0.8, delay: 0.5 },
          scale: { duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] },
          rotate: { duration: 22, repeat: Infinity, ease: "linear" },
        }}
        className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border border-white/[0.06]"
      />

      {/* Radiant Pulsing Core Glow — entra crescendo e depois pulsa continuamente */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [1, 1.28, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{
          scale: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
          opacity: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
        }}
        className="absolute w-64 h-64 md:w-[22rem] md:h-[22rem] rounded-full bg-white blur-[80px] pointer-events-none"
      />

      {/* Logo flutuante direto no espaço, sem cartão/moldura ao redor */}
      <motion.div
        style={{ rotateX, rotateY }}
        initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
        animate={{
          opacity: 1,
          scale: 1,
          rotate: 0,
          y: [-8, 8, -8],
        }}
        transition={{
          opacity: { duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 0.9, delay: 0.15, type: "spring", stiffness: 90, damping: 11 },
          rotate: { duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.1 },
        }}
        className="relative z-10 cursor-pointer"
      >
        <img
          src={pherieliumLogo}
          alt="Pherielium"
          className="w-52 h-52 md:w-72 md:h-72 object-contain drop-shadow-[0_0_60px_rgba(255,255,255,0.65)] transition-transform duration-500 hover:scale-105"
          draggable={false}
        />
      </motion.div>
    </div>
  );
};

const LoginContent: React.FC = () => {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/app", { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading && !user) {
    return (
      <div className="min-h-screen w-full bg-[#030405] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <SmokeyBackground backdropBlurAmount="lg" color="#333333" className="opacity-95" />
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      setIsGoogleLoading(false);
      setLoginSuccess(true);
      setTimeout(() => navigate("/app", { replace: true }), 1500);
      return;
    } catch (err: any) {
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
      transition={{ duration: 0.7, ease: "easeOut" }}
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

      {/* Background WebGL Dynamic Smoke Effect — mais presente */}
      <SmokeyBackground backdropBlurAmount="lg" color="#333333" className="opacity-95" />

      {/* Ambient Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(3,4,5,0.8)_100%)] pointer-events-none" />

      {/* TOP LEFT BRAND NAME (Space Grotesk) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="absolute top-8 left-8 md:top-12 md:left-14 z-20 flex items-center gap-1.5"
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

      {/* LEFT COLUMN: Large Animated Celestial Logo */}
      <div className="w-full md:w-1/2 h-full flex items-center justify-center z-10 py-12 md:py-0">
        <AnimatedPherieliumLogo />
      </div>

      {/* RIGHT COLUMN: Opaque Blur Card with Space Grotesk Titles & Inter Body */}
      <div className="w-full md:w-1/2 flex items-center justify-center md:justify-end z-10">
        <motion.div
          initial={{ opacity: 0, x: 25, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md backdrop-blur-2xl border border-white/[0.08] rounded-[36px] p-8 md:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.9)] relative flex flex-col justify-between"
        >
          {/* Header */}
          <div className="space-y-2 mb-8">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
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
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            variants={formContainerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Email Field */}
            <motion.div variants={formItemVariants} className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-body font-medium text-white/60">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/15 focus:border-white/30 focus:bg-white/[0.06] rounded-2xl px-4 py-3.5 text-sm font-body text-white placeholder:text-white/25 outline-none transition-all duration-200"
              />
            </motion.div>

            {/* Password Field */}
            <motion.div variants={formItemVariants} className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-body font-medium text-white/60">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "Digite sua senha" : "Crie uma senha"}
                  required
                  className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/15 focus:border-white/30 focus:bg-white/[0.06] rounded-2xl px-4 py-3.5 pr-11 text-sm font-body text-white placeholder:text-white/25 outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 text-red-400 text-xs py-1 font-body"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Action Button */}
            <motion.div variants={formItemVariants} className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01, boxShadow: "0 0 25px rgba(255,255,255,0.2)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || isGoogleLoading || authLoading}
                className="w-full bg-white text-black font-body font-semibold text-sm rounded-2xl py-3.5 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:bg-white/95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <LoadingState
                    label={mode === "login" ? "Entrando..." : "Criando conta..."}
                    variant="connecting"
                    dark
                    size="sm"
                  />
                ) : (
                  <span>{mode === "login" ? "Entrar" : "Criar conta"}</span>
                )}
              </motion.button>
            </motion.div>

            {/* Divider */}
            <motion.div variants={formItemVariants} className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-white/30 text-[11px] font-body">
                {mode === "login" ? "ou entre com" : "ou cadastre-se com"}
              </span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </motion.div>

            {/* Social Login Button */}
            <motion.div variants={formItemVariants}>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading || authLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-white/85 hover:text-white rounded-2xl text-xs font-body font-medium transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
              >
                {isGoogleLoading ? (
                  <LoadingState label="Conectando Google..." variant="connecting" size="sm" />
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Google</span>
                  </>
                )}
              </button>
            </motion.div>

            {/* Bottom Toggle Text */}
            <motion.div variants={formItemVariants} className="text-center pt-3">
              <p className="text-xs font-body text-white/45">
                {mode === "login" ? (
                  <>
                    Não tem uma conta?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                      className="text-white hover:underline font-medium cursor-pointer"
                    >
                      Cadastre-se
                    </button>
                  </>
                ) : (
                  <>
                    Já tem uma conta?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                      }}
                      className="text-white hover:underline font-medium cursor-pointer"
                    >
                      Entrar
                    </button>
                  </>
                )}
              </p>
            </motion.div>
          </motion.form>
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
