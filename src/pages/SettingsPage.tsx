import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Gamepad2,
  Gauge,
  Globe,
  Headphones,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Palette,
  Phone,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  Volume2,
  Zap,
  Layers,
  Battery,
  BatteryLow,
  BatteryCharging,
  Usb,
  Bluetooth,
  Vibrate,
  ChevronDown,
  X,
} from "lucide-react";
import {
  SlidersHorizontal as AnimatedSlidersHorizontal,
  Palette as AnimatedPalette,
  ShieldCheck as AnimatedShieldCheck,
  Globe as AnimatedGlobe,
  Gamepad2 as AnimatedGamepad2,
  Mic as AnimatedMic,
  Bell as AnimatedBell,
  LogOut as AnimatedLogOut,
  Settings as AnimatedSettings,
  Laptop as AnimatedLaptop,
} from "../components/animate-ui/icons";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import { ConfirmationModal } from "../components/home/ConfirmationModal";
import { Switch } from "../components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/utils";
import { AppUpdateSection, SettingsHeader } from "../components/settings/AppUpdateSection";
import { usePreferences, type LauncherLanguage, type SoundTheme, type VisualTheme } from "../context/PreferencesContext";
import { useVoiceCallContext } from "../context/VoiceCallContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGamepad, useGamepadButton, playHapticPattern } from "../context/GamepadContext";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { activateElementWithController } from "../utils/controllerTextInput";
import { useControllerLedStatus } from "../hooks/useControllerLed";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../services/supabase";
import { saveProfileVisibility } from "../services/profilePrivacy";
import { PlatformRemovalTransition } from "../components/PlatformRemovalTransition";
import type { SettingsTab } from "../services/launcherNavigation";
import type { ProfileVisibility } from "../types/domain";
import { ElasticSlider } from "../components/ReactBits/ElasticSlider";
import { LinearProgress } from "../components/ui/LinearProgress";
import { ThinkingOrbLoader } from "../components/ThinkingOrbLoader";
import { saveOverlayPrefs } from "../lib/overlayPrefs";
import { formatRamGb, usePerfMonitor } from "../hooks/usePerfMonitor";
import { MASCOT_MOODS, PherieMascot, getMascotBaseMood, setMascotBaseMood, type MascotMood } from "../components/notch/PherieMascot";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface LanguageOption {
  id: LauncherLanguage;
  label: string;
  hint: string;
}

export interface AppThemeOption {
  id: "default" | "ps5" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}

const CONTROLLER_COPY = {
  "pt-BR": ["Controles e dispositivos", "Controle conectado", "Nenhum controle conectado", "Conecte via USB ou Bluetooth para navegar pelo launcher.", "Testar iluminação", "Autorizar acesso ao LED"],
  "en-US": ["Controllers & Devices", "Controller connected", "No controller connected", "Connect through USB or Bluetooth to navigate the launcher.", "Test LED", "Authorize LED access"],
  "es-ES": ["Mandos y dispositivos", "Mando conectado", "Ningún mando conectado", "Conecta por USB o Bluetooth para navegar por el launcher.", "Probar LED", "Autorizar acceso al LED"],
  "fr-FR": ["Manettes et périphériques", "Manette connectée", "Aucune manette connectée", "Connectez-la en USB ou Bluetooth pour naviguer.", "Tester la LED", "Autoriser l'accès LED"],
  "de-DE": ["Controller und Geräte", "Controller verbunden", "Kein Controller verbunden", "Über USB oder Bluetooth verbinden, um den Launcher zu steuern.", "LED testen", "LED-Zugriff autorisieren"],
  "it-IT": ["Controller e dispositivi", "Controller collegato", "Nessun controller collegato", "Collega tramite USB o Bluetooth per navigare.", "Prova LED", "Autorizza accesso LED"],
} as const;

const DIAGNOSTICS_COPY = {
  "pt-BR": { title: "Diagnóstico do Controle", connection: "Conexão", battery: "Bateria", family: "Família", close: "Fechar", unknown: "Bateria não informada pelo dispositivo" },
  "en-US": { title: "Controller Diagnostics", connection: "Connection", battery: "Battery", family: "Family", close: "Close", unknown: "Battery not reported by device" },
  "es-ES": { title: "Diagnóstico del Mando", connection: "Conexión", battery: "Batería", family: "Familia", close: "Cerrar", unknown: "Batería no informada por el dispositivo" },
  "fr-FR": { title: "Diagnostic de la Manette", connection: "Connexion", battery: "Batterie", family: "Famille", close: "Fermer", unknown: "Batterie non signalée par l'appareil" },
  "de-DE": { title: "Controller-Diagnose", connection: "Verbindung", battery: "Batterie", family: "Familie", close: "Schließen", unknown: "Batterie nicht vom Gerät gemeldet" },
  "it-IT": { title: "Diagnostica Controller", connection: "Connessione", battery: "Batteria", family: "Famiglia", close: "Chiudi", unknown: "Batteria non segnalata dal dispositivo" },
} as const;

const SETTINGS_SHELL_COPY = {
  "pt-BR": { preferences: "Preferências do Launcher", general: "Geral", personalization: "Personalização", performance: "Desempenho", account: "Sua conta", connections: "Conexões e privacidade", controller: "Controles e dispositivos", voice: "Voz e vídeo", notifications: "Notificações & Overlay", mascot: "Mascote e Notch", quit: "Sair do Aplicativo", encrypted: "Autenticação da sessão", encryptedHint: "Credenciais e token de sessão autenticados com segurança neste dispositivo.", privacy: "Privacidade do Perfil", privacyHint: "Escolha o que outros jogadores podem ver ao encontrar seu perfil.", public: "Perfil Público", publicHint: "Todos podem abrir seus detalhes, jogos e atividade.", private: "Perfil Privado", privateHint: "Somente você e amigos aceitos veem os detalhes.", saving: "Salvando privacidade...", saved: "Privacidade atualizada.", controllerHint: "Status da navegação e iluminação do controle conectado." },
  "en-US": { preferences: "Launcher preferences", general: "General", personalization: "Personalization", performance: "Performance", account: "Your account", connections: "Connections & Privacy", controller: "Controllers & Devices", voice: "Voice & Video", notifications: "Notifications & Overlay", mascot: "Mascot & Notch", quit: "Quit Application", encrypted: "Session Authentication", encryptedHint: "Session credentials and token securely authenticated on this device.", privacy: "Profile Privacy", privacyHint: "Choose what other players can see when they find your profile.", public: "Public Profile", publicHint: "Anyone can open your details, games, and activity.", private: "Private Profile", privateHint: "Only you and accepted friends can see the details.", saving: "Saving privacy...", saved: "Privacy updated.", controllerHint: "Navigation and lighting status for the connected controller." },
  "es-ES": { preferences: "Preferencias del launcher", general: "General", personalization: "Personalización", performance: "Rendimiento", account: "Tu cuenta", connections: "Conexiones y privacidad", controller: "Mandos y dispositivos", voice: "Voz y vídeo", notifications: "Notificaciones y overlay", mascot: "Mascota y Notch", quit: "Salir de la aplicación", encrypted: "Autenticación de sesión", encryptedHint: "Credenciales y token de sesión autenticados de forma segura en este dispositivo.", privacy: "Privacidad del perfil", privacyHint: "Elige qué pueden ver otros jugadores al encontrar tu perfil.", public: "Perfil público", publicHint: "Todos pueden abrir tus detalles, juegos y actividad.", private: "Perfil privado", privateHint: "Solo tú y tus amigos aceptados pueden ver los detalles.", saving: "Guardando privacidad...", saved: "Privacidad actualizada.", controllerHint: "Estado de navegación e iluminación del mando conectado." },
  "fr-FR": { preferences: "Préférences du launcher", general: "Général", personalization: "Personnalisation", performance: "Performances", account: "Votre compte", connections: "Connexions et confidentialité", controller: "Manettes et périphériques", voice: "Voix et vidéo", notifications: "Notifications et overlay", mascot: "Mascotte et Notch", quit: "Quitter l'application", encrypted: "Authentification de session", encryptedHint: "Identifiants et jeton de session authentifiés en toute sécurité sur cet appareil.", privacy: "Confidentialité du profil", privacyHint: "Choisissez ce que les autres joueurs voient en trouvant votre profil.", public: "Profil public", publicHint: "Tout le monde peut ouvrir vos détails, jeux et activité.", private: "Profil privé", privateHint: "Seuls vous et vos amis acceptés voyez les détails.", saving: "Enregistrement...", saved: "Confidentialité mise à jour.", controllerHint: "État de navigation et d'éclairage de la manette connectée." },
  "de-DE": { preferences: "Launcher-Einstellungen", general: "Allgemein", personalization: "Personnalierung", performance: "Leistung", account: "Dein Konto", connections: "Verbindungen und Datenschutz", controller: "Controller und Geräte", voice: "Sprache und Video", notifications: "Benachrichtigungen und Overlay", mascot: "Maskottchen & Notch", quit: "Anwendung beenden", encrypted: "Sitzungsauthentifizierung", encryptedHint: "Sitzungsanmeldedaten und Token auf diesem Gerät sicher authentifiziert.", privacy: "Profil-Datenschutz", privacyHint: "Lege fest, was andere Spieler in deinem Profil sehen.", public: "Öffentliches Profil", publicHint: "Alle können Details, Spiele und Aktivitäten öffnen.", private: "Privates Profil", privateHint: "Nur du und bestätigte Freunde sehen die Details.", saving: "Datenschutz wird gespeichert...", saved: "Datenschutz aktualisiert.", controllerHint: "Navigations- und Beleuchtungsstatus des verbundenen Controllers." },
  "it-IT": { preferences: "Preferenze del launcher", general: "Generale", personalization: "Personalizzazione", performance: "Prestazioni", account: "Il tuo account", connections: "Connessioni e privacy", controller: "Controller e dispositivi", voice: "Voce e video", notifications: "Notifiche e overlay", mascot: "Mascotte e Notch", quit: "Esci dall'applicazione", encrypted: "Autenticazione della sessione", encryptedHint: "Credenziali e token di sessione autenticati in modo sicuro su questo dispositivo.", privacy: "Privacy del profilo", privacyHint: "Scegli cosa possono vedere gli altri giocatori nel tuo profilo.", public: "Profilo pubblico", publicHint: "Tutti possono aprire dettagli, giochi e attività.", private: "Profilo privato", privateHint: "Solo tu e gli amici accettati vedete i dettagli.", saving: "Salvataggio privacy...", saved: "Privacy aggiornata.", controllerHint: "Stato di navigazione e illuminazione del controller collegato." },
} as const;

const PERF_SETTINGS_COPY = {
  "pt-BR": {
    general: "Geral",
    monitor: "Monitor",
    hudTitle: "Monitor de desempenho",
    hudHint: "Mostra FPS, CPU e RAM no hub e no overlay in-game, mesmo com o painel fechado.",
    liveTitle: "Uso agora",
    liveHint: "Atualiza a cada segundo no launcher e durante o jogo.",
  },
  "en-US": {
    general: "General",
    monitor: "Monitor",
    hudTitle: "Performance monitor",
    hudHint: "Shows FPS, CPU, and RAM on the hub and in-game overlay, even with the panel closed.",
    liveTitle: "Live usage",
    liveHint: "Updates every second in the launcher and while you play.",
  },
  "es-ES": {
    general: "General",
    monitor: "Monitor",
    hudTitle: "Monitor de rendimiento",
    hudHint: "Muestra FPS, CPU y RAM en el hub y en el overlay, aunque el panel esté cerrado.",
    liveTitle: "Uso actual",
    liveHint: "Se actualiza cada segundo en el launcher y durante la partida.",
  },
  "fr-FR": {
    general: "Général",
    monitor: "Moniteur",
    hudTitle: "Moniteur de performances",
    hudHint: "Affiche FPS, CPU et RAM sur le hub et l'overlay, même avec le panneau fermé.",
    liveTitle: "Utilisation actuelle",
    liveHint: "Mise à jour chaque seconde dans le launcher et en jeu.",
  },
  "de-DE": {
    general: "Allgemein",
    monitor: "Monitor",
    hudTitle: "Leistungsmonitor",
    hudHint: "Zeigt FPS, CPU und RAM im Hub und Overlay – auch bei geschlossenem Panel.",
    liveTitle: "Aktuelle Auslastung",
    liveHint: "Aktualisiert sich jede Sekunde im Launcher und im Spiel.",
  },
  "it-IT": {
    general: "Generale",
    monitor: "Monitor",
    hudTitle: "Monitor prestazioni",
    hudHint: "Mostra FPS, CPU e RAM nell'hub e nell'overlay, anche a pannello chiuso.",
    liveTitle: "Utilizzo attuale",
    liveHint: "Si aggiorna ogni secondo nel launcher e in gioco.",
  },
} as const;

