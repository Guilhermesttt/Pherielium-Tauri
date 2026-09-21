import type { Game, GameLaunchProfile } from "./domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import type { SteamAchievement, SteamAppDetails } from "../services/steam";
import type { EpicAppDetails } from "../services/epic";

export interface GameDetailPanelProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  playSound: (type: SoundEffectType) => void;
  onLibraryChanged?: () => Promise<void> | void;
  onGameHydrated?: (game: Game) => void;
  onOpenMods?: () => void;
}

export interface GamePanelMod {
  id: string;
  name: string;
  pictureUrl?: string;
  enabled: boolean;
  status?: "downloaded" | "installed";
  manifestPath?: string;
}

export interface DisplayOption {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

export interface GalleryItem {
  type: "video" | "image";
  url: string;
  thumbnail?: string;
}

export type AchievementFilter = "all" | "unlocked" | "locked";

export type GameDetailTab = "play" | "captures" | "achievements" | "about" | "manage" | "mods";

export interface AsyncSectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface GameDetailState {
  activeTab: string;
  isLaunching: boolean;
  launchError: string | null;
  galleryModalOpen: boolean;
  currentGalleryIndex: number;
  deleteModalOpen: boolean;
  isDeleting: boolean;
  deleteConfirmText: string;
  achievementFilter: AchievementFilter;
  achievementSearch: string;
  debouncedAchievementSearch: string;
  isAddAchModalOpen: boolean;
  newAchName: string;
  newAchDesc: string;
  isSavingLaunchProfile: boolean;
}

export type GameDetailAction =
  | { type: "SET_TAB"; payload: string }
  | { type: "SET_LAUNCHING"; payload: boolean }
  | { type: "SET_LAUNCH_ERROR"; payload: string | null }
  | { type: "OPEN_GALLERY"; payload?: number }
  | { type: "CLOSE_GALLERY" }
  | { type: "SET_GALLERY_INDEX"; payload: number }
  | { type: "OPEN_DELETE_MODAL" }
  | { type: "CLOSE_DELETE_MODAL" }
  | { type: "SET_DELETE_CONFIRM_TEXT"; payload: string }
  | { type: "SET_DELETING"; payload: boolean }
  | { type: "SET_ACHIEVEMENT_FILTER"; payload: AchievementFilter }
  | { type: "SET_ACHIEVEMENT_SEARCH"; payload: string }
  | { type: "SET_DEBOUNCED_SEARCH"; payload: string }
  | { type: "OPEN_ADD_ACH_MODAL" }
  | { type: "CLOSE_ADD_ACH_MODAL" }
  | { type: "SET_NEW_ACH_NAME"; payload: string }
  | { type: "SET_NEW_ACH_DESC"; payload: string }
  | { type: "SET_SAVING_LAUNCH_PROFILE"; payload: boolean }
  | { type: "RESET_FOR_GAME"; payload: { defaultTab: string } };

export const MIN_LAUNCH_SCREEN_MS = 3000;

export const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const normalizeSteamLookup = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface GameDetailCopy {
  tabPlay: string;
  tabCaptures: string;
  tabAchievements: string;
  tabAbout: string;
  tabManage: string;
  tabMods: string;
  steamLabel: string;
  epicLabel: string;
  localLabel: string;
  library: string;
  timePlayed: string;
  lastSession: string;
  neverStarted: string;
  achievements: string;
  appId: string;
  epicShortcutLabel: string;
  epicShortcut: string;
  epicStore: string;
  source: string;
  sourceSteamSync: string;
  sourceEpicCatalog: string;
  sourceManual: string;
  photoWall: string;
  viewGallery: string;
  noScreenshot: string;
  about: string;
  seeMore: string;
  popularTags: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  category: string;
  notInformed: string;
  management: string;
  verify: string;
  edit: string;
  createShortcut: string;
  remove: string;
  platform: string;
  noDescription: string;
  gallery: string;
  previous: string;
  next: string;
  removeGame: string;
  cannotUndo: string;
  confirmRemove: (title: string) => string;
  cancel: string;
  removing: string;
  close: string;
  loginToRemove: string;
  removedSuccess: string;
  removeError: string;
  launchGenericError: string;
  achievementsLoading: string;
  achievementsEmpty: string;
  achievementsLocked: string;
  achievementsUnlocked: string;
  achievementsUnlockedAt: string;
  verifySuccess: string;
  verifyNotFound: string;
  shortcutComingSoon: string;
  achievementsSource: string;
  achievementsLocalSource: string;
  achievementsEpicLocalSource: string;
  achievementsSteamFallback: string;
  achievementsNeedSteam: string;
  achievementsMissingAppId: string;
  achievementsEpicLocalEmpty: string;
  achievementsEpicBinarySave: string;
  achievementsEpicNotInstalled: string;
  filterAll: string;
  filterUnlocked: string;
  filterLocked: string;
  searchPlaceholder: string;
  tryAgain: string;
  achievementsNoSupportTitle: string;
  achievementsNoSupportDesc: string;
  noMatchingAchievements: string;
  running: string;
  launch: string;
  launching: string;
  openFolder: string;
  confirmDeletePlaceholder: string;
  gameRunning: string;
}

export const DETAIL_PANEL_COPY: Record<string, GameDetailCopy> = {
  "pt-BR": {
    tabPlay: "JOGAR",
    tabCaptures: "CAPTURAS",
    tabAchievements: "CONQUISTAS",
    tabAbout: "SOBRE",
    tabManage: "GERENCIAR",
    tabMods: "MODS",
    steamLabel: "Steam",
    epicLabel: "Epic Games",
    localLabel: "PC Local",
    library: "Biblioteca",
    timePlayed: "TEMPO JOGADO",
    lastSession: "ÚLTIMA SESSÃO",
    neverStarted: "Ainda não iniciado",
    achievements: "CONQUISTAS",
    appId: "App ID",
    epicShortcutLabel: "Epic",
    epicShortcut: "Atalho direto",
    epicStore: "Via loja",
    source: "Fonte",
    sourceSteamSync: "Sync Steam",
    sourceEpicCatalog: "Catálogo Epic",
    sourceManual: "Manual",
    photoWall: "Mural de fotos",
    viewGallery: "Ver Galeria",
    noScreenshot: "Nenhuma captura",
    about: "Sobre",
    seeMore: "Ver mais →",
    popularTags: "Marcadores Populares",
    developer: "Desenvolvedor",
    publisher: "Distribuidora",
    releaseDate: "Data de Lançamento",
    category: "Categoria",
    notInformed: "Não informado",
    management: "Gerenciamento",
    verify: "Verificar",
    edit: "Editar",
    createShortcut: "Criar Atalho",
    remove: "Remover",
    platform: "Plataforma",
    noDescription: "Sem descrição disponível para este jogo.",
    gallery: "GALERIA",
    previous: "← Anterior",
    next: "Próximo →",
    removeGame: "Remover jogo",
    cannotUndo: "Esta ação não pode ser desfeita",
    confirmRemove: (title: string) =>
      `Tem certeza que deseja remover "${title}" da sua biblioteca?`,
    cancel: "Cancelar",
    removing: "Removendo...",
    close: "Fechar",
    loginToRemove: "Você precisa estar logado para remover um jogo.",
    removedSuccess: "Jogo removido.",
    removeError: "Erro ao remover jogo.",
    launchGenericError: "Falha ao iniciar o jogo.",
    achievementsLoading: "Buscando conquistas...",
    achievementsEmpty: "Nenhuma conquista encontrada.",
    achievementsLocked: "Bloqueada",
    achievementsUnlocked: "Desbloqueada",
    achievementsUnlockedAt: "Desbloqueada em",
    verifySuccess: "Executável encontrado.",
    verifyNotFound: "Executável não encontrado.",
    shortcutComingSoon: "Em breve.",
    achievementsSource: "Suas conquistas",
    achievementsLocalSource: "Conquistas locais",
    achievementsEpicLocalSource: "Arquivos locais Epic",
    achievementsSteamFallback: "Steam",
    achievementsNeedSteam: "Conecte sua conta Steam para carregar conquistas.",
    achievementsMissingAppId: "Este jogo não possui Steam App ID.",
    achievementsEpicLocalEmpty: "Nenhum arquivo local de conquistas legível.",
    achievementsEpicBinarySave: "Formato binário/protegido não suportado.",
    achievementsEpicNotInstalled: "Jogo não instalado localmente.",
    filterAll: "Todas",
    filterUnlocked: "Desbloqueadas",
    filterLocked: "Bloqueadas",
    searchPlaceholder: "Buscar conquista...",
    tryAgain: "Tentar novamente",
    achievementsNoSupportTitle: "Este jogo não possui conquistas",
    achievementsNoSupportDesc: "Não foram encontradas conquistas suportadas ou integradas para este título.",
    noMatchingAchievements: "Nenhuma conquista corresponde ao filtro ou busca.",
    running: "Em execução",
    launch: "Jogar",
    launching: "Iniciando...",
    openFolder: "Abrir pasta",
    confirmDeletePlaceholder: "Digite o nome do jogo",
    gameRunning: "Jogo em execução",
  },
  "en-US": {
    tabPlay: "PLAY",
    tabCaptures: "CAPTURES",
    tabAchievements: "ACHIEVEMENTS",
    tabAbout: "ABOUT",
    tabManage: "MANAGE",
    tabMods: "MODS",
    steamLabel: "Steam",
    epicLabel: "Epic Games",
    localLabel: "Local PC",
    library: "Library",
    timePlayed: "TIME PLAYED",
    lastSession: "LAST SESSION",
    neverStarted: "Not started",
    achievements: "ACHIEVEMENTS",
    appId: "App ID",
    epicShortcutLabel: "Epic",
    epicShortcut: "Direct shortcut",
    epicStore: "Via store",
    source: "Source",
    sourceSteamSync: "Steam sync",
    sourceEpicCatalog: "Epic catalog",
    sourceManual: "Manual",
    photoWall: "Photo wall",
    viewGallery: "View gallery",
    noScreenshot: "No screenshot",
    about: "About",
    seeMore: "See more →",
    popularTags: "Popular tags",
    developer: "Developer",
    publisher: "Publisher",
    releaseDate: "Release date",
    category: "Category",
    notInformed: "Not informed",
    management: "Management",
    verify: "Verify",
    edit: "Edit",
    createShortcut: "Create shortcut",
    remove: "Remove",
    platform: "Platform",
    noDescription: "No description available.",
    gallery: "GALLERY",
    previous: "← Previous",
    next: "Next →",
    removeGame: "Remove game",
    cannotUndo: "This action cannot be undone",
    confirmRemove: (title: string) =>
      `Are you sure you want to remove "${title}" from your library? Type the game name to confirm.`,
    cancel: "Cancel",
    removing: "Removing...",
    close: "Close",
    loginToRemove: "You must be logged in to remove a game.",
    removedSuccess: "Game removed.",
    removeError: "Error removing game.",
    launchGenericError: "Failed to launch the game.",
    achievementsLoading: "Loading achievements...",
    achievementsEmpty: "No achievements found.",
    achievementsLocked: "Locked",
    achievementsUnlocked: "Unlocked",
    achievementsUnlockedAt: "Unlocked on",
    verifySuccess: "Executable found.",
    verifyNotFound: "Executable not found.",
    shortcutComingSoon: "Coming soon.",
    achievementsSource: "Your achievements",
    achievementsLocalSource: "Local achievements",
    achievementsEpicLocalSource: "Epic local files",
    achievementsSteamFallback: "Steam",
    achievementsNeedSteam: "Connect your Steam account to load achievements.",
    achievementsMissingAppId: "This game has no Steam App ID.",
    achievementsEpicLocalEmpty: "No readable local achievement file found.",
    achievementsEpicBinarySave: "Binary/protected save not supported.",
    achievementsEpicNotInstalled: "Game not installed locally.",
    filterAll: "All",
    filterUnlocked: "Unlocked",
    filterLocked: "Locked",
    searchPlaceholder: "Search achievement...",
    tryAgain: "Try again",
    achievementsNoSupportTitle: "This game has no achievements",
    achievementsNoSupportDesc: "No supported or integrated achievements were found for this title.",
    noMatchingAchievements: "No achievements match your filter or search.",
    running: "Running",
    launch: "Play",
    launching: "Launching...",
    openFolder: "Open folder",
    confirmDeletePlaceholder: "Type the game name",
    gameRunning: "Game is running",
  },
  "es-ES": {
    tabPlay: "JUGAR",
    tabCaptures: "CAPTURAS",
    tabAchievements: "LOGROS",
    tabAbout: "ACERCA DE",
    tabManage: "GESTIONAR",
    tabMods: "MODS",
    steamLabel: "Steam",
    epicLabel: "Epic Games",
    localLabel: "PC Local",
    library: "Biblioteca",
    timePlayed: "TIEMPO JUGADO",
    lastSession: "ÚLTIMA SESIÓN",
    neverStarted: "No iniciado",
    achievements: "LOGROS",
    appId: "App ID",
    epicShortcutLabel: "Epic",
    epicShortcut: "Acceso directo",
    epicStore: "Vía tienda",
    source: "Fuente",
    sourceSteamSync: "Sync Steam",
    sourceEpicCatalog: "Catálogo Epic",
    sourceManual: "Manual",
    photoWall: "Mural de fotos",
    viewGallery: "Ver galería",
    noScreenshot: "Sin capturas",
    about: "Acerca de",
    seeMore: "Ver más →",
    popularTags: "Etiquetas populares",
    developer: "Desarrollador",
    publisher: "Distribuidora",
    releaseDate: "Fecha de lanzamiento",
    category: "Categoría",
    notInformed: "No informado",
    management: "Gestión",
    verify: "Verificar",
    edit: "Editar",
    createShortcut: "Crear acceso directo",
    remove: "Eliminar",
    platform: "Plataforma",
    noDescription: "Sin descripción.",
    gallery: "GALERÍA",
    previous: "← Anterior",
    next: "Siguiente →",
    removeGame: "Eliminar juego",
    cannotUndo: "Esta acción no se puede deshacer",
    confirmRemove: (title: string) =>
      `¿Seguro que deseas eliminar "${title}" de tu biblioteca? Escribe el nombre del juego para confirmar.`,
    cancel: "Cancelar",
    removing: "Eliminando...",
    close: "Cerrar",
    loginToRemove: "Debes iniciar sesión para eliminar un juego.",
    removedSuccess: "Juego eliminado.",
    removeError: "Error al eliminar el juego.",
    launchGenericError: "No se pudo iniciar el juego.",
    achievementsLoading: "Cargando logros...",
    achievementsEmpty: "No se encontraron logros.",
    achievementsLocked: "Bloqueado",
    achievementsUnlocked: "Desbloqueado",
    achievementsUnlockedAt: "Desbloqueado el",
    verifySuccess: "Ejecutable encontrado.",
    verifyNotFound: "Ejecutable no encontrado.",
    shortcutComingSoon: "Próximamente.",
    achievementsSource: "Tus logros",
    achievementsLocalSource: "Logros locales",
    achievementsEpicLocalSource: "Archivos locales Epic",
    achievementsSteamFallback: "Steam",
    achievementsNeedSteam: "Conecta tu cuenta de Steam para cargar logros.",
    achievementsMissingAppId: "Este juego no tiene Steam App ID.",
    achievementsEpicLocalEmpty: "No se encontró archivo local legible.",
    achievementsEpicBinarySave: "Formato binario/protegido no soportado.",
    achievementsEpicNotInstalled: "Juego no instalado localmente.",
    filterAll: "Todas",
    filterUnlocked: "Desbloqueadas",
    filterLocked: "Bloqueadas",
    searchPlaceholder: "Buscar logro...",
    tryAgain: "Reintentar",
    achievementsNoSupportTitle: "Este juego no tiene logros",
    achievementsNoSupportDesc: "No se encontraron logros admitidos o integrados para este título.",
    noMatchingAchievements: "Ningún logro coincide con el filtro o búsqueda.",
    running: "En execução",
    launch: "Jugar",
    launching: "Iniciando...",
    openFolder: "Abrir carpeta",
    confirmDeletePlaceholder: "Escribe el nombre del juego",
    gameRunning: "El juego está en ejecución",
  },
};

export const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  ACTION: { "pt-BR": "Ação", "en-US": "Action", "es-ES": "Acción" },
  ADVENTURE: { "pt-BR": "Aventura", "en-US": "Adventure", "es-ES": "Aventura" },
  RPG: { "pt-BR": "RPG", "en-US": "RPG", "es-ES": "RPG" },
  SPORTS: { "pt-BR": "Esportes", "en-US": "Sports", "es-ES": "Deportes" },
  RACING: { "pt-BR": "Corrida", "en-US": "Racing", "es-ES": "Carreras" },
  STRATEGY: { "pt-BR": "Estratégia", "en-US": "Strategy", "es-ES": "Estrategia" },
};
