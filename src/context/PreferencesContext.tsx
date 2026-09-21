import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export type LauncherLanguage =
  | "pt-BR"
  | "en-US"
  | "es-ES"
  | "fr-FR"
  | "de-DE"
  | "it-IT";
export type SoundTheme = "default" | "ps5" | "ps4" | "psp" | "ps2" | "gamecube" | "xbox360" | "cyberpunk";
export type VisualTheme = "phelierium" | "ps5" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "checkpoint" | "cyberpunk";
export type AchievementNotificationPosition =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right";

export interface PreferencesStateValue {
  language: LauncherLanguage;
  effectsVolume: number;
  achievementVolume: number;
  notificationVolume: number;
  achievementNotificationsEnabled: boolean;
  customAchievementNotifications: boolean;
  achievementNotificationPosition: AchievementNotificationPosition;
  musicVolume: number;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
  openAtLogin: boolean;
  lowPerformanceMode: boolean;
  gameBootIntroEnabled: boolean;
  gameBootIntroSoundEnabled: boolean;
  closeOnLaunch: boolean;
  minimizeToTrayOnClose: boolean;
  restoreLastScreen: boolean;
  confirmBeforeExit: boolean;
  hapticsEnabled: boolean;
  preferencesHydrated: boolean;
}

export interface PreferencesActionsValue {
  setLanguage: (language: LauncherLanguage) => void;
  setEffectsVolume: (volume: number) => void;
  setAchievementVolume: (volume: number) => void;
  setNotificationVolume: (volume: number) => void;
  setAchievementNotificationsEnabled: (enabled: boolean) => void;
  setCustomAchievementNotifications: (custom: boolean) => void;
  setAchievementNotificationPosition: (position: AchievementNotificationPosition) => void;
  setMusicVolume: (volume: number) => void;
  setSoundTheme: (theme: SoundTheme) => void;
  setVisualTheme: (theme: VisualTheme) => void;
  setOpenAtLogin: (value: boolean) => void;
  setLowPerformanceMode: (value: boolean) => void;
  setGameBootIntroEnabled: (value: boolean) => void;
  setGameBootIntroSoundEnabled: (value: boolean) => void;
  setCloseOnLaunch: (value: boolean) => void;
  setMinimizeToTrayOnClose: (value: boolean) => void;
  setRestoreLastScreen: (value: boolean) => void;
  setConfirmBeforeExit: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  t: (key: TranslationKey) => string;
}

type PreferencesContextValue = PreferencesStateValue & PreferencesActionsValue;

