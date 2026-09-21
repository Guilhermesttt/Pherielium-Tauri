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

interface ProfileEditorModalProps {
  isOpen?: boolean;
  profile: UserProfile | null;
  fallbackName: string;
  fallbackPhotoURL?: string | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/45 px-3.5 py-3 text-sm text-white outline-none transition focus:border-white/30 placeholder:text-white/20";

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
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, profile, fallbackName, fallbackPhotoURL]);

  const setField = <K extends keyof EditableProfile>(field: K, value: EditableProfile[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > PROFILE_LIMITS.avatarBytes) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        setRawImageForCrop(src);
        setIsCropOpen(true);
        setError("");
      }
    };
    reader.onerror = () => setError("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  const handleOpenCropCurrent = () => {
    if (form.photoURL) {
      setRawImageForCrop(form.photoURL);
      setIsCropOpen(true);
    }
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    setField("photoURL", croppedDataUrl);
    setIsCropOpen(false);
    setRawImageForCrop(null);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveCurrentUserProfile({ profile: form, userId: profile?.uid });
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
        <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-[22px] border border-white/12 bg-[#090909] p-6 shadow-2xl thin-scrollbar text-white">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Conta Phelierium</p>
              <h2 id="profile-editor-title" className="mt-1 text-2xl font-black text-white">Editar perfil</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-white/[0.06] text-2xl font-black text-white/50 aspect-square shadow-inner">
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
              <p className="text-sm font-black text-white">Foto de perfil</p>
              <p className="mt-1 text-xs text-white/35">JPG, PNG ou WebP. Você pode ajustar e recortar a foto perfeitamente.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    handleFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-black hover:bg-white/85 transition active:scale-95"
                >
                  <Camera className="h-4 w-4" /> Escolher foto
                </button>
                {form.photoURL && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenCropCurrent}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-black text-white hover:bg-white/20 transition active:scale-95"
                    >
                      <Crop className="h-4 w-4" /> Ajustar / Cortar
                    </button>
                    <button
                      type="button"
                      onClick={() => setField("photoURL", "")}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/55 hover:bg-white/10 hover:text-white transition active:scale-95"
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
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">Nome público</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.displayName} value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 flex justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
              <span>Bio</span><span>{form.bio.length}/{PROFILE_LIMITS.bio}</span>
            </span>
            <textarea className={`${inputClass} min-h-24 resize-none`} maxLength={PROFILE_LIMITS.bio} value={form.bio} placeholder="Conte um pouco sobre você e os jogos que curte." onChange={(event) => setField("bio", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">Site ou rede social</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.website} value={form.website} placeholder="https://..." onChange={(event) => setField("website", event.target.value)} />
          </label>

          <div className="sm:col-span-2 mt-2">
            <span className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
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
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${isSelected ? "border-white bg-white text-black" : "border-white/10 bg-black/45 text-white/70 hover:border-white/30 hover:text-white"}`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[10px] text-white/25">Selecione até {PROFILE_LIMITS.genres} gêneros.</span>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{error}</p>}

        <footer className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-white/55 hover:bg-white/10">Cancelar</button>
          <button type="button" disabled={saving} onClick={handleSave} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black hover:bg-white/85 disabled:opacity-50">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </footer>
      </div>
    </ModalShell>

    {rawImageForCrop && (
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={rawImageForCrop}
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

