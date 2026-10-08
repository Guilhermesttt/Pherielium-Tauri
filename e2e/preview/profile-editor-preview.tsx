import React from "react";
import { createRoot } from "react-dom/client";
import ProfileEditorModal from "../../src/components/ProfileEditorModal";
import type { UserProfile } from "../../src/types/domain";

const profile = { uid: "preview-user", displayName: "Guilherme", bio: "Jogo de tudo um pouco.", favoriteGenres: ["RPG"] } as UserProfile;

export function mount(el: HTMLElement) {
  createRoot(el).render(<ProfileEditorModal isOpen profile={profile} fallbackName="Guilherme" onClose={() => {}} />);
}
