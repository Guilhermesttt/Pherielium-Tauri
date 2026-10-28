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
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";
import { IconSwap } from "../ui/IconSwap";
import { useModalSounds } from "../../hooks/useModalSounds";

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
  { id: "amber", label: "Sunset Amber", value: "#F59E0B", border: "border-transparent", bg: "bg-[var(--tone-3)]" },
  { id: "red", label: "Crimson Red", value: "#EF4444", border: "border-transparent", bg: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)]" },
  { id: "emerald", label: "Cyber Emerald", value: "#10B981", border: "border-transparent", bg: "bg-[var(--tone-3)]" },
  { id: "blue", label: "Cobalt Blue", value: "#3B82F6", border: "border-blue-500", bg: "bg-blue-500/20" },
  { id: "monochrome", label: "Monochrome Ice", value: "#F8FAFC", border: "border-white", bg: "bg-[var(--tone-4)]" },
];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  initialConfig,
  isEditing = false,
  onCreateChannel,
}) => {
  useModalSounds(isOpen);
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

  // O pai recria `initialConfig` a cada render (a chamada re-renderiza todo segundo): sem esta chave
  // estável o formulário era zerado para os valores antigos enquanto o usuário digitava.
  const initialKey = JSON.stringify(initialConfig ?? null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialKey]);

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
          {...modalBackdropMotion}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
        />

        <motion.div
          {...modalMotion}
          className="relative z-10 flex w-full max-w-[720px] max-h-[90vh] flex-col overflow-hidden rounded-[var(--corner-lg)] border border-transparent bg-[var(--tone-1)] shadow-[0_40px_120px_rgba(0,0,0,0.82)]"
          style={{ boxShadow: `0 40px 120px rgba(0,0,0,0.82), 0 0 0 1px ${themeColor}22, 0 24px 80px ${themeColor}18` }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70"
            style={{ background: `radial-gradient(ellipse at top, ${themeColor}28, transparent 70%)` }}
          />

          <div className="relative flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div>
              <p className="text-[length:var(--step-0)] font-black uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                {isEditing ? "Ajustar canal" : "Novo canal"}
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--ink)]">
                {isEditing ? "Editar canal de voz" : "Criar canal de voz"}
              </h3>
              <p className="mt-1 text-xs text-[var(--ink-faint)]">
                Até 10 pessoas. Escolha identidade, banner, categoria e quem pode entrar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-[var(--tone-3)] text-[var(--ink-muted)] transition hover:bg-[var(--tone-4)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative space-y-5 overflow-y-auto px-6 pb-5 scrollbar-thin scrollbar-thumb-white/10">
            <div className="overflow-hidden rounded-2xl border border-transparent bg-[var(--tone-3)]">
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
                    <p className="truncate text-sm font-black text-[var(--ink)]">
                      {roomName.trim() || fallbackDefaultName}
                    </p>
                    {isPrivate ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--ink)]" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-transparent bg-[var(--tone-3)] px-2 py-0.5 text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                      {CATEGORIES.find((item) => item.id === category)?.icon}
                      {CATEGORIES.find((item) => item.id === category)?.label}
                    </span>
                    <span className="text-[length:var(--step-0)] font-bold text-[var(--ink-faint)]">0/4 na sala</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[length:var(--step-0)] font-black uppercase tracking-wider text-[var(--ink-muted)]">Nome do canal</label>
              <input aria-label="Nome do canal"
                type="text"
                placeholder={fallbackDefaultName}
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setError(null);
                }}
                className="h-11 w-full rounded-xl border border-transparent bg-[var(--tone-3)] px-4 text-sm font-semibold text-[var(--ink)] placeholder-white/30 outline-none transition focus:border-transparent focus:bg-[var(--tone-4)]"
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-transparent bg-[var(--tone-3)] p-4">
              <label className="flex items-center gap-1.5 text-[length:var(--step-0)] font-black uppercase tracking-wider text-[var(--ink-muted)]">
                <Palette className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
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
                        isSelected ? "" : "border-transparent bg-[var(--tone-3)] text-[var(--ink-faint)] hover:border-transparent hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                      }`}
                      style={isSelected
                        ? { borderColor: themeColor, backgroundColor: `${themeColor}28`, color: themeColor, boxShadow: `0 0 16px ${themeColor}30` }
                        : undefined}
                      title={item.label}
                    >
                      <IconComp className={`h-4 w-4 ${isSelected ? "" : "text-[var(--ink-faint)]"}`} />
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-transparent pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Foto personalizada
                  </span>
                  {customAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomAvatarUrl("")}
                      className="flex items-center gap-1 text-[length:var(--step-0)] font-bold text-[var(--danger)] transition hover:text-[var(--danger)] cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      Remover
                    </button>
                  )}
                </div>

                {customAvatarUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-transparent bg-black/30 p-2.5">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-transparent bg-black/40">
                      <img src={customAvatarUrl} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">Imagem ativa no canal</p>
                      <p className="truncate text-[length:var(--step-0)] text-[var(--ink-faint)]">Vai aparecer na lista de salas</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--tone-3)] px-3.5 text-xs font-bold text-[var(--ink)] transition hover:bg-[var(--tone-4)]">
                      <Upload className="h-3.5 w-3.5 text-[var(--ink)]" />
                      Carregar
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                    <div className="relative flex items-center">
                      <LinkIcon className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]" />
                      <input aria-label="Link da imagem do canal"
                        type="text"
                        placeholder="https://..."
                        value={customAvatarUrl}
                        onChange={(e) => setCustomAvatarUrl(e.target.value)}
                        className="h-10 w-full rounded-xl border border-transparent bg-[var(--tone-3)] pl-9 pr-3 text-xs font-medium text-[var(--ink)] placeholder-white/30 outline-none transition focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">Cor de destaque</span>
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
                        {isSelected && <Check className="h-3.5 w-3.5 text-[var(--tone-0)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[length:var(--step-0)] font-black uppercase tracking-wider text-[var(--ink-muted)]">Categoria</label>
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
                      <div className={`flex items-center gap-2 text-xs font-black ${isSelected ? "text-[var(--ink)]" : "text-[var(--ink)]"}`}>
                        <span style={isSelected ? { color: themeColor } : undefined}>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </div>
                      <p className={`mt-1 text-[length:var(--step-0)] leading-snug ${isSelected ? "text-[var(--ink-muted)]" : "text-[var(--ink-faint)]"}`}>
                        {cat.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[length:var(--step-0)] font-black uppercase tracking-wider text-[var(--ink-muted)]">Visibilidade</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    !isPrivate ? "border-transparent bg-[var(--tone-3)]" : "border-transparent bg-[var(--tone-3)] hover:bg-[var(--tone-4)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black text-[var(--ink)]">
                    <Unlock className="h-3.5 w-3.5 text-[var(--live)]" />
                    Sala pública
                  </div>
                  <p className="mt-1 text-[length:var(--step-0)] leading-snug text-[var(--ink-faint)]">
                    Aparece na aba de canais. Qualquer amigo entra direto.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                    isPrivate ? "border-transparent bg-[var(--tone-3)]" : "border-transparent bg-[var(--tone-3)] hover:bg-[var(--tone-4)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black text-[var(--ink)]">
                    <Lock className="h-3.5 w-3.5 text-[var(--ink)]" />
                    Sala privada
                  </div>
                  <p className="mt-1 text-[length:var(--step-0)] leading-snug text-[var(--ink-faint)]">
                    Fora da lista global. Só entra quem tiver convite ou senha.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-transparent bg-[var(--tone-3)] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">Banner</span>
                <div className="flex items-center gap-2">
                  {shownBanner && (
                    <button
                      type="button"
                      onClick={() => {
                        setClearBanner(true);
                        setBannerBlob(null);
                        setBannerPreview("");
                      }}
                      className="cursor-pointer text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
                    >
                      Remover
                    </button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-3 py-1.5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)]">
                    <Upload className="h-3.5 w-3.5" />
                    {shownBanner ? "Trocar imagem" : "Escolher imagem"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleBannerPick} />
                  </label>
                </div>
              </div>
              <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">Imagem larga (3:1) de até 10 MB. PNG, JPG, WebP ou GIF.</p>
              <label className="mt-1 block text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]" htmlFor="room-description">Descrição</label>
              <textarea
                id="room-description"
                value={description}
                maxLength={200}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sobre o que é essa sala?"
                className="w-full resize-none rounded-xl border border-transparent bg-black/35 px-3.5 py-2.5 text-xs font-medium text-[var(--ink)] placeholder-white/30 outline-none transition focus:border-transparent"
              />
              <p className="text-right text-[length:var(--step-0)] tabular-nums text-[var(--ink-faint)]">{description.length}/200</p>
            </div>

            {isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1.5 rounded-2xl border border-transparent bg-[var(--tone-3)] p-3.5"
              >
                <label className="flex items-center justify-between text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-[var(--ink)]" />
                    Senha da sala
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input aria-label="Senha da sala"
                    type={showPassword ? "text" : "password"}
                    placeholder={hadPassword ? "Deixe em branco para manter a senha atual" : "Mínimo de 3 caracteres"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="h-10 w-full rounded-xl border border-transparent bg-black/35 px-3.5 pr-10 text-xs font-semibold text-[var(--ink)] placeholder-white/30 outline-none transition focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-[var(--ink-faint)] transition hover:text-[var(--ink)] cursor-pointer"
                  >
                    <IconSwap active={showPassword} a={<Eye className="h-4 w-4" />} b={<EyeOff className="h-4 w-4" />} />
                  </button>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] px-3 py-2 text-xs font-medium text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>

          <div className="relative flex gap-3 border-t border-transparent bg-black/40 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-transparent bg-[var(--tone-3)] py-2.5 text-xs font-bold text-[var(--ink)] transition hover:bg-[var(--tone-4)] cursor-pointer disabled:opacity-50"
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