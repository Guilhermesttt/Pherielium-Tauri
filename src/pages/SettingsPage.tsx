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
import { saveOverlayPrefs } from "../lib/overlayPrefs";
import { formatRamGb, usePerfMonitor } from "../hooks/usePerfMonitor";

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
  "pt-BR": ["Controle", "Controle conectado", "Nenhum controle conectado", "Conecte via USB ou Bluetooth para navegar pelo launcher.", "Testar LED", "Autorizar"],
  "en-US": ["Controller", "Controller connected", "No controller connected", "Connect through USB or Bluetooth to navigate the launcher.", "Test LED", "Authorize"],
  "es-ES": ["Mando", "Mando conectado", "Ningún mando conectado", "Conecta por USB o Bluetooth para navegar por el launcher.", "Probar LED", "Autorizar"],
  "fr-FR": ["Manette", "Manette connectée", "Aucune manette connectée", "Connectez-la en USB ou Bluetooth pour naviguer.", "Tester la LED", "Autoriser"],
  "de-DE": ["Controller", "Controller verbunden", "Kein Controller verbunden", "Über USB oder Bluetooth verbinden, um den Launcher zu steuern.", "LED testen", "Autorisieren"],
  "it-IT": ["Controller", "Controller collegato", "Nessun controller collegato", "Collega tramite USB o Bluetooth per navigare.", "Prova LED", "Autorizza"],
} as const;

const DIAGNOSTICS_COPY = {
  "pt-BR": { title: "Diagnóstico do Controle", connection: "Conexão", battery: "Bateria", family: "Família", close: "Fechar", unknown: "Desconhecida" },
  "en-US": { title: "Controller Diagnostics", connection: "Connection", battery: "Battery", family: "Family", close: "Close", unknown: "Unknown" },
  "es-ES": { title: "Diagnóstico del Mando", connection: "Conexión", battery: "Batería", family: "Familia", close: "Cerrar", unknown: "Desconocida" },
  "fr-FR": { title: "Diagnostic de la Manette", connection: "Connexion", battery: "Batterie", family: "Famille", close: "Fermer", unknown: "Inconnue" },
  "de-DE": { title: "Controller-Diagnose", connection: "Verbindung", battery: "Batterie", family: "Familie", close: "Schließen", unknown: "Unbekannt" },
  "it-IT": { title: "Diagnostica Controller", connection: "Connessione", battery: "Batteria", family: "Famiglia", close: "Chiudi", unknown: "Sconosciuta" },
} as const;

