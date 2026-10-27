import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Crop, LoaderCircle, Trash2, X } from "lucide-react";
import type { EditableProfile, UserProfile } from "../types/domain";
import {
  PROFILE_LIMITS,
  saveCurrentUserProfile,
} from "../services/profile";
import { completeUserQuest } from "../services/userQuests";
import ModalShell from "./ui/ModalShell";
import ImageCropModal from "./ImageCropModal";
import {
  PROFILE_MEDIA_LIMITS,
  dataUrlToBlob,
  isAnimatedImage,
  uploadProfileMedia,
  validateProfileMedia,
  type ProfileMediaKind,
} from "../services/profileMedia";
import { IconSwap } from "./ui/IconSwap";

interface ProfileEditorModalProps {
  isOpen?: boolean;
  profile: UserProfile | null;
  fallbackName: string;
  fallbackPhotoURL?: string | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}

const inputClass =
  "w-full rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-base)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[color:var(--border-strong)] placeholder:text-[var(--ink-faint)]";

const AVAILABLE_GENRES = [
  "Ação", "Aventura", "RPG", "Estratégia", "Simulação",
  "Esportes", "Corrida", "Luta", "Shooter (FPS/TPS)",
  "Plataforma", "Puzzle", "Sobrevivência", "Terror",
  "MMO", "Indie", "Casual", "Moba"
];

