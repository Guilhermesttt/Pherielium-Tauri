import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/AuthProvider";
import { dataUrlToBlob, uploadRoomMedia, validateRoomMedia } from "../../services/voiceRoomMedia";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Gamepad2,
  Swords,
  BookOpen,
  MessageSquare,
  Lock,
  Unlock,
  KeyRound,
  X,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  Palette,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Headphones,
  Shield,
  Crown,
  Rocket,
  Flame,
  Zap,
  Dices,
  Trophy,
  Ghost,
  Skull,
  Heart,
  Star,
  Check,
} from "lucide-react";
import type { RoomCategory, CallRoomConfig } from "../../types/voice-governance";
import type { UserProfile } from "../../types/domain";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  initialConfig?: Partial<CallRoomConfig> | null;
  isEditing?: boolean;
  onCreateChannel: (config: CallRoomConfig) => void | Promise<void>;
}

const CATEGORIES: {
  id: RoomCategory;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
    {
      id: "resenha_games",
      label: "Resenha & Games",
      desc: "Jogos em grupo, diversão e zoeira",
      icon: <Gamepad2 className="h-4 w-4" />,
    },
    {
      id: "gameplay_foco",
      label: "Só Gameplay",
      desc: "Foco competitivo e comunicação limpa",
      icon: <Swords className="h-4 w-4" />,
    },
    {
      id: "estudos_foco",
      label: "Foco & Estudos",
      desc: "Trabalho, programação e concentração",
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: "casual_chat",
      label: "Conversa Livre",
      desc: "Bate-papo aberto sobre qualquer assunto",
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

export const VOICE_CHANNEL_ICONS = [
  { id: "gamepad", label: "Controle", icon: Gamepad2 },
  { id: "swords", label: "Combate", icon: Swords },
  { id: "headphones", label: "Headset", icon: Headphones },
  { id: "shield", label: "Escudo", icon: Shield },
  { id: "crown", label: "Coroa", icon: Crown },
  { id: "rocket", label: "Foguete", icon: Rocket },
  { id: "flame", label: "Fogo", icon: Flame },
  { id: "zap", label: "Raio", icon: Zap },
  { id: "dices", label: "Dados", icon: Dices },
  { id: "trophy", label: "Troféu", icon: Trophy },
  { id: "sparkles", label: "Brilho", icon: Sparkles },
  { id: "radio", label: "Rádio", icon: Radio },
  { id: "ghost", label: "Fantasma", icon: Ghost },
  { id: "skull", label: "Caveira", icon: Skull },
  { id: "heart", label: "Coração", icon: Heart },
  { id: "star", label: "Estrela", icon: Star },
] as const;

export const renderVoiceRoomIcon = (
  iconKey?: string,
  className = "h-4 w-4",
  color?: string,
) => {
  if (!iconKey) return <Gamepad2 className={className} style={color ? { color } : undefined} />;
  const normalized = iconKey.toLowerCase().trim();
  const match = VOICE_CHANNEL_ICONS.find((item) => item.id === normalized);
  if (match) {
    const IconComp = match.icon;
    return <IconComp className={className} style={color ? { color } : undefined} />;
  }
  // Mapeamentos para compatibilidade com emojis antigos
  if (iconKey === "🎮") return <Gamepad2 className={className} style={color ? { color } : undefined} />;
  if (iconKey === "⚔️") return <Swords className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🎧") return <Headphones className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🛡️") return <Shield className={className} style={color ? { color } : undefined} />;
  if (iconKey === "👑") return <Crown className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🚀") return <Rocket className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🔥") return <Flame className={className} style={color ? { color } : undefined} />;
  if (iconKey === "⚡") return <Zap className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🎲") return <Dices className={className} style={color ? { color } : undefined} />;
  if (iconKey === "🌟") return <Star className={className} style={color ? { color } : undefined} />;
  if (iconKey === "👾") return <Ghost className={className} style={color ? { color } : undefined} />;

  return <span className="text-sm leading-none select-none">{iconKey}</span>;
};