const SETTINGS_SHELL_COPY = {
  "pt-BR": { preferences: "Preferências do Launcher", general: "Geral", personalization: "Personalização", performance: "Desempenho", account: "Conta & Segurança", connections: "Contas & Privacidade", controller: "Controle & Hardware", voice: "Voz & Vídeo", notifications: "Notificações & Overlay", quit: "Sair do Aplicativo", encrypted: "Sessão Encriptada", encryptedHint: "Conexão protegida com token Supabase JWT de alta segurança.", privacy: "Privacidade do Perfil", privacyHint: "Escolha o que outros jogadores podem ver ao encontrar seu perfil.", public: "Perfil Público", publicHint: "Todos podem abrir seus detalhes, jogos e atividade.", private: "Perfil Privado", privateHint: "Somente você e amigos aceitos veem os detalhes.", saving: "Salvando privacidade...", saved: "Privacidade atualizada.", controllerHint: "Status da navegação e iluminação do controle conectado." },
  "en-US": { preferences: "Launcher preferences", general: "General", personalization: "Personalization", performance: "Performance", account: "Account & Security", connections: "Accounts & Privacy", controller: "Controller & Hardware", voice: "Voice & Video", notifications: "Notifications & Overlay", quit: "Quit Application", encrypted: "Encrypted session", encryptedHint: "Connection protected with a secure Supabase JWT.", privacy: "Profile Privacy", privacyHint: "Choose what other players can see when they find your profile.", public: "Public Profile", publicHint: "Anyone can open your details, games, and activity.", private: "Private Profile", privateHint: "Only you and accepted friends can see the details.", saving: "Saving privacy...", saved: "Privacy updated.", controllerHint: "Navigation and lighting status for the connected controller." },
  "es-ES": { preferences: "Preferencias del launcher", general: "General", personalization: "Personalización", performance: "Rendimiento", account: "Cuenta y seguridad", connections: "Cuentas y privacidad", controller: "Mando y hardware", voice: "Voz y vídeo", notifications: "Notificaciones y overlay", quit: "Salir de la aplicación", encrypted: "Sesión cifrada", encryptedHint: "Conexión protegida con un JWT seguro de Supabase.", privacy: "Privacidad del perfil", privacyHint: "Elige qué pueden ver otros jugadores al encontrar tu perfil.", public: "Perfil público", publicHint: "Todos pueden abrir tus detalles, juegos y actividad.", private: "Perfil privado", privateHint: "Solo tú y tus amigos aceptados pueden ver los detalles.", saving: "Guardando privacidad...", saved: "Privacidad actualizada.", controllerHint: "Estado de navegación e iluminación del mando conectado." },
  "fr-FR": { preferences: "Préférences du launcher", general: "Général", personalization: "Personnalisation", performance: "Performances", account: "Compte et sécurité", connections: "Comptes et confidentialité", controller: "Manette et matériel", voice: "Voix & vidéo", notifications: "Notifications et overlay", quit: "Quitter l'application", encrypted: "Session chiffrée", encryptedHint: "Connexion protégée par un JWT Supabase sécurisé.", privacy: "Confidentialité du profil", privacyHint: "Choisissez ce que les autres joueurs voient en trouvant votre profil.", public: "Profil public", publicHint: "Tout le monde peut ouvrir vos détails, jeux et activité.", private: "Profil privé", privateHint: "Seuls vous et vos amis acceptés voyez les détails.", saving: "Enregistrement...", saved: "Confidentialité mise à jour.", controllerHint: "État de navigation et d'éclairage de la manette connectée." },
  "de-DE": { preferences: "Launcher-Einstellungen", general: "Allgemein", personalization: "Personnalierung", performance: "Leistung", account: "Konto und Sicherheit", connections: "Konten und Datenschutz", controller: "Controller und Hardware", voice: "Sprache & Video", notifications: "Benachrichtigungen und Overlay", quit: "Anwendung beenden", encrypted: "Verschlüsselte Sitzung", encryptedHint: "Verbindung durch ein sicheres Supabase-JWT geschützt.", privacy: "Profil-Datenschutz", privacyHint: "Lege fest, was andere Spieler in deinem Profil sehen.", public: "Öffentliches Profil", publicHint: "Alle können Details, Spiele und Aktivitäten öffnen.", private: "Privates Profil", privateHint: "Nur du und bestätigte Freunde sehen die Details.", saving: "Datenschutz wird gespeichert...", saved: "Datenschutz aktualisiert.", controllerHint: "Navigations- und Beleuchtungsstatus des verbundenen Controllers." },
  "it-IT": { preferences: "Preferenze del launcher", general: "Generale", personalization: "Personalizzazione", performance: "Prestazioni", account: "Account e sicurezza", connections: "Account e privacy", controller: "Controller e hardware", voice: "Voce & Video", notifications: "Notifiche e overlay", quit: "Esci dall'applicazione", encrypted: "Sessione crittografata", encryptedHint: "Connessione protetta da un JWT Supabase sicuro.", privacy: "Privacy del profilo", privacyHint: "Scegli cosa possono vedere gli altri giocatori nel tuo profilo.", public: "Profilo pubblico", publicHint: "Tutti possono aprire dettagli, giochi e attività.", private: "Profilo privato", privateHint: "Solo tu e gli amici accettati vedete i dettagli.", saving: "Salvataggio privacy...", saved: "Privacy aggiornata.", controllerHint: "Stato di navigazione e illuminazione del controller collegato." },
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
    preview: "Preview",
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
    pushToTalk: "Push-to-Talk"
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
    pushToTalk: "Push-to-Talk"
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
    pushToTalk: "Pulsar para hablar"
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
    pushToTalk: "Appuyer pour parler"
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
    pushToTalk: "Push-to-Talk"
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
    pushToTalk: "Premi per Parlare"
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
  title: string;
  children: React.ReactNode;
  hasBorder?: boolean;
}> = ({ icon, title, children, hasBorder = true }) => (
  <div className={`py-4 ${hasBorder ? 'border-b border-[var(--color-ui-detail)]' : ''}`}>
    <div className="flex items-center gap-2.5 mb-3.5">
      {icon && <div className="text-white/70">{icon}</div>}
      <span className="text-[13px] font-medium text-white/90 tracking-wide">{title}</span>
    </div>
    <div className="pl-0">
      {children}
    </div>
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
    hint: "Visual limpo e sons originais",
    accentColor: "#ffffff",
    glowColor: "rgba(255, 255, 255, 0.35)",
    soundTheme: "default",
    visualTheme: "phelierium",
  },
  {
    id: "ps5",
    label: "PlayStation 5",
    hint: "Branco futurista + sons PS5",
    accentColor: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.4)",
    soundTheme: "ps5",
    visualTheme: "ps5",
  },
  {
    id: "ps4",
    label: "PlayStation 4",
    hint: "Azul cobalto + sons PS4",
    accentColor: "#2563eb",
    glowColor: "rgba(37, 99, 235, 0.4)",
    soundTheme: "ps4",
    visualTheme: "ps4",
  },
  {
    id: "playstation",
    label: "PlayStation 2",
    hint: "Azul clássico + sons PS2",
    accentColor: "#1d4ed8",
    glowColor: "rgba(29, 78, 216, 0.4)",
    soundTheme: "ps2",
    visualTheme: "playstation",
  },
  {
    id: "psp",
    label: "PSP",
    hint: "Cyan Waves + sons PSP",
    accentColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.4)",
    soundTheme: "psp",
    visualTheme: "psp",
  },
  {
    id: "gamecube",
    label: "GameCube",
    hint: "Roxo Nintendo + sons GameCube",
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.4)",
    soundTheme: "gamecube",
    visualTheme: "gamecube",
  },
  {
    id: "xbox360",
    label: "Xbox",
    hint: "Verde Xbox + sons Metro UI",
    accentColor: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.4)",
    soundTheme: "xbox360",
    visualTheme: "xbox360",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk 2077",
    hint: "Amarelo Neon + sons Cyberpunk 2077",
    accentColor: "#fcee0a",
    glowColor: "rgba(252, 238, 10, 0.45)",
    soundTheme: "cyberpunk",
    visualTheme: "cyberpunk",
  },
];