const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({
  isOpen = true,
  profile,
  fallbackName,
  fallbackPhotoURL,
  onClose,
  onSaved,
}) => {
  const cachedDisplayName = profile?.uid ? localStorage.getItem(`phelierium_custom_display_name_${profile.uid}`) : null;
  const cachedAvatar = profile?.uid ? localStorage.getItem(`phelierium_custom_avatar_${profile.uid}`) : null;

  const [form, setForm] = useState<EditableProfile>({
    displayName: cachedDisplayName || profile?.displayName || fallbackName,
    photoURL: cachedAvatar || profile?.photoURL || fallbackPhotoURL || "",
    bannerURL: profile?.bannerURL || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    pronouns: profile?.pronouns || "",
    website: profile?.website || "",
    favoriteGenres: profile?.favoriteGenres || [],
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropKind, setCropKind] = useState<ProfileMediaKind>("avatar");
  // Arquivos escolhidos e ainda não enviados (o envio acontece ao salvar). GIF vai original, sem recorte.
  const pendingRef = useRef<Partial<Record<ProfileMediaKind, Blob>>>({});
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const wasOpenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Apenas inicializa os campos quando o modal acaba de abrir (transição false -> true)
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const currentCachedName = profile?.uid ? localStorage.getItem(`phelierium_custom_display_name_${profile.uid}`) : null;
      const currentCachedAvatar = profile?.uid ? localStorage.getItem(`phelierium_custom_avatar_${profile.uid}`) : null;
      setForm({
        displayName: currentCachedName || profile?.displayName || fallbackName,
        photoURL: currentCachedAvatar || profile?.photoURL || fallbackPhotoURL || "",
        bannerURL: profile?.bannerURL || "",
        bio: profile?.bio || "",
        location: profile?.location || "",
        pronouns: profile?.pronouns || "",
        website: profile?.website || "",
        favoriteGenres: profile?.favoriteGenres || [],
      });
      setError("");
      setSaving(false);
      setRawImageForCrop(null);
      setIsCropOpen(false);
      pendingRef.current = {};
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, profile, fallbackName, fallbackPhotoURL]);

  const setField = <K extends keyof EditableProfile>(field: K, value: EditableProfile[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleFile = (file: File | undefined, kind: ProfileMediaKind) => {
    if (!file) return;
    const invalid = validateProfileMedia(kind, file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");

    // GIF: sobe o arquivo original (o recorte no canvas deixaria só o 1º quadro).
    if (isAnimatedImage(file)) {
      pendingRef.current[kind] = file;
      setField(kind === "banner" ? "bannerURL" : "photoURL", URL.createObjectURL(file));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        setCropKind(kind);
        setRawImageForCrop(src);
        setIsCropOpen(true);
      }
    };
    reader.onerror = () => setError("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  const handleOpenCropCurrent = (kind: ProfileMediaKind) => {
    const current = kind === "banner" ? form.bannerURL : form.photoURL;
    // um GIF atual não pode ser recortado (viraria estático): troque o arquivo para mudar
    const isGif = pendingRef.current[kind]?.type === "image/gif" || /\.gif($|\?)/i.test(current || "");
    if (current && !isGif) {
      setCropKind(kind);
      setRawImageForCrop(current);
      setIsCropOpen(true);
    }
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    pendingRef.current[cropKind] = dataUrlToBlob(croppedDataUrl);
    setField(cropKind === "banner" ? "bannerURL" : "photoURL", croppedDataUrl);
    setIsCropOpen(false);
    setRawImageForCrop(null);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const uid = profile?.uid;
      const toSave = { ...form };
      if (uid) {
        // envia só o que mudou; a foto estática cai no formato antigo (data URL) se o armazenamento não existir
        for (const kind of ["avatar", "banner"] as const) {
          const blob = pendingRef.current[kind];
          if (!blob) continue;
          try {
            const url = await uploadProfileMedia(uid, kind, blob);
            if (kind === "banner") toSave.bannerURL = url;
            else toSave.photoURL = url;
          } catch (uploadError) {
            const canFallBack = kind === "avatar" && !isAnimatedImage(blob) && (form.photoURL || "").startsWith("data:");
            if (!canFallBack) throw uploadError;
          }
        }
        pendingRef.current = {};
      }
      await saveCurrentUserProfile({ profile: toSave, userId: uid });
      // atualiza o app inteiro agora (Home, chamada, notch...), antes do refetch do servidor
      window.dispatchEvent(new CustomEvent("pherielium:profile-saved", { detail: toSave }));
      if (profile?.uid) {
        completeUserQuest(profile.uid, "customize_profile");
      }
      await onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen && !isCropOpen}
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        zIndexClassName="z-[250]"
        ariaLabel="Editar perfil"
      >
        <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-[var(--corner-md)] border border-[color:var(--border-subtle)] bg-[var(--tone-1)] p-6 shadow-2xl thin-scrollbar text-[var(--ink)]">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <h2 id="profile-editor-title" className="text-2xl font-bold text-[var(--ink)]">Editar perfil</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-[color:var(--border-subtle)] p-2 text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)] focus-visible:ring-2">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="mb-4 overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--tone-2)]">
            <div className="relative h-32 w-full bg-[var(--tone-3)]">
              {form.bannerURL ? (
                <img src={form.bannerURL} alt="Prévia do banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-[var(--ink-faint)]">
                  <Camera className="h-4 w-4" /> Sem banner
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3">
              <div className="mr-auto min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)]">Banner do perfil</p>
                <p className="text-xs text-[var(--ink-faint)]">JPG, PNG, WebP ou GIF animado, até {Math.round(PROFILE_MEDIA_LIMITS.bannerBytes / 1048576)} MB.</p>
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  handleFile(event.target.files?.[0], "banner");
                  event.target.value = "";
                }}
              />
              <button type="button" onClick={() => bannerInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-3.5 py-2 text-xs font-semibold text-[var(--tone-0)] hover:opacity-90 transition active:scale-95">
                <Camera className="h-4 w-4" /> {form.bannerURL ? "Trocar banner" : "Adicionar banner"}
              </button>
              {form.bannerURL && (
                <>
                  <button type="button" onClick={() => handleOpenCropCurrent("banner")} className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--tone-4)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--tone-4)] transition active:scale-95">
                    <Crop className="h-4 w-4" /> Ajustar
                  </button>
                  <button type="button" onClick={() => { delete pendingRef.current.banner; setField("bannerURL", ""); }} className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)] transition active:scale-95">
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--tone-2)] p-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--border-subtle)] bg-[var(--tone-3)] text-2xl font-semibold text-[var(--ink-muted)] aspect-square shadow-inner">
              {form.photoURL ? (
                <img
                  src={form.photoURL}
                  alt="Prévia do avatar"
                  className="h-full w-full object-cover object-center aspect-square"
                />
              ) : (
                form.displayName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--ink)]">Foto de perfil</p>
              <p className="mt-1 text-xs text-[var(--ink-faint)]">JPG, PNG, WebP ou GIF animado. Fotos estáticas podem ser recortadas; GIFs sobem como estão.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    handleFile(event.target.files?.[0], "avatar");
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-3.5 py-2 text-xs font-semibold text-[var(--tone-0)] hover:opacity-90 transition active:scale-95"
                >
                  <Camera className="h-4 w-4" /> Escolher foto
                </button>
                {form.photoURL && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenCropCurrent("avatar")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--tone-4)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--tone-4)] transition active:scale-95"
                    >
                      <Crop className="h-4 w-4" /> Ajustar / Cortar
                    </button>
                    <button
                      type="button"
                      onClick={() => { delete pendingRef.current.avatar; setField("photoURL", ""); }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)] transition active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">Nome público</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.displayName} value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 flex justify-between text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
              <span>Bio</span><span>{form.bio.length}/{PROFILE_LIMITS.bio}</span>
            </span>
            <textarea className={`${inputClass} min-h-24 resize-none`} maxLength={PROFILE_LIMITS.bio} value={form.bio} placeholder="Conte um pouco sobre você e os jogos que curte." onChange={(event) => setField("bio", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">Site ou rede social</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.website} value={form.website} placeholder="https://..." onChange={(event) => setField("website", event.target.value)} />
          </label>

          <div className="sm:col-span-2 mt-2">
            <span className="mb-2 flex justify-between text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
              <span>Gêneros favoritos</span>
              <span>{form.favoriteGenres.length}/{PROFILE_LIMITS.genres}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_GENRES.map((genre) => {
                const isSelected = form.favoriteGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setField("favoriteGenres", form.favoriteGenres.filter(g => g !== genre));
                      } else {
                        if (form.favoriteGenres.length < PROFILE_LIMITS.genres) {
                          setField("favoriteGenres", [...form.favoriteGenres, genre]);
                        }
                      }
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${isSelected ? "border-[color:var(--ink)] bg-[var(--ink)] text-[var(--tone-0)]" : "border-[color:var(--border-subtle)] bg-[var(--surface-base)] text-[var(--ink-muted)] hover:border-[color:var(--border-strong)] hover:text-[var(--ink)]"}`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[length:var(--step-0)] text-[var(--ink-faint)]">Selecione até {PROFILE_LIMITS.genres} gêneros.</span>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl ring-1 ring-[color:var(--danger)] bg-[var(--tone-2)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">{error}</p>}

        <footer className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-[color:var(--border-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--tone-4)]">Cancelar</button>
          <button type="button" disabled={saving} onClick={handleSave} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-xs font-semibold text-[var(--tone-0)] hover:opacity-90 disabled:opacity-50">
            <IconSwap active={saving} a={<Check className="h-4 w-4" />} b={<LoaderCircle className="h-4 w-4 animate-spin" />} />
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </footer>
      </div>
    </ModalShell>

    {rawImageForCrop && (
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={rawImageForCrop}
        kind={cropKind}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setIsCropOpen(false);
          setRawImageForCrop(null);
        }}
      />
    )}
  </>
  );
};

export default ProfileEditorModal;