const SETTINGS_DETAIL_COPY = {
  "pt-BR": {
    moreThemes: "Mais temas",
    comingSoon: "Novos pacotes em breve",
    audioTitle: "Efeitos Sonoros & Áudio",
    audioHint: "Ajuste o volume dos sons de navegação, música e alertas do launcher.",
    performanceTitle: "Modo de Desempenho",
    performanceHint: "Reduza animações e desative o desfoque em computadores mais antigos.",
    playerProfile: "Perfil do Jogador",
    playerProfileHint: "Informações da sua conta sincronizada com a nuvem.",
    playerFallback: "Jogador Phelierium",
    noEmail: "Sem e-mail vinculado",
    activeAccount: "Conta Ativa",
    security: "Segurança da Conta",
    securityHint: "Gerencie sua senha de acesso e opções de recuperação.",
    resetPassword: "Redefinir Senha",
    resetPasswordHint: "Envia um e-mail de segurança para alterar sua senha atual.",
    emailSent: "E-mail enviado!",
    sending: "Enviando...",
    sendEmail: "Enviar E-mail",
    overlayLab: "Overlay Lab",
    overlayLabHint: "Prévia de como os overlays e notificações ficarão durante o jogo.",
    testWelcome: "Testar Boas-Vindas",
    testWelcomeHint: "Mostra o card social ao iniciar um jogo.",
    testAchievement: "Testar Conquista",
    testAchievementHint: "Mostra o toast completo com conquista.",
    testBronze: "Troféu Bronze (+15 XP)",
    testBronzeHint: "Simula o desbloqueio de um troféu de bronze comum.",
    testSilver: "Troféu Prata (+30 XP)",
    testSilverHint: "Simula o desbloqueio de um troféu de prata intermediário.",
    testGold: "Troféu Ouro (+90 XP)",
    testGoldHint: "Simula o desbloqueio de ouro com áudio exclusivo.",
    testPlatinum: "Troféu Platina (+300 XP)",
    testPlatinumHint: "Simula a Platina (100%) com efeitos cósmicos.",
  },
  "en-US": {
    moreThemes: "More themes",
    comingSoon: "New packs coming soon",
    audioTitle: "Sound Effects & Audio",
    audioHint: "Adjust navigation, music, and launcher alert volumes.",
    performanceTitle: "Performance Mode",
    performanceHint: "Reduce animations and blur on older computers.",
    playerProfile: "Player Profile",
    playerProfileHint: "Information from your cloud-synced account.",
    playerFallback: "Phelierium Player",
    noEmail: "No email linked",
    activeAccount: "Active Account",
    security: "Account Security",
    securityHint: "Manage your password and recovery options.",
    resetPassword: "Reset Password",
    resetPasswordHint: "Sends a security email to change your current password.",
    emailSent: "Email sent!",
    sending: "Sending...",
    sendEmail: "Send Email",
    overlayLab: "Overlay Lab",
    overlayLabHint: "Preview how overlays will look while you play.",
    testWelcome: "Test Welcome",
    testWelcomeHint: "Shows the social card when a game starts.",
    testAchievement: "Test Achievement",
    testAchievementHint: "Shows the complete achievement toast.",
    testBronze: "Bronze Trophy (+15 XP)",
    testBronzeHint: "Simulates unlocking a standard bronze trophy.",
    testSilver: "Silver Trophy (+30 XP)",
    testSilverHint: "Simulates unlocking an intermediate silver trophy.",
    testGold: "Gold Trophy (+90 XP)",
    testGoldHint: "Simulates unlocking a gold trophy with unique SFX.",
    testPlatinum: "Platinum Trophy (+300 XP)",
    testPlatinumHint: "Simulates 100% completion with cosmic platinum SFX.",
  },
  "es-ES": {
    moreThemes: "Más temas",
    comingSoon: "Nuevos paquetes próximamente",
    audioTitle: "Efectos de sonido y audio",
    audioHint: "Ajusta el volumen de navegación, música y alertas.",
    performanceTitle: "Modo de rendimiento",
    performanceHint: "Reduce animaciones y desenfoque en equipos antiguos.",
    playerProfile: "Perfil del jugador",
    playerProfileHint: "Información de tu cuenta sincronizada en la nube.",
    playerFallback: "Jugador Phelierium",
    noEmail: "Sin correo vinculado",
    activeAccount: "Cuenta activa",
    security: "Seguridad de la cuenta",
    securityHint: "Gestiona tu contraseña y opciones de recuperación.",
    resetPassword: "Restablecer contraseña",
    resetPasswordHint: "Envía un correo de seguridad para cambiar tu contraseña.",
    emailSent: "¡Correo enviado!",
    sending: "Enviando...",
    sendEmail: "Enviar correo",
    overlayLab: "Laboratorio de overlay",
    overlayLabHint: "Vista previa de los overlays mientras juegas.",
    testWelcome: "Probar bienvenida",
    testWelcomeHint: "Muestra la tarjeta social al iniciar un juego.",
    testAchievement: "Probar logro",
    testAchievementHint: "Muestra la notificación completa del logro.",
    testBronze: "Trofeo Bronce (+15 XP)",
    testBronzeHint: "Simula el desbloqueo de un trofeo de bronce.",
    testSilver: "Trofeo Plata (+30 XP)",
    testSilverHint: "Simula el desbloqueo de un trofeo de plata.",
    testGold: "Trofeo Oro (+90 XP)",
    testGoldHint: "Simula el desbloqueo de oro con audio especial.",
    testPlatinum: "Trofeo Platino (+300 XP)",
    testPlatinumHint: "Simula el trofeo Platino con efectos cósmicos.",
  },
  "fr-FR": {
    moreThemes: "Plus de thèmes",
    comingSoon: "Nouveaux packs bientôt disponibles",
    audioTitle: "Effets sonores et audio",
    audioHint: "Réglez le volume de navigation, musique et alertes.",
    performanceTitle: "Mode performance",
    performanceHint: "Réduisez les animations et le flou sur les anciens PC.",
    playerProfile: "Profil du joueur",
    playerProfileHint: "Informations de votre compte synchronisé dans le cloud.",
    playerFallback: "Joueur Phelierium",
    noEmail: "Aucun e-mail associé",
    activeAccount: "Compte actif",
    security: "Sécurité du compte",
    securityHint: "Gérez votre mot de passe et les options de récupération.",
    resetPassword: "Réinitialiser le mot de passe",
    resetPasswordHint: "Envoie un e-mail de sécurité pour modifier votre mot de passe.",
    emailSent: "E-mail envoyé !",
    sending: "Envoi...",
    sendEmail: "Envoyer l'e-mail",
    overlayLab: "Laboratoire overlay",
    overlayLabHint: "Prévisualisez les overlays pendant vos parties.",
    testWelcome: "Tester la bienvenue",
    testWelcomeHint: "Affiche la carte sociale au lancement d'un jeu.",
    testAchievement: "Tester le succès",
    testAchievementHint: "Affiche la notification complète du succès.",
    testBronze: "Trophée Bronze (+15 XP)",
    testBronzeHint: "Simule le déverrouillage d'un trophée de bronze.",
    testSilver: "Trophée Argent (+30 XP)",
    testSilverHint: "Simule le déverrouillage d'un trophée d'argent.",
    testGold: "Trophée Or (+90 XP)",
    testGoldHint: "Simule le déverrouillage d'un trophée d'or.",
    testPlatinum: "Trophée Platine (+300 XP)",
    testPlatinumHint: "Simule le trophée Platine 100%.",
  },
  "de-DE": {
    moreThemes: "Weitere Themes",
    comingSoon: "Neue Pakete folgen bald",
    audioTitle: "Soundeffekte und Audio",
    audioHint: "Passe Navigation, Musik und Hinweislautstärke an.",
    performanceTitle: "Leistungsmodus",
    performanceHint: "Reduziert Animationen und Unschärfe auf älteren PCs.",
    playerProfile: "Spielerprofil",
    playerProfileHint: "Informationen deines cloud-synchronisierten Kontos.",
    playerFallback: "Phelierium-Spieler",
    noEmail: "Keine E-Mail verknüpft",
    activeAccount: "Aktives Konto",
    security: "Kontosicherheit",
    securityHint: "Verwalte Passwort und Wiederherstellungsoptionen.",
    resetPassword: "Passwort zurücksetzen",
    resetPasswordHint: "Sendet eine Sicherheits-E-Mail zum Ändern des Passworts.",
    emailSent: "E-Mail gesendet!",
    sending: "Wird gesendet...",
    sendEmail: "E-Mail senden",
    overlayLab: "Overlay-Labor",
    overlayLabHint: "Vorschau der Overlays während des Spielens.",
    testWelcome: "Willkommen testen",
    testWelcomeHint: "Zeigt die Social-Karte beim Spielstart.",
    testAchievement: "Erfolg testen",
    testAchievementHint: "Zeigt die vollständige Erfolgsbenachrichtigung.",
    testBronze: "Bronze-Trophäe (+15 XP)",
    testBronzeHint: "Simuliert das Freischalten einer Bronze-Trophäe.",
    testSilver: "Silber-Trophäe (+30 XP)",
    testSilverHint: "Simuliert das Freischalten einer Silber-Trophäe.",
    testGold: "Gold-Trophäe (+90 XP)",
    testGoldHint: "Simuliert das Freischalten einer Gold-Trophäe.",
    testPlatinum: "Platin-Trophäe (+300 XP)",
    testPlatinumHint: "Simuliert die 100%-Platin-Trophäe.",
  },
  "it-IT": {
    moreThemes: "Altri temi",
    comingSoon: "Nuovi pacchetti in arrivo",
    audioTitle: "Effetti sonori e audio",
    audioHint: "Regola il volume di navigazione, musica e avvisi.",
    performanceTitle: "Modalità prestazioni",
    performanceHint: "Riduce animazioni e sfocatura sui computer più datati.",
    playerProfile: "Profilo giocatore",
    playerProfileHint: "Informazioni dell'account sincronizzato nel cloud.",
    playerFallback: "Giocatore Phelierium",
    noEmail: "Nessuna e-mail collegata",
    activeAccount: "Account attivo",
    security: "Sicurezza account",
    securityHint: "Gestisci password e opzioni di recupero.",
    resetPassword: "Reimposta password",
    resetPasswordHint: "Invia un'e-mail di sicurezza per modificare la password.",
    emailSent: "E-mail inviata!",
    sending: "Invio...",
    sendEmail: "Invia e-mail",
    overlayLab: "Laboratorio overlay",
    overlayLabHint: "Anteprima degli overlay durante il gioco.",
    testWelcome: "Prova benvenuto",
    testWelcomeHint: "Mostra la scheda social all'avvio di un gioco.",
    testAchievement: "Prova obiettivo",
    testAchievementHint: "Mostra la notifica completa dell'obiettivo.",
    testBronze: "Trofeo Bronzo (+15 XP)",
    testBronzeHint: "Simula lo sblocco di un trofeo di bronzo.",
    testSilver: "Trofeo Argento (+30 XP)",
    testSilverHint: "Simula lo sblocco di un trofeo d'argento.",
    testGold: "Trofeo Oro (+90 XP)",
    testGoldHint: "Simula lo sblocco di un trofeo d'oro.",
    testPlatinum: "Trofeo Platino (+300 XP)",
    testPlatinumHint: "Simula il trofeo Platino al 100%.",
  },
} as const;

const ACHIEVEMENT_NOTIFICATION_COPY = {
  "pt-BR": {
    title: "Notificações de conquistas",
    description: "Escolha como e onde os desbloqueios aparecem durante o jogo.",
    enabled: "Notificar ao desbloquear",
    enabledHint: "Desliga completamente o aviso visual e o som de conquistas.",
    custom: "Notificação customizada",
    customHint: "Desligada, usa a notificação nativa do Windows — inclusive em tela cheia exclusiva.",
    position: "Posição da notificação customizada",
    positions: ["Superior esquerda", "Superior centro", "Superior direita", "Inferior esquerda", "Inferior direita"],
  },
  "en-US": {
    title: "Achievement notifications",
    description: "Choose how and where unlocks appear while you play.",
    enabled: "Notify when unlocked",
    enabledHint: "Turns off both the achievement visual alert and its sound.",
    custom: "Custom notification",
    customHint: "When off, uses the native Windows notification, including exclusive fullscreen.",
    position: "Custom notification position",
    positions: ["Top left", "Top center", "Top right", "Bottom left", "Bottom right"],
  },
  "es-ES": {
    title: "Notificaciones de logros",
    description: "Elige cómo y dónde aparecen los desbloqueos durante el juego.",
    enabled: "Notificar al desbloquear",
    enabledHint: "Desactiva por completo el aviso visual y el sonido.",
    custom: "Notificación personalizada",
    customHint: "Desactivada, usa la notificación nativa de Windows, incluso en pantalla completa exclusiva.",
    position: "Posición de la notificación",
    positions: ["Arriba izquierda", "Arriba centro", "Arriba derecha", "Abajo izquierda", "Abajo derecha"],
  },
  "fr-FR": {
    title: "Notifications de succès",
    description: "Choisissez comment et où les succès apparaissent pendant le jeu.",
    enabled: "Notifier au déverrouillage",
    enabledHint: "Désactive entièrement l’alerte visuelle et le son.",
    custom: "Notification personnalisée",
    customHint: "Désactivée, utilise la notification native de Windows, même en plein écran exclusif.",
    position: "Position de la notification",
    positions: ["Haut gauche", "Haut centre", "Haut droite", "Bas gauche", "Bas droite"],
  },
  "de-DE": {
    title: "Erfolgsbenachrichtigungen",
    description: "Lege fest, wie und wo Freischaltungen im Spiel erscheinen.",
    enabled: "Bei Freischaltung benachrichtigen",
    enabledHint: "Schaltet den visuellen Hinweis und den Ton vollständig aus.",
    custom: "Benutzerdefinierte Benachrichtigung",
    customHint: "Ausgeschaltet wird die native Windows-Benachrichtigung verwendet, auch im exklusiven Vollbild.",
    position: "Position der Benachrichtigung",
    positions: ["Oben links", "Oben Mitte", "Oben rechts", "Unten links", "Unten rechts"],
  },
  "it-IT": {
    title: "Notifiche degli obiettivi",
    description: "Scegli come e dove mostrare gli sblocchi durante il gioco.",
    enabled: "Notifica allo sblocco",
    enabledHint: "Disattiva completamente l’avviso visivo e il suono.",
    custom: "Notifica personalizzata",
    customHint: "Se disattivata usa la notifica nativa di Windows, anche a schermo intero esclusivo.",
    position: "Posizione della notifica",
    positions: ["In alto a sinistra", "In alto al centro", "In alto a destra", "In basso a sinistra", "In basso a destra"],
  },
} as const;