export const ThemePreviewCard: React.FC<{
  active: boolean;
  label: string;
  accentColor: string;
  glowColor?: string;
  onClick: () => void;
}> = ({ active, label, accentColor, glowColor = "rgba(255,255,255,0.3)", onClick }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={`relative p-1 rounded-2xl transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 ease-out transform-gpu will-change-transform cursor-pointer ${active
          ? "scale-[1.03]"
          : "hover:scale-[1.015] opacity-75 hover:opacity-100"
          }`}
        style={{
          border: active ? `2px solid ${accentColor}` : "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: active ? `0 0 20px ${glowColor}, inset 0 0 10px ${glowColor}` : "none",
          backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div className="w-[122px] h-[78px] rounded-xl overflow-hidden flex flex-col border border-[var(--color-ui-detail)] bg-black/40  shadow-inner relative">
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 80% 20%, ${accentColor} 0%, transparent 70%)`,
            }}
          />
          <div className="h-4 w-full flex items-center px-2.5 justify-between border-b border-[var(--color-ui-detail)] bg-[var(--color-surface)] shrink-0">
            <div className="h-1 w-6 rounded-full bg-white/25" />
            <div
              className="h-1.5 w-1.5 rounded-full transition-all"
              style={{
                backgroundColor: accentColor,
                boxShadow: active ? `0 0 6px ${accentColor}` : "none",
              }}
            />
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[34px] h-full p-1.5 flex flex-col gap-1 border-r border-[var(--color-ui-detail)] bg-[var(--color-surface)]">
              <div className="h-1 w-full rounded-full bg-white/25" />
              <div className="h-1 w-3/4 rounded-full bg-white/15" />
              <div className="h-1 w-4/5 rounded-full bg-white/15" />
            </div>
            <div className="flex-1 p-2 flex gap-1.5 items-center justify-center">
              <div
                className="w-1/2 h-7 rounded-md border border-white/10 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: `${accentColor}20`,
                  borderColor: `${accentColor}40`,
                }}
              >
                <div className="h-1 w-3 rounded-full bg-white/30" />
              </div>
              <div
                className="w-1/2 h-7 rounded-md border border-white/10 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: `${accentColor}20`,
                  borderColor: `${accentColor}40`,
                }}
              >
                <div className="h-1 w-3 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </button>
      <span
        className={`text-[11.5px] font-semibold tracking-tight transition-colors text-center ${active
          ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          : "text-white/60 hover:text-white/90"
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
  onConnectDiscord: () => void;
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
  onConnectDiscord,
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
      {/* Wrapper Principal - Split Layout estilo macOS[cite: 1] */}
      <div className="flex w-full max-w-[960px] h-[75vh] min-h-[600px] max-h-[820px] gap-2">

        {/* SIDEBAR ESQUERDA - Ghost Style */}
        <aside
          className="w-[240px] border border-[var(--color-border)] bg-[#0B0B0B] rounded-3xl flex flex-col py-6 px-4 shrink-0 shadow-[0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] transform-gpu"
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

          <div className="h-px w-full bg-white/10 mb-4" />

          <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
            {[
              { id: "general" as const, icon: AnimatedSlidersHorizontal, label: shellCopy.general },
              { id: "personalization" as const, icon: AnimatedPalette, label: shellCopy.personalization },
              { id: "performance" as const, icon: AnimatedLaptop, label: shellCopy.performance },
              { id: "account" as const, icon: AnimatedShieldCheck, label: shellCopy.account },
              { id: "connections" as const, icon: AnimatedGlobe, label: shellCopy.connections },
              { id: "controller" as const, icon: AnimatedGamepad2, label: shellCopy.controller },
              { id: "voice" as const, icon: AnimatedMic, label: shellCopy.voice },
              { id: "notifications" as const, icon: AnimatedBell, label: shellCopy.notifications },
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
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors cursor-pointer ${isActive
                    ? "bg-[var(--color-surface)] text-white shadow-sm"
                    : "text-white/60 hover:bg-[#222222] hover:text-white/90"
                    }`}
                >
                  <IconComponent
                    size={16}
                    animate={isHovered}
                    animateOnHover={true}
                    className={`shrink-0 transition-colors ${isActive ? "text-white" : "text-white/50 group-hover:text-white/80"}`}
                  />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-3 mt-3 border-t border-[var(--color-ui-detail)]">
            <button
              type="button"
              onClick={handleQuitApp}
              onMouseEnter={() => setIsQuitHovered(true)}
              onMouseLeave={() => setIsQuitHovered(false)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[12.5px] font-medium text-white/50 hover:bg-[#222222] hover:text-white transition-colors cursor-pointer"
            >
              <AnimatedLogOut size={16} animate={isQuitHovered} animateOnHover={true} className="shrink-0 text-white/40 group-hover:text-white transition-colors" />
              <span>{shellCopy.quit}</span>
            </button>
          </div>
        </aside>

        {/* PAINEL DIREITO - Ghost Style */}
        <main
          ref={mainScrollRef}
          className="flex-1 rounded-3xl border border-[var(--color-border)] bg-[#0B0B0B] overflow-y-auto no-scrollbar relative shadow-[0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] transform-gpu"
          style={{ contain: "layout paint" }}
        >
          <div className="p-8 md:p-10 space-y-8 max-w-[680px]">

            {/* ABA GERAL */}
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <SlidersHorizontal className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.general}</h2>
                  </div>
                  <SettingsRow icon={<Languages className="h-4 w-4" />} title={t("language")}>
                    <SettingsSelect
                      value={language}
                      onChange={(v) => onLanguageChange(v as LauncherLanguage)}
                      options={languageOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                      className="w-[180px]"
                    />
                  </SettingsRow>

                  {behaviorOptions.map((option, idx) => (
                    <SettingsRow
                      key={option.label}
                      title={option.label}
                      hasBorder={idx !== behaviorOptions.length - 1}
                    >
                      <p className="mb-3 text-[11px] leading-relaxed text-white/40">{option.hint}</p>
                      <div className="flex items-center gap-3">
                        <Switch checked={option.checked} onCheckedChange={option.onChange} />
                        <span className="text-[12px] text-white/50 w-16">{option.checked ? t("enabled") : t("disabled")}</span>
                      </div>
                    </SettingsRow>
                  ))}
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8">
                    {COMPLETE_THEME_OPTIONS.map((opt) => {
                      const isSelected = isThemeSelected(opt);
                      return (
                        <ThemePreviewCard
                          key={opt.id}
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

                  <SettingsRow title={t("gameBootIntro")}>
                    <p className="text-[11px] text-white/40 mb-3">{t("gameBootIntroHint")}</p>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={gameBootIntroEnabled}
                        onCheckedChange={setGameBootIntroEnabled}
                      />
                      <span className="text-[12px] text-white/50 w-16">
                        {gameBootIntroEnabled ? t("enabled") : t("disabled")}
                      </span>
                    </div>
                  </SettingsRow>
                  <SettingsRow title={t("gameBootIntroSound")}>
                    <p className="text-[11px] text-white/40 mb-3">{t("gameBootIntroSoundHint")}</p>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={gameBootIntroSoundEnabled}
                        onCheckedChange={setGameBootIntroSoundEnabled}
                      />
                      <span className="text-[12px] text-white/50 w-16">
                        {gameBootIntroSoundEnabled ? t("enabled") : t("disabled")}
                      </span>
                    </div>
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Volume2 className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.audioTitle}</h2>
                  </div>
                  <SettingsRow title={t("soundEffects")}>
                    <div className="flex items-center gap-4">
                      <button onClick={onPreviewSound} className="text-[10px] bg-white/10 px-2.5 py-1 rounded-xl hover:bg-white/20 text-white font-medium transition-colors cursor-pointer shrink-0">{t("test")}</button>
                      <ElasticSlider
                        value={effectsVolume}
                        onChange={onEffectsVolumeChange}
                        startingValue={0}
                        maxValue={100}
                        className="ml-6"
                      />
                    </div>
                  </SettingsRow>
                  <SettingsRow title={t("achievementSound")}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => onTestOverlayAchievement()} onMouseEnter={() => playSound("hover")} className="text-[10px] bg-white/10 px-2.5 py-1 rounded-xl hover:bg-white/20 text-white font-medium transition-colors cursor-pointer shrink-0">{t("test")}</button>
                      <ElasticSlider
                        value={achievementVolume}
                        onChange={onAchievementVolumeChange}
                        startingValue={0}
                        maxValue={100}
                        className="ml-6"
                      />
                    </div>
                  </SettingsRow>
                  <SettingsRow title={t("notificationSound")}>
                    <div className="flex items-center gap-4">
                      <button onClick={onTestNotificationSound} className="text-[10px] bg-white/10 px-2.5 py-1 rounded hover:bg-white/20 text-white rounded-xl font-medium transition-colors cursor-pointer shrink-0">{t("test")}</button>
                      <ElasticSlider
                        value={notificationVolume}
                        onChange={onNotificationVolumeChange}
                        startingValue={0}
                        maxValue={100}
                        className="ml-6"
                      />
                    </div>
                  </SettingsRow>
                  <SettingsRow title={t("music")} hasBorder={false}>
                    <div className="flex items-center gap-4">
                      <ElasticSlider
                        value={musicVolume}
                        onChange={onMusicVolumeChange}
                        startingValue={0}
                        maxValue={35}
                        className="ml-2"
                      />
                    </div>
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
                          className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                            isActive
                              ? "bg-white text-black"
                              : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
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
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <ShieldCheck className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.account}</h2>
                  </div>
                  <SettingsRow icon={<User className="w-4 h-4" />} title={userProfile?.displayName || user?.displayName || detailCopy.playerFallback} hasBorder={false}>
                    <div className="flex items-center gap-4">
                      <span className="text-[12px] text-white/50">{user?.email || detailCopy.noEmail}</span>
                      <div className="flex h-10 w-10 overflow-hidden rounded-full border border-white/10 shadow-sm">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="bg-white/10 h-full w-full flex items-center justify-center"><User className="h-5 w-5 text-white/50" /></div>
                        )}
                      </div>
                    </div>
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Lock className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.security}</h2>
                  </div>
                  <SettingsRow title={detailCopy.resetPassword}>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isResettingPassword || !user?.email || passwordResetSent}
                      className="px-4 py-1.5 bg-[var(--color-surface)] hover:bg-[#222222] rounded-md text-[12.5px] font-medium text-white transition-all disabled:opacity-50"
                    >
                      {passwordResetSent ? detailCopy.emailSent : isResettingPassword ? detailCopy.sending : detailCopy.sendEmail}
                    </button>
                  </SettingsRow>
                  <SettingsRow title={shellCopy.encrypted} hasBorder={false}>
                    <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      <span>{t("protected")}</span>
                    </div>
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <SettingsRow title="Sair da Conta" hasBorder={false}>
                    <button
                      type="button"
                      onClick={() => setIsLogoutModalOpen(true)}
                      className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer"
                    >
                      Desconectar
                    </button>
                  </SettingsRow>
                </section>
              </div>
            )}

            {/* ABA CONEXÕES (CONTAS & PRIVACIDADE) */}
            {activeTab === "connections" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Globe className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{t("connectedAccounts")}</h2>
                  </div>

                  <SettingsRow icon={<SteamIcon className="h-5 w-5" />} title="Steam">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-colors ${steamDisconnecting
                        ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                        : steamConnected
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-[var(--color-surface)] text-white/40 border-white/10"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${steamDisconnecting ? "bg-yellow-400 animate-pulse" : steamConnected ? "bg-emerald-400" : "bg-white/30"}`} />
                        {steamDisconnecting ? "Desconectando..." : steamConnected ? t("connected") : t("notConnected")}
                      </span>
                      {steamConnected ? (
                        <button onClick={onDisconnectSteam} disabled={steamDisconnecting} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {steamDisconnecting ? "Desconectando..." : t("unlink")}
                        </button>
                      ) : (
                        <button onClick={onConnectSteam} disabled={steamConnecting} className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {steamConnecting ? (
                            <span className="flex items-center gap-2">
                              <LinearProgress className="w-12" label={t("connecting")} />
                              <span>{t("connecting")}</span>
                            </span>
                          ) : t("connectSteam")}
                        </button>
                      )}
                    </div>
                  </SettingsRow>

                  <SettingsRow icon={<DiscordIcon className="h-5 w-5" />} title="Discord">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-colors ${discordDisconnecting
                        ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                        : discordConnected
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-[var(--color-surface)] text-white/40 border-white/10"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${discordDisconnecting ? "bg-yellow-400 animate-pulse" : discordConnected ? "bg-emerald-400" : "bg-white/30"}`} />
                        {discordDisconnecting ? "Desconectando..." : discordConnected ? (discordUsername || t("connected")) : t("notConnected")}
                      </span>
                      {discordConnected ? (
                        <button onClick={onDisconnectDiscord} disabled={discordDisconnecting} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {discordDisconnecting ? "Desconectando..." : t("unlink")}
                        </button>
                      ) : (
                        <button onClick={onConnectDiscord} disabled={discordConnecting} className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {discordConnecting ? (
                            <span className="flex items-center gap-2">
                              <LinearProgress className="w-12" label={t("connecting")} />
                              <span>{t("connecting")}</span>
                            </span>
                          ) : t("connectDiscord")}
                        </button>
                      )}
                    </div>
                  </SettingsRow>

                  <SettingsRow icon={<EpicIcon className="h-5 w-5" />} title="Epic Games" hasBorder={false}>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-colors ${epicDisconnecting
                        ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                        : epicConnected
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-[var(--color-surface)] text-white/40 border-white/10"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${epicDisconnecting ? "bg-yellow-400 animate-pulse" : epicConnected ? "bg-emerald-400" : "bg-white/30"}`} />
                        {epicDisconnecting ? "Desconectando..." : epicConnected ? (epicDisplayName || t("connected")) : t("notConnected")}
                      </span>
                      {epicConnected ? (
                        <button onClick={onDisconnectEpic} disabled={epicDisconnecting} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[11.5px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {epicDisconnecting ? "Desconectando..." : t("unlink")}
                        </button>
                      ) : (
                        <button onClick={onConnectEpic} disabled={epicConnecting} className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50 active:scale-95 cursor-pointer">
                          {epicConnecting ? (
                            <span className="flex items-center gap-2">
                              <LinearProgress className="w-12" label={t("connecting")} />
                              <span>{t("connecting")}</span>
                            </span>
                          ) : t("connectEpic")}
                        </button>
                      )}
                    </div>
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <ShieldCheck className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{shellCopy.privacy}</h2>
                  </div>
                  <SettingsRow title={t("profileVisibility")} hasBorder={false}>
                    <SettingsSelect
                      value={profileVisibility}
                      onChange={(v) => handleProfileVisibilityChange(v as ProfileVisibility)}
                      options={[
                        { value: "public", label: shellCopy.public },
                        { value: "private", label: shellCopy.private },
                      ]}
                      className="w-[180px]"
                    />
                  </SettingsRow>
                </section>
              </div>
            )}

            {/* ABA CONTROLE */}
            {activeTab === "controller" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Gamepad2 className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{controllerCopy[0]}</h2>
                  </div>
                  <SettingsRow title={t("controllerStatus")}>
                    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-xl border transition-colors ${isGamepadConnected
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      : "bg-[var(--color-surface)] text-white/50 border-white/10"
                      }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isGamepadConnected ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                      {isGamepadConnected ? controllerCopy[1] : t("disconnected")}
                    </span>
                  </SettingsRow>
                  <SettingsRow title={t("batteryLevel")}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[12px] font-semibold text-white/70 tabular-nums">{isGamepadConnected ? `${batteryLevel !== null ? batteryLevel : '--'}%` : "N/A"}</span>
                      {batteryCharging && <span className="inline-flex items-center gap-1 text-[10.5px] uppercase font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]">{t("charging")}</span>}
                      {batteryLevel !== null && batteryLevel <= 20 && !batteryCharging && isGamepadConnected && <span className="inline-flex items-center gap-1 text-[10.5px] uppercase font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)]">{t("lowBattery")}</span>}
                      <button onClick={() => setShowControllerStatusModal(true)} className="px-2.5 py-1 bg-[var(--color-surface)] hover:bg-[#222222] border border-white/10 text-white rounded-lg text-[11.5px] font-medium transition-colors ml-1 active:scale-95 cursor-pointer">{t("details")}</button>
                    </div>
                  </SettingsRow>
                  <SettingsRow title={t("playstationLed")}>
                    {led.status !== "unsupported" && (
                      <button
                        onClick={led.status === "connected" ? led.testLed : led.requestAccess}
                        disabled={led.status === "connecting"}
                        className="px-4 py-1.5 bg-white/10 text-white rounded-md text-[12.5px] font-medium hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {led.status === "connected" ? controllerCopy[4] : led.status === "connecting" ? "..." : controllerCopy[5]}
                      </button>
                    )}
                  </SettingsRow>
                  <SettingsRow title={t("hapticsEnabled")} hasBorder={false}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { try { playHapticPattern("action"); } catch { } }} className="text-white/50 hover:text-white transition-colors cursor-pointer"><Vibrate className="h-4 w-4" /></button>
                      <Switch checked={hapticsEnabled} onCheckedChange={(v) => { setHapticsEnabled(v); if (v) try { playHapticPattern("action"); } catch { } }} />
                      <span className="text-[12px] text-white/50 w-16">{hapticsEnabled ? t("enabled") : t("disabled")}</span>
                    </div>
                  </SettingsRow>
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

                  <SettingsRow title={voiceCopy.audioInput}>
                    <SettingsSelect
                      value={voiceCallContext?.selectedAudioInput || "default"}
                      onChange={(v) => voiceCallContext?.changeAudioInputDevice(v)}
                      options={[
                        { value: "default", label: voiceCopy.defaultSystem },
                        ...(voiceCallContext?.audioInputDevices.map((d) => ({
                          value: d.deviceId,
                          label: d.label || `Mic (${d.deviceId.slice(0, 8)}...)`,
                        })) || []),
                      ]}
                      className="w-[220px]"
                    />
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.micMonitor}>
                    <div className="flex items-center gap-3">
                      <Switch checked={Boolean(voiceCallContext?.isMicMonitoring)} onCheckedChange={(v) => voiceCallContext?.setIsMicMonitoring(v)} />
                      <span className="text-[12px] text-white/50 w-16">{voiceCallContext?.isMicMonitoring ? t("enabled") : t("disabled")}</span>
                    </div>
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.micTesting}>
                    <div className="flex items-center gap-3 w-[220px]">
                      <button onClick={() => setIsTestingMic(!isTestingMic)} className={`px-2 py-1 text-[11px] rounded font-medium transition-colors cursor-pointer ${isTestingMic ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'}`}>
                        {isTestingMic ? voiceCopy.stop : voiceCopy.test}
                      </button>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 transition-all duration-75" style={{ width: `${testMicVolume}%` }} />
                      </div>
                    </div>
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.audioOutput}>
                    <SettingsSelect
                      value={voiceCallContext?.selectedAudioOutput || "default"}
                      onChange={(v) => voiceCallContext?.changeAudioOutputDevice(v)}
                      options={[
                        { value: "default", label: voiceCopy.defaultSystem },
                        ...(voiceCallContext?.audioOutputDevices.map((d) => ({
                          value: d.deviceId,
                          label: d.label || `Speaker (${d.deviceId.slice(0, 8)}...)`,
                        })) || []),
                      ]}
                      className="w-[220px]"
                    />
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.camera} hasBorder={false}>
                    <div className="flex gap-2">
                      <button onClick={() => setIsVideoPreviewOn(!isVideoPreviewOn)} className="px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[#222222] border border-white/10 text-white rounded-xl text-[12px] font-medium transition-colors cursor-pointer active:scale-95">{voiceCopy.preview}</button>
                      <SettingsSelect
                        value={voiceCallContext?.selectedVideoInput || "default"}
                        onChange={(v) => voiceCallContext?.changeVideoInputDevice(v)}
                        options={[
                          { value: "default", label: voiceCopy.defaultSystem },
                          ...(voiceCallContext?.videoInputDevices.map((d) => ({
                            value: d.deviceId,
                            label: d.label || `Cam (${d.deviceId.slice(0, 8)}...)`,
                          })) || []),
                        ]}
                        className="w-[150px]"
                      />
                    </div>
                  </SettingsRow>
                  {isVideoPreviewOn && (
                    <div className="w-full aspect-video rounded-xl bg-black overflow-hidden border border-white/10 mt-2 mb-4">
                      <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                  )}
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <SlidersHorizontal className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{voiceCopy.processingTitle}</h2>
                  </div>

                  <SettingsRow title={voiceCopy.noiseSuppression}>
                    <SettingsSelect
                      value={voiceCallContext?.advancedNoiseSuppression ? 'rnnoise' : voiceCallContext?.noiseSuppression ? 'native' : 'none'}
                      onChange={(val) => {
                        voiceCallContext?.setAdvancedNoiseSuppression?.(val === 'rnnoise');
                        voiceCallContext?.setNoiseSuppression(val === 'native');
                      }}
                      options={[
                        { value: "rnnoise", label: voiceCopy.aiIsolation },
                        { value: "native", label: voiceCopy.standardNative },
                        { value: "none", label: voiceCopy.raw },
                      ]}
                      className="w-[180px]"
                    />
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.voiceSensitivity}>
                    <div className="flex items-center gap-4">
                      <ElasticSlider
                        value={voiceCallContext?.voiceSensitivity ?? 35}
                        onChange={(val) => voiceCallContext?.setVoiceSensitivity(val)}
                        startingValue={0}
                        maxValue={100}
                        leftIcon={<MicOff className="h-3.5 w-3.5" />}
                        rightIcon={<Mic className="h-3.5 w-3.5" />}
                        className="ml-2"
                      />
                    </div>
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.echoCancellation}>
                    <div className="flex items-center gap-3">
                      <Switch checked={voiceCallContext?.echoCancellation ?? true} onCheckedChange={(checked) => voiceCallContext?.setEchoCancellation(checked)} />
                      <span className="text-[12px] text-white/50 w-16">{(voiceCallContext?.echoCancellation ?? true) ? t("enabled") : t("disabled")}</span>
                    </div>
                  </SettingsRow>

                  <SettingsRow title={voiceCopy.inputMode} hasBorder={false}>
                    <SettingsSelect
                      value={voiceCallContext?.inputMode || 'voice-activity'}
                      onChange={(v) => voiceCallContext?.setInputMode(v as "voice-activity" | "push-to-talk")}
                      options={[
                        { value: "voice-activity", label: voiceCopy.voiceActivity },
                        { value: "push-to-talk", label: voiceCopy.pushToTalk },
                      ]}
                      className="w-[180px]"
                    />
                  </SettingsRow>

                  {voiceCallContext?.inputMode === "push-to-talk" && (
                    <SettingsRow title={voiceCopy.pttKeybind} hasBorder={false}>
                      <button
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
                        className={`min-w-[80px] px-3 py-1.5 rounded-md border text-[12px] font-mono font-medium transition-colors ${isRecordingPttKey ? "bg-amber-500/20 text-amber-300 border-amber-500" : "bg-white/10 text-white border-white/15"}`}
                      >
                        {isRecordingPttKey ? "..." : voiceCallContext?.pushToTalkKey || "F8"}
                      </button>
                    </SettingsRow>
                  )}
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

                  <SettingsRow title={achievementNotificationCopy.enabled}>
                    <div className="flex items-center gap-3">
                      <Switch checked={achievementNotificationsEnabled} onCheckedChange={setAchievementNotificationsEnabled} />
                      <span className="text-[12px] text-white/50 w-16">{achievementNotificationsEnabled ? t("enabled") : t("disabled")}</span>
                    </div>
                  </SettingsRow>

                  <SettingsRow title={achievementNotificationCopy.custom}>
                    <div className="flex items-center gap-3">
                      <Switch checked={customAchievementNotifications} disabled={!achievementNotificationsEnabled} onCheckedChange={setCustomAchievementNotifications} />
                      <span className="text-[12px] text-white/50 w-16">{customAchievementNotifications ? t("enabled") : t("disabled")}</span>
                    </div>
                  </SettingsRow>

                  <SettingsRow title={t("position")} hasBorder={false}>
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
                  </SettingsRow>
                </section>

                <div className="h-px w-full bg-[var(--color-surface)]" />

                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <Sparkles className="h-4 w-4 text-white/70 shrink-0" />
                    <h2 className="text-[17px] font-semibold text-white tracking-wide">{detailCopy.overlayLab}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={onTestOverlayWelcome} onMouseEnter={() => playSound("hover")} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left">
                      <span className="block text-[13px] font-medium text-white">{detailCopy.testWelcome}</span>
                    </button>
                    <button onClick={() => onTestOverlayAchievement("bronze")} onMouseEnter={() => playSound("hover")} className="p-3 bg-amber-700/10 hover:bg-amber-700/20 border border-amber-600/30 rounded-xl text-left">
                      <span className="block text-[13px] font-medium text-amber-500">{detailCopy.testBronze}</span>
                    </button>
                    <button onClick={() => onTestOverlayAchievement("silver")} onMouseEnter={() => playSound("hover")} className="p-3 bg-slate-300/10 hover:bg-slate-300/20 border border-slate-300/25 rounded-xl text-left">
                      <span className="block text-[13px] font-medium text-slate-300">{detailCopy.testSilver}</span>
                    </button>
                    <button onClick={() => onTestOverlayAchievement("gold")} onMouseEnter={() => playSound("hover")} className="p-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-400/35 rounded-xl text-left">
                      <span className="block text-[13px] font-medium text-yellow-400">{detailCopy.testGold}</span>
                    </button>
                    <button onClick={() => onTestOverlayAchievement("platinum")} onMouseEnter={() => playSound("hover")} className="p-3 col-span-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 rounded-xl text-left">
                      <span className="block text-[13px] font-medium text-sky-300">{detailCopy.testPlatinum}</span>
                    </button>
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