const THEME_COLORS = [
  { id: "purple", label: "Neon Purple", value: "#8B5CF6", border: "border-purple-500", bg: "bg-purple-500/20" },
  { id: "cyan", label: "Retro Cyan", value: "#06B6D4", border: "border-cyan-500", bg: "bg-cyan-500/20" },
  { id: "amber", label: "Sunset Amber", value: "#F59E0B", border: "border-amber-500", bg: "bg-amber-500/20" },
  { id: "red", label: "Crimson Red", value: "#EF4444", border: "border-rose-500", bg: "bg-rose-500/20" },
  { id: "emerald", label: "Cyber Emerald", value: "#10B981", border: "border-emerald-500", bg: "bg-emerald-500/20" },
  { id: "blue", label: "Cobalt Blue", value: "#3B82F6", border: "border-blue-500", bg: "bg-blue-500/20" },
  { id: "monochrome", label: "Monochrome Ice", value: "#F8FAFC", border: "border-white", bg: "bg-white/20" },
];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  initialConfig,
  isEditing = false,
  onCreateChannel,
}) => {
  const [roomName, setRoomName] = useState("");
  const [category, setCategory] = useState<RoomCategory>("resenha_games");
  const [selectedIcon, setSelectedIcon] = useState("gamepad");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [themeColor, setThemeColor] = useState(THEME_COLORS[0].value);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerBlob, setBannerBlob] = useState<Blob | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [clearBanner, setClearBanner] = useState(false);
  const hadPassword = isEditing && initialConfig?.password !== undefined;
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fallbackDefaultName = userProfile?.displayName
    ? `Sala de ${userProfile.displayName}`
    : "Sala de voz";

  const accentText = (() => {
    const hex = themeColor.replace("#", "");
    if (hex.length !== 6) return "#0B0B0E";
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#0B0B0E" : "#FFFFFF";
  })();

  const handleBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const bad = validateRoomMedia(file);
    if (bad) {
      setError(bad);
      return;
    }
    setError(null);
    setBannerBlob(file);
    setClearBanner(false);
    setBannerPreview(URL.createObjectURL(file));
  };

  const shownBanner = clearBanner ? "" : bannerPreview || bannerUrl;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomAvatarUrl(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setRoomName(initialConfig.roomName || "");
        setCategory(initialConfig.category || "resenha_games");
        setSelectedIcon(initialConfig.icon || "gamepad");
        setCustomAvatarUrl(initialConfig.avatarUrl || "");
        setThemeColor(initialConfig.themeColor || THEME_COLORS[0].value);
        setIsPrivate(Boolean(initialConfig.isPrivate));
        setPassword(initialConfig.password || "");
        setDescription(initialConfig.description || "");
        setBannerUrl(initialConfig.bannerUrl || "");
      } else {
        setRoomName("");
        setCategory("resenha_games");
        setSelectedIcon("gamepad");
        setCustomAvatarUrl("");
        setThemeColor(THEME_COLORS[0].value);
        setIsPrivate(false);
        setPassword("");
        setDescription("");
        setBannerUrl("");
      }
      setBannerBlob(null);
      setBannerPreview("");
      setClearBanner(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialConfig]);

  // Trava o scroll do body enquanto o modal está aberto e permite fechar com Esc.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCreate = async () => {
    const trimmedName = roomName.trim() || fallbackDefaultName;
    const keepsPassword = hadPassword && password.trim().length === 0;
    if (isPrivate && !keepsPassword && password.trim().length < 3) {
      setError("Uma sala privada precisa de senha (mínimo de 3 caracteres).");
      return;
    }
    if (description.length > 200) {
      setError("A descrição pode ter no máximo 200 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // imagens vão para o Storage (o ícone antigo era uma data URL gigante dentro da tabela)
      let finalBanner = clearBanner ? undefined : bannerUrl || undefined;
      let finalAvatar = customAvatarUrl.trim() || undefined;
      if (user?.uid) {
        if (bannerBlob) finalBanner = await uploadRoomMedia(user.uid, "banner", bannerBlob);
        const inline = finalAvatar ? dataUrlToBlob(finalAvatar) : null;
        if (inline) finalAvatar = await uploadRoomMedia(user.uid, "icon", inline);
      }
      await onCreateChannel({
        roomName: trimmedName,
        category,
        isPrivate,
        password: isPrivate && password.trim() ? password.trim() : undefined,
        clearPassword: isEditing && hadPassword && !isPrivate ? true : undefined,
        icon: selectedIcon,
        avatarUrl: finalAvatar,
        themeColor,
        description: description.trim(),
        bannerUrl: bannerBlob ? finalBanner : undefined,
        clearBanner: clearBanner || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o canal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Portal direto pro <body>: garante que o modal fica na frente de QUALQUER coisa,
  // independente de em que parte da árvore (sidebar, painel, card) ele é chamado.
  // Sem isso, um pai com overflow:hidden ou transform pode "prender" o z-index
  // mesmo com position:fixed e z-[99999].
  return createPortal(
    <AnimatePresence>
      {isOpen && (
      <div
        key="create-channel-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Criar canal de voz"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
      >
        {/* Backdrop: escurece e borra tudo atrás, padrão de modal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative z-10 flex w-full max-w-[720px] max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0B0B0E] shadow-[0_40px_120px_rgba(0,0,0,0.82)]"
          style={{ boxShadow: `0 40px 120px rgba(0,0,0,0.82), 0 0 0 1px ${themeColor}22, 0 24px 80px ${themeColor}18` }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70"
            style={{ background: `radial-gradient(ellipse at top, ${themeColor}28, transparent 70%)` }}
          />

          <div className="relative flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                {isEditing ? "Ajustar canal" : "Novo canal"}
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                {isEditing ? "Editar canal de voz" : "Criar canal de voz"}
              </h3>
              <p className="mt-1 text-xs text-white/45">
                Até 10 pessoas. Escolha identidade, banner, categoria e quem pode entrar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative space-y-5 overflow-y-auto px-6 pb-5 scrollbar-thin scrollbar-thumb-white/10">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {shownBanner ? (
                <img src={shownBanner} alt="" className="aspect-[3/1] w-full object-cover" />
              ) : (
                <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
              )}
              <div className="flex items-center gap-3.5 p-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
                  style={{ borderColor: `${themeColor}55`, backgroundColor: `${themeColor}22` }}
                >
                  {customAvatarUrl ? (
                    <img src={customAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    renderVoiceRoomIcon(selectedIcon, "h-7 w-7", themeColor)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-white">
                      {roomName.trim() || fallbackDefaultName}
                    </p>
                    {isPrivate ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                      {CATEGORIES.find((item) => item.id === category)?.icon}
                      {CATEGORIES.find((item) => item.id === category)?.label}
                    </span>
                    <span className="text-[10px] font-bold text-white/35">0/4 na sala</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-white/55">Nome do canal</label>
              <input
                type="text"
                placeholder={fallbackDefaultName}
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setError(null);
                }}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:bg-white/[0.07]"
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/55">
                <Palette className="h-3.5 w-3.5 text-white/50" />
                Identidade visual
              </label>

              <div className="grid grid-cols-8 gap-1.5">
                {VOICE_CHANNEL_ICONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = selectedIcon === item.id && !customAvatarUrl;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedIcon(item.id);
                        setCustomAvatarUrl("");
                      }}
                      className={`flex h-10 w-full items-center justify-center rounded-xl border transition cursor-pointer ${
                        isSelected ? "" : "border-white/8 bg-white/[0.04] text-white/45 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                      }`}
                      style={isSelected
                        ? { borderColor: themeColor, backgroundColor: `${themeColor}28`, color: themeColor, boxShadow: `0 0 16px ${themeColor}30` }
                        : undefined}
                      title={item.label}
                    >
                      <IconComp className={`h-4 w-4 ${isSelected ? "" : "text-white/45"}`} />
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-white/6 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/45">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Foto personalizada
                  </span>
                  {customAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomAvatarUrl("")}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-400 transition hover:text-rose-300 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      Remover
                    </button>
                  )}
                </div>

                {customAvatarUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/40">
                      <img src={customAvatarUrl} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">Imagem ativa no canal</p>
                      <p className="truncate text-[10px] text-white/40">Vai aparecer na lista de salas</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3.5 text-xs font-bold text-white transition hover:bg-white/12">
                      <Upload className="h-3.5 w-3.5 text-white/80" />
                      Carregar
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                    <div className="relative flex items-center">
                      <LinkIcon className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="https://..."
                        value={customAvatarUrl}
                        onChange={(e) => setCustomAvatarUrl(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs font-medium text-white placeholder-white/30 outline-none transition focus:border-white/25"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-medium text-white/45">Cor de destaque</span>
                <div className="flex flex-wrap items-center gap-2">
                  {THEME_COLORS.map((c) => {
                    const isSelected = themeColor === c.value;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setThemeColor(c.value)}
                        title={c.label}
                        className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition cursor-pointer"
                        style={{
                          backgroundColor: c.value,
                          borderColor: isSelected ? "#fff" : "transparent",
                          transform: isSelected ? "scale(1.12)" : undefined,
                        }}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-black" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-white/55">Categoria</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className="rounded-2xl border p-3 text-left transition cursor-pointer"
                      style={isSelected
                        ? { borderColor: `${themeColor}80`, backgroundColor: `${themeColor}18`, boxShadow: `inset 0 0 0 1px ${themeColor}30` }
                        : { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
                    >
                      <div className={`flex items-center gap-2 text-xs font-black ${isSelected ? "text-white" : "text-white/80"}`}>
                        <span style={isSelected ? { color: themeColor } : undefined}>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </div>
                      <p className={`mt-1 text-[10px] leading-snug ${isSelected ? "text-white/70" : "text-white/38"}`}>
                        {cat.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-white/55">Visibilidade</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    !isPrivate ? "border-white/25 bg-white/[0.08]" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                    Sala pública
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-white/45">
                    Aparece na aba de canais. Qualquer amigo entra direto.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    isPrivate ? "border-amber-400/40 bg-amber-400/10" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    Sala privada
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-white/45">
                    Fora da lista global. Só entra quem tiver convite ou senha.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/70">Banner</span>
                <div className="flex items-center gap-2">
                  {shownBanner && (
                    <button
                      type="button"
                      onClick={() => {
                        setClearBanner(true);
                        setBannerBlob(null);
                        setBannerPreview("");
                      }}
                      className="cursor-pointer text-[11px] font-semibold text-white/50 transition hover:text-white"
                    >
                      Remover
                    </button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.14]">
                    <Upload className="h-3.5 w-3.5" />
                    {shownBanner ? "Trocar imagem" : "Escolher imagem"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleBannerPick} />
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-white/40">Imagem larga (3:1) de até 10 MB. PNG, JPG, WebP ou GIF.</p>
              <label className="mt-1 block text-[11px] font-bold text-white/70" htmlFor="room-description">Descrição</label>
              <textarea
                id="room-description"
                value={description}
                maxLength={200}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sobre o que é essa sala?"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-xs font-medium text-white placeholder-white/30 outline-none transition focus:border-white/30"
              />
              <p className="text-right text-[10.5px] tabular-nums text-white/35">{description.length}/200</p>
            </div>

            {isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1.5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-3.5"
              >
                <label className="flex items-center justify-between text-[11px] font-bold text-white/70">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                    Senha da sala
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={hadPassword ? "Deixe em branco para manter a senha atual" : "Mínimo de 3 caracteres"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 pr-10 text-xs font-semibold text-white placeholder-white/30 outline-none transition focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-white/40 transition hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
                {error}
              </p>
            )}
          </div>

          <div className="relative flex gap-3 border-t border-white/8 bg-black/40 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-white/8 bg-white/5 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition hover:brightness-110 active:scale-[0.98] cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: themeColor, color: accentText }}
            >
              {isSubmitting ? (
                <span>Criando...</span>
              ) : isEditing ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Salvar alterações
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Criar canal
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};