const VOICE_COPY = {
  "pt-BR": {
    ioTitle: "Entrada e Saída de Áudio",
    audioInput: "Microfone de Entrada",
    micTesting: "Teste de Microfone",
    test: "Testar",
    stop: "Parar",
    audioOutput: "Alto-falante (Saída)",
    camera: "Câmera de Vídeo",
    preview: "Visualizar câmera",
    micMonitor: "Ouvir o próprio microfone (Retorno)",
    processingTitle: "Processamento e Calibração",
    noiseSuppression: "Supressão de Ruído",
    voiceSensitivity: "Sensibilidade de Voz",
    echoCancellation: "Cancelamento de Eco",
    inputMode: "Modo de Entrada",
    pttKeybind: "Atalho Push-to-Talk",
    defaultSystem: "Padrão do Sistema",
    aiIsolation: "Isolamento por IA (Recomendado)",
    standardNative: "Nativo Padrão",
    raw: "Estúdio / Sem Filtro",
    voiceActivity: "Atividade de Voz",
    pushToTalk: "Push-to-Talk",
    callOverlayTitle: "Widget de chamada no overlay",
    callOverlayHint: "Exibe controles de voz (mute, surdo, desligar) durante o jogo",
  },
  "en-US": {
    ioTitle: "Input & Output",
    audioInput: "Audio Input (Microphone)",
    micTesting: "Microphone Testing",
    test: "Test",
    stop: "Stop",
    audioOutput: "Audio Output (Speakers)",
    camera: "Video Camera",
    preview: "Preview",
    micMonitor: "Listen to my own microphone",
    processingTitle: "Processing & Calibration",
    noiseSuppression: "Noise Suppression",
    voiceSensitivity: "Voice Sensitivity",
    echoCancellation: "Echo Cancellation",
    inputMode: "Input Mode",
    pttKeybind: "Push-to-Talk Keybind",
    defaultSystem: "Default System",
    aiIsolation: "AI Isolation (Recommended)",
    standardNative: "Standard Native",
    raw: "Studio / Raw",
    voiceActivity: "Voice Activity",
    pushToTalk: "Push-to-Talk",
    callOverlayTitle: "In-game call widget",
    callOverlayHint: "Shows voice controls (mute, deafen, hang up) while playing",
  },
  "es-ES": {
    ioTitle: "Entrada y Salida",
    audioInput: "Entrada de audio (Micrófono)",
    micTesting: "Prueba de Micrófono",
    test: "Probar",
    stop: "Detener",
    audioOutput: "Salida de audio (Altavoces)",
    camera: "Cámara de Vídeo",
    preview: "Vista previa",
    micMonitor: "Escuchar mi propio micrófono",
    processingTitle: "Procesamiento y Calibración",
    noiseSuppression: "Supresión de Ruido",
    voiceSensitivity: "Sensibilidad de Voz",
    echoCancellation: "Cancelación de Eco",
    inputMode: "Modo de Entrada",
    pttKeybind: "Atajo Push-to-Talk",
    defaultSystem: "Predeterminado",
    aiIsolation: "Aislamiento por IA (Recomendado)",
    standardNative: "Nativo Estándar",
    raw: "Estudio / Sin Filtro",
    voiceActivity: "Actividad de Voz",
    pushToTalk: "Pulsar para hablar",
    callOverlayTitle: "Widget de llamada en overlay",
    callOverlayHint: "Muestra controles de voz (silenciar, ensordecer, colgar) mientras juegas",
  },
  "fr-FR": {
    ioTitle: "Entrée et Sortie",
    audioInput: "Entrée audio (Microphone)",
    micTesting: "Test du Microphone",
    test: "Tester",
    stop: "Arrêter",
    audioOutput: "Sortie audio (Haut-parleurs)",
    camera: "Caméra vidéo",
    preview: "Aperçu",
    micMonitor: "Écouter mon propre microphone",
    processingTitle: "Traitement et Étalonnage",
    noiseSuppression: "Suppression du Bruit",
    voiceSensitivity: "Sensibilité Vocale",
    echoCancellation: "Annulation d'Écho",
    inputMode: "Mode d'Entrée",
    pttKeybind: "Raccourci Push-to-Talk",
    defaultSystem: "Système par défaut",
    aiIsolation: "Isolation IA (Recommandé)",
    standardNative: "Natif Standard",
    raw: "Studio / Brut",
    voiceActivity: "Détection Vocale",
    pushToTalk: "Appuyer pour parler",
    callOverlayTitle: "Widget d'appel dans l'overlay",
    callOverlayHint: "Affiche les contrôles vocaux (muet, sourd, raccrocher) en jeu",
  },
  "de-DE": {
    ioTitle: "Eingang & Ausgang",
    audioInput: "Audioeingang (Mikrofon)",
    micTesting: "Mikrofontest",
    test: "Testen",
    stop: "Stopp",
    audioOutput: "Audioausgang (Lautsprecher)",
    camera: "Videokamera",
    preview: "Vorschau",
    micMonitor: "Eigenes Mikrofon abhören",
    processingTitle: "Verarbeitung & Kalibrierung",
    noiseSuppression: "Geräuschunterdrückung",
    voiceSensitivity: "Sprachempfindlichkeit",
    echoCancellation: "Echounterdrückung",
    inputMode: "Eingabemodus",
    pttKeybind: "Push-to-Talk-Tastenkürzel",
    defaultSystem: "Systemvorgabe",
    aiIsolation: "KI-Isolation (Empfohlen)",
    standardNative: "Standard-Nativ",
    raw: "Studio / Roh",
    voiceActivity: "Sprachaktivität",
    pushToTalk: "Push-to-Talk",
    callOverlayTitle: "Anruf-Widget im Overlay",
    callOverlayHint: "Zeigt Sprachsteuerung (Stumm, Taub, Auflegen) während des Spiels",
  },
  "it-IT": {
    ioTitle: "Ingresso e Uscita",
    audioInput: "Ingresso audio (Microfono)",
    micTesting: "Test Microfono",
    test: "Testa",
    stop: "Ferma",
    audioOutput: "Uscita audio (Altoparlanti)",
    camera: "Videocamera",
    preview: "Anteprima",
    micMonitor: "Ascolta il mio microfono",
    processingTitle: "Elaborazione e Calibrazione",
    noiseSuppression: "Soppressione Rumore",
    voiceSensitivity: "Sensibilità Vocale",
    echoCancellation: "Cancellazione Eco",
    inputMode: "Modalità di Ingresso",
    pttKeybind: "Scorciatoia Push-to-Talk",
    defaultSystem: "Predefinito di Sistema",
    aiIsolation: "Isolamento IA (Consigliato)",
    standardNative: "Nativo Standard",
    raw: "Studio / Senza Filtri",
    voiceActivity: "Attività Vocale",
    pushToTalk: "Premi per Parlare",
    callOverlayTitle: "Widget chiamata nell'overlay",
    callOverlayHint: "Mostra i controlli vocali (muto, non sentire, riaggancia) durante il gioco",
  }
} as const;

const ACHIEVEMENT_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const SettingsChoice: React.FC<{
  active: boolean;
  label: string;
  hint: string;
  swatch?: string;
  onClick: () => void;
  onHover?: () => void;
}> = React.memo(({ active, label, hint, swatch, onClick, onHover }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    onMouseEnter={onHover}
    className="relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:scale-[1.015] hover:border-white/30 hover:bg-white/8 hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] active:scale-[0.985]"
    style={{
      background: active ? "var(--launcher-accent-soft)" : "rgba(255,255,255,0.035)",
      borderColor: active
        ? "rgb(var(--launcher-accent) / 0.45)"
        : "rgba(255,255,255,0.07)",
    }}
  >
    <div className="flex items-center gap-2 min-w-0 mb-1">
      {swatch && (
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-white/20 shadow-sm"
          style={{ background: swatch }}
        />
      )}
      <span className="text-xs font-bold text-white whitespace-nowrap truncate min-w-0">
        {label}
      </span>
    </div>
    {hint && (
      <span className="text-xs font-medium text-white/60 whitespace-nowrap truncate block min-w-0">
        {hint}
      </span>
    )}
    {active && (
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgb(var(--launcher-accent) / 0.28), 0 0 28px rgb(var(--launcher-accent) / 0.16)",
        }}
      />
    )}
  </button>
));
SettingsChoice.displayName = "SettingsChoice";

export interface SettingsSelectOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SettingsSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SettingsSelectOption<T>[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export const SettingsSelect = <T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  className = "w-[180px]",
  triggerClassName,
}: SettingsSelectProps<T>) => {
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between w-full bg-[var(--color-surface)] hover:bg-[#222222] border border-white/10 hover:border-white/20 text-white text-[12px] font-medium rounded-xl px-3 py-1.5 transition-all outline-none focus-visible:ring-1 focus-visible:ring-white/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]",
              triggerClassName
            )}
          >
            <span className="truncate">{selectedOption?.label ?? value}</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/50 shrink-0 ml-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="min-w-[180px] max-h-[260px] overflow-y-auto no-scrollbar border border-white/10 bg-[#161619]/95  rounded-xl p-1.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-[250]"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <DropdownMenuItem
                key={opt.value}
                glideId={opt.value}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 text-[12px] rounded-lg cursor-pointer transition-all outline-none select-none",
                  isSelected
                    ? "bg-[var(--color-surface)] text-white font-semibold"
                    : "text-white/70 hover:text-white hover:bg-[#222222]"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
SettingsSelect.displayName = "SettingsSelect";

// ============================================================================
// COMPONENTES DE LAYOUT ESTILO MACOS
// ============================================================================
const SettingsRow: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  hasBorder?: boolean;
  className?: string;
}> = ({ icon, title, description, action, children, hasBorder = true, className = "" }) => (
  <div className={`py-3.5 ${hasBorder ? 'border-b border-[var(--border-subtle)]' : ''} ${className}`}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-[38px]">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {icon && <div className="text-white/60 mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white/90 tracking-wide">{title}</div>
          {description && (
            <p className="text-[11.5px] leading-relaxed text-white/45 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="shrink-0 flex items-center justify-start sm:justify-end gap-2.5">
          {action}
        </div>
      )}
    </div>
    {children && (
      <div className="mt-2.5 pl-0">
        {children}
      </div>
    )}
  </div>
);

export interface ThemeOptionItem {
  id: "default" | "ps5" | "ps4" | "playstation" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
  label: string;
  hint: string;
  accentColor: string;
  glowColor: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}

export const COMPLETE_THEME_OPTIONS: ThemeOptionItem[] = [
  {
    id: "default",
    label: "Phelierium",
    hint: "Preto carvão + branco neutro, superfícies foscas",
    accentColor: "#ffffff",
    glowColor: "rgba(255, 255, 255, 0.25)",
    soundTheme: "default",
    visualTheme: "phelierium",
  },
  {
    id: "ps5",
    label: "PlayStation 5",
    hint: "Branco porcelana + azul elétrico DualSense pontual",
    accentColor: "#F4F4F6",
    glowColor: "rgba(41, 121, 255, 0.25)",
    soundTheme: "ps5",
    visualTheme: "ps5",
  },
  {
    id: "psp",
    label: "PSP",
    hint: "Grafite + prata, vidro fumê e ondas horizontais",
    accentColor: "#CBD5E1",
    glowColor: "rgba(203, 213, 225, 0.22)",
    soundTheme: "psp",
    visualTheme: "psp",
  },
  {
    id: "ps4",
    label: "PlayStation 4",
    hint: "Azul médio intenso com gradientes amplos",
    accentColor: "#0070D1",
    glowColor: "rgba(0, 112, 209, 0.35)",
    soundTheme: "ps4",
    visualTheme: "ps4",
  },
  {
    id: "playstation",
    label: "PlayStation 2",
    hint: "Azul profundo com detalhes ciano e profundidade",
    accentColor: "#1d4ed8",
    glowColor: "rgba(29, 78, 216, 0.35)",
    soundTheme: "ps2",
    visualTheme: "playstation",
  },
  {
    id: "gamecube",
    label: "GameCube",
    hint: "Roxo Nintendo + sons GameCube",
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.35)",
    soundTheme: "gamecube",
    visualTheme: "gamecube",
  },
  {
    id: "xbox360",
    label: "Xbox",
    hint: "Verde Xbox + sons Metro UI",
    accentColor: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.35)",
    soundTheme: "xbox360",
    visualTheme: "xbox360",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk 2077",
    hint: "Amarelo Neon + sons Cyberpunk 2077",
    accentColor: "#fcee0a",
    glowColor: "rgba(252, 238, 10, 0.4)",
    soundTheme: "cyberpunk",
    visualTheme: "cyberpunk",
  },
];