const translations = {
  "pt-BR": {
    settings: "Ajustes",
    system: "Sistema",
    language: "Idioma",
    languageHint: "Preferência visual salva neste dispositivo.",
    soundEffects: "Efeitos sonoros",
    soundEffectsHint: "Volume de navegação, seleção e retorno.",
    achievementSound: "Som de conquista",
    achievementSoundHint: "Volume exclusivo do aviso de conquista desbloqueada.",
    notificationSound: "Som de notificação",
    notificationSoundHint: "Volume dos avisos de mensagens, amigos e solicitações.",
    music: "Música",
    musicHint: "Volume da trilha de fundo em loop.",
    soundTheme: "Tema sonoro",
    soundThemeHint: "Pacote de sons usado pela interface.",
    visualTheme: "Tema visual",
    visualThemeHint: "Skin de cores aplicada ao launcher.",
    themes: "Temas",
    themesHint: "Cada tema aplica visual e sons do mesmo pacote.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
    checkpointTheme: "Phelierium Space",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
    defaultTheme: "Padrão",
    gamecubeTheme: "GameCube",
    test: "Testar",
    mute: "Mudo",
    max: "Máximo",
    performance: "Desempenho",
    appBehavior: "Comportamentos do App",
    appBehaviorHint: "Defina como o launcher inicia, fecha e retoma sua navegação.",
    minimizeToTray: "Minimizar para a bandeja ao fechar",
    minimizeToTrayHint: "Mantém o launcher disponível em segundo plano.",
    restoreLastScreen: "Restaurar a última tela aberta",
    restoreLastScreenHint: "Retoma a última categoria e subaba estáveis.",
    confirmBeforeExit: "Confirmar antes de sair",
    confirmBeforeExitHint: "Pede confirmação antes de encerrar o aplicativo.",
    lowPerformanceMode: "Desativar Animações",
    lowPerformanceModeHint: "Desativa animações pesadas para poupar CPU/GPU.",
    gameBootIntro: "Tela de boot (GameBoot)",
    gameBootIntroHint: "Mostra a animação de boot após o carregamento. Desative para ir direto ao hub.",
    gameBootIntroSound: "Som da intro GameBoot",
    gameBootIntroSoundHint: "Toca o áudio ao iniciar o launcher após o login.",
    hapticsEnabled: "Vibração do controle",
    hapticsEnabledHint: "Ativa o feedback háptico ao navegar e interagir com o controle. Desative se a luz ficar bugada.",
    openAtLogin: "Iniciar com o Windows",
    openAtLoginHint: "Inicia o launcher silenciosamente em segundo plano ao ligar o PC.",
    quitAppTitle: "Sair do Phelierium",
    quitAppDescription: "O aplicativo será encerrado neste computador.",
    closeOnLaunch: "Ocultar ao Jogar",
    closeOnLaunchHint: "Minimiza/Oculta o launcher completamente enquanto você joga para liberar memória.",
    new: "Novo",
    searchPlaceholder: "Pesquisar jogo... (S)",
    connectSteam: "Conectar Steam",
    connecting: "Conectando...",
    unlink: "Desvincular",
    sync: "Sincronizar",
    syncing: "Sincronizando...",
    identity: "Identidade",
    playNow: "Jogar Agora",
    viaSteam: "Via Steam",
    favorite: "Favorito",
    emptyLibrary: "Biblioteca vazia",
    noResults: "Nenhum resultado",
    noResultsHint: "Tente pesquisar por outro termo.",
    emptyHintConnected: "Você não tem jogos salvos. Adicione um manualmente.",
    emptyHintDisconnected: "Adicione um jogo ou conecte sua conta Steam.",
    newGame: "Novo Jogo",
    editMetadata: "Editar Metadados",
    addFavorite: "Adicionar aos Favoritos",
    removeFavorite: "Remover dos Favoritos",
    removeFromLibrary: "Remover da Biblioteca",
    cancel: "Cancelar",
    confirm: "Confirmar",
    signOutTitle: "Sair da Conta",
    signOutDescription: "Você será desconectado e voltará para a tela de login.",
    signOutConfirm: "Sair",
    disconnectSteamTitle: "Desconectar Steam",
    disconnectSteamDescription:
      "Desvincular a Steam removerá os jogos sincronizados da sua biblioteca.",
    launching: "Iniciando...",
    play: "Jogar",
    connectedAccounts: "Contas conectadas",
    connectedAccountsHint: "Vincule Steam, Epic Games e Discord para sincronizar bibliotecas e amigos.",
    connectEpic: "Conectar Epic",
    connectDiscord: "Conectar Discord",
    disconnectEpicTitle: "Desconectar Epic Games",
    disconnectEpicDescription:
      "Desvincular a Epic Games removerá os jogos da Epic sincronizados da sua biblioteca.",
    disconnectDiscordTitle: "Desconectar Discord",
    disconnectDiscordDescription:
      "Desvincular o Discord removerá a integração.",
    connected: "Conectado",
    notConnected: "Não conectado",
    friends: "Amigos",
    friendsHint: "Veja seus amigos de Steam, Discord e Phelierium.",
    overviewContinue: "Continuar",
    overviewResumeSession: "Retomar sessão",
    overviewNextReturn: "Seu próximo retorno aparece aqui.",
    overviewFriends: "Amigos",
    overviewPlayingNow: "Jogando agora",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Ninguém está jogando no momento.",
    overviewPulse: "Pulso",
    overviewQuickSummary: "Resumo rápido",
    overviewFavorites: "Favoritos",
    overviewActivity: "Atividade",
    overviewNoRecentNews: "Nenhuma novidade recente.",
    overviewNoRecord: "sem registro",
    overviewHoursPlayed: "h jogadas",
    overviewOnline: "Online",
    activityFriendPlaying: "começou a jogar",
    activityFriendPlayingDetail: "Jogando agora",
    activityFriendOnlineDetail: "Está online no Phelierium.",
    activityReturnedTo: "Você voltou para",
    activityLibraryHours: "h registradas na biblioteca.",
    activityFavoriteStill: "segue entre seus favoritos",
    activityFavoriteHint: "Bom candidato para voltar a jogar em uma sessão rápida.",
    addFriendTitle: "Adicionar amigo",
    addFriendHint: "Busque por nome de usuário ou email",
    addFriendSearchPlaceholder: "Digite o nome ou email do usuário...",
    addFriendSearchButton: "Buscar",
    addFriendSearching: "Buscando usuários...",
    addFriendRecentSearches: "Pesquisas recentes",
    addFriendClear: "Limpar",
    addFriendEmpty: "Busque por amigos",
    addFriendEmptyHint: "Digite o nome ou email para encontrar usuários",
    addFriendNoResults: "Nenhum usuário encontrado",
    addFriendNoResultsHint: "Verifique se o nome ou email está correto",
    addFriendKeyboardHint: "Use ↑↓ para navegar, Enter para enviar solicitação",
    addFriendSend: "Enviar",
    addFriendViewProfile: "Ver perfil",
    addFriendYou: "Você",
    addFriendAlreadyFriend: "Amigo",
    addFriendPending: "Pendente",
    addFriendRespond: "Responder",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Jogando",
    steamFriends: "Amigos da Steam",
    epicFriends: "Amigos da Epic",
    discordFriends: "Amigos do Discord",
    priceAlerts: "Alertas de preço",
    priceAlertsHint: "Monitore ofertas dos jogos da sua biblioteca.",
    addAlert: "Monitorar oferta",
    noAlerts: "Nenhum alerta criado.",
    enabled: "Ativado",
    disabled: "Desativado",

    charging: "Carregando",
    lowBattery: "Baixa",
    details: "Detalhes",
    protected: "Protegido",
    profileVisibility: "Visibilidade do Perfil",
    position: "Posição",
    controllerStatus: "Status do Controle",
    batteryLevel: "Nível da Bateria",
    playstationLed: "LED do PlayStation",
    disconnected: "Desconectado",
  },
  "en-US": {
    settings: "Settings",
    system: "System",
    language: "Language",
    languageHint: "Visual preference saved on this device.",
    soundEffects: "Sound effects",
    soundEffectsHint: "Navigation, selection and back volume.",
    achievementSound: "Achievement sound",
    achievementSoundHint: "Dedicated volume for unlocked achievement notifications.",
    notificationSound: "Notification sound",
    notificationSoundHint: "Volume for message, friend and request alerts.",
    music: "Music",
    musicHint: "Background loop track volume.",
    soundTheme: "Sound theme",
    soundThemeHint: "Sound pack used by the interface.",
    visualTheme: "Visual theme",
    visualThemeHint: "Color skin applied to the launcher.",
    themes: "Themes",
    themesHint: "Each theme applies matching visuals and sounds.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
    checkpointTheme: "Phelierium Space",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
    defaultTheme: "Default",
    gamecubeTheme: "GameCube",
    test: "Test",
    mute: "Mute",
    max: "Max",
    performance: "Performance",
    appBehavior: "App Behavior",
    appBehaviorHint: "Choose how the launcher starts, closes, and resumes navigation.",
    minimizeToTray: "Minimize to tray when closing",
    minimizeToTrayHint: "Keeps the launcher available in the background.",
    restoreLastScreen: "Restore the last open screen",
    restoreLastScreenHint: "Returns to the last stable category and settings tab.",
    confirmBeforeExit: "Confirm before exiting",
    confirmBeforeExitHint: "Asks for confirmation before quitting the application.",
    lowPerformanceMode: "Disable Animations",
    lowPerformanceModeHint: "Disables heavy animations and effects to save CPU/GPU.",
    gameBootIntro: "Boot screen (GameBoot)",
    gameBootIntroHint: "Shows the boot animation after loading. Disable to go straight to the hub.",
    gameBootIntroSound: "GameBoot intro sound",
    gameBootIntroSoundHint: "Plays audio when the launcher boot intro starts after login.",
    hapticsEnabled: "Controller vibration",
    hapticsEnabledHint: "Enables haptic feedback when navigating with the controller. Turn off if the lightbar glitches.",
    openAtLogin: "Start with Windows",
    openAtLoginHint: "Starts the launcher silently in the background on PC startup.",
    quitAppTitle: "Quit Phelierium",
    quitAppDescription: "The application will close on this computer.",
    closeOnLaunch: "Hide on Launch",
    closeOnLaunchHint: "Minimizes/Hides the launcher completely to free memory.",
    new: "New",
    searchPlaceholder: "Search game... (S)",
    connectSteam: "Connect Steam",
    connecting: "Connecting...",
    unlink: "Unlink",
    sync: "Sync",
    syncing: "Sync...",
    identity: "Identity",
    playNow: "Play Now",
    viaSteam: "Via Steam",
    favorite: "Favorite",
    emptyLibrary: "Empty library",
    noResults: "No results",
    noResultsHint: "Try searching for another term.",
    emptyHintConnected: "You do not have saved games. Add one manually.",
    emptyHintDisconnected: "Add a game or connect your Steam account.",
    newGame: "New Game",
    editMetadata: "Edit Metadata",
    addFavorite: "Add to Favorites",
    removeFavorite: "Remove from Favorites",
    removeFromLibrary: "Remove from Library",
    cancel: "Cancel",
    confirm: "Confirm",
    signOutTitle: "Sign Out",
    signOutDescription: "You will be signed out and returned to the login screen.",
    signOutConfirm: "Sign Out",
    disconnectSteamTitle: "Disconnect Steam",
    disconnectSteamDescription:
      "Unlinking Steam will remove synced games from your library.",
    launching: "Launching...",
    play: "Play",
    connectedAccounts: "Connected accounts",
    connectedAccountsHint: "Link Steam and Discord. Epic uses catalog search and shortcuts, without account sync.",
    connectEpic: "Epic catalog",
    connectDiscord: "Connect Discord",
    disconnectEpicTitle: "Disconnect Epic",
    disconnectEpicDescription:
      "Epic is used only for catalog search, artwork, details and shortcuts.",
    disconnectDiscordTitle: "Disconnect Discord",
    disconnectDiscordDescription:
      "Unlinking Discord will remove integration.",
    connected: "Connected",
    notConnected: "Not connected",
    friends: "Friends",
    friendsHint: "View your friends from Steam, Discord and Phelierium.",
    overviewContinue: "Continue",
    overviewResumeSession: "Resume session",
    overviewNextReturn: "Your next return appears here.",
    overviewFriends: "Friends",
    overviewPlayingNow: "Playing now",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Nobody is playing right now.",
    overviewPulse: "Pulse",
    overviewQuickSummary: "Quick summary",
    overviewFavorites: "Favorites",
    overviewActivity: "Activity",
    overviewNoRecentNews: "No recent updates.",
    overviewNoRecord: "no record",
    overviewHoursPlayed: "h played",
    overviewOnline: "Online",
    activityFriendPlaying: "started playing",
    activityFriendPlayingDetail: "Now playing",
    activityFriendOnlineDetail: "Is online on Phelierium.",
    activityReturnedTo: "You returned to",
    activityLibraryHours: "h recorded in your library.",
    activityFavoriteStill: "is still one of your favorites",
    activityFavoriteHint: "A good candidate for a quick session.",
    addFriendTitle: "Add friend",
    addFriendHint: "Search by username or email",
    addFriendSearchPlaceholder: "Type the user's name or email...",
    addFriendSearchButton: "Search",
    addFriendSearching: "Searching users...",
    addFriendRecentSearches: "Recent searches",
    addFriendClear: "Clear",
    addFriendEmpty: "Search for friends",
    addFriendEmptyHint: "Type a name or email to find users",
    addFriendNoResults: "No users found",
    addFriendNoResultsHint: "Check if the name or email is correct",
    addFriendKeyboardHint: "Use ↑↓ to navigate, Enter to send request",
    addFriendSend: "Send",
    addFriendViewProfile: "View profile",
    addFriendYou: "You",
    addFriendAlreadyFriend: "Friend",
    addFriendPending: "Pending",
    addFriendRespond: "Respond",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Playing",
    steamFriends: "Steam Friends",
    epicFriends: "Epic Friends",
    discordFriends: "Discord Friends",
    priceAlerts: "Price alerts",
    priceAlertsHint: "Monitor deals for games in your library.",
    addAlert: "Track deal",
    noAlerts: "No alerts created.",
    enabled: "Enabled",
    disabled: "Disabled",

    charging: "Charging",
    lowBattery: "Low",
    details: "Details",
    protected: "Protected",
    profileVisibility: "Profile Visibility",
    position: "Position",
    controllerStatus: "Controller Status",
    batteryLevel: "Battery Level",
    playstationLed: "PlayStation LED",
    disconnected: "Disconnected",
  },
  "es-ES": {
    settings: "Ajustes",
    system: "Sistema",
    language: "Idioma",
    languageHint: "Preferencia visual guardada en este dispositivo.",
    soundEffects: "Efectos sonoros",
    soundEffectsHint: "Volumen de navegación, selección y retorno.",
    achievementSound: "Sonido de logro",
    achievementSoundHint: "Volumen exclusivo de las notificaciones de logros desbloqueados.",
    notificationSound: "Sonido de notificación",
    notificationSoundHint: "Volumen de las alertas de mensajes, amigos y solicitudes.",
    music: "Música",
    musicHint: "Volumen de la pista de fondo en loop.",
    soundTheme: "Tema sonoro",
    soundThemeHint: "Paquete de sonidos usado por la interfaz.",
    visualTheme: "Tema visual",
    visualThemeHint: "Skin de colores aplicada al launcher.",
    themes: "Temas",
    themesHint: "Cada tema aplica visual y sonidos del mismo paquete.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
    checkpointTheme: "Phelierium Space",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
    defaultTheme: "Predeterminado",
    gamecubeTheme: "GameCube",
    test: "Probar",
    mute: "Silencio",
    max: "Máximo",
    performance: "Rendimiento",
    appBehavior: "Comportamiento de la App",
    appBehaviorHint: "Elige cómo se inicia, se cierra y retoma la navegación.",
    minimizeToTray: "Minimizar a la bandeja al cerrar",
    minimizeToTrayHint: "Mantiene el launcher disponible en segundo plano.",
    restoreLastScreen: "Restaurar la última pantalla abierta",
    restoreLastScreenHint: "Vuelve a la última categoría y pestaña estables.",
    confirmBeforeExit: "Confirmar antes de salir",
    confirmBeforeExitHint: "Pide confirmación antes de cerrar la aplicación.",
    lowPerformanceMode: "Desactivar Animaciones",
    lowPerformanceModeHint: "Desactiva animaciones pesadas para ahorrar CPU/GPU.",
    gameBootIntro: "Pantalla de boot (GameBoot)",
    gameBootIntroHint: "Muestra la animación de arranque tras la carga. Desactívala para ir directo al hub.",
    gameBootIntroSound: "Sonido de intro GameBoot",
    gameBootIntroSoundHint: "Reproduce audio al iniciar el launcher tras el login.",
    hapticsEnabled: "Vibración del mando",
    hapticsEnabledHint: "Activa la respuesta háptica al navegar con el mando. Desactívala si la luz parpadea.",
    openAtLogin: "Iniciar con Windows",
    openAtLoginHint: "Inicia el launcher silenciosamente en segundo plano.",
    quitAppTitle: "Salir de Phelierium",
    quitAppDescription: "La aplicación se cerrará en este equipo.",
    closeOnLaunch: "Ocultar al Jugar",
    closeOnLaunchHint: "Oculta el launcher completamente para liberar memoria.",
    new: "Nuevo",
    searchPlaceholder: "Buscar juego... (S)",
    connectSteam: "Conectar Steam",
    connecting: "Conectando...",
    unlink: "Desvincular",
    sync: "Sync",
    syncing: "Sync...",
    identity: "Identidad",
    playNow: "Jugar Ahora",
    viaSteam: "Vía Steam",
    favorite: "Favorito",
    emptyLibrary: "Biblioteca vacía",
    noResults: "Sin resultados",
    noResultsHint: "Intenta buscar otro término.",
    emptyHintConnected: "No tienes juegos guardados. Añade uno manualmente.",
    emptyHintDisconnected: "Añade un juego o conecta tu cuenta de Steam.",
    newGame: "Nuevo Jogo",
    editMetadata: "Editar Metadatos",
    addFavorite: "Añadir a Favoritos",
    removeFavorite: "Quitar de Favoritos",
    removeFromLibrary: "Quitar de la Biblioteca",
    cancel: "Cancelar",
    confirm: "Confirmar",
    signOutTitle: "Cerrar Sesión",
    signOutDescription: "Se cerrará tu sesión y volverás a la pantalla de entrada.",
    signOutConfirm: "Salir Ahora",
    disconnectSteamTitle: "Desconectar Steam",
    disconnectSteamDescription:
      "Desvincular Steam eliminará los juegos sincronizados de la biblioteca.",
    launching: "Iniciando...",
    play: "Jugar",
    connectedAccounts: "Cuentas conectadas",
    connectedAccountsHint: "Vincula Steam y Discord. Epic usa catálogo y accesos directos, sin sync de cuenta.",
    connectEpic: "Catálogo Epic",
    connectDiscord: "Conectar Discord",
    disconnectEpicTitle: "Desconectar Epic",
    disconnectEpicDescription:
      "Epic se usa solo para catálogo, carátulas, detalles y accesos directos.",
    disconnectDiscordTitle: "Desconectar Discord",
    disconnectDiscordDescription:
      "Desvincular Discord eliminará la integración.",
    connected: "Conectado",
    notConnected: "No conectado",
    friends: "Amigos",
    friendsHint: "Ver tus amigos de Steam, Discord y Phelierium.",
    overviewContinue: "Continuar",
    overviewResumeSession: "Retomar sesión",
    overviewNextReturn: "Tu próximo regreso aparece aquí.",
    overviewFriends: "Amigos",
    overviewPlayingNow: "Jugando ahora",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Nadie está jugando ahora.",
    overviewPulse: "Pulso",
    overviewQuickSummary: "Resumen rápido",
    overviewFavorites: "Favoritos",
    overviewActivity: "Actividad",
    overviewNoRecentNews: "Sin novedades recientes.",
    overviewNoRecord: "sin registro",
    overviewHoursPlayed: "h jugadas",
    overviewOnline: "Online",
    activityFriendPlaying: "empezó a jugar",
    activityFriendPlayingDetail: "Ahora está jugando",
    activityFriendOnlineDetail: "Está online en Phelierium.",
    activityReturnedTo: "Volviste a",
    activityLibraryHours: "h registradas en la biblioteca.",
    activityFavoriteStill: "sigue entre tus favoritos",
    activityFavoriteHint: "Buen candidato para volver en una sesión rápida.",
    addFriendTitle: "Añadir amigo",
    addFriendHint: "Busca por nombre de usuario o email",
    addFriendSearchPlaceholder: "Escribe el nombre o email del usuario...",
    addFriendSearchButton: "Buscar",
    addFriendSearching: "Buscando usuarios...",
    addFriendRecentSearches: "Búsquedas recientes",
    addFriendClear: "Limpiar",
    addFriendEmpty: "Busca amigos",
    addFriendEmptyHint: "Escribe un nombre o email para encontrar usuarios",
    addFriendNoResults: "No se encontraron usuarios",
    addFriendNoResultsHint: "Verifica si el nombre o email es correcto",
    addFriendKeyboardHint: "Usa ↑↓ para navegar, Enter para enviar solicitud",
    addFriendSend: "Enviar",
    addFriendViewProfile: "Ver perfil",
    addFriendYou: "Tú",
    addFriendAlreadyFriend: "Amigo",
    addFriendPending: "Pendiente",
    addFriendRespond: "Responder",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Jugando",
    steamFriends: "Amigos de Steam",
    epicFriends: "Amigos de Epic",
    discordFriends: "Amigos de Discord",
    priceAlerts: "Alertas de precio",
    priceAlertsHint: "Monitorea ofertas de los juegos de tu biblioteca.",
    addAlert: "Monitorear oferta",
    noAlerts: "Ninguna alerta creada.",
    enabled: "Activado",
    disabled: "Desactivado",

    charging: "Cargando",
    lowBattery: "Baja",
    details: "Detalles",
    protected: "Protegido",
    profileVisibility: "Visibilidad del perfil",
    position: "Posición",
    controllerStatus: "Estado del mando",
    batteryLevel: "Nivel de batería",
    playstationLed: "LED de PlayStation",
    disconnected: "Desconectado",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["pt-BR"];

type AdditionalLanguage = "fr-FR" | "de-DE" | "it-IT";

const additionalTranslations: Record<
  AdditionalLanguage,
  Partial<Record<TranslationKey, string>>
> = {
  "fr-FR": {
    settings: "Paramètres",
    system: "Système",
    language: "Langue",
    languageHint: "Préférence visuelle enregistrée sur cet appareil.",
    soundEffects: "Effets sonores",
    soundEffectsHint: "Volume de navigation, de sélection et de retour.",
    achievementSound: "Son des succès",
    achievementSoundHint: "Volume réservé aux notifications de succès débloqués.",
    notificationSound: "Son des notifications",
    notificationSoundHint: "Volume des messages, amis et demandes.",
    music: "Musique",
    musicHint: "Volume de la musique de fond en boucle.",
    soundTheme: "Thème sonore",
    soundThemeHint: "Pack de sons utilisé par l’interface.",
    visualTheme: "Thème visuel",
    visualThemeHint: "Palette de couleurs appliquée au launcher.",
    themes: "Thèmes",
    themesHint: "Chaque thème applique des visuels et des sons assortis.",
    defaultTheme: "Par défaut",
    test: "Tester",
    mute: "Muet",
    max: "Maximum",
    performance: "Performances",
    appBehavior: "Comportement de l'application",
    appBehaviorHint: "Choisissez comment le launcher démarre, se ferme et reprend la navigation.",
    minimizeToTray: "Réduire dans la zone de notification",
    minimizeToTrayHint: "Maintient le launcher disponible en arrière-plan.",
    restoreLastScreen: "Restaurer le dernier écran ouvert",
    restoreLastScreenHint: "Revient à la dernière catégorie et au dernier onglet stables.",
    confirmBeforeExit: "Confirmer avant de quitter",
    confirmBeforeExitHint: "Demande une confirmation avant de fermer l'application.",
    lowPerformanceMode: "Désactiver les animations",
    lowPerformanceModeHint: "Désactive les effets lourds pour économiser le CPU/GPU.",
    openAtLogin: "Démarrer avec Windows",
    openAtLoginHint: "Démarre le launcher silencieusement en arrière-plan.",
    quitAppTitle: "Quitter Phelierium",
    quitAppDescription: "L'application sera fermée sur cet ordinateur.",
    closeOnLaunch: "Masquer au lancement",
    closeOnLaunchHint: "Masque le launcher pendant que vous jouez.",
    new: "Nouveau",
    searchPlaceholder: "Rechercher un jeu... (S)",
    connectSteam: "Connecter Steam",
    connecting: "Connexion...",
    unlink: "Dissocier",
    sync: "Synchroniser",
    syncing: "Synchronisation...",
    identity: "Identité",
    playNow: "Jouer maintenant",
    viaSteam: "Via Steam",
    favorite: "Favori",
    emptyLibrary: "Bibliothèque vide",
    noResults: "Aucun résultat",
    noResultsHint: "Essayez un autre terme.",
    emptyHintConnected: "Aucun jeu enregistré. Ajoutez-en un manuellement.",
    emptyHintDisconnected: "Ajoutez un jeu ou connectez votre compte Steam.",
    newGame: "Nouveau jeu",
    editMetadata: "Modifier les métadonnées",
    addFavorite: "Ajouter aux favoris",
    removeFavorite: "Retirer des favoris",
    removeFromLibrary: "Retirer de la bibliothèque",
    cancel: "Annuler",
    confirm: "Confirmer",
    signOutTitle: "Se déconnecter",
    signOutDescription: "Vous serez déconnecté et renvoyé à l’écran de connexion.",
    signOutConfirm: "Se déconnecter",
    launching: "Lancement...",
    play: "Jouer",
    connectedAccounts: "Comptes connectés",
    connectedAccountsHint: "Associez Steam et Discord.",
    connectEpic: "Catalogue Epic",
    connectDiscord: "Connecter Discord",
    connected: "Connecté",
    notConnected: "Non connecté",
    friends: "Amis",
    friendsHint: "Consultez vos amis Steam, Discord et Phelierium.",
    overviewContinue: "Continuer",
    overviewResumeSession: "Reprendre la session",
    overviewFriends: "Amis",
    overviewPlayingNow: "Joue actuellement",
    overviewNobodyPlaying: "Personne ne joue actuellement.",
    overviewFavorites: "Favoris",
    overviewActivity: "Activité",
    overviewNoRecentNews: "Aucune nouveauté récente.",
    overviewOnline: "En ligne",
    addFriendTitle: "Ajouter un ami",
    addFriendHint: "Rechercher par nom d’utilisateur ou e-mail",
    addFriendSearchPlaceholder: "Saisissez le nom ou l’e-mail...",
    addFriendSearchButton: "Rechercher",
    addFriendSearching: "Recherche d’utilisateurs...",
    addFriendRecentSearches: "Recherches récentes",
    addFriendClear: "Effacer",
    addFriendEmpty: "Rechercher des amis",
    addFriendEmptyHint: "Saisissez un nom ou un e-mail",
    addFriendNoResults: "Aucun utilisateur trouvé",
    addFriendNoResultsHint: "Vérifiez le nom ou l’e-mail",
    addFriendSend: "Envoyer",
    addFriendViewProfile: "Voir le profil",
    addFriendYou: "Vous",
    addFriendAlreadyFriend: "Ami",
    addFriendPending: "En attente",
    addFriendRespond: "Répondre",
    addFriendOnline: "En ligne",
    addFriendOffline: "Hors ligne",
    addFriendPlaying: "Joue à",
    steamFriends: "Amis Steam",
    epicFriends: "Amis Epic",
    discordFriends: "Amis Discord",
    priceAlerts: "Alertes de prix",
    priceAlertsHint: "Surveillez les promotions de votre bibliothèque.",
    addAlert: "Suivre l’offre",
    noAlerts: "Aucune alerte créée.",
    enabled: "Activé",
    disabled: "Désactivé",

    charging: "En charge",
    lowBattery: "Faible",
    details: "Détails",
    protected: "Protégé",
    profileVisibility: "Visibilité du profil",
    position: "Position",
    controllerStatus: "État de la manette",
    batteryLevel: "Niveau de la batterie",
    playstationLed: "LED PlayStation",
    disconnected: "Déconnecté",
  },
  "de-DE": {
    settings: "Einstellungen",
    system: "System",
    language: "Sprache",
    languageHint: "Darstellungseinstellung auf diesem Gerät gespeichert.",
    soundEffects: "Soundeffekte",
    soundEffectsHint: "Lautstärke für Navigation, Auswahl und Zurück.",
    achievementSound: "Erfolgssound",
    achievementSoundHint: "Eigene Lautstärke für freigeschaltete Erfolge.",
    notificationSound: "Benachrichtigungston",
    notificationSoundHint: "Lautstärke für Nachrichten, Freunde und Anfragen.",
    music: "Musik",
    musicHint: "Lautstärke der Hintergrundmusik.",
    soundTheme: "Sounddesign",
    soundThemeHint: "Von der Oberfläche verwendetes Soundpaket.",
    visualTheme: "Design",
    visualThemeHint: "Auf den Launcher angewendetes Farbschema.",
    themes: "Designs",
    themesHint: "Jedes Design verwendet passende Grafik und Sounds.",
    defaultTheme: "Standard",
    test: "Testen",
    mute: "Stumm",
    max: "Maximum",
    performance: "Leistung",
    appBehavior: "App-Verhalten",
    appBehaviorHint: "Legt fest, wie der Launcher startet, schließt und die Navigation fortsetzt.",
    minimizeToTray: "Beim Schließen in den Infobereich minimieren",
    minimizeToTrayHint: "Hält den Launcher im Hintergrund verfügbar.",
    restoreLastScreen: "Zuletzt geöffneten Bildschirm wiederherstellen",
    restoreLastScreenHint: "Kehrt zur letzten stabilen Kategorie und Registerkarte zurück.",
    confirmBeforeExit: "Vor dem Beenden bestätigen",
    confirmBeforeExitHint: "Fragt vor dem Beenden der Anwendung nach einer Bestätigung.",
    lowPerformanceMode: "Animationen deaktivieren",
    lowPerformanceModeHint: "Deaktiviert aufwendige Effekte, um CPU/GPU zu schonen.",
    openAtLogin: "Mit Windows starten",
    openAtLoginHint: "Startet den Launcher unauffällig im Hintergrund.",
    quitAppTitle: "Phelierium beenden",
    quitAppDescription: "Die Anwendung wird auf diesem Computer geschlossen.",
    closeOnLaunch: "Beim Spielen ausblenden",
    closeOnLaunchHint: "Blendet den Launcher beim Spielen vollständig aus.",
    new: "Neu",
    searchPlaceholder: "Spiel suchen... (S)",
    connectSteam: "Steam verbinden",
    connecting: "Verbindung...",
    unlink: "Trennen",
    sync: "Synchronisieren",
    syncing: "Synchronisierung...",
    identity: "Identität",
    playNow: "Jetzt spielen",
    viaSteam: "Über Steam",
    favorite: "Favorit",
    emptyLibrary: "Leere Bibliothek",
    noResults: "Keine Ergebnisse",
    noResultsHint: "Versuche einen anderen Suchbegriff.",
    emptyHintConnected: "Keine Spiele gespeichert. Füge ein Spiel manuell hinzu.",
    emptyHintDisconnected: "Füge ein Spiel hinzu oder verbinde dein Steam-Konto.",
    newGame: "Neues Spiel",
    editMetadata: "Metadaten bearbeiten",
    addFavorite: "Zu Favoriten hinzufügen",
    removeFavorite: "Aus Favoriten entfernen",
    removeFromLibrary: "Aus Bibliothek entfernen",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    signOutTitle: "Abmelden",
    signOutDescription: "Du wirst abgemeldet und zur Anmeldung zurückgeleitet.",
    signOutConfirm: "Abmelden",
    launching: "Wird gestartet...",
    play: "Spielen",
    connectedAccounts: "Verbundene Konten",
    connectedAccountsHint: "Verbinde Steam und Discord.",
    connectEpic: "Epic-Katalog",
    connectDiscord: "Discord verbinden",
    connected: "Verbunden",
    notConnected: "Nicht verbunden",
    friends: "Freunde",
    friendsHint: "Sieh deine Freunde von Steam, Discord und Phelierium.",
    overviewContinue: "Fortsetzen",
    overviewResumeSession: "Sitzung fortsetzen",
    overviewFriends: "Freunde",
    overviewPlayingNow: "Spielt gerade",
    overviewNobodyPlaying: "Gerade spielt niemand.",
    overviewFavorites: "Favoriten",
    overviewActivity: "Aktivität",
    overviewNoRecentNews: "Keine aktuellen Neuigkeiten.",
    overviewOnline: "Online",
    addFriendTitle: "Freund hinzufügen",
    addFriendHint: "Nach Benutzername oder E-Mail suchen",
    addFriendSearchPlaceholder: "Name oder E-Mail eingeben...",
    addFriendSearchButton: "Suchen",
    addFriendSearching: "Benutzer werden gesucht...",
    addFriendRecentSearches: "Letzte Suchen",
    addFriendClear: "Löschen",
    addFriendEmpty: "Freunde suchen",
    addFriendEmptyHint: "Gib einen Namen oder eine E-Mail ein",
    addFriendNoResults: "Keine Benutzer gefunden",
    addFriendNoResultsHint: "Überprüfe den Namen oder die E-Mail",
    addFriendSend: "Senden",
    addFriendViewProfile: "Profil anzeigen",
    addFriendYou: "Du",
    addFriendAlreadyFriend: "Freund",
    addFriendPending: "Ausstehend",
    addFriendRespond: "Antworten",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Spielt",
    steamFriends: "Steam-Freunde",
    epicFriends: "Epic-Freunde",
    discordFriends: "Discord-Freunde",
    priceAlerts: "Preisalarm",
    priceAlertsHint: "Überwache Angebote für deine Spiele.",
    addAlert: "Angebot verfolgen",
    noAlerts: "Keine Alarme erstellt.",
    enabled: "Aktiviert",
    disabled: "Deaktiviert",

    charging: "Wird geladen",
    lowBattery: "Schwach",
    details: "Details",
    protected: "Geschützt",
    profileVisibility: "Profil-Sichtbarkeit",
    position: "Position",
    controllerStatus: "Controller-Status",
    batteryLevel: "Akkustand",
    playstationLed: "PlayStation-LED",
    disconnected: "Getrennt",
  },
  "it-IT": {
    settings: "Impostazioni",
    system: "Sistema",
    language: "Lingua",
    languageHint: "Preferenza visiva salvata su questo dispositivo.",
    soundEffects: "Effetti sonori",
    soundEffectsHint: "Volume di navigazione, selezione e ritorno.",
    achievementSound: "Suono degli obiettivi",
    achievementSoundHint: "Volume dedicato agli obiettivi sbloccati.",
    notificationSound: "Suono delle notifiche",
    notificationSoundHint: "Volume di messaggi, amici e richieste.",
    music: "Musica",
    musicHint: "Volume della musica di sottofondo.",
    soundTheme: "Tema sonoro",
    soundThemeHint: "Pacchetto audio usato dall’interfaccia.",
    visualTheme: "Tema visivo",
    visualThemeHint: "Schema di colori applicato al launcher.",
    themes: "Temi",
    themesHint: "Ogni tema applica grafica e suoni coordinati.",
    defaultTheme: "Predefinito",
    test: "Prova",
    mute: "Muto",
    max: "Massimo",
    performance: "Prestazioni",
    appBehavior: "Comportamento dell'app",
    appBehaviorHint: "Scegli come il launcher si avvia, si chiude e riprende la navigazione.",
    minimizeToTray: "Riduci nell'area di notifica alla chiusura",
    minimizeToTrayHint: "Mantiene il launcher disponibile in background.",
    restoreLastScreen: "Ripristina l'ultima schermata aperta",
    restoreLastScreenHint: "Ritorna all'ultima categoria e scheda stabili.",
    confirmBeforeExit: "Conferma prima di uscire",
    confirmBeforeExitHint: "Richiede conferma prima di chiudere l'applicazione.",
    lowPerformanceMode: "Disattiva animazioni",
    lowPerformanceModeHint: "Disattiva gli effetti pesanti per ridurre l’uso di CPU/GPU.",
    openAtLogin: "Avvia con Windows",
    openAtLoginHint: "Avvia il launcher silenziosamente in background.",
    quitAppTitle: "Esci da Phelierium",
    quitAppDescription: "L'applicazione verrà chiusa su questo computer.",
    closeOnLaunch: "Nascondi durante il gioco",
    closeOnLaunchHint: "Nasconde completamente il launcher durante il gioco.",
    new: "Nuovo",
    searchPlaceholder: "Cerca gioco... (S)",
    connectSteam: "Collega Steam",
    connecting: "Connessione...",
    unlink: "Scollega",
    sync: "Sincronizza",
    syncing: "Sincronizzazione...",
    identity: "Identità",
    playNow: "Gioca ora",
    viaSteam: "Tramite Steam",
    favorite: "Preferito",
    emptyLibrary: "Libreria vuota",
    noResults: "Nessun risultato",
    noResultsHint: "Prova a cercare un altro termine.",
    emptyHintConnected: "Non ci sono giochi salvati. Aggiungine uno manualmente.",
    emptyHintDisconnected: "Aggiungi un gioco o collega il tuo account Steam.",
    newGame: "Nuovo gioco",
    editMetadata: "Modifica metadati",
    addFavorite: "Aggiungi ai preferiti",
    removeFavorite: "Rimuovi dai preferiti",
    removeFromLibrary: "Rimuovi dalla libreria",
    cancel: "Annulla",
    confirm: "Conferma",
    signOutTitle: "Esci",
    signOutDescription: "Verrai disconnesso e tornerai alla schermata di accesso.",
    signOutConfirm: "Esci",
    launching: "Avvio...",
    play: "Gioca",
    connectedAccounts: "Account collegati",
    connectedAccountsHint: "Collega Steam e Discord.",
    connectEpic: "Catalogo Epic",
    connectDiscord: "Collega Discord",
    connected: "Collegato",
    notConnected: "Non collegato",
    friends: "Amici",
    friendsHint: "Visualizza gli amici di Steam, Discord e Phelierium.",
    overviewContinue: "Continua",
    overviewResumeSession: "Riprendi sessione",
    overviewFriends: "Amici",
    overviewPlayingNow: "Sta giocando",
    overviewNobodyPlaying: "Nessuno sta giocando.",
    overviewFavorites: "Preferiti",
    overviewActivity: "Attività",
    overviewNoRecentNews: "Nessuna novità recente.",
    overviewOnline: "Online",
    addFriendTitle: "Aggiungi amico",
    addFriendHint: "Cerca per nome utente o e-mail",
    addFriendSearchPlaceholder: "Inserisci nome o e-mail...",
    addFriendSearchButton: "Cerca",
    addFriendSearching: "Ricerca utenti...",
    addFriendRecentSearches: "Ricerche recenti",
    addFriendClear: "Cancella",
    addFriendEmpty: "Cerca amici",
    addFriendEmptyHint: "Inserisci un nome o un’e-mail",
    addFriendNoResults: "Nessun utente trovato",
    addFriendNoResultsHint: "Controlla il nome o l’e-mail",
    addFriendSend: "Invia",
    addFriendViewProfile: "Vedi profilo",
    addFriendYou: "Tu",
    addFriendAlreadyFriend: "Amico",
    addFriendPending: "In attesa",
    addFriendRespond: "Rispondi",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Sta giocando",
    steamFriends: "Amici Steam",
    epicFriends: "Amici Epic",
    discordFriends: "Amici Discord",
    priceAlerts: "Avvisi di prezzo",
    priceAlertsHint: "Monitora le offerte dei giochi nella tua libreria.",
    addAlert: "Segui offerta",
    noAlerts: "Nessun avviso creato.",
    enabled: "Attivato",
    disabled: "Disattivato",

    charging: "In carica",
    lowBattery: "Bassa",
    details: "Dettagli",
    protected: "Protetto",
    profileVisibility: "Visibilità del profilo",
    position: "Posizione",
    controllerStatus: "Stato del controller",
    batteryLevel: "Livello batteria",
    playstationLed: "LED PlayStation",
    disconnected: "Disconnesso",
  },
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const PreferencesStateContext = createContext<PreferencesStateValue | null>(null);
const PreferencesActionsContext = createContext<PreferencesActionsValue | null>(null);

const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

const prefKey = (uid: string, key: string) => `checkpoint_${key}_${uid}`;

const readPreference = (uid: string, key: string) => {
  try {
    return localStorage.getItem(prefKey(uid, key));
  } catch (error) {
    console.warn(`[preferences] Falha ao ler ${key}.`, error);
    return null;
  }
};

const writePreference = (uid: string, key: string, value: string) => {
  try {
    localStorage.setItem(prefKey(uid, key), value);
  } catch (error) {
    console.warn(`[preferences] Falha ao salvar ${key}.`, error);
  }
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [language, setLanguage] = useState<LauncherLanguage>("pt-BR");
  const [effectsVolume, setEffectsVolume] = useState(30);
  const [achievementVolume, setAchievementVolume] = useState(22);
  const [notificationVolume, setNotificationVolume] = useState(40);
  const [achievementNotificationsEnabled, setAchievementNotificationsEnabled] = useState(true);
  const [customAchievementNotifications, setCustomAchievementNotifications] = useState(true);
  const [achievementNotificationPosition, setAchievementNotificationPosition] =
    useState<AchievementNotificationPosition>("top-right");
  const [musicVolume, setMusicVolume] = useState(9);
  const [soundTheme, setSoundTheme] = useState<SoundTheme>("default");
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("phelierium");
  const [openAtLogin, setOpenAtLoginState] = useState(false);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [gameBootIntroEnabled, setGameBootIntroEnabled] = useState(true);
  const [gameBootIntroSoundEnabled, setGameBootIntroSoundEnabled] = useState(true);
  const [closeOnLaunch, setCloseOnLaunch] = useState(true);
  const [minimizeToTrayOnClose, setMinimizeToTrayOnClose] = useState(true);
  const [restoreLastScreen, setRestoreLastScreen] = useState(false);
  const [confirmBeforeExit, setConfirmBeforeExit] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [hydratedPreferencesUid, setHydratedPreferencesUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHydratedPreferencesUid(null);
      return;
    }
    const savedLanguage = readPreference(user.uid, "language");
    const savedEffectsVolumeRaw = readPreference(user.uid, "effects_volume");
    const savedAchievementVolumeRaw = readPreference(user.uid, "achievement_volume");
    const savedNotificationVolumeRaw = readPreference(user.uid, "notification_volume");
    const savedMusicVolumeRaw = readPreference(user.uid, "music_volume");
    const savedEffectsVolume =
      savedEffectsVolumeRaw == null ? null : Number(savedEffectsVolumeRaw);
    const savedAchievementVolume =
      savedAchievementVolumeRaw == null ? null : Number(savedAchievementVolumeRaw);
    const savedNotificationVolume =
      savedNotificationVolumeRaw == null ? null : Number(savedNotificationVolumeRaw);
    const savedMusicVolume =
      savedMusicVolumeRaw == null ? null : Number(savedMusicVolumeRaw);
    const savedSoundTheme = readPreference(user.uid, "sound_theme");
    const savedVisualTheme = readPreference(user.uid, "visual_theme");
    const savedOpenAtLogin = readPreference(user.uid, "open_at_login");
    const savedLowPerf = readPreference(user.uid, "low_perf");
    const savedGameBootIntro = readPreference(user.uid, "game_boot_intro");
    const savedGameBootSound = readPreference(user.uid, "game_boot_intro_sound");
    const savedCloseLaunch = readPreference(user.uid, "close_launch");
    const savedMinimizeToTray = readPreference(user.uid, "minimize_to_tray");
    const savedRestoreLastScreen = readPreference(user.uid, "restore_last_screen");
    const savedConfirmBeforeExit = readPreference(user.uid, "confirm_before_exit");
    const savedAchievementNotifications = readPreference(user.uid, "achievement_notifications");
    const savedCustomAchievementNotifications = readPreference(user.uid, "custom_achievement_notifications");
    const savedAchievementNotificationPosition = readPreference(user.uid, "achievement_notification_position");
    const savedHapticsEnabled = readPreference(user.uid, "haptics_enabled");

    if (savedOpenAtLogin !== null) {
      const shouldOpenAtLogin = savedOpenAtLogin === "true";
      setOpenAtLoginState(shouldOpenAtLogin);
      if (shouldOpenAtLogin) {
        void window.electronAPI?.setOpenAtLogin?.(true).then((result) => {
          setOpenAtLoginState(result.openAtLogin);
        }).catch(console.error);
      }
    }
    if (savedGameBootIntro !== null) {
      setGameBootIntroEnabled(savedGameBootIntro === "true");
    }
    if (savedGameBootSound !== null) {
      setGameBootIntroSoundEnabled(savedGameBootSound === "true");
    }
    if (savedLowPerf !== null) {
      setLowPerformanceMode(savedLowPerf === "true");
    } else {
      const nav = typeof navigator !== "undefined" ? (navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number }) : null;
      const isWeakDevice = Boolean(
        nav &&
          ((nav.deviceMemory != null && nav.deviceMemory <= 4) ||
            (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4)),
      );
      if (isWeakDevice) {
        setLowPerformanceMode(true);
      }
    }
    if (savedCloseLaunch !== null) setCloseOnLaunch(savedCloseLaunch === "true");
    if (savedMinimizeToTray !== null) setMinimizeToTrayOnClose(savedMinimizeToTray === "true");
    if (savedRestoreLastScreen !== null) setRestoreLastScreen(savedRestoreLastScreen === "true");
    if (savedConfirmBeforeExit !== null) setConfirmBeforeExit(savedConfirmBeforeExit === "true");
    if (savedHapticsEnabled !== null) setHapticsEnabled(savedHapticsEnabled === "true");
    if (savedAchievementNotifications !== null) {
      setAchievementNotificationsEnabled(savedAchievementNotifications === "true");
    }
    if (savedCustomAchievementNotifications !== null) {
      setCustomAchievementNotifications(savedCustomAchievementNotifications === "true");
    }
    if (
      savedAchievementNotificationPosition === "top-left"
      || savedAchievementNotificationPosition === "top-right"
      || savedAchievementNotificationPosition === "top-center"
      || savedAchievementNotificationPosition === "bottom-left"
      || savedAchievementNotificationPosition === "bottom-right"
    ) {
      setAchievementNotificationPosition(savedAchievementNotificationPosition);
    }

    if (
      savedLanguage === "pt-BR" ||
      savedLanguage === "en-US" ||
      savedLanguage === "es-ES" ||
      savedLanguage === "fr-FR" ||
      savedLanguage === "de-DE" ||
      savedLanguage === "it-IT"
    ) {
      setLanguage(savedLanguage);
    }
    if (savedEffectsVolume != null && Number.isFinite(savedEffectsVolume)) {
      setEffectsVolume(clampVolume(savedEffectsVolume));
    }
    if (savedAchievementVolume != null && Number.isFinite(savedAchievementVolume)) {
      setAchievementVolume(clampVolume(savedAchievementVolume));
    }
    if (savedNotificationVolume != null && Number.isFinite(savedNotificationVolume)) {
      setNotificationVolume(clampVolume(savedNotificationVolume));
    }
    if (savedMusicVolume != null && Number.isFinite(savedMusicVolume)) {
      setMusicVolume(clampVolume(savedMusicVolume));
    }
    if (
      savedSoundTheme === "default" ||
      savedSoundTheme === "ps5" ||
      savedSoundTheme === "ps4" ||
      savedSoundTheme === "psp" ||
      savedSoundTheme === "ps2" ||
      savedSoundTheme === "gamecube" ||
      savedSoundTheme === "xbox360" ||
      savedSoundTheme === "cyberpunk"
    ) {
      setSoundTheme(savedSoundTheme);
    }
    if (
      savedVisualTheme === "phelierium" ||
      savedVisualTheme === "checkpoint" ||
      savedVisualTheme === "ps5" ||
      savedVisualTheme === "playstation" ||
      savedVisualTheme === "ps4" ||
      savedVisualTheme === "psp" ||
      savedVisualTheme === "gamecube" ||
      savedVisualTheme === "xbox360" ||
      savedVisualTheme === "cyberpunk"
    ) {
      setVisualTheme(savedVisualTheme);
    }
    setHydratedPreferencesUid(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || hydratedPreferencesUid !== user.uid) return;
    writePreference(user.uid, "language", language);
    writePreference(user.uid, "effects_volume", String(effectsVolume));
    writePreference(user.uid, "achievement_volume", String(achievementVolume));
    writePreference(user.uid, "notification_volume", String(notificationVolume));
    writePreference(user.uid, "music_volume", String(musicVolume));
    writePreference(user.uid, "sound_theme", soundTheme);
    writePreference(user.uid, "visual_theme", visualTheme);
    writePreference(user.uid, "open_at_login", String(openAtLogin));
    writePreference(user.uid, "low_perf", String(lowPerformanceMode));
    writePreference(user.uid, "game_boot_intro", String(gameBootIntroEnabled));
    writePreference(user.uid, "game_boot_intro_sound", String(gameBootIntroSoundEnabled));
    writePreference(user.uid, "close_launch", String(closeOnLaunch));
    writePreference(user.uid, "minimize_to_tray", String(minimizeToTrayOnClose));
    writePreference(user.uid, "restore_last_screen", String(restoreLastScreen));
    writePreference(user.uid, "confirm_before_exit", String(confirmBeforeExit));
    writePreference(user.uid, "haptics_enabled", String(hapticsEnabled));
    writePreference(user.uid, "achievement_notifications", String(achievementNotificationsEnabled));
    writePreference(user.uid, "custom_achievement_notifications", String(customAchievementNotifications));
    writePreference(user.uid, "achievement_notification_position", achievementNotificationPosition);
  }, [achievementNotificationPosition, achievementNotificationsEnabled, achievementVolume, closeOnLaunch, confirmBeforeExit, customAchievementNotifications, effectsVolume, gameBootIntroEnabled, gameBootIntroSoundEnabled, hapticsEnabled, hydratedPreferencesUid, language, lowPerformanceMode, minimizeToTrayOnClose, musicVolume, notificationVolume, openAtLogin, restoreLastScreen, soundTheme, user?.uid, visualTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.launcherTheme = visualTheme;
    if (lowPerformanceMode) {
      document.body.classList.add("low-performance");
    } else {
      document.body.classList.remove("low-performance");
    }
  }, [visualTheme, lowPerformanceMode]);

  useEffect(() => {
    try { localStorage.setItem("checkpoint_haptics_enabled_global", String(hapticsEnabled)); } catch {}
  }, [hapticsEnabled]);

  useEffect(() => {
    try { localStorage.setItem("checkpoint_achievement_volume_global", String(achievementVolume)); } catch {}
    void window.electronAPI?.setAchievementVolume?.(achievementVolume).catch(console.error);
  }, [achievementVolume]);

  useEffect(() => {
    try { localStorage.setItem("checkpoint_sound_theme_global", soundTheme); } catch {}
    void window.electronAPI?.setAchievementSoundTheme?.(soundTheme).catch(console.error);
  }, [soundTheme]);

  useEffect(() => {
    if (!user?.uid || hydratedPreferencesUid !== user.uid) return;
    void window.electronAPI?.setAchievementSoundTheme?.(soundTheme).catch(console.error);
  }, [hydratedPreferencesUid, soundTheme, user?.uid]);

  useEffect(() => {
    if (!user?.uid || hydratedPreferencesUid !== user.uid) return;
    void window.electronAPI?.setAchievementNotificationSettings?.({
      enabled: achievementNotificationsEnabled,
      custom: customAchievementNotifications,
      position: achievementNotificationPosition,
    }).catch(console.error);
  }, [
    achievementNotificationPosition,
    achievementNotificationsEnabled,
    customAchievementNotifications,
    hydratedPreferencesUid,
    user?.uid,
  ]);

  const translate = useCallback(
    (key: TranslationKey) => {
      if (language === "pt-BR" || language === "en-US" || language === "es-ES") {
        return translations[language][key] ?? translations["pt-BR"][key];
      }
      return (
        additionalTranslations[language][key]
        ?? translations["en-US"][key]
        ?? translations["pt-BR"][key]
      );
    },
    [language],
  );

  const stateValue = useMemo<PreferencesStateValue>(
    () => ({
      language,
      effectsVolume,
      achievementVolume,
      notificationVolume,
      achievementNotificationsEnabled,
      customAchievementNotifications,
      achievementNotificationPosition,
      musicVolume,
      soundTheme,
      visualTheme,
      openAtLogin,
      lowPerformanceMode,
      gameBootIntroEnabled,
      gameBootIntroSoundEnabled,
      closeOnLaunch,
      minimizeToTrayOnClose,
      restoreLastScreen,
      confirmBeforeExit,
      hapticsEnabled,
      preferencesHydrated: hydratedPreferencesUid === user?.uid,
    }),
    [achievementNotificationPosition, achievementNotificationsEnabled, achievementVolume, closeOnLaunch, confirmBeforeExit, customAchievementNotifications, effectsVolume, gameBootIntroEnabled, gameBootIntroSoundEnabled, hapticsEnabled, hydratedPreferencesUid, language, lowPerformanceMode, minimizeToTrayOnClose, musicVolume, notificationVolume, openAtLogin, restoreLastScreen, soundTheme, user?.uid, visualTheme],
  );

  const actionsValue = useMemo<PreferencesActionsValue>(
    () => ({
      setLanguage,
      setEffectsVolume: (volume) => setEffectsVolume(clampVolume(volume)),
      setAchievementVolume: (volume) => setAchievementVolume(clampVolume(volume)),
      setNotificationVolume: (volume) => setNotificationVolume(clampVolume(volume)),
      setAchievementNotificationsEnabled,
      setCustomAchievementNotifications,
      setAchievementNotificationPosition,
      setMusicVolume: (volume) => setMusicVolume(clampVolume(volume)),
      setSoundTheme,
      setVisualTheme,
      setOpenAtLogin: (val) => {
        setOpenAtLoginState(val);
        window.electronAPI?.setOpenAtLogin?.(val).then((result) => {
          setOpenAtLoginState(result.openAtLogin);
        }).catch(console.error);
      },
      setLowPerformanceMode,
      setGameBootIntroEnabled,
      setGameBootIntroSoundEnabled,
      setCloseOnLaunch,
      setMinimizeToTrayOnClose,
      setRestoreLastScreen,
      setConfirmBeforeExit,
      setHapticsEnabled,
      t: translate,
    }),
    [translate],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({ ...stateValue, ...actionsValue }),
    [stateValue, actionsValue],
  );

  return (
    <PreferencesActionsContext.Provider value={actionsValue}>
      <PreferencesStateContext.Provider value={stateValue}>
        <PreferencesContext.Provider value={value}>
          {children}
        </PreferencesContext.Provider>
      </PreferencesStateContext.Provider>
    </PreferencesActionsContext.Provider>
  );
};

export const usePreferencesState = () => {
  const ctx = useContext(PreferencesStateContext);
  if (!ctx) throw new Error("usePreferencesState deve ser usado dentro de PreferencesProvider");
  return ctx;
};

export const usePreferencesActions = () => {
  const ctx = useContext(PreferencesActionsContext);
  if (!ctx) throw new Error("usePreferencesActions deve ser usado dentro de PreferencesProvider");
  return ctx;
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences deve ser usado dentro de PreferencesProvider");
  }
  return ctx;
};
