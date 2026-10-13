import React from "react";
import { useSearchParams } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider, usePreferences } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import { VoiceCallProvider } from "../context/VoiceCallContext";
import { DiscordBrandIcon, EpicBrandIcon, SteamBrandIcon } from "../components/Sidebar";
import { SETTINGS_TABS, type SettingsTab } from "../services/launcherNavigation";
import { SettingsPageV2, type AppThemeOption, type LanguageOption } from "./SettingsPage";

/**
 * Laboratório (só em desenvolvimento): a tela REAL de Configurações, com os mesmos provedores da App,
 * sem conta e com ações vazias. Serve para capturar e revisar o visual sem login.
 * Abrir: #/design-lab/settings?tab=general (abas em SETTINGS_TABS).
 */
const LANGUAGES: LanguageOption[] = [
  { id: "pt-BR", label: "Português", hint: "Brasil" },
  { id: "en-US", label: "English", hint: "United States" },
];

const THEMES: AppThemeOption[] = [
  {
    id: "default",
    label: "Phelierium Default",
    hint: "Preto carvão + branco neutro",
    swatch: "rgb(255 255 255)",
    soundTheme: "default",
    visualTheme: "phelierium",
  },
];

const noop = () => undefined;

const isSettingsTab = (value: string | null): value is SettingsTab =>
  value !== null && (SETTINGS_TABS as readonly string[]).includes(value);

const LabSettings: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: SettingsTab = isSettingsTab(requested) ? requested : "general";
  const { t, language, effectsVolume, soundTheme, visualTheme } = usePreferences();

  return (
    <SettingsPageV2
      language={language}
      effectsVolume={effectsVolume}
      achievementVolume={60}
      notificationVolume={60}
      musicVolume={40}
      soundTheme={soundTheme}
      visualTheme={visualTheme}
      languageOptions={LANGUAGES}
      appThemeOptions={THEMES}
      SteamIcon={SteamBrandIcon}
      DiscordIcon={DiscordBrandIcon}
      EpicIcon={EpicBrandIcon}
      onLanguageChange={noop}
      onEffectsVolumeChange={noop}
      onAchievementVolumeChange={noop}
      onNotificationVolumeChange={noop}
      onMusicVolumeChange={noop}
      onSoundThemeChange={noop}
      onVisualThemeChange={noop}
      onPreviewSound={noop}
      onTestNotificationSound={noop}
      t={t}
      steamConnected={false}
      discordConnected={false}
      steamConnecting={false}
      discordConnecting={false}
      onConnectSteam={noop}
      onConnectDiscord={noop}
      onDisconnectSteam={noop}
      onDisconnectDiscord={noop}
      onTestOverlayWelcome={noop}
      onTestOverlayAchievement={noop}
      initialTab={tab}
      onTabChange={(next) => setParams({ tab: next }, { replace: true })}
    />
  );
};

const DesignLabSettings: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <TooltipProvider>
            <VoiceCallProvider>
              <LabSettings />
            </VoiceCallProvider>
          </TooltipProvider>
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default DesignLabSettings;