export const renderThemeMiniatureContent = (
  themeId: string,
  active: boolean,
  accentColor: string,
  containerClassName = "w-[122px] h-[78px]"
) => {
  switch (themeId) {
    case "default":
      // Pherielium: Preto carvão + branco neutro, superfícies foscas, luz localizada no elemento em foco
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-white/10 bg-[#0E0E0E] shadow-inner relative`}>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-white/10 bg-[#161616] shrink-0">
            <div className="h-1 w-5 rounded-full bg-white/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-white/10 bg-[#141414]">
              <div className="h-1 w-full rounded-full bg-white/40" />
              <div className="h-1 w-3/4 rounded-full bg-white/20" />
              <div className="h-1 w-4/5 rounded-full bg-white/20" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center bg-[#0A0A0A]">
              <div className="w-1/2 h-8 rounded-lg border border-white/50 bg-[#1F1F1F] shadow-[0_0_12px_rgba(255,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.25)] flex flex-col items-center justify-center gap-1">
                <div className="h-1 w-4 rounded-full bg-white" />
                <div className="h-0.5 w-2.5 rounded-full bg-white/40" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-white/5 bg-white/[0.03] opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
        </div>
      );

    case "ps5":
      // PS5: Branco porcelana + azul elétrico pontual, contornos suaves e iluminação fria nas bordas
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-white/12 bg-[#0B0E14] shadow-inner relative`}>
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-[#2979FF] opacity-90 shadow-[0_0_8px_#2979FF]" />
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-white/10 bg-[#121620] shrink-0">
            <div className="h-1 w-6 rounded-full bg-white/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#2979FF] shadow-[0_0_6px_#2979FF]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-white/10 bg-[#0F131C]">
              <div className="h-1 w-full rounded-full bg-white/35" />
              <div className="h-1 w-3/4 rounded-full bg-white/15" />
              <div className="h-1 w-4/5 rounded-full bg-white/15" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center bg-[#07090E]">
              {/* Botão/Card Branco Porcelana com linha azul discreta no estado selecionado */}
              <div className="w-1/2 h-8 rounded-lg bg-[#F5F6F8] shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex flex-col items-center justify-between p-1 relative overflow-hidden">
                <div className="h-1 w-4 rounded-full bg-[#111] mt-0.5" />
                <div className="h-[2px] w-full bg-[#2979FF] rounded-full shadow-[0_0_5px_#2979FF]" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-white/10 bg-white/[0.04] opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      );

    case "psp":
      // PSP: Grafite + prata com champagne discreto, reflexos de vidro fumê e ondas horizontais suaves
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-white/10 bg-[#121417] shadow-inner relative`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(214,188,145,0.18)_0%,transparent_65%)] pointer-events-none" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" viewBox="0 0 122 78" fill="none">
            <path d="M-10 45 C 30 25, 70 60, 135 35" stroke="rgba(226, 232, 240, 0.8)" strokeWidth="1.5" />
            <path d="M-10 52 C 35 32, 75 66, 135 42" stroke="rgba(214, 188, 145, 0.6)" strokeWidth="1" />
          </svg>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-white/10 bg-white/[0.04] backdrop-blur-xs shrink-0 z-10">
            <div className="h-1 w-6 rounded-full bg-[#CBD5E1]/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#E2E8F0] shadow-[0_0_4px_rgba(226,232,240,0.6)]" />
          </div>
          <div className="flex flex-1 min-h-0 z-10">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-white/10 bg-black/30 backdrop-blur-xs">
              <div className="h-1 w-full rounded-full bg-[#CBD5E1]/50" />
              <div className="h-1 w-3/4 rounded-full bg-[#CBD5E1]/25" />
              <div className="h-1 w-4/5 rounded-full bg-[#CBD5E1]/25" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-[#CBD5E1]/60 bg-[#CBD5E1]/20 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col items-center justify-center gap-1">
                <div className="h-1 w-4 rounded-full bg-[#E2E8F0]" />
                <div className="h-0.5 w-2.5 rounded-full bg-[#D4AF37]/80" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-white/10 bg-white/[0.03] opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
        </div>
      );

    case "ps4":
      // PS4: Azul médio intenso com gradientes amplos e sensação de ondas
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-blue-500/20 bg-gradient-to-b from-[#002466] to-[#001033] shadow-inner relative`}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" viewBox="0 0 122 78" fill="none">
            <path d="M-10 38 Q 40 18 135 50" stroke="#0070D1" strokeWidth="2" />
            <path d="M-10 50 Q 50 25 135 60" stroke="#38BDF8" strokeWidth="1" />
          </svg>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-blue-400/15 bg-blue-950/40 shrink-0 z-10">
            <div className="h-1 w-6 rounded-full bg-blue-200/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#0070D1] shadow-[0_0_6px_#0070D1]" />
          </div>
          <div className="flex flex-1 min-h-0 z-10">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-blue-400/15 bg-blue-950/30">
              <div className="h-1 w-full rounded-full bg-blue-200/50" />
              <div className="h-1 w-3/4 rounded-full bg-blue-200/25" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-blue-400/50 bg-blue-600/35 shadow-[0_0_12px_rgba(0,112,209,0.35)] flex items-center justify-center">
                <div className="h-1 w-4 rounded-full bg-white" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-blue-400/20 bg-blue-900/20 opacity-50 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-blue-200/30" />
              </div>
            </div>
          </div>
        </div>
      );

    case "playstation":
      // PS2: Azul profundo + ciano em pequenos detalhes, profundidade escura e formas geométricas
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-indigo-500/20 bg-[#00081C] shadow-inner relative`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_100%,rgba(0,210,255,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-indigo-900/40 bg-[#000D2B] shrink-0">
            <div className="h-1 w-6 rounded-full bg-indigo-300/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#00D2FF] shadow-[0_0_6px_#00D2FF]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-indigo-900/40 bg-[#000A24]">
              <div className="h-1 w-full rounded-full bg-indigo-300/40" />
              <div className="h-1 w-3/4 rounded-full bg-indigo-300/20" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-[#1D4ED8] bg-[#1D4ED8]/30 shadow-[0_0_10px_rgba(29,78,216,0.3)] flex flex-col items-center justify-center gap-1">
                <div className="h-1 w-4 rounded-full bg-white/90" />
                <div className="h-0.5 w-1.5 rounded-full bg-[#00D2FF]" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-indigo-900/30 bg-indigo-950/20 opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-indigo-300/20" />
              </div>
            </div>
          </div>
        </div>
      );

    case "gamecube":
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-purple-500/20 bg-[#10081C] shadow-inner relative`}>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-purple-900/40 bg-[#1A0D30] shrink-0">
            <div className="h-1 w-6 rounded-full bg-purple-300/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] shadow-[0_0_6px_#8B5CF6]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-purple-900/40 bg-[#160B28]">
              <div className="h-1 w-full rounded-full bg-purple-300/40" />
              <div className="h-1 w-3/4 rounded-full bg-purple-300/20" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-purple-500/50 bg-purple-600/30 shadow-[0_0_10px_rgba(139,92,246,0.3)] flex items-center justify-center">
                <div className="h-1 w-4 rounded-full bg-white" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-purple-900/30 bg-purple-950/20 opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-purple-300/20" />
              </div>
            </div>
          </div>
        </div>
      );

    case "xbox360":
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-green-500/20 bg-[#0A120B] shadow-inner relative`}>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-green-900/40 bg-[#101C12] shrink-0">
            <div className="h-1 w-6 rounded-full bg-green-300/30" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] shadow-[0_0_6px_#22C55E]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-green-900/40 bg-[#0D170E]">
              <div className="h-1 w-full rounded-full bg-green-300/40" />
              <div className="h-1 w-3/4 rounded-full bg-green-300/20" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-green-500/50 bg-green-600/30 shadow-[0_0_10px_rgba(34,197,94,0.3)] flex items-center justify-center">
                <div className="h-1 w-4 rounded-full bg-white" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-green-900/30 bg-green-950/20 opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-green-300/20" />
              </div>
            </div>
          </div>
        </div>
      );

    case "cyberpunk":
      return (
        <div className={`${containerClassName} rounded-xl overflow-hidden flex flex-col border border-yellow-500/25 bg-[#0C0C0C] shadow-inner relative`}>
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-yellow-500/20 bg-[#141414] shrink-0">
            <div className="h-1 w-6 rounded-full bg-yellow-400/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#FCEE0A] shadow-[0_0_6px_#FCEE0A]" />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-yellow-500/20 bg-[#101010]">
              <div className="h-1 w-full rounded-full bg-yellow-400/40" />
              <div className="h-1 w-3/4 rounded-full bg-yellow-400/20" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div className="w-1/2 h-8 rounded-lg border border-[#FCEE0A] bg-[#FCEE0A]/25 shadow-[0_0_12px_rgba(252,238,10,0.35)] flex items-center justify-center">
                <div className="h-1 w-4 rounded-full bg-[#FCEE0A]" />
              </div>
              <div className="w-1/2 h-7 rounded-md border border-cyan-400/30 bg-cyan-950/20 opacity-40 flex items-center justify-center">
                <div className="h-1 w-3 rounded-full bg-cyan-300/30" />
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};

export const ThemePreviewCard: React.FC<{
  id: string;
  active: boolean;
  label: string;
  accentColor: string;
  glowColor?: string;
  onClick: () => void;
}> = ({ id, active, label, accentColor, onClick }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={`relative p-1 rounded-2xl transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 ease-out transform-gpu will-change-transform cursor-pointer ${
          active
            ? "scale-[1.02] border border-white/60 bg-white/[0.08] shadow-[0_0_16px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.22)]"
            : "border border-white/10 bg-white/[0.02] opacity-75 hover:opacity-100 hover:border-white/25 hover:scale-[1.01]"
        }`}
      >
        {active && (
          <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full flex items-center justify-center bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-20">
            <Check className="h-2.5 w-2.5 text-black stroke-[3]" />
          </div>
        )}
        {renderThemeMiniatureContent(id, active, accentColor)}
      </button>
      <span
        className={`text-[11.5px] font-semibold tracking-tight transition-colors text-center ${
          active ? "text-white" : "text-white/60 hover:text-white/90"
        }`}
      >
        {label}
      </span>
    </div>
  );
};


export interface SettingsPageV2Props {
  language: LauncherLanguage;
  effectsVolume: number;
  achievementVolume: number;
  notificationVolume: number;
  musicVolume: number;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
  languageOptions: LanguageOption[];
  appThemeOptions: AppThemeOption[];
  SteamIcon: BrandIcon;
  DiscordIcon: BrandIcon;
  EpicIcon: BrandIcon;
  onLanguageChange: (language: LauncherLanguage) => void;
  onEffectsVolumeChange: (volume: number) => void;
  onAchievementVolumeChange: (volume: number) => void;
  onNotificationVolumeChange: (volume: number) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSoundThemeChange: (theme: SoundTheme) => void;
  onVisualThemeChange: (theme: VisualTheme) => void;
  onPreviewSound: () => void;
  onTestNotificationSound: () => void;
  t: TranslationFn;
  steamConnected: boolean;
  discordConnected: boolean;
  discordUsername?: string;
  discordAvatar?: string;
  steamConnecting: boolean;
  discordConnecting: boolean;
  epicConnected?: boolean;
  epicDisplayName?: string;
  epicConnecting?: boolean;
  steamDisconnecting?: boolean;
  discordDisconnecting?: boolean;
  epicDisconnecting?: boolean;
  onConnectSteam: () => void;
  onCancelSteamConnect?: () => void;
  onConnectDiscord: () => void;
  onCancelDiscordConnect?: () => void;
  onConnectEpic?: () => void;
  onDisconnectSteam: () => void;
  onDisconnectDiscord: () => void;
  onDisconnectEpic?: () => void;
  onTestOverlayWelcome: () => void;
  onTestOverlayAchievement: (tier?: "bronze" | "silver" | "gold" | "platinum") => void;
  initialTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose?: () => void;
  platformOperations?: { steam?: { status?: string; phase?: string }; epic?: { status?: string; phase?: string } };
}

export const SettingsPageV2: React.FC<SettingsPageV2Props> = React.memo(({
  language,
  effectsVolume,
  achievementVolume,
  notificationVolume,
  platformOperations,
  musicVolume,
  soundTheme,
  visualTheme,
  languageOptions,
  appThemeOptions,
  SteamIcon,
  DiscordIcon,
  EpicIcon,
  onLanguageChange,
  onEffectsVolumeChange,
  onAchievementVolumeChange,
  onNotificationVolumeChange,
  onMusicVolumeChange,
  onSoundThemeChange,
  onVisualThemeChange,
  onPreviewSound,
  onTestNotificationSound,
  t,
  steamConnected,
  discordConnected,
  discordUsername,
  discordAvatar,
  steamConnecting,
  discordConnecting,
  epicConnected,
  epicDisplayName,
  epicConnecting,
  steamDisconnecting,
  discordDisconnecting,
  epicDisconnecting,
  onConnectSteam,
  onCancelSteamConnect,
  onConnectDiscord,
  onCancelDiscordConnect,
  onConnectEpic,
  onDisconnectSteam,
  onDisconnectDiscord,
  onDisconnectEpic,
  onTestOverlayWelcome,
  onTestOverlayAchievement,
  initialTab,
  onTabChange,
  onClose,
}) => {
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );
  const { isGamepadConnected, gamepadFamily, connectedGamepadId } = useGamepad();
  const {
    openAtLogin,
    setOpenAtLogin,
    lowPerformanceMode,
    setLowPerformanceMode,
    performanceTier,
    setPerformanceTier,
    gameBootIntroEnabled,
    setGameBootIntroEnabled,
    gameBootIntroSoundEnabled,
    setGameBootIntroSoundEnabled,
    hapticsEnabled,
    setHapticsEnabled,
    closeOnLaunch,
    setCloseOnLaunch,
    minimizeToTrayOnClose,
    setMinimizeToTrayOnClose,
    restoreLastScreen,
    setRestoreLastScreen,
    confirmBeforeExit,
    setConfirmBeforeExit,
    achievementNotificationsEnabled,
    setAchievementNotificationsEnabled,
    customAchievementNotifications,
    setCustomAchievementNotifications,
    achievementNotificationPosition,
    setAchievementNotificationPosition,
    callOverlayEnabled,
    setCallOverlayEnabled,
    mascotColor,
    setMascotColor,
  } = usePreferences();

  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);
  const [passwordResetSent, setPasswordResetSent] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [profileVisibility, setProfileVisibility] = React.useState<ProfileVisibility>(
    userProfile?.profileVisibility ?? "public",
  );
  const [privacyStatus, setPrivacyStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [privacyError, setPrivacyError] = React.useState("");

  const voiceCallContext = useVoiceCallContext();
  const [isRecordingPttKey, setIsRecordingPttKey] = React.useState(false);
  const [isTestingMic, setIsTestingMic] = React.useState(false);
  const [micPermissionError, setMicPermissionError] = React.useState(false);
  const [testMicVolume, setTestMicVolume] = React.useState(0);
  const [isVideoPreviewOn, setIsVideoPreviewOn] = React.useState(false);
  const videoPreviewRef = React.useRef<HTMLVideoElement | null>(null);
  const videoPreviewStreamRef = React.useRef<MediaStream | null>(null);
  const [batteryLevel, setBatteryLevel] = React.useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = React.useState(false);
  const [showControllerStatusModal, setShowControllerStatusModal] = React.useState(false);
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);
  const [isQuitHovered, setIsQuitHovered] = React.useState(false);
  const [isSettingsTitleHovered, setIsSettingsTitleHovered] = React.useState(false);
  const [perfSubTab, setPerfSubTab] = React.useState<"general" | "monitor">("general");
  const [mascotPreviewHovered, setMascotPreviewHovered] = React.useState(false);
  const [mascotPreviewMood, setMascotPreviewMood] = React.useState<MascotMood>(() => getMascotBaseMood() ?? "idle");
  const [mascotAppliedMood, setMascotAppliedMood] = React.useState<MascotMood | null>(() => getMascotBaseMood());
  const perfHud = usePerfMonitor({ sample: activeTab === "performance" });

  React.useEffect(() => {
    if (!isTestingMic || activeTab !== "voice") {
      setTestMicVolume(0);
      return;
    }

    let isCancelled = false;
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animId: number | null = null;

    const startTest = async () => {
      setMicPermissionError(false);
      try {
        const targetId = voiceCallContext?.selectedAudioInput;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: targetId && targetId !== "default" ? { exact: targetId } : undefined,
            echoCancellation: voiceCallContext?.echoCancellation ?? true,
            noiseSuppression: voiceCallContext?.noiseSuppression ?? true,
            autoGainControl: voiceCallContext?.autoGainControl ?? true,
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 48000 },
            sampleSize: { ideal: 16 },
          },
          video: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        ctx = new AudioCtx();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.25;
        source.connect(analyser);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (isCancelled || !analyser) return;
          analyser.getFloatTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            sumSquares += data[i] * data[i];
          }
          const rms = Math.sqrt(sumSquares / data.length);
          const gainMultiplier = (voiceCallContext?.micGain ?? 100) / 100;
          const level = Math.min(100, Math.round(rms * 700 * gainMultiplier));
          setTestMicVolume(level);
          animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
      } catch (err) {
        console.warn("[SettingsPage] Mic test failed:", err);
        setMicPermissionError(true);
        setIsTestingMic(false);
      }
    };

    void startTest();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try { source.disconnect(); } catch { }
      }
      if (analyser) {
        try { analyser.disconnect(); } catch { }
      }
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => { });
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setTestMicVolume(0);
    };
  }, [activeTab, isTestingMic, voiceCallContext?.autoGainControl, voiceCallContext?.echoCancellation, voiceCallContext?.noiseSuppression, voiceCallContext?.selectedAudioInput]);

  React.useEffect(() => {
    if (!isVideoPreviewOn || activeTab !== "voice") {
      if (videoPreviewStreamRef.current) {
        videoPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        videoPreviewStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      return;
    }

    let isCancelled = false;
    const startVideo = async () => {
      try {
        const targetId = voiceCallContext?.selectedVideoInput;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: targetId && targetId !== "default" ? { exact: targetId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoPreviewStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch {
        setIsVideoPreviewOn(false);
      }
    };

    void startVideo();

    return () => {
      isCancelled = true;
      if (videoPreviewStreamRef.current) {
        videoPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        videoPreviewStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [activeTab, isVideoPreviewOn, voiceCallContext?.selectedVideoInput]);

  React.useEffect(() => {
    let cancelled = false;
    let bat: any = null;
    const update = (b: any) => {
      if (cancelled) return;
      setBatteryLevel(Math.round(b.level * 100));
      setBatteryCharging(!!b.charging);
    };
    const poll = async () => {
      try {
        const nav: any = navigator as any;
        if (nav.getBattery) {
          bat = await nav.getBattery();
          update(bat);
          bat.addEventListener("levelchange", () => update(bat));
          bat.addEventListener("chargingchange", () => update(bat));
        }
      } catch { }
    };
    if (isGamepadConnected) void poll();
    else { setBatteryLevel(null); setBatteryCharging(false); }
    return () => {
      cancelled = true;
      try { bat?.removeEventListener("levelchange", update); bat?.removeEventListener("chargingchange", update); } catch { }
    };
  }, [isGamepadConnected]);

  React.useEffect(() => {
    if (!isGamepadConnected || batteryLevel === null || batteryCharging) return;
    if (batteryLevel > 20) return;
    const key = `checkpoint_low_bat_${batteryLevel}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.setTimeout(() => sessionStorage.removeItem(key), 600000);
    if (window.electronAPI?.updateOverlayPanel) {
      try { window.electronAPI?.showBatteryWarning?.(batteryLevel); } catch { }
    }
    window.dispatchEvent(new CustomEvent("checkpoint:low-battery", { detail: { level: batteryLevel } }));
  }, [batteryLevel, batteryCharging, isGamepadConnected]);

  React.useEffect(() => {
    setProfileVisibility(userProfile?.profileVisibility ?? "public");
  }, [userProfile?.profileVisibility]);

  const handleProfileVisibilityChange = async (nextVisibility: ProfileVisibility) => {
    if (!user || nextVisibility === profileVisibility || privacyStatus === "saving") return;
    const previousVisibility = profileVisibility;
    setProfileVisibility(nextVisibility);
    setPrivacyStatus("saving");
    setPrivacyError("");
    try {
      const savedVisibility = await saveProfileVisibility(nextVisibility);
      setProfileVisibility(savedVisibility);
      setPrivacyStatus("saved");
    } catch (error) {
      setProfileVisibility(previousVisibility);
      setPrivacyStatus("error");
      setPrivacyError(error instanceof Error ? error.message : "Não foi possível alterar a privacidade.");
    }
  };

  const handleSignOut = React.useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }, []);

  const handlePasswordReset = async () => {
    if (!user?.email || isResettingPassword) return;
    setIsResettingPassword(true);
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      });
      setPasswordResetSent(true);
    } catch {
      // Ignore fallback
    } finally {
      setIsResettingPassword(false);
    }
  };

  const controllerCopy = CONTROLLER_COPY[language] || CONTROLLER_COPY["pt-BR"];
  const shellCopy = SETTINGS_SHELL_COPY[language] || SETTINGS_SHELL_COPY["pt-BR"];
  const detailCopy = SETTINGS_DETAIL_COPY[language] || SETTINGS_DETAIL_COPY["pt-BR"];
  const achievementNotificationCopy = ACHIEVEMENT_NOTIFICATION_COPY[language] || ACHIEVEMENT_NOTIFICATION_COPY["pt-BR"];
  const voiceCopy = VOICE_COPY[language] || VOICE_COPY["pt-BR"];
  const diagnosticsCopy = DIAGNOSTICS_COPY[language] || DIAGNOSTICS_COPY["pt-BR"];
  const perfCopy = PERF_SETTINGS_COPY[language] || PERF_SETTINGS_COPY["pt-BR"];
  const led = useControllerLedStatus();
  const isPt = language === "pt-BR";

  const selectTab = React.useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
    onTabChange(tab);
    playSound("hover");
  }, [onTabChange, playSound]);

  const mainScrollRef = React.useRef<HTMLDivElement | null>(null);

  const SETTINGS_TAB_ORDER: SettingsTab[] = React.useMemo(() => [
    "general",
    "personalization",
    "performance",
    "account",
    "connections",
    "controller",
    "voice",
    "notifications",
  ], []);

  useGamepadNavigation({
    scrollRef: mainScrollRef,
    scrollSpeed: 24,
    disableX: true,
    disableO: true,
    enabled: true,
    priority: 10,
  });

  useGamepadButton("L1", () => {
    const currentIndex = SETTINGS_TAB_ORDER.indexOf(activeTab);
    const prevIndex = (currentIndex - 1 + SETTINGS_TAB_ORDER.length) % SETTINGS_TAB_ORDER.length;
    selectTab(SETTINGS_TAB_ORDER[prevIndex]);
  });

  useGamepadButton("R1", () => {
    const currentIndex = SETTINGS_TAB_ORDER.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % SETTINGS_TAB_ORDER.length;
    selectTab(SETTINGS_TAB_ORDER[nextIndex]);
  });

  useGamepadButton(
    "O",
    () => {
      if (showControllerStatusModal) {
        setShowControllerStatusModal(false);
        playSound("back");
        return;
      }
      if (onClose) {
        playSound("back");
        onClose();
      }
    },
    true,
    10,
  );

  React.useEffect(() => {
    if (!isGamepadConnected) return;
    const timer = window.setTimeout(() => {
      const mainEl = mainScrollRef.current;
      if (!mainEl) return;
      const firstFocusable = mainEl.querySelector<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
      );
      if (firstFocusable) {
        document
          .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
          .forEach((el) => {
            delete el.dataset.gamepadFocused;
          });
        firstFocusable.dataset.gamepadFocused = "true";
        firstFocusable.focus({ preventScroll: true });
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeTab, isGamepadConnected]);

  const behaviorOptions = [
    {
      label: t("openAtLogin"),
      hint: t("openAtLoginHint"),
      checked: openAtLogin,
      onChange: setOpenAtLogin,
    },
    {
      label: t("closeOnLaunch"),
      hint: t("closeOnLaunchHint"),
      checked: closeOnLaunch,
      onChange: setCloseOnLaunch,
    },
    {
      label: t("minimizeToTray"),
      hint: t("minimizeToTrayHint"),
      checked: minimizeToTrayOnClose,
      onChange: setMinimizeToTrayOnClose,
    },
    {
      label: t("restoreLastScreen"),
      hint: t("restoreLastScreenHint"),
      checked: restoreLastScreen,
      onChange: setRestoreLastScreen,
    },
    {
      label: t("confirmBeforeExit"),
      hint: t("confirmBeforeExitHint"),
      checked: confirmBeforeExit,
      onChange: setConfirmBeforeExit,
    },
  ];

  const isThemeSelected = (opt: ThemeOptionItem) => {
    if (opt.id === "default") {
      return soundTheme === "default" || visualTheme === "phelierium" || visualTheme === "checkpoint";
    }
    if (opt.id === "ps5") {
      return soundTheme === "ps5" && visualTheme === "ps5";
    }
    if (opt.id === "playstation") {
      return soundTheme === "ps2" || visualTheme === "playstation";
    }
    if (opt.id === "ps4") {
      return soundTheme === "ps4" || visualTheme === "ps4";
    }
    if (opt.id === "psp") {
      return soundTheme === "psp" || visualTheme === "psp";
    }
    if (opt.id === "gamecube") {
      return soundTheme === "gamecube" || visualTheme === "gamecube";
    }
    if (opt.id === "xbox360") {
      return soundTheme === "xbox360" || visualTheme === "xbox360";
    }
    if (opt.id === "cyberpunk") {
      return soundTheme === "cyberpunk" || visualTheme === "cyberpunk";
    }
    return soundTheme === opt.soundTheme && visualTheme === opt.visualTheme;
  };

  const handleQuitApp = () => {
    playSound("back");
    if (window.electronAPI?.requestAppQuit) {
      window.electronAPI.requestAppQuit();
    } else if (window.close) {
      window.close();
    }
  };

  return (
    <div
      data-system-page="settings"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8  animate-in fade-in duration-300 pointer-events-auto select-none"
    >
      {/* Wrapper Principal - Split Layout estilo macOS */}
      <div className="flex w-full max-w-[1040px] h-[78vh] min-h-[620px] max-h-[860px] gap-3">

        {/* SIDEBAR ESQUERDA - Theme Surface Style */}
        <aside
          className="w-[240px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-[var(--radius-panel)] flex flex-col py-6 px-4 shrink-0 shadow-[0_32px_64px_rgba(0,0,0,0.6)] [box-shadow:var(--surface-chamfer)] transform-gpu transition-colors duration-300"
        >
          <div
            className="flex items-center justify-between px-3 mb-5 group cursor-default"
            onMouseEnter={() => setIsSettingsTitleHovered(true)}
            onMouseLeave={() => setIsSettingsTitleHovered(false)}
          >
            <div className="flex items-center gap-2.5">
              <AnimatedSettings size={18} animate={isSettingsTitleHovered} animateOnHover={true} className="text-white/80 group-hover:text-white transition-colors" />
              <h2 className="text-[14px] font-semibold text-white tracking-wide">{t("settings")}</h2>
            </div>
            {isGamepadConnected && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-ui-detail)] text-white/70 shadow-sm">
                <span className="text-[10px] font-bold font-mono">L1</span>
                <span className="text-[9px] text-white/30">•</span>
                <span className="text-[10px] font-bold font-mono">R1</span>
              </div>
            )}
          </div>

          <div className="h-px w-full bg-[var(--border-subtle)] mb-4" />

          <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
            {[
              { id: "general" as const, icon: AnimatedSlidersHorizontal, label: shellCopy.general },
              { id: "personalization" as const, icon: AnimatedPalette, label: shellCopy.personalization },
              { id: "performance" as const, icon: AnimatedLaptop, label: shellCopy.performance },
              { id: "account" as const, icon: AnimatedShieldCheck, label: shellCopy.account },
              { id: "connections" as const, icon: AnimatedGlobe, label: shellCopy.connections },
              { id: "controller" as const, icon: AnimatedGamepad2, label: shellCopy.controller },
              { id: "voice" as const, icon: AnimatedMic, label: shellCopy.voice },
              { id: "notifications" as const, icon: AnimatedBell, label: shellCopy.notifications },
              { id: "mascot" as const, icon: Sparkles as any, label: (shellCopy as any).mascot || "Mascote e Notch" },
            ].map(({ id, icon: IconComponent, label }) => {
              const isActive = activeTab === id;
              const isHovered = hoveredTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  onMouseEnter={() => setHoveredTab(id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={`group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-2.5 text-[12.5px] font-medium transition-all duration-200 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-selected)] ${isActive
                    ? "bg-[var(--selection-bg)] text-[var(--selection-text)] border-[var(--selection-border)] shadow-sm font-semibold"
                    : "text-white/60 border-transparent hover:bg-white/[0.05] hover:text-white"
                    }`}
                >
                  <IconComponent
                    size={16}
                    animate={isHovered}
                    animateOnHover={true}
                    className={`shrink-0 transition-colors ${isActive ? "text-current" : "text-white/50 group-hover:text-white/80"}`}
                  />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-3 mt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={handleQuitApp}
              onMouseEnter={() => setIsQuitHovered(true)}
              onMouseLeave={() => setIsQuitHovered(false)}
              className="group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-2.5 text-[12.5px] font-medium text-white/50 hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-selected)]"
            >
              <AnimatedLogOut size={16} animate={isQuitHovered} animateOnHover={true} className="shrink-0 text-white/40 group-hover:text-white transition-colors" />
              <span>{shellCopy.quit}</span>
            </button>
          </div>
        </aside>

        {/* PAINEL DIREITO - Theme Surface Style */}
        <main
          ref={mainScrollRef}
          className="flex-1 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] overflow-y-auto no-scrollbar relative shadow-[0_32px_64px_rgba(0,0,0,0.6)] [box-shadow:var(--surface-chamfer)] transform-gpu transition-colors duration-300"
          style={{ contain: "layout paint" }}
        >
          <div className="p-7 sm:p-8 md:p-9 space-y-7 w-full max-w-[760px]">

            {/* ABA GERAL */}
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <SlidersHorizontal className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.general}</h2>
                  </div>
                  <SettingsRow
                    icon={<Languages className="h-4 w-4" />}
                    title={t("language")}
                    description="Idioma utilizado em todos os menus, textos e notificações do hub."
                    action={
                      <SettingsSelect
                        value={language}
                        onChange={(v) => onLanguageChange(v as LauncherLanguage)}
                        options={languageOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                        className="w-full sm:w-[190px]"
                      />
                    }
                  />

                  {behaviorOptions.map((option) => (
                    <SettingsRow
                      key={option.label}
                      title={option.label}
                      description={option.hint}
                      action={
                        <div className="flex items-center gap-2.5">
                          <Switch checked={option.checked} onCheckedChange={option.onChange} />
                          <span className="text-[11.5px] text-white/50 w-16 select-none">{option.checked ? t("enabled") : t("disabled")}</span>
                        </div>
                      }
                    />
                  ))}

                  <SettingsRow
                    icon={<Sparkles className="h-4 w-4" />}
                    title="Guia do Ecossistema Pherielium"
                    description="Veja novamente o tour interativo explicando como adicionar jogos, conectar plataformas e usar o overlay."
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          playSound?.("select");
                          window.dispatchEvent(new CustomEvent("phelierium:open-welcome-modal"));
                        }}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 text-xs font-semibold text-white transition-colors cursor-pointer active:scale-95"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Abrir Guia</span>
                      </button>
                    }
                    hasBorder={false}
                  />
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                {/* Seção de Atualização do Launcher */}
                <AppUpdateSection />
              </div>
            )}

            {/* ABA PERSONALIZAÇÃO */}
            {activeTab === "personalization" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="mb-6">
                    <div className="flex items-center gap-2.5">
                      <Palette className="h-4 w-4 text-white/70 shrink-0" />
                      <h2 className="text-[17px] font-semibold text-white tracking-wide">{t("themes")}</h2>
                    </div>
                    <p className="text-[12.5px] text-white/40 mt-1">{t("themesHint")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {COMPLETE_THEME_OPTIONS.map((opt) => {
                      const isSelected = isThemeSelected(opt);
                      return (
                        <ThemePreviewCard
                          key={opt.id}
                          id={opt.id}
                          active={isSelected}
                          label={opt.label}
                          accentColor={opt.accentColor}
                          glowColor={opt.glowColor}
                          onClick={() => {
                            onVisualThemeChange(opt.visualTheme);
                            onSoundThemeChange(opt.soundTheme);
                            playSound("select");
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Prévia Expandida da Cena com Amostra de Som Explícita */}
                  {(() => {
                    const activeTheme = COMPLETE_THEME_OPTIONS.find((opt) => isThemeSelected(opt)) || COMPLETE_THEME_OPTIONS[0];
                    return (
                      <div className="mb-7 p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-[#0E1012] relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-5 shadow-inner">
                        <div
                          className="absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
                          style={{ backgroundColor: activeTheme.accentColor }}
                        />

                        <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                          {/* Miniatura ampliada da cena representativa */}
                          <div className="shrink-0 shadow-md">
                            {renderThemeMiniatureContent(activeTheme.id, true, activeTheme.accentColor, "w-28 h-20")}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white tracking-wide">
                                {activeTheme.label}
                              </span>
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border"
                                style={{
                                  color: activeTheme.accentColor,
                                  borderColor: `${activeTheme.accentColor}40`,
                                  backgroundColor: `${activeTheme.accentColor}15`,
                                }}
                              >
                                Tema ativo
                              </span>
                            </div>
                            <p className="text-[11.5px] text-white/50 leading-relaxed">
                              {activeTheme.hint}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 relative z-10 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={onPreviewSound}
                            onMouseEnter={() => playSound("hover")}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/10 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                          >
                            <Volume2 className="h-3.5 w-3.5 text-white/70" />
                            <span>Ouvir amostra de som</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <SettingsRow
                    title={t("gameBootIntro")}
                    description={t("gameBootIntroHint")}
                    action={
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={gameBootIntroEnabled}
                          onCheckedChange={(val) => {
                            setGameBootIntroEnabled(val);
                            if (!val) setGameBootIntroSoundEnabled(false);
                          }}
                        />
                        <span className="text-[11.5px] text-white/50 w-16 select-none">
                          {gameBootIntroEnabled ? t("enabled") : t("disabled")}
                        </span>
                      </div>
                    }
                  />

                  <SettingsRow
                    title={t("gameBootIntroSound")}
                    description={
                      gameBootIntroEnabled
                        ? t("gameBootIntroSoundHint")
                        : "Requer a animação de abertura ativada para reprodução."
                    }
                    className={!gameBootIntroEnabled ? "opacity-50" : ""}
                    action={
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={gameBootIntroEnabled && gameBootIntroSoundEnabled}
                          disabled={!gameBootIntroEnabled}
                          onCheckedChange={setGameBootIntroSoundEnabled}
                        />
                        <span className="text-[11.5px] text-white/50 w-16 select-none">
                          {gameBootIntroEnabled && gameBootIntroSoundEnabled ? t("enabled") : t("disabled")}
                        </span>
                      </div>
                    }
                  />
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Volume2 className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.audioTitle}</h2>
                  </div>

                  <SettingsRow
                    title={t("soundEffects")}
                    description="Efeitos de clique e navegação nos menus"
                    action={
                      <button
                        type="button"
                        onClick={onPreviewSound}
                        className="text-[11px] bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl text-white font-medium transition-colors cursor-pointer"
                      >
                        {t("test")}
                      </button>
                    }
                  >
                    <ElasticSlider
                      value={effectsVolume}
                      onChange={onEffectsVolumeChange}
                      startingValue={0}
                      maxValue={100}
                      className="w-full max-w-[340px]"
                    />
                  </SettingsRow>

                  <SettingsRow
                    title={t("achievementSound")}
                    description="Notificação sonora ao desbloquear um marco ou conquista"
                    action={
                      <button
                        type="button"
                        onClick={() => onTestOverlayAchievement()}
                        onMouseEnter={() => playSound("hover")}
                        className="text-[11px] bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl text-white font-medium transition-colors cursor-pointer"
                      >
                        {t("test")}
                      </button>
                    }
                  >
                    <ElasticSlider
                      value={achievementVolume}
                      onChange={onAchievementVolumeChange}
                      startingValue={0}
                      maxValue={100}
                      className="w-full max-w-[340px]"
                    />
                  </SettingsRow>

                  <SettingsRow
                    title={t("notificationSound")}
                    description="Sons para alertas gerais e mensagens recebidas"
                    action={
                      <button
                        type="button"
                        onClick={onTestNotificationSound}
                        className="text-[11px] bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl text-white font-medium transition-colors cursor-pointer"
                      >
                        {t("test")}
                      </button>
                    }
                  >
                    <ElasticSlider
                      value={notificationVolume}
                      onChange={onNotificationVolumeChange}
                      startingValue={0}
                      maxValue={100}
                      className="w-full max-w-[340px]"
                    />
                  </SettingsRow>

                  <SettingsRow
                    title={t("music")}
                    description="Música de fundo ambiente nas páginas do launcher"
                    hasBorder={false}
                  >
                    <ElasticSlider
                      value={musicVolume}
                      onChange={onMusicVolumeChange}
                      startingValue={0}
                      maxValue={35}
                      className="w-full max-w-[340px]"
                    />
                  </SettingsRow>
                </section>
              </div>
            )}

            {/* ABA DESEMPENHO */}
            {activeTab === "performance" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Gauge className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.performance}</h2>
                  </div>
                  <div className="mb-6 flex items-center gap-2">
                    {([
                      { id: "general" as const, label: perfCopy.general },
                      { id: "monitor" as const, label: perfCopy.monitor },
                    ]).map((tab) => {
                      const isActive = perfSubTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setPerfSubTab(tab.id);
                            playSound("hover");
                          }}
                          className={`rounded-[var(--radius-control)] px-3.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer border ${
                            isActive
                              ? "bg-[var(--selection-bg)] text-[var(--selection-text)] border-[var(--selection-border)] shadow-sm"
                              : "bg-transparent text-white/55 border-transparent hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {perfSubTab === "general" && (
                    <SettingsRow title={detailCopy.performanceTitle} hasBorder={false}>
                      <p className="mb-3 text-[11px] leading-relaxed text-white/40">{detailCopy.performanceHint}</p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {([
                          ["quality", "Qualidade"],
                          ["balanced", "Equilíbrio"],
                          ["performance", "Desempenho"],
                        ] as const).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPerformanceTier(id)}
                            className={`rounded-[var(--radius-control)] px-3 py-1.5 text-[12px] font-semibold border cursor-pointer ${
                              performanceTier === id
                                ? "bg-[var(--selection-bg)] text-[var(--selection-text)] border-[var(--selection-border)]"
                                : "border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={lowPerformanceMode} onCheckedChange={setLowPerformanceMode} />
                        <span className="text-[12px] text-white/50 w-16">{lowPerformanceMode ? t("enabled") : t("disabled")}</span>
                      </div>
                    </SettingsRow>
                  )}

                  {perfSubTab === "monitor" && (
                    <div className="space-y-4">
                      <SettingsRow title={perfCopy.hudTitle} hasBorder={false}>
                        <p className="mb-3 text-[11px] leading-relaxed text-white/40">{perfCopy.hudHint}</p>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={perfHud.enabled}
                            onCheckedChange={(next) => {
                              void saveOverlayPrefs({ perfMonitor: next });
                            }}
                          />
                          <span className="text-[12px] text-white/50 w-16">{perfHud.enabled ? t("enabled") : t("disabled")}</span>
                        </div>
                      </SettingsRow>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[12px] font-semibold text-white">{perfCopy.liveTitle}</p>
                        <p className="mt-1 text-[11px] text-white/40">{perfCopy.liveHint}</p>
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          {[
                            { label: "FPS", value: String(Math.round(perfHud.fps)) },
                            { label: "CPU", value: `${Math.round(perfHud.cpu)}%` },
                            {
                              label: "RAM",
                              value: `${Math.round(perfHud.ramPercent)}%`,
                              hint: `${formatRamGb(perfHud.ramUsed)} / ${formatRamGb(perfHud.ramTotal)}`,
                            },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-xl border border-white/8 bg-black/30 px-3 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{stat.label}</p>
                              <p className="mt-1 text-lg font-black text-white tabular-nums">{stat.value}</p>
                              {"hint" in stat && stat.hint ? (
                                <p className="mt-0.5 text-[10px] text-white/35">{stat.hint}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ABA CONTA */}
            {activeTab === "account" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <User className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.account}</h2>
                  </div>

                  {/* Bloco alinhado unificado: avatar, nome e e-mail */}
                  <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-md">
                        {userProfile?.photoURL || user?.photoURL ? (
                          <img
                            src={userProfile?.photoURL || user?.photoURL || ""}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-white/10 text-white/60 font-bold text-base">
                            {(userProfile?.displayName || user?.displayName || "P")[0].toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-black" title="Sessão ativa" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-white tracking-tight truncate">
                            {userProfile?.displayName || user?.displayName || detailCopy.playerFallback}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/80 border border-white/10">
                            Phelierium ID
                          </span>
                        </div>
                        <p className="text-[12px] text-white/50 truncate">
                          {user?.email || detailCopy.noEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsLogoutModalOpen(true)}
                        className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[12px] font-medium transition-colors cursor-pointer active:scale-95 flex items-center gap-1.5"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sair da conta</span>
                      </button>
                    </div>
                  </div>
                </section>

                <div className="h-px w-full bg-white/[0.06]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <ShieldCheck className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.security}</h2>
                  </div>

                  <SettingsRow
                    title={detailCopy.resetPassword}
                    description="Enviaremos um link de recuperação e segurança para seu e-mail cadastrado"
                    action={
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={isResettingPassword || !user?.email || passwordResetSent}
                        className="px-3.5 py-1.5 bg-[var(--color-surface)] hover:bg-[#222222] border border-white/10 rounded-xl text-[12px] font-medium text-white transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        {passwordResetSent ? detailCopy.emailSent : isResettingPassword ? detailCopy.sending : detailCopy.sendEmail}
                      </button>
                    }
                  />

                  <SettingsRow
                    title={shellCopy.encrypted}
                    description="Token de acesso assinado e verificado localmente com criptografia de transporte TLS 1.3"
                    hasBorder={false}
                    action={
                      <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-[11.5px] font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Token ativo</span>
                      </div>
                    }
                  />
                </section>
              </div>
            )}

            {/* ABA CONEXÕES (CONEXÕES E PRIVACIDADE) */}
            {activeTab === "connections" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Globe className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{t("connectedAccounts")}</h2>
                  </div>

                  {/* Steam: Plataforma -> Identidade Vinculada -> Estado -> Ação */}
                  <SettingsRow
                    icon={<SteamIcon className="h-5 w-5" />}
                    title="Steam"
                    description={
                      steamConnected
                        ? (userProfile?.steamUsername
                            ? `@${userProfile.steamUsername}`
                            : userProfile?.steamId
                            ? `Steam ID: ${userProfile.steamId}`
                            : "Conta vinculada e sincronizada")
                        : "Nenhuma conta vinculada"
                    }
                    action={
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          steamDisconnecting
                            ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                            : steamConnected
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-white/5 text-white/40 border-white/10"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            steamDisconnecting ? "bg-yellow-400 animate-pulse" : steamConnected ? "bg-emerald-400" : "bg-white/30"
                          }`} />
                          {steamDisconnecting ? "Desconectando..." : steamConnected ? t("connected") : t("notConnected")}
                        </span>

                        {steamConnected ? (
                          <button
                            onClick={onDisconnectSteam}
                            disabled={steamDisconnecting}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
                          >
                            {steamDisconnecting ? "Desconectando..." : t("unlink")}
                          </button>
                        ) : steamConnecting ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl text-[11.5px] text-white/70">
                              <ThinkingOrbLoader size={20} preset="connecting" />
                              <span className="t-shimmer" data-text={t("connecting")}>{t("connecting")}</span>
                            </span>
                            {onCancelSteamConnect && (
                              <button
                                type="button"
                                onClick={onCancelSteamConnect}
                                className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 rounded-xl text-[11px] font-medium transition-colors active:scale-95 cursor-pointer"
                                title="Cancelar tentativa de conexão"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={onConnectSteam}
                            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors active:scale-95 cursor-pointer"
                          >
                            {t("connectSteam")}
                          </button>
                        )}
                      </div>
                    }
                  />

                  {/* Discord: Plataforma -> Identidade Vinculada -> Estado -> Ação */}
                  <SettingsRow
                    icon={<DiscordIcon className="h-5 w-5" />}
                    title="Discord"
                    description={
                      discordConnected
                        ? (discordUsername || userProfile?.discordUsername
                            ? `@${discordUsername || userProfile?.discordUsername}`
                            : "Conta vinculada e sincronizada")
                        : "Nenhuma conta vinculada"
                    }
                    action={
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          discordDisconnecting
                            ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                            : discordConnected
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-white/5 text-white/40 border-white/10"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            discordDisconnecting ? "bg-yellow-400 animate-pulse" : discordConnected ? "bg-emerald-400" : "bg-white/30"
                          }`} />
                          {discordDisconnecting ? "Desconectando..." : discordConnected ? t("connected") : t("notConnected")}
                        </span>

                        {discordConnected ? (
                          <button
                            onClick={onDisconnectDiscord}
                            disabled={discordDisconnecting}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
                          >
                            {discordDisconnecting ? "Desconectando..." : t("unlink")}
                          </button>
                        ) : discordConnecting ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl text-[11.5px] text-white/70">
                              <LinearProgress className="w-10" label={t("connecting")} />
                              <span className="t-shimmer" data-text={t("connecting")}>{t("connecting")}</span>
                            </span>
                            {onCancelDiscordConnect && (
                              <button
                                type="button"
                                onClick={onCancelDiscordConnect}
                                className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 rounded-xl text-[11px] font-medium transition-colors active:scale-95 cursor-pointer"
                                title="Cancelar tentativa de conexão"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={onConnectDiscord}
                            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors active:scale-95 cursor-pointer"
                          >
                            {t("connectDiscord")}
                          </button>
                        )}
                      </div>
                    }
                  />

                  {/* Epic Games: Plataforma -> Identidade Vinculada -> Estado -> Ação */}
                  <SettingsRow
                    icon={<EpicIcon className="h-5 w-5" />}
                    title="Epic Games"
                    description={
                      epicConnected
                        ? (epicDisplayName
                            ? `@${epicDisplayName}`
                            : "Conta vinculada e sincronizada")
                        : "Nenhuma conta vinculada"
                    }
                    hasBorder={false}
                    action={
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          epicDisconnecting
                            ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                            : epicConnected
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-white/5 text-white/40 border-white/10"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            epicDisconnecting ? "bg-yellow-400 animate-pulse" : epicConnected ? "bg-emerald-400" : "bg-white/30"
                          }`} />
                          {epicDisconnecting ? "Desconectando..." : epicConnected ? t("connected") : t("notConnected")}
                        </span>

                        {epicConnected ? (
                          <button
                            onClick={onDisconnectEpic}
                            disabled={epicDisconnecting}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
                          >
                            {epicDisconnecting ? "Desconectando..." : t("unlink")}
                          </button>
                        ) : (
                          <button
                            onClick={onConnectEpic}
                            disabled={epicConnecting}
                            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
                          >
                            {epicConnecting ? (
                              <span className="flex items-center gap-2">
                                <ThinkingOrbLoader size={20} preset="connecting" />
                                <span className="t-shimmer" data-text={t("connecting")}>{t("connecting")}</span>
                              </span>
                            ) : t("connectEpic")}
                          </button>
                        )}
                      </div>
                    }
                  />
                </section>

                <div className="h-px w-full bg-white/[0.06]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <ShieldCheck className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.privacy}</h2>
                  </div>
                  <SettingsRow
                    title={t("profileVisibility")}
                    description={
                      profileVisibility === "public"
                        ? "Qualquer jogador na comunidade pode visualizar seu avatar, biografia, jogos recentes, tempo de jogo e conquistas desbloqueadas. E-mail e credenciais permanecem sempre privados."
                        : "Seus jogos, horas de jogo, histórico recente e conquistas ficam visíveis apenas para você e seus amigos aprovados. Usuários desconhecidos só verão seu nome de exibição e avatar."
                    }
                    hasBorder={false}
                    action={
                      <SettingsSelect
                        value={profileVisibility}
                        onChange={(v) => handleProfileVisibilityChange(v as ProfileVisibility)}
                        options={[
                          { value: "public", label: shellCopy.public },
                          { value: "private", label: shellCopy.private },
                        ]}
                        className="w-[180px]"
                      />
                    }
                  >
                    {privacyStatus === "saving" && (
                      <span className="text-[11px] text-white/50">{shellCopy.saving}</span>
                    )}
                    {privacyStatus === "saved" && (
                      <span className="text-[11px] text-emerald-400 font-medium">{shellCopy.saved}</span>
                    )}
                    {privacyStatus === "error" && (
                      <span className="text-[11px] text-red-400">{privacyError}</span>
                    )}
                  </SettingsRow>
                </section>
              </div>
            )}

            {/* ABA CONTROLE (CONTROLES E DISPOSITIVOS) */}
            {activeTab === "controller" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Gamepad2 className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{controllerCopy[0]}</h2>
                  </div>

                  {/* Status do controle */}
                  <SettingsRow
                    title={t("controllerStatus")}
                    description={
                      isGamepadConnected
                        ? (connectedGamepadId
                            ? `Dispositivo ativo: ${connectedGamepadId}`
                            : "Controle detectado e mapeado para navegação fluida no launcher")
                        : "Nenhum controle detectado via USB ou Bluetooth"
                    }
                    action={
                      <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-xl border transition-colors ${
                        isGamepadConnected
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                          : "bg-[var(--color-surface)] text-white/50 border-white/10"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isGamepadConnected ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                        {isGamepadConnected ? controllerCopy[1] : t("disconnected")}
                      </span>
                    }
                  />

                  {/* Nível de bateria */}
                  <SettingsRow
                    title={t("batteryLevel")}
                    description={
                      !isGamepadConnected
                        ? "Conecte um controle para monitorar a autonomia e status de carregamento"
                        : batteryLevel === null
                        ? "Bateria não informada pelo dispositivo ou driver conectado"
                        : batteryCharging
                        ? "Controle conectado via cabo e em processo de carregamento"
                        : "Nível de bateria reportado pelo driver em tempo real"
                    }
                    action={
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12px] font-medium text-white/70 tabular-nums">
                          {!isGamepadConnected ? (
                            <span className="text-white/45 italic">Conecte um controle</span>
                          ) : batteryLevel !== null ? (
                            `${batteryLevel}%`
                          ) : (
                            <span className="text-white/50">Não informada</span>
                          )}
                        </span>
                        {batteryCharging && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] uppercase font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {t("charging")}
                          </span>
                        )}
                        {batteryLevel !== null && batteryLevel <= 20 && !batteryCharging && isGamepadConnected && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] uppercase font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                            {t("lowBattery")}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowControllerStatusModal(true)}
                          className="px-2.5 py-1 bg-[var(--color-surface)] hover:bg-[#222222] border border-white/10 text-white rounded-lg text-[11.5px] font-medium transition-colors ml-1 active:scale-95 cursor-pointer"
                        >
                          {t("details")}
                        </button>
                      </div>
                    }
                  />

                  {/* Barra de LED */}
                  <SettingsRow
                    title={t("playstationLed")}
                    description="Compatível com controles DualSense (PS5) e DualShock 4 (PS4) via cabo USB. A autorização via WebHID permite ao launcher sincronizar a barra de luz com os temas ativos e alertas de conquistas."
                    action={
                      led.status === "unsupported" ? (
                        <span className="text-[11.5px] text-white/40">WebHID não suportado</span>
                      ) : (
                        <button
                          type="button"
                          onClick={led.status === "connected" ? led.testLed : led.requestAccess}
                          disabled={led.status === "connecting"}
                          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                          {led.status === "connected" ? controllerCopy[4] : led.status === "connecting" ? "..." : controllerCopy[5]}
                        </button>
                      )
                    }
                  />

                  {/* Resposta tátil / Vibração */}
                  <SettingsRow
                    title={t("hapticsEnabled")}
                    description="Vibração tátil em navegação e ações no hub. A preferência será aplicada automaticamente quando um controle compatível estiver conectado."
                    hasBorder={false}
                    action={
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { try { playHapticPattern("action"); } catch { } }}
                          className="text-white/50 hover:text-white p-1 transition-colors cursor-pointer"
                          title="Testar pulso de vibração"
                        >
                          <Vibrate className="h-4 w-4" />
                        </button>
                        <Switch
                          checked={hapticsEnabled}
                          onCheckedChange={(v) => {
                            setHapticsEnabled(v);
                            if (v) try { playHapticPattern("action"); } catch { }
                          }}
                        />
                        <span className="text-[12px] text-white/50 w-16">{hapticsEnabled ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />
                </section>
              </div>
            )}

            {/* ABA VOZ & VÍDEO */}
            {activeTab === "voice" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Mic className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{voiceCopy.ioTitle}</h2>
                  </div>

                  <SettingsRow
                    title={voiceCopy.audioInput}
                    description="Dispositivo principal de captura para canais de voz e chamadas em grupo"
                    action={
                      <SettingsSelect
                        value={voiceCallContext?.selectedAudioInput || "default"}
                        onChange={(v) => voiceCallContext?.changeAudioInputDevice(v)}
                        options={[
                          { value: "default", label: voiceCopy.defaultSystem },
                          ...(voiceCallContext?.audioInputDevices.map((d) => ({
                            value: d.deviceId,
                            label: d.label || `Microfone (${d.deviceId.slice(0, 8)}...)`,
                          })) || []),
                        ]}
                        className="w-full sm:w-[280px] md:w-[320px]"
                      />
                    }
                  />

                  <SettingsRow
                    title={voiceCopy.micMonitor}
                    description="Retorno imediato da própria voz nos fones para calibrar volume e ruído ambiente"
                    action={
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={Boolean(voiceCallContext?.isMicMonitoring)}
                          onCheckedChange={(v) => voiceCallContext?.setIsMicMonitoring(v)}
                        />
                        <span className="text-[12px] text-white/50 w-16">{voiceCallContext?.isMicMonitoring ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />

                  {/* Teste de microfone com VU Meter proeminente e estados explícitos */}
                  <SettingsRow
                    title={voiceCopy.micTesting}
                    description="Fale no microfone para testar o nível de captação e verificar a resposta sonora em tempo real"
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setIsTestingMic(!isTestingMic);
                          playSound("hover");
                        }}
                        className={`px-3.5 py-1.5 text-[12px] rounded-xl font-medium transition-all cursor-pointer active:scale-95 flex items-center gap-2 ${
                          isTestingMic
                            ? "bg-red-500/15 text-red-300 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                            : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${isTestingMic ? "bg-red-400 animate-pulse" : "bg-white/40"}`} />
                        {isTestingMic ? voiceCopy.stop : voiceCopy.test}
                      </button>
                    }
                  >
                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/40 space-y-2.5">
                      <div className="flex items-center justify-between text-[11.5px]">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">Estado do sinal:</span>
                          {micPermissionError ? (
                            <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              Permissão necessária no sistema operacional
                            </span>
                          ) : !isTestingMic ? (
                            <span className="inline-flex items-center gap-1.5 text-white/40">
                              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                              Inativo
                            </span>
                          ) : testMicVolume > 4 ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Sinal detectado ({testMicVolume}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Aguardando sinal sonoro...
                            </span>
                          )}
                        </div>
                        <span className="text-white/40 font-mono text-[11px] tabular-nums">
                          {isTestingMic ? `${testMicVolume}%` : "--"}
                        </span>
                      </div>

                      {/* Barra visual do medidor VU com gradiente dinâmico */}
                      <div className="relative h-2.5 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-75 ease-out"
                          style={{
                            width: `${testMicVolume}%`,
                            background: "linear-gradient(90deg, #10b981 0%, #34d399 60%, #eab308 85%, #ef4444 100%)",
                            boxShadow: testMicVolume > 0 ? "0 0 10px rgba(16,185,129,0.35)" : "none",
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-white/30 font-medium px-0.5">
                        <span>Silêncio</span>
                        <span>Nível ideal</span>
                        <span>Pico</span>
                      </div>
                    </div>
                  </SettingsRow>

                  <SettingsRow
                    title={voiceCopy.audioOutput}
                    description="Dispositivo para reprodução do áudio de chamadas e notificações do launcher"
                    action={
                      <SettingsSelect
                        value={voiceCallContext?.selectedAudioOutput || "default"}
                        onChange={(v) => voiceCallContext?.changeAudioOutputDevice(v)}
                        options={[
                          { value: "default", label: voiceCopy.defaultSystem },
                          ...(voiceCallContext?.audioOutputDevices.map((d) => ({
                            value: d.deviceId,
                            label: d.label || `Alto-falante (${d.deviceId.slice(0, 8)}...)`,
                          })) || []),
                        ]}
                        className="w-full sm:w-[280px] md:w-[320px]"
                      />
                    }
                  />

                  <SettingsRow
                    title={voiceCopy.camera}
                    description="Dispositivo de vídeo utilizado nas chamadas de canal do Phelierium"
                    hasBorder={false}
                    action={
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsVideoPreviewOn(!isVideoPreviewOn)}
                          className={`px-3 py-1.5 border rounded-xl text-[12px] font-medium transition-all cursor-pointer active:scale-95 ${
                            isVideoPreviewOn
                              ? "bg-white text-black border-white shadow-sm"
                              : "bg-[var(--color-surface)] hover:bg-[#222222] border-white/10 text-white"
                          }`}
                        >
                          {isVideoPreviewOn ? "Ocultar câmera" : voiceCopy.preview}
                        </button>
                        <SettingsSelect
                          value={voiceCallContext?.selectedVideoInput || "default"}
                          onChange={(v) => voiceCallContext?.changeVideoInputDevice(v)}
                          options={[
                            { value: "default", label: voiceCopy.defaultSystem },
                            ...(voiceCallContext?.videoInputDevices.map((d) => ({
                              value: d.deviceId,
                              label: d.label || `Câmera (${d.deviceId.slice(0, 8)}...)`,
                            })) || []),
                          ]}
                          className="w-full sm:w-[200px] md:w-[240px]"
                        />
                      </div>
                    }
                  >
                    {isVideoPreviewOn && (
                      <div className="relative w-full aspect-video rounded-2xl bg-black overflow-hidden border border-white/15 shadow-xl mt-3">
                        <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Pré-visualização ativa</span>
                        </div>
                      </div>
                    )}
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-white/[0.06]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <SlidersHorizontal className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{voiceCopy.processingTitle}</h2>
                  </div>

                  <SettingsRow
                    title={voiceCopy.noiseSuppression}
                    description="Krisp (LiveKit) isola a voz com IA. RNNoise e nativo são alternativas locais."
                    action={
                      <SettingsSelect
                        value={voiceCallContext?.noiseSuppressionMode ?? (voiceCallContext?.advancedNoiseSuppression ? "rnnoise" : voiceCallContext?.noiseSuppression ? "native" : "none")}
                        onChange={(val) => {
                          const mode = val as "none" | "native" | "rnnoise" | "krisp";
                          void voiceCallContext?.setNoiseSuppressionMode?.(mode);
                        }}
                        options={[
                          { value: "krisp", label: "Krisp (LiveKit IA)" },
                          { value: "rnnoise", label: voiceCopy.aiIsolation },
                          { value: "native", label: voiceCopy.standardNative },
                          { value: "none", label: voiceCopy.raw },
                        ]}
                        className="w-full sm:w-[260px] md:w-[300px]"
                      />
                    }
                  />

                  <SettingsRow
                    title={voiceCopy.voiceSensitivity}
                    description="Limiar de volume para abertura automática da captação de voz"
                    action={
                      <span className="text-[12px] text-white/50 tabular-nums font-semibold">
                        {voiceCallContext?.voiceSensitivity ?? 35}%
                      </span>
                    }
                  >
                    <ElasticSlider
                      value={voiceCallContext?.voiceSensitivity ?? 35}
                      onChange={(val) => voiceCallContext?.setVoiceSensitivity(val)}
                      startingValue={0}
                      maxValue={100}
                      leftIcon={<MicOff className="h-3.5 w-3.5" />}
                      rightIcon={<Mic className="h-3.5 w-3.5" />}
                      className="w-full max-w-[340px]"
                    />
                  </SettingsRow>

                  <SettingsRow
                    title={voiceCopy.echoCancellation}
                    description="Elimina retorno acústico em caixas de som e fones de ouvido vazados"
                    action={
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={voiceCallContext?.echoCancellation ?? true}
                          onCheckedChange={(checked) => voiceCallContext?.setEchoCancellation(checked)}
                        />
                        <span className="text-[12px] text-white/50 w-16">{(voiceCallContext?.echoCancellation ?? true) ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />

                  <SettingsRow
                    title={voiceCopy.inputMode}
                    description="Escolha entre transmissão contínua com detecção de voz ou atalho manual"
                    hasBorder={false}
                    action={
                      <SettingsSelect
                        value={voiceCallContext?.inputMode || 'voice-activity'}
                        onChange={(v) => voiceCallContext?.setInputMode(v as "voice-activity" | "push-to-talk")}
                        options={[
                          { value: "voice-activity", label: voiceCopy.voiceActivity },
                          { value: "push-to-talk", label: voiceCopy.pushToTalk },
                        ]}
                        className="w-full sm:w-[200px] md:w-[240px]"
                      />
                    }
                  />

                  {voiceCallContext?.inputMode === "push-to-talk" && (
                    <SettingsRow
                      title={voiceCopy.pttKeybind}
                      description="Pressione para configurar o atalho de ativação da voz"
                      hasBorder={false}
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setIsRecordingPttKey(true);
                            const onKey = (e: KeyboardEvent) => {
                              e.preventDefault(); e.stopPropagation();
                              voiceCallContext?.setPushToTalkKey(e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key);
                              setIsRecordingPttKey(false);
                              window.removeEventListener("keydown", onKey, true);
                            };
                            window.addEventListener("keydown", onKey, true);
                          }}
                          className={`min-w-[80px] px-3 py-1.5 rounded-xl border text-[12px] font-mono font-medium transition-colors ${isRecordingPttKey ? "bg-amber-500/20 text-amber-300 border-amber-500" : "bg-white/10 text-white border-white/15"}`}
                        >
                          {isRecordingPttKey ? "Pressione..." : voiceCallContext?.pushToTalkKey || "F8"}
                        </button>
                      }
                    />
                  )}
                </section>

                <div className="h-px w-full bg-white/[0.06]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Phone className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{voiceCopy.callOverlayTitle}</h2>
                  </div>

                  <SettingsRow
                    title={voiceCopy.callOverlayTitle}
                    description={voiceCopy.callOverlayHint}
                    hasBorder={false}
                    action={
                      <div className="flex items-center gap-3">
                        <Switch checked={callOverlayEnabled} onCheckedChange={setCallOverlayEnabled} />
                        <span className="text-[12px] text-white/50 w-16">{callOverlayEnabled ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />
                </section>
              </div>
            )}

            {/* ABA NOTIFICAÇÕES & OVERLAY */}
            {activeTab === "notifications" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Bell className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{achievementNotificationCopy.title}</h2>
                  </div>

                  <SettingsRow
                    title={achievementNotificationCopy.enabled}
                    description="Exibe notificações visuais no canto da tela ao desbloquear conquistas em jogos"
                    action={
                      <div className="flex items-center gap-3">
                        <Switch checked={achievementNotificationsEnabled} onCheckedChange={setAchievementNotificationsEnabled} />
                        <span className="text-[12px] text-white/50 w-16">{achievementNotificationsEnabled ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />

                  <SettingsRow
                    title={achievementNotificationCopy.custom}
                    description="Utiliza o card com design e efeitos sonoros customizados do Phelierium"
                    action={
                      <div className="flex items-center gap-3">
                        <Switch checked={customAchievementNotifications} disabled={!achievementNotificationsEnabled} onCheckedChange={setCustomAchievementNotifications} />
                        <span className="text-[12px] text-white/50 w-16">{customAchievementNotifications ? t("enabled") : t("disabled")}</span>
                      </div>
                    }
                  />

                  <SettingsRow
                    title={t("position")}
                    description="Posicionamento do card de conquista sobreposto à tela do jogo"
                    hasBorder={false}
                    action={
                      <SettingsSelect
                        value={achievementNotificationPosition}
                        disabled={!achievementNotificationsEnabled || !customAchievementNotifications}
                        onChange={(pos) => setAchievementNotificationPosition(pos as any)}
                        options={ACHIEVEMENT_POSITIONS.map((pos, idx) => ({
                          value: pos,
                          label: achievementNotificationCopy.positions[idx] || pos,
                        }))}
                        className="w-[180px]"
                      />
                    }
                  />
                </section>

                <div className="h-px w-full bg-white/[0.06]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Sparkles className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.overlayLab}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={onTestOverlayWelcome}
                      onMouseEnter={() => playSound("hover")}
                      className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-white">{detailCopy.testWelcome}</span>
                      <span className="block text-[11px] text-white/40 mt-0.5">{detailCopy.testWelcomeHint}</span>
                    </button>
                    <button
                      onClick={() => onTestOverlayAchievement("bronze")}
                      onMouseEnter={() => playSound("hover")}
                      className="p-3.5 bg-amber-700/10 hover:bg-amber-700/20 border border-amber-600/30 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-amber-500">{detailCopy.testBronze}</span>
                      <span className="block text-[11px] text-amber-500/50 mt-0.5">{detailCopy.testBronzeHint}</span>
                    </button>
                    <button
                      onClick={() => onTestOverlayAchievement("silver")}
                      onMouseEnter={() => playSound("hover")}
                      className="p-3.5 bg-slate-300/10 hover:bg-slate-300/20 border border-slate-300/25 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-slate-300">{detailCopy.testSilver}</span>
                      <span className="block text-[11px] text-slate-300/50 mt-0.5">{detailCopy.testSilverHint}</span>
                    </button>
                    <button
                      onClick={() => onTestOverlayAchievement("gold")}
                      onMouseEnter={() => playSound("hover")}
                      className="p-3.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-400/35 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-yellow-400">{detailCopy.testGold}</span>
                      <span className="block text-[11px] text-yellow-400/50 mt-0.5">{detailCopy.testGoldHint}</span>
                    </button>
                    <button
                      onClick={() => onTestOverlayAchievement("platinum")}
                      onMouseEnter={() => playSound("hover")}
                      className="p-3.5 col-span-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-sky-300">{detailCopy.testPlatinum}</span>
                      <span className="block text-[11px] text-sky-300/50 mt-0.5">{detailCopy.testPlatinumHint}</span>
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* ABA MASCOTE (PHERIE) */}
            {activeTab === "mascot" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Sparkles className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{(shellCopy as any).mascot || "Mascote e Notch"}</h2>
                  </div>

                  <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-white/[0.06]">
                        <h3 className="text-white text-[14px] font-semibold mb-2">Conheça o Pherie</h3>
                        <p className="text-[12px] text-white/50 leading-relaxed mb-4">
                          O Pherie é o mascote que habita a sua Notch. Ele reage ao que você está fazendo,
                          como ouvir música, jogar ou falar em uma chamada, de forma animada e orgânica!
                        </p>
                        
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {["#FFFFFF", "#10B981", "#3B82F6", "#8B5CF6", "#F43F5E", "#F59E0B"].map(color => (
                            <button
                              key={color}
                              onClick={() => { setMascotColor(color); playSound("hover"); }}
                              className={cn(
                                "h-8 w-8 rounded-full border-2 transition-all cursor-pointer",
                                mascotColor === color ? "border-white scale-110 shadow-lg shadow-white/10" : "border-transparent hover:scale-105"
                              )}
                              style={{ backgroundColor: color }}
                              title={`Cor: ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="p-6 md:w-1/2 flex items-center justify-center bg-black/20">
                        <div
                          className="relative shrink-0 w-[100px] h-[100px] rounded-[28px] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.12] shadow-inner flex items-center justify-center overflow-hidden cursor-pointer"
                          onMouseEnter={() => setMascotPreviewHovered(true)}
                          onMouseLeave={() => setMascotPreviewHovered(false)}
                        >
                           {/* Brilho dinâmico na cor do mascote */}
                           <div className="absolute inset-0 rounded-[28px] blur-[16px] -z-10 opacity-30" style={{ backgroundColor: mascotColor }} />
                            <PherieMascot
                              size={72}
                              mood={mascotPreviewHovered ? "happy" : mascotPreviewMood}
                              isHovered={mascotPreviewHovered}
                              color={mascotColor}
                            />
                           </div>
                         </div>
                       </div>
                     </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
                    <h3 className="text-white text-[14px] font-semibold mb-2">Expressões do Pherie</h3>
                    <p className="text-[12px] text-white/50 leading-relaxed mb-4">
                      Clique em uma expressão para aplicar no mascote da Notch. Passe o mouse sobre o Pherie para animá-lo.
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      <button
                        type="button"
                        onClick={() => { setMascotPreviewMood("idle"); setMascotBaseMood(null); setMascotAppliedMood(null); playSound("hover"); }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all cursor-pointer",
                          mascotAppliedMood === null
                            ? "border-white/40 bg-white/[0.08]"
                            : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:scale-[1.03]"
                        )}
                        title="Automático"
                      >
                        <span className="text-lg leading-none">✨</span>
                        <span className="text-[10px] font-medium text-white/60 leading-none">Automático</span>
                      </button>
                      {MASCOT_MOODS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => { setMascotPreviewMood(id); setMascotBaseMood(id); setMascotAppliedMood(id); playSound("hover"); }}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all cursor-pointer",
                            mascotAppliedMood === id
                              ? "border-white/40 bg-white/[0.08]"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:scale-[1.03]"
                          )}
                          title={label}
                        >
                          <PherieMascot size={40} mood={id} color={mascotColor} />
                          <span className="text-[10px] font-medium text-white/60 leading-none">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Sobreposto para Controller Status */}
      <AnimatePresence>
        {showControllerStatusModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 "
          >
            <div
              className="border border-[var(--color-ui-detail)] rounded-2xl p-6 w-[320px] shadow-2xl  transform-gpu"
              style={{
                background: "linear-gradient(145deg, rgba(20,20,24,0.7) 0%, rgba(10,10,14,0.85) 100%)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.06)",
              }}
            >
              <h3 className="text-white font-semibold mb-4">{diagnosticsCopy.title}</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/50">{diagnosticsCopy.connection}</span>
                  <span className="text-white">{isGamepadConnected ? (connectedGamepadId?.toLowerCase().includes("bluetooth") ? "Bluetooth" : "USB") : "--"}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/50">{diagnosticsCopy.battery}</span>
                  <span className="text-white">{batteryLevel !== null ? `${batteryLevel}%` : diagnosticsCopy.unknown}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/50">{diagnosticsCopy.family}</span>
                  <span className="text-white capitalize">{gamepadFamily}</span>
                </div>
              </div>
              <button onClick={() => setShowControllerStatusModal(false)} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[13px] font-medium transition-colors cursor-pointer active:scale-98">
                {diagnosticsCopy.close}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        variant="logout"
        title="Sair da Conta"
        description="Você será desconectado e voltará para a tela de login."
        confirmLabel="Sim, sair"
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={async () => {
          setIsLogoutModalOpen(false);
          await handleSignOut();
        }}
        playSound={playSound}
      />
    </div>
  );
});

SettingsPageV2.displayName = "SettingsPageV2";
