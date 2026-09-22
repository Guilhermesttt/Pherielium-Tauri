import React from "react";
import { X } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import UserProfilePage from "../UserProfilePage";
import type { Game, UserProfile } from "../../types/domain";

export interface FriendProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendData: {
    profile: UserProfile;
    games: Game[];
  } | null;
  onOpenChat?: (friendId: string) => void;
  playSound?: (sound: any) => void;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  isOpen,
  onClose,
  friendData,
  onOpenChat,
  playSound,
  onNotify,
}) => {
  if (!friendData) return null;

  const profile = friendData.profile;
  const friendUid = profile.uid;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-[1120px]"
      zIndexClassName="z-[170]"
      backdropClassName="bg-black/75 backdrop-blur-md"
      ariaLabel={`Perfil de ${profile.displayName || "Amigo"}`}
      className="relative flex h-[88vh] max-h-[920px] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#070709] p-0 shadow-[0_32px_90px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] text-white"
    >
      {/* Botão Fechar Integrado */}
      <div className="flex items-center justify-end px-8 pt-5 pb-1 shrink-0 z-20">
        <button
          type="button"
          aria-label="Fechar perfil"
          onClick={() => {
            playSound?.("back");
            onClose();
          }}
          onMouseEnter={() => playSound?.("hover")}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Conteúdo: Design de Perfil Padrão Completo com Scroll Fluido */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <UserProfilePage
          userProfile={profile}
          user={{ email: null, photoURL: profile.photoURL }}
          userId={friendUid}
          games={friendData.games}
          onOpenGame={undefined}
          editable={false}
          playSound={playSound as any}
          copyFriendDiscord
          onNotify={onNotify}
        />
      </div>
    </ModalShell>
  );
};

export default React.memo(FriendProfileModal);
