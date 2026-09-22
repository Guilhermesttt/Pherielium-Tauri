import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Globe,
  Gamepad2,
  RefreshCw,
  FolderOpen,
  HardDrive,
  Check,
  CheckCircle2,
  ChevronDown,
  LibraryBig,
  Upload,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import ModalShell from "./ui/ModalShell";
import { AddGameWizardSteps } from "./game/AddGameWizardSteps";
import { GhostSelect } from "./ui/GhostSelect";
import { LoadingState } from "./ui/loading-state";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../context/PreferencesContext";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import { useNotification } from "./NotificationCenter";
import {
  createLibraryGame,
  updateLibraryGame,
} from "../services/localLibrary";
import {
  fetchSteamAppDetailsResult,
  fetchSteamAchievementSchema,
} from "../services/steam";
import {
  fetchEpicAppDetailsResult,
  searchEpicGames,
} from "../services/epic";
import { apiUrl } from "../services/api";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import type { LauncherType } from "../types/domain";
import {
  SteamBrandIcon,
  EpicBrandIcon,
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  XboxBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from "./Sidebar";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: SoundEffectType) => void;
  gameToEdit?: any | null;
  initialLauncherType?: LauncherType;
  onSaved?: () => void;
}

const EpicIcon: React.FC<{ className?: string; invert?: boolean }> = ({ className, invert = true }) => (
  <img
    width={96}
    height={96}
    src={EPIC_GAMES_ICON_PATH}
    alt="Epic Games"
    className={className}
    style={{ filter: invert ? "invert(1)" : "none" }}
  />
);

const CATEGORIES = [
  { id: "ACTION", label: "Ação" },
  { id: "ADVENTURE", label: "Aventura" },
  { id: "RACING", label: "Corrida" },
  { id: "RPG", label: "RPG" },
  { id: "SHOOTER", label: "FPS" },
  { id: "ARCADE", label: "Arcade" },
  { id: "FIGHTING", label: "Luta" },
  { id: "ROLE_PLAYING", label: "Role Playing" },
  { id: "Multiplayer", label: "Multiplayer" },
  { id: "SPORTS", label: "Esportes" },
  { id: "HORROR", label: "Terror" },
  { id: "STRATEGY", label: "Estratégia" },
  { id: "SIMULATION", label: "Simulação" },
  { id: "PUZZLE", label: "Quebra-Cabeça" },
  { id: "CASUAL", label: "Casual" },
];

type GameFormData = {
  title: string;
  image?: string;
  cardImage: string;
  backgroundImage: string;
  logoImage?: string;
  category: string;
  description: string;
  aboutTheGame?: string;
  launcherType: LauncherType;
  executablePath: string;
  steamAppId?: string;
  epicCatalogId?: string;
  epicLaunchId?: string;
  epicStoreUrl?: string;
  sizeGB?: number;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  trailerUrl?: string;
  screenshots?: string[];
  source?: "manual" | "steam" | "epic";
  hasGame?: boolean;
  totalAchievements?: number;
  completedAchievements?: number;
};

const removeUndefined = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

const isWindowsExecutablePath = (value: string) =>
  /^(?:[a-zA-Z]:[\\/]|\\\\).+\.exe$/i.test(String(value || "").trim());

// Dropdown de busca reutilizado entre Steam e Epic — antes era duplicado
// quase inteiro em dois blocos JSX separados.
const GameSearchDropdown: React.FC<{
  id: string;
  results: any[];
  isSearching: boolean;
  hasQuery: boolean;
  noResultsLabel: string;
  onSelect: (game: any) => void;
}> = ({ id, results, isSearching, hasQuery, noResultsLabel, onSelect }) => {
  const showEmptyState =
    hasQuery && !isSearching && results.length === 0;

  if (!isSearching && !showEmptyState && results.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        id={id}
        role="listbox"
        aria-label="Resultados da busca"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
      >
        {isSearching && (
          <div className="flex items-center gap-3 p-4 text-white/40">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs">Buscando...</span>
          </div>
        )}
        {!isSearching && showEmptyState && (
          <div className="p-4 text-xs text-white/40">{noResultsLabel}</div>
        )}
        {!isSearching &&
          results.map((g) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={g.id}
              onClick={() => onSelect(g)}
              className="w-full flex items-center gap-4 p-3 hover:bg-white/5 transition-colors text-left group"
            >
              {g.tiny_image ? (
                <img
                  src={g.tiny_image}
                  alt=""
                  className="w-12 h-6 object-cover rounded opacity-40 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-12 h-6 bg-white/5 rounded" />
              )}
              <span className="text-sm text-white/70 group-hover:text-white">
                {g.name}
              </span>
            </button>
          ))}
      </motion.div>
    </AnimatePresence>
  );
};

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  initialLauncherType,
  onSaved,
}) => {
  const { user } = useAuth();
  const { language } = usePreferences();
  const modalLanguage =
    language === "pt-BR" || language === "en-US" || language === "es-ES"
      ? language
      : "en-US";
  const baseCopy = {
    "pt-BR": {
      editInfo: "Editar informações",
      addGame: "Adicionar Jogo",
      steamSearch: "Buscar na Steam",
      epicSearch: "Buscar na Epic",
      optional: "Opcional",
      searchPlaceholder: "Pesquisar jogo para auto-preenchimento...",
      title: "Título",
      titlePlaceholder: "Nome do seu jogo",
      category: "Categoria",
      cover: "Capa",
      link: "Link",
      platform: "Plataforma",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Upload",
      confirmAdd: "Confirmar Adição",
      saving: "Salvando...",
      executable: "Executável",
      chooseExe: "Selecionar .exe",
      executableHint:
        "No navegador, o sistema não expõe o caminho completo. Em runtime desktop, o caminho local pode ser usado para iniciar o jogo.",
      noExecutable: "Nenhum executável selecionado",
      noSearchResults: "Nenhum resultado encontrado.",
      searchError: "Erro ao buscar jogos. Tente novamente.",
      sizeGB: "Tamanho (GB)",
      sizePlaceholder: "Ex: 42",
      missingCoverOrExe:
        "Adicione uma capa ou selecione um executável antes de salvar.",
      viewOnEpicStore: "Ver na Epic Games Store",
      ownGameConfirmed: "Tenho esse jogo",
      ownGameConfirm: "Confirmar que possuo este jogo",
      previewPanel: "Prévia no Painel",
      wallpaper: "Wallpaper",
      libraryKicker: "Biblioteca Checkpoint",
      addSubtitle: "Adicione, organize e prepare um novo jogo para iniciar pelo launcher.",
      editSubtitle: "Atualize os dados, as artes e a forma de inicialização deste jogo.",
      localDescription: "Jogos instalados no PC e executáveis personalizados.",
      steamDescription: "Metadados, biblioteca e inicialização pela Steam.",
      epicDescription: "Metadados da Epic com inicialização local opcional.",
      platformSubtitle: "Escolha onde o jogo está instalado ou de onde ele vem.",
      automaticFill: "Preenchimento automático",
      automaticFillHint: "Busque um jogo para importar capa, descrição e metadados.",
      launchTitle: "Inicialização",
      launchHint: "Defina o tamanho estimado e o executável do jogo.",
      gameDetails: "Identidade do jogo",
      gameDetailsHint: "Revise como o jogo será exibido na biblioteca.",
      visualAssets: "Artes da biblioteca",
      visualAssetsHint: "Use links ou arquivos locais para personalizar o card do jogo.",
      description: "Descrição",
      descriptionPlaceholder: "Uma breve descrição do jogo...",
      cancel: "Cancelar",
      saveChanges: "Salvar alterações",
      ready: "Pronto para salvar",
      missingFields: "Preencha os itens obrigatórios",
      setupStatus: "Status do cadastro",
      sourceReady: "Plataforma definida",
      titleReady: "Título informado",
      launchReady: "Jogo confirmado",
      selected: "Selecionado",
      imageTooLarge: "A imagem é muito grande. Escolha um arquivo menor ou use um link.",
    },
    "en-US": {
      editInfo: "Edit game details",
      addGame: "Add Game",
      steamSearch: "Search Steam",
      epicSearch: "Search Epic",
      optional: "Optional",
      searchPlaceholder: "Search game for autofill...",
      title: "Title",
      titlePlaceholder: "Your game name",
      category: "Category",
      cover: "Cover",
      link: "Link",
      platform: "Platform",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Upload",
      confirmAdd: "Confirm",
      saving: "Saving...",
      executable: "Executable",
      chooseExe: "Select .exe",
      executableHint:
        "Browsers do not expose the full local path. In a desktop runtime, the local path can be used to launch the game.",
      noExecutable: "No executable selected",
      noSearchResults: "No results found.",
      searchError: "Error searching games. Please try again.",
      sizeGB: "Size (GB)",
      sizePlaceholder: "E.g. 42",
      missingCoverOrExe:
        "Add a cover image or select an executable before saving.",
      viewOnEpicStore: "View on Epic Games Store",
      ownGameConfirmed: "I own this game",
      ownGameConfirm: "Confirm you own this game",
      previewPanel: "Dashboard Preview",
      wallpaper: "Wallpaper",
      libraryKicker: "Checkpoint Library",
      addSubtitle: "Add, organize and prepare a new game to launch from Checkpoint.",
      editSubtitle: "Update this game's details, artwork and launch method.",
      localDescription: "Installed PC games and custom executables.",
      steamDescription: "Steam metadata, library ownership and launch support.",
      epicDescription: "Epic catalog metadata with optional local launching.",
      platformSubtitle: "Choose where the game is installed or comes from.",
      automaticFill: "Automatic details",
      automaticFillHint: "Search for a game to import artwork, description and metadata.",
      launchTitle: "Launch",
      launchHint: "Set the estimated size and the game's executable.",
      gameDetails: "Game identity",
      gameDetailsHint: "Review how the game will appear in your library.",
      visualAssets: "Library artwork",
      visualAssetsHint: "Use links or local files to customize the game card.",
      description: "Description",
      descriptionPlaceholder: "A short description of the game...",
      cancel: "Cancel",
      saveChanges: "Save changes",
      ready: "Ready to save",
      missingFields: "Complete the required items",
      setupStatus: "Setup status",
      sourceReady: "Platform selected",
      titleReady: "Title provided",
      launchReady: "Game confirmed",
      selected: "Selected",
      imageTooLarge: "The image is too large. Choose a smaller file or use an image URL.",
    },
    "es-ES": {
      editInfo: "Editar información",
      addGame: "Añadir juego",
      steamSearch: "Buscar en Steam",
      epicSearch: "Buscar en Epic",
      optional: "Opcional",
      searchPlaceholder: "Buscar juego para auto-completar...",
      title: "Título",
      titlePlaceholder: "Nombre del juego",
      category: "Categoría",
      cover: "Portada",
      link: "Enlace",
      platform: "Plataforma",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Subir",
      confirmAdd: "Confirmar",
      saving: "Guardando...",
      executable: "Ejecutable",
      chooseExe: "Seleccionar .exe",
      executableHint:
        "El navegador no expone la ruta local completa. En el entorno de escritorio, la ruta local puede usarse para iniciar el juego.",
      noExecutable: "Ningún ejecutable seleccionado",
      noSearchResults: "No se encontraron resultados.",
      searchError: "Error al buscar juegos. Inténtalo de nuevo.",
      sizeGB: "Tamaño (GB)",
      sizePlaceholder: "Ej: 42",
      missingCoverOrExe:
        "Añade una portada o selecciona un ejecutable antes de guardar.",
      viewOnEpicStore: "Ver en la Epic Games Store",
      ownGameConfirmed: "Tengo este juego",
      ownGameConfirm: "Confirmar que poseo este juego",
      previewPanel: "Vista previa del panel",
      wallpaper: "Fondo",
      libraryKicker: "Biblioteca Checkpoint",
      addSubtitle: "Añade, organiza y prepara un nuevo juego para iniciarlo desde Checkpoint.",
      editSubtitle: "Actualiza los datos, las imágenes y el método de inicio de este juego.",
      localDescription: "Juegos instalados en el PC y ejecutables personalizados.",
      steamDescription: "Metadatos, biblioteca e inicio mediante Steam.",
      epicDescription: "Metadatos de Epic con soporte para inicio local.",
      platformSubtitle: "Elige dónde está instalado o de dónde proviene el juego.",
      automaticFill: "Relleno automático",
      automaticFillHint: "Busca un juego para importar portadas, descripción y metadatos.",
      launchTitle: "Inicio",
      launchHint: "Define el tamaño estimado y el ejecutable del juego.",
      gameDetails: "Identidad del juego",
      gameDetailsHint: "Revisa cómo se mostrará el juego en la biblioteca.",
      visualAssets: "Imágenes de la biblioteca",
      visualAssetsHint: "Usa enlaces o archivos locales para personalizar la ficha del juego.",
      description: "Descripción",
      descriptionPlaceholder: "Una breve descripción del juego...",
      cancel: "Cancelar",
      saveChanges: "Guardar cambios",
      ready: "Listo para guardar",
    },
  }[modalLanguage];
  const extraCopy = {
    "fr-FR": {
      editInfo: "Modifier les informations",
      addGame: "Ajouter un jeu",
      steamSearch: "Rechercher sur Steam",
      epicSearch: "Rechercher sur Epic",
      optional: "Facultatif",
      searchPlaceholder: "Rechercher un jeu pour remplir les informations...",
      title: "Titre",
      titlePlaceholder: "Nom du jeu",
      category: "Catégorie",
      cover: "Jaquette",
      link: "Lien",
      platform: "Plateforme",
      upload: "Importer",
      confirmAdd: "Confirmer",
      saving: "Enregistrement...",
      executable: "Exécutable",
      chooseExe: "Choisir un .exe",
      noExecutable: "Aucun exécutable sélectionné",
      noSearchResults: "Aucun résultat trouvé.",
      searchError: "Erreur pendant la recherche. Réessayez.",
      sizeGB: "Taille (Go)",
      viewOnEpicStore: "Voir sur l’Epic Games Store",
      ownGameConfirmed: "Je possède ce jeu",
      ownGameConfirm: "Confirmer que vous possédez ce jeu",
      automaticFill: "Informations automatiques",
      automaticFillHint: "Recherchez un jeu pour importer les images et les métadonnées.",
      gameDetails: "Identité du jeu",
      visualAssets: "Images de la bibliothèque",
      description: "Description",
      descriptionPlaceholder: "Une courte description du jeu...",
      cancel: "Annuler",
      saveChanges: "Enregistrer",
      ready: "Prêt à enregistrer",
      selected: "Sélectionné",
    },
    "de-DE": {
      editInfo: "Informationen bearbeiten",
      addGame: "Spiel hinzufügen",
      steamSearch: "Steam durchsuchen",
      epicSearch: "Epic durchsuchen",
      optional: "Optional",
      searchPlaceholder: "Spiel zum automatischen Ausfüllen suchen...",
      title: "Titel",
      titlePlaceholder: "Name des Spiels",
      category: "Kategorie",
      cover: "Cover",
      link: "Link",
      platform: "Plattform",
      upload: "Hochladen",
      confirmAdd: "Bestätigen",
      saving: "Wird gespeichert...",
      executable: "Ausführbare Datei",
      chooseExe: ".exe auswählen",
      noExecutable: "Keine ausführbare Datei ausgewählt",
      noSearchResults: "Keine Ergebnisse gefunden.",
      searchError: "Fehler bei der Spielsuche. Versuche es erneut.",
      sizeGB: "Größe (GB)",
      viewOnEpicStore: "Im Epic Games Store ansehen",
      ownGameConfirmed: "Ich besitze dieses Spiel",
      ownGameConfirm: "Bestätigen, dass Sie dieses Spiel besitzen",
      automaticFill: "Automatische Details",
      automaticFillHint: "Suchen Sie ein Spiel, um Artwork, Beschreibung und Metadaten zu importieren.",
      gameDetails: "Spielidentität",
      visualAssets: "Bibliotheksgrafiken",
      description: "Beschreibung",
      descriptionPlaceholder: "Eine kurze Beschreibung des Spiels...",
      cancel: "Abbrechen",
      saveChanges: "Speichern",
      ready: "Bereit zum Speichern",
      selected: "Ausgewählt",
    },
    "it-IT": {
      editInfo: "Modifica informazioni",
      addGame: "Aggiungi gioco",
      steamSearch: "Cerca su Steam",
      epicSearch: "Cerca su Epic",
      optional: "Opzionale",
      searchPlaceholder: "Cerca un gioco per compilare i dati...",
      title: "Titolo",
      titlePlaceholder: "Nome del gioco",
      category: "Categoria",
      cover: "Copertina",
      link: "Link",
      platform: "Piattaforma",
      upload: "Carica",
      confirmAdd: "Conferma",
      saving: "Salvataggio...",
      executable: "Eseguibile",
      chooseExe: "Seleziona .exe",
      noExecutable: "Nessun eseguibile selezionato",
      noSearchResults: "Nessun risultato trovato.",
      searchError: "Errore durante la ricerca. Riprova.",
      sizeGB: "Dimensione (GB)",
      viewOnEpicStore: "Visualizza su Epic Games Store",
      ownGameConfirmed: "Possiedo questo gioco",
      ownGameConfirm: "Conferma di possedere questo gioco",
      automaticFill: "Dati automatici",
      automaticFillHint: "Cerca un gioco per importare copertina, descrizione e metadati.",
      gameDetails: "Identità del gioco",
      visualAssets: "Elementi visivi della libreria",
      description: "Descrizione",
      descriptionPlaceholder: "Una breve descrizione del gioco...",
      cancel: "Annulla",
      saveChanges: "Salva modifiche",
      ready: "Pronto per il salvataggio",
      selected: "Selezionato",
    },
  }[language as "fr-FR" | "de-DE" | "it-IT"] || {};
  const copy = { ...baseCopy, ...extraCopy };
  const { notify } = useNotification();
  const executableInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const wallpaperInputRef = React.useRef<HTMLInputElement>(null);
  const searchDebounceRef = React.useRef<number | null>(null);
  const searchRequestRef = React.useRef(0);
  const detailsRequestRef = React.useRef(0);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSource, setSearchSource] = useState<"steam" | "epic">(() => {
    if (gameToEdit?.launcherType === "epic" || initialLauncherType === "epic") return "epic";
    return "steam";
  });

  const [formData, setFormData] = useState<GameFormData>(() => {
    if (gameToEdit) {
      return {
        title: gameToEdit.title || "",
        image: gameToEdit.image || "",
        cardImage: gameToEdit.cardImage || "",
        backgroundImage: gameToEdit.backgroundImage || gameToEdit.image || "",
        logoImage: gameToEdit.logoImage || "",
        category: gameToEdit.category || "ACTION",
        description: gameToEdit.description || "",
        aboutTheGame: gameToEdit.aboutTheGame || "",
        launcherType: gameToEdit.launcherType || initialLauncherType || "local",
        executablePath: gameToEdit.executablePath || "",
        steamAppId: gameToEdit.steamAppId || "",
        epicCatalogId: gameToEdit.epicCatalogId || "",
        epicLaunchId: gameToEdit.epicLaunchId || "",
        epicStoreUrl: gameToEdit.epicStoreUrl || "",
        sizeGB: gameToEdit.sizeGB,
        releaseDate: gameToEdit.releaseDate || "",
        developer: gameToEdit.developer || "",
        publisher: gameToEdit.publisher || "",
        tags: gameToEdit.tags || [],
        trailerUrl: gameToEdit.trailerUrl || "",
        screenshots: gameToEdit.screenshots || [],
        source: gameToEdit.source || "manual",
        totalAchievements: gameToEdit.totalAchievements,
        completedAchievements: gameToEdit.completedAchievements,
        hasGame:
          gameToEdit.hasGame ??
          Boolean(gameToEdit.steamAppId || gameToEdit.epicCatalogId),
      };
    }
    return {
      title: "",
      cardImage: "",
      backgroundImage: "",
      category: "ACTION",
      description: "",
      launcherType: initialLauncherType || "local",
      executablePath: "",
      source: "manual",
      hasGame: false,
      epicLaunchId: "",
    };
  });

  useEffect(() => {
    if (isOpen) {
      searchRequestRef.current += 1;
      detailsRequestRef.current += 1;
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (gameToEdit) {
        setFormData({
          title: gameToEdit.title || "",
          image: gameToEdit.image || "",
          cardImage: gameToEdit.cardImage || "",
          backgroundImage: gameToEdit.backgroundImage || gameToEdit.image || "",
          logoImage: gameToEdit.logoImage || "",
          category: gameToEdit.category || "ACTION",
          description: gameToEdit.description || "",
          aboutTheGame: gameToEdit.aboutTheGame || "",
          launcherType: gameToEdit.launcherType || initialLauncherType || "local",
          executablePath: gameToEdit.executablePath || "",
          steamAppId: gameToEdit.steamAppId || "",
          epicCatalogId: gameToEdit.epicCatalogId || "",
          epicLaunchId: gameToEdit.epicLaunchId || "",
          epicStoreUrl: gameToEdit.epicStoreUrl || "",
          sizeGB: gameToEdit.sizeGB,
          releaseDate: gameToEdit.releaseDate || "",
          developer: gameToEdit.developer || "",
          publisher: gameToEdit.publisher || "",
          tags: gameToEdit.tags || [],
          trailerUrl: gameToEdit.trailerUrl || "",
          screenshots: gameToEdit.screenshots || [],
          source: gameToEdit.source || "manual",
          totalAchievements: gameToEdit.totalAchievements,
          completedAchievements: gameToEdit.completedAchievements,
          hasGame:
            gameToEdit.hasGame ??
            Boolean(gameToEdit.steamAppId || gameToEdit.epicCatalogId),
        });
      } else {
        setFormData({
          title: "",
          cardImage: "",
          backgroundImage: "",
          category: "ACTION",
          description: "",
          launcherType: initialLauncherType || "local",
          executablePath: "",
          source: "manual",
          hasGame: false,
          epicLaunchId: "",
        });
      }
      setSearchSource(
        (gameToEdit?.launcherType === "epic" || initialLauncherType === "epic") ? "epic" : "steam",
      );
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setLoading(false);
      setIsSaving(false);
    }
  }, [isOpen, gameToEdit]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchRequestRef.current += 1;
      detailsRequestRef.current += 1;
    },
    [],
  );

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

  const optimizeArtwork = async (
    file: File,
    maxWidth: number,
    maxHeight: number,
  ) => {
    const MAX_ART_DATA_URL_LENGTH = 230_000;
    const MAX_ART_FILE_BYTES = 12 * 1024 * 1024;
    const MAX_SOURCE_PIXELS = 32_000_000;
    const supportedMimeType = /^(?:image\/(?:jpeg|png|webp|gif))$/i.test(file.type);
    const supportedExtension = /\.(?:jpe?g|png|webp|gif)$/i.test(file.name);
    if (
      file.size <= 0
      || file.size > MAX_ART_FILE_BYTES
      || (!supportedMimeType && !supportedExtension)
    ) {
      throw new Error(copy.imageTooLarge);
    }

    const original = await fileToDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error(copy.imageTooLarge));
      nextImage.src = original;
    });

    if (
      image.naturalWidth <= 0
      || image.naturalHeight <= 0
      || image.naturalWidth > 10_000
      || image.naturalHeight > 10_000
      || image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS
    ) {
      throw new Error(copy.imageTooLarge);
    }

    if (
      original.length <= MAX_ART_DATA_URL_LENGTH
      && image.naturalWidth <= maxWidth
      && image.naturalHeight <= maxHeight
    ) {
      return original;
    }

    const initialScale = Math.min(
      1,
      maxWidth / Math.max(1, image.naturalWidth),
      maxHeight / Math.max(1, image.naturalHeight),
    );
    let scale = initialScale;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.48, 0.84 - (attempt % 3) * 0.14);
      const optimized = canvas.toDataURL("image/webp", quality);
      if (optimized.length <= MAX_ART_DATA_URL_LENGTH) return optimized;
      if (attempt % 3 === 2) scale *= 0.78;
    }

    throw new Error(copy.imageTooLarge);
  };

  const handleSteamSearch = async (query: string) => {
    const requestId = ++searchRequestRef.current;
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const resp = await fetch(
        apiUrl(
          `/api/steam/search?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}`,
        ),
      );
      const data = await resp.json();
      if (requestId === searchRequestRef.current) {
        setSearchResults(data.items || []);
      }
    } catch (error) {
      console.error(error);
      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSelectSteamGame = async (game: any) => {
    playSound("select");
    resetSearch();
    const requestId = ++detailsRequestRef.current;
    const appId = String(game.id);
    setLoading(true);
    try {
      const [details, schema] = await Promise.all([
        fetchSteamAppDetailsResult(appId, language),
        fetchSteamAchievementSchema(appId).catch(() => ({ achievements: [], total: 0, unlocked: 0 })),
      ]);
      if (requestId !== detailsRequestRef.current) return;
      if (details.ok) {
        const d = details.data;
        const steamCover =
          d.cardImage ||
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
        const steamWallpaper =
          d.backgroundImage ||
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;
        setFormData((prev) => ({
          ...prev,
          title: d.title || game.name,
          image: steamCover,
          cardImage: steamCover,
          backgroundImage: steamWallpaper,
          logoImage: d.logoImage || "",
          description: d.description || "",
          aboutTheGame: d.aboutTheGame || d.description || "",
          launcherType: prev.launcherType === "steam" ? "steam" : prev.launcherType,
          executablePath:
            prev.launcherType === "steam" ? appId : prev.executablePath,
          steamAppId: appId,
          totalAchievements: schema?.total || 0,
          completedAchievements: schema?.unlocked || 0,
          sizeGB:
            typeof d.sizeGB === "number" && d.sizeGB > 0
              ? Math.round(d.sizeGB)
              : prev.sizeGB,
          releaseDate: d.releaseDate || "",
          developer: d.developer || "",
          publisher: d.publisher || "",
          tags: d.tags || [],
          trailerUrl: d.trailerUrl || "",
          screenshots: d.screenshots || [],
          source: "manual",
        }));
      } else {
        notify(copy.searchError, "error");
      }
    } catch (error) {
      console.error(error);
      if (requestId === detailsRequestRef.current) {
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === detailsRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const handleEpicSearch = async (query: string) => {
    const requestId = ++searchRequestRef.current;
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchEpicGames(query);
      if (requestId === searchRequestRef.current) {
        // Normaliza resultados da Epic para o formato esperado pelo GameSearchDropdown.
        // A API Epic retorna { id, title, namespace, productSlug, keyImages[] }
        // mas o dropdown espera { name, tiny_image } (formato Steam).
        const normalized = (data.items || []).map((item: any) => {
          const keyImages: Array<{ type: string; url: string }> = item.keyImages || [];
          const tallImg = keyImages.find(
            (img) => img.type === "OfferImageTall" || img.type === "DieselGameBoxTall"
          );
          const wideImg = keyImages.find(
            (img) => img.type === "OfferImageWide" || img.type === "DieselGameBox" || img.type === "OfferImageWidePortrait"
          );
          const thumbImg = keyImages.find(
            (img) => img.type === "Thumbnail" || img.type === "OfferImageTall"
          );

          // Extrai o productSlug a partir dos mappings do catalogNs se não vier direto
          const pageSlug =
            item.productSlug ||
            item.catalogNs?.mappings?.find(
              (m: any) => m.pageType === "productHome"
            )?.pageSlug ||
            item.catalogNs?.mappings?.[0]?.pageSlug ||
            "";

          const cardImg = (tallImg || wideImg)?.url || item.cardImage || item.image || item.tiny_image || "";
          const bgImg = wideImg?.url || item.backgroundImage || cardImg;
          const thumb = (thumbImg || tallImg || wideImg)?.url || item.tiny_image || cardImg;

          return {
            // Campos originais preservados para handleSelectEpicGame
            ...item,
            productSlug: pageSlug,
            catalogId: item.catalogId || item.id,
            appName: item.appName || item.app_name || "",
            // Campos normalizados para GameSearchDropdown
            name: item.title || item.name || "",
            tiny_image: thumb,
            cardImage: cardImg,
            backgroundImage: bgImg,
          };
        });
        setSearchResults(normalized);
      }
    } catch (e) {
      console.error(e);
      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
      }
    }
  };

  const scheduleSearch = (query: string, platform: "steam" | "epic") => {
    searchRequestRef.current += 1;
    setSearchQuery(query);
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchDebounceRef.current = window.setTimeout(() => {
      searchDebounceRef.current = null;
      if (platform === "steam") {
        handleSteamSearch(query);
        return;
      }
      handleEpicSearch(query);
    }, 350);
  };

  const handleSelectEpicGame = async (game: any) => {
    playSound("select");
    resetSearch();
    const requestId = ++detailsRequestRef.current;
    setLoading(true);
    try {
      const catalogId = String(
        game.catalogId || (game.namespace ? game.id : ""),
      ).trim();
      const namespace = String(game.namespace || "").trim();
      const productSlug = String(game.productSlug || "").trim();
      const details =
        productSlug
          ? await fetchEpicAppDetailsResult(
            catalogId,
            namespace,
            productSlug,
            language,
          ).catch(() => null)
          : null;
      const d = details?.ok ? details.data : null;
      if (requestId !== detailsRequestRef.current) return;

      const resolvedCatalogId = String(d?.catalogId || catalogId).trim();
      const resolvedNamespace = String(d?.namespace || namespace).trim();
      const appName = String(d?.appName || game.appName || "").trim();
      const launchId = String(
        d?.epicLaunchId
        || game.epicLaunchId
        || (
          resolvedNamespace && resolvedCatalogId
            ? `${resolvedNamespace}:${resolvedCatalogId}${appName ? `:${appName}` : ""}`
            : resolvedCatalogId
        ),
      ).trim();
      const gameTitle = d?.title || game.title || game.name || "";

      if (requestId !== detailsRequestRef.current) return;
      setFormData((prev) => ({
        ...prev,
        title: gameTitle,
        image: d?.cardImage || game.cardImage || game.tiny_image || game.image || "",
        cardImage: d?.cardImage || game.cardImage || game.tiny_image || game.image || "",
        backgroundImage: d?.backgroundImage || game.backgroundImage || game.image || "",
        logoImage: d?.logoImage || game.logoImage || "",
        description: d?.description || game.description || "",
        aboutTheGame: d?.aboutTheGame || game.aboutTheGame || game.description || "",
        launcherType: prev.launcherType === "epic" ? "epic" : prev.launcherType,
        executablePath:
          (isWindowsExecutablePath(d?.executablePath || "") && d?.executablePath)
          || (isWindowsExecutablePath(game.executablePath) && game.executablePath)
          || (isWindowsExecutablePath(prev.executablePath) ? prev.executablePath : ""),
        steamAppId: "",
        epicCatalogId: resolvedCatalogId,
        epicLaunchId: launchId,
        epicStoreUrl: d?.productUrl || game.productUrl || "",
        sizeGB: d?.sizeGB ?? prev.sizeGB,
        releaseDate: d?.releaseDate || game.releaseDate || "",
        developer: d?.developer || game.developer || "",
        publisher: d?.publisher || game.publisher || "",
        tags: d?.tags || game.tags || [],
        trailerUrl: d?.trailerUrl || "",
        screenshots: d?.screenshots || game.screenshots || [],
        source: "epic",
        hasGame: true,
      }));
    } catch (e) {
      console.error(e);
      if (requestId === detailsRequestRef.current) {
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === detailsRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const applyExecutableSelection = (
    executablePath: string,
    launcherType: LauncherType,
  ) => {
    setFormData((prev) => ({
      ...prev,
      launcherType,
      executablePath,
      ...(launcherType === "local" ? {
        epicCatalogId: "",
        epicLaunchId: "",
        epicStoreUrl: "",
        source: "manual" as const,
      } : {
        source: prev.epicCatalogId ? "epic" as const : "manual" as const,
      }),
    }));
    playSound("select");
  };

  const handleExecutableFileFallback = (
    e: React.ChangeEvent<HTMLInputElement>,
    launcherType: LauncherType,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const browserPath =
      (file as File & { path?: string }).path ||
      file.webkitRelativePath;
    e.target.value = "";
    if (!isWindowsExecutablePath(browserPath)) {
      notify("Nao foi possivel obter o caminho completo. Selecione o executavel pelo aplicativo desktop.", "error");
      return;
    }
    applyExecutableSelection(browserPath, launcherType);
  };

  const handleChooseExecutable = async (launcherType: LauncherType) => {
    if (!window.electronAPI?.selectExecutable) {
      executableInputRef.current?.click();
      return;
    }
    try {
      const executablePath = await window.electronAPI.selectExecutable();
      if (executablePath) applyExecutableSelection(executablePath, launcherType);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Nao foi possivel selecionar o executavel.",
        "error",
      );
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await optimizeArtwork(file, 720, 1080);
      setFormData((prev) => ({
        ...prev,
        cardImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Imagem muito grande para ser salva.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleWallpaperSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await optimizeArtwork(file, 1600, 900);
      setFormData((prev) => ({
        ...prev,
        backgroundImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Imagem muito grande para ser salva.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const resetSearch = () => {
    searchRequestRef.current += 1;
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleClose = (silent?: boolean) => {
    detailsRequestRef.current += 1;
    setLoading(false);
    resetSearch();
    onClose(silent);
  };

  const selectLauncherType = (launcherType: GameFormData["launcherType"]) => {
    playSound("navigate");
    detailsRequestRef.current += 1;
    setLoading(false);
    resetSearch();
    setSearchSource(launcherType === "epic" ? "epic" : "steam");
    setFormData((prev) => {
      const platformChanged = prev.launcherType !== launcherType;
      if (launcherType === "local") {
        return {
          ...prev,
          launcherType,
          executablePath: platformChanged ? "" : prev.executablePath,
          steamAppId: "",
          epicCatalogId: "",
          epicLaunchId: "",
          epicStoreUrl: "",
          hasGame: false,
          source: "manual",
        };
      }
      if (launcherType === "steam") {
        return {
          ...prev,
          launcherType,
          executablePath: platformChanged ? "" : prev.steamAppId || prev.executablePath,
          steamAppId: platformChanged ? "" : prev.steamAppId,
          epicCatalogId: "",
          epicLaunchId: "",
          epicStoreUrl: "",
          hasGame: platformChanged ? false : prev.hasGame,
          source: "manual",
        };
      }
      return {
        ...prev,
        launcherType,
        executablePath: platformChanged ? "" : prev.executablePath,
        steamAppId: platformChanged ? "" : prev.steamAppId,
        epicCatalogId: platformChanged ? "" : prev.epicCatalogId,
        epicLaunchId: platformChanged ? "" : prev.epicLaunchId,
        epicStoreUrl: platformChanged ? "" : prev.epicStoreUrl,
        hasGame: platformChanged ? false : prev.hasGame,
        source: "manual",
      };
    });
  };

  const isFormValid = () => {
    return Boolean(formData.title.trim());
  };

  const previewImage = formData.cardImage || formData.image || formData.backgroundImage || "";
  const platformLabel =
    formData.launcherType === "steam"
      ? copy.steam
      : formData.launcherType === "epic"
        ? copy.epic
        : copy.local;
  const launchRequirementReady = formData.launcherType === "local"
    ? Boolean(formData.executablePath || formData.cardImage || formData.image)
    : Boolean(formData.hasGame || formData.steamAppId || formData.epicCatalogId || formData.title.trim());
  const setupChecks = [
    { label: copy.sourceReady, ready: true },
    { label: copy.titleReady, ready: Boolean(formData.title.trim()) },
    { label: copy.launchReady, ready: launchRequirementReady },
  ];
  const completedSetupChecks = setupChecks.filter((item) => item.ready).length;
  const isSubmittingRef = useRef(false);
  const setupProgress = Math.round((completedSetupChecks / setupChecks.length) * 100);

  const handleSubmit = async () => {
    if (isSubmittingRef.current || isSaving || loading) return;
    const targetUid = user?.uid || "default_user";
    if (!formData.title.trim()) {
      notify("Informe o nome do jogo.", "info");
      return;
    }
    isSubmittingRef.current = true;
    setIsSaving(true);
    playSound("select");
    try {
      const image =
        formData.cardImage || formData.image || formData.backgroundImage || "";
      const data = removeUndefined({
        ...formData,
        image,
        cardImage: image,
        imageUrl: image,
        updatedAt: new Date().toISOString(),
      });
      if (new Blob([JSON.stringify(data)]).size > 850_000) {
        notify("O tamanho das imagens é muito grande para ser salvo.", "error");
        return;
      }
      if (gameToEdit) {
        await updateLibraryGame(targetUid, gameToEdit.id, {
          ...data,
          ...(!formData.steamAppId
            ? {
              steamPlaytimeMinutes: 0,
              steamLastPlayedAt: "",
              totalAchievements: 0,
              completedAchievements: 0,
            }
            : {}),
        } as Partial<import("../types/domain").Game>);
        notify("Jogo atualizado!", "success");
      } else {
        await createLibraryGame(targetUid, {
          ...data,
          createdAt: new Date().toISOString(),
        } as Omit<import("../types/domain").Game, "id">);
        notify("Jogo adicionado!", "success");
      }
      handleClose(true);
      onSaved?.();
    } catch (err: any) {
      console.error("[AddGameModal] Erro ao salvar jogo:", err);
      const msg = (typeof err === "string" ? err : err?.message) || "Erro ao salvar jogo.";
      notify(msg, "error");
    } finally {
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-6xl"
      ariaLabel={gameToEdit ? copy.editInfo : copy.addGame}
    >
      <div
        aria-busy={isSaving || loading}
        className="relative flex h-[calc(100dvh-2rem)] max-h-[860px] w-full flex-col overflow-hidden rounded-xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] md:h-[calc(100dvh-4rem)] text-white bg-[#0F0F0F]/95"
      >
        <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 md:px-7 md:py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06]">
              <LibraryBig size={20} className="text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                {copy.libraryKicker}
              </p>
              <h2 className="truncate text-xl font-black tracking-[-0.035em] text-white md:text-2xl">
                {gameToEdit ? copy.editInfo : copy.addGame}
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 sm:flex">
              <span className="text-[10px] font-bold text-white/42">
                {completedSetupChecks}/3
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${setupProgress}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose()}
              aria-label={copy.cancel}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/42 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="add-game-scrollbar grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
          <form
            id="add-game-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="add-game-scrollbar min-h-0 space-y-8 border-white/[0.07] p-5 pb-8 lg:overflow-y-auto lg:border-r lg:p-7"
          >
            <AddGameWizardSteps currentStep={completedSetupChecks === 3 ? 3 : completedSetupChecks === 2 ? 2 : 1} />
            <section>
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">{copy.platform}</p>
                <div className="mt-2 border-b border-white/[0.08]" />
              </div>
              <div role="radiogroup" aria-label={copy.platform} className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {([
                  { id: "local" as const, label: copy.local, icon: () => <HardDrive size={17} /> },
                  { id: "steam" as const, label: copy.steam, icon: (selected: boolean) => <SteamBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "epic" as const, label: copy.epic, icon: (selected: boolean) => <EpicBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "ea" as const, label: "EA App", icon: (selected: boolean) => <EaBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "ubisoft" as const, label: "Ubisoft", icon: (selected: boolean) => <UbisoftBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "gog" as const, label: "GOG", icon: (selected: boolean) => <GogBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "xbox" as const, label: "Xbox", icon: (selected: boolean) => <XboxBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "riot" as const, label: "Riot Games", icon: (selected: boolean) => <RiotBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "battlenet" as const, label: "Battle.net", icon: (selected: boolean) => <BattlenetBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                  { id: "rockstar" as const, label: "Rockstar", icon: (selected: boolean) => <RockstarBrandIcon className="h-[17px] w-[17px]" style={{ color: selected ? "#000" : "#fff" }} /> },
                ]).map((option) => {
                  const selected = formData.launcherType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectLauncherType(option.id)}
                      className={"flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all " + (selected
                        ? "border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        : "border-white/10 bg-transparent text-white hover:border-white/25 hover:bg-white/[0.04]")}
                    >
                      <span className={"grid h-7 w-7 shrink-0 place-items-center rounded-xl " + (selected ? "text-black/70" : "text-white/55")}>
                        {option.icon(selected)}
                      </span>
                      <strong className="truncate text-[12px] font-bold">{option.label}</strong>
                      {selected && <CheckCircle2 size={15} className="ml-auto shrink-0 text-black/60" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="relative">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">{copy.automaticFill}</p>
                <div className="flex items-center gap-2">
                  {loading && <RefreshCw size={14} className="animate-spin text-white/45" />}
                  <div className="flex items-center gap-1 rounded-xg bg-white/[0.04] p-0.5 border border-white/[0.06] text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchSource("steam");
                        resetSearch();
                      }}
                      className={`px-3 py-1 rounded-xl transition-all font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${searchSource === "steam"
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-white/40 hover:text-white/70"
                        }`}
                    >
                      <SteamBrandIcon className="w-3.5 h-3.5" style={{ color: searchSource === "steam" ? "#fff" : "currentColor" }} /> Steam
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchSource("epic");
                        resetSearch();
                      }}
                      className={`px-3 py-1 rounded-xl transition-all font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${searchSource === "epic"
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-white/40 hover:text-white/70"
                        }`}
                    >
                      <EpicBrandIcon className="w-3.5 h-3.5" style={{ color: searchSource === "epic" ? "#fff" : "currentColor" }} /> Epic
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-3 border-b border-white/[0.08]" />

              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/24" />
                <input
                  id="game-metadata-search"
                  role="combobox"
                  aria-label={searchSource === "epic" ? copy.epicSearch : copy.steamSearch}
                  aria-autocomplete="list"
                  aria-controls="game-search-results"
                  aria-expanded={searchQuery.length >= 3}
                  value={searchQuery}
                  onChange={(event) => scheduleSearch(event.target.value, searchSource)}
                  placeholder={searchSource === "epic" ? copy.epicSearch : copy.steamSearch}
                  className="w-full rounded-xl border border-white/10 bg-black/30 py-3.5 pl-11 pr-11 text-[13px] text-white outline-none transition-all placeholder:text-white/22 focus:border-white/24"
                />
                {isSearching && <RefreshCw size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-white/32" />}
                <GameSearchDropdown
                  id="game-search-results"
                  results={searchResults}
                  isSearching={isSearching}
                  hasQuery={searchQuery.length >= 3}
                  noResultsLabel={copy.noSearchResults}
                  onSelect={searchSource === "epic" ? handleSelectEpicGame : handleSelectSteamGame}
                />
              </div>

              {formData.epicStoreUrl && (
                <a
                  href={formData.epicStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-white/38 transition-colors hover:text-white/70"
                >
                  <EpicIcon className="h-3.5 w-3.5 opacity-60" /> {copy.viewOnEpicStore}
                </a>
              )}

              {formData.launcherType !== "local" &&
                (formData.epicCatalogId || formData.steamAppId) && (
                  <button
                    type="button"
                    aria-pressed={Boolean(formData.hasGame)}
                    onClick={() => {
                      playSound("select");
                      setFormData((prev) => ({ ...prev, hasGame: !prev.hasGame }));
                    }}
                    className={`mt-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${formData.hasGame
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-transparent text-white/48 hover:border-white/25 hover:bg-white/[0.04]"
                      }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl border ${formData.hasGame ? "border-black/10 bg-black/[0.06]" : "border-white/10"}`}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <strong className="text-[12px] font-bold">{formData.hasGame ? copy.ownGameConfirmed : copy.ownGameConfirm}</strong>
                  </button>
                )}

              {formData.launcherType !== "steam" && formData.launcherType !== "local" && (
                <div className="mt-4">
                  <input ref={executableInputRef} type="file" accept=".exe,application/x-msdownload" className="hidden" onChange={(event) => handleExecutableFileFallback(event, formData.launcherType)} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => void handleChooseExecutable(formData.launcherType)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-[11px] font-bold text-white/68 transition-all hover:bg-white/[0.06] hover:text-white">
                      <FolderOpen size={14} /> {copy.chooseExe}
                    </button>
                    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="truncate text-[12px] text-white/52">{formData.executablePath || copy.noExecutable}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">{copy.gameDetails}</p>
                <div className="mt-2 border-b border-white/[0.08]" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="game-title" className="text-[11px] font-bold text-white/40">
                    {copy.title}
                  </label>
                  <input
                    id="game-title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder={copy.titlePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/22 focus:border-white/24"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="game-category" className="text-[11px] font-bold text-white/40">
                    {copy.category}
                  </label>
                  <div className="relative">
                    <GhostSelect
                      value={formData.category}
                      onChange={(value) => {
                        playSound("navigate");
                        setFormData({ ...formData, category: value });
                      }}
                      options={CATEGORIES.map((category) => ({
                        value: category.id,
                        label: category.label
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="game-description" className="text-[11px] font-bold text-white/40">{copy.description}</label>
                  <textarea
                    id="game-description"
                    rows={3}
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    placeholder={copy.descriptionPlaceholder}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-white/72 outline-none transition-all placeholder:text-white/22 focus:border-white/24"
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">{copy.visualAssets}</p>
                <div className="mt-2 border-b border-white/[0.08]" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-3">
                  <label htmlFor="game-cover-url" className="text-[11px] font-bold text-white/40">
                    {copy.cover}
                  </label>
                  <div
                    className="h-24 rounded-xl border border-white/[0.08] bg-[#111116] bg-cover bg-center"
                    style={formData.cardImage || formData.image ? { backgroundImage: "linear-gradient(to top, rgba(0,0,0,.35), transparent), url(" + JSON.stringify(formData.cardImage || formData.image) + ")" } : undefined}
                  />
                  <input
                    id="game-cover-url"
                    value={formData.cardImage}
                    onChange={(e) =>
                      setFormData({ ...formData, cardImage: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-white/60 outline-none placeholder:text-white/20 focus:border-white/20"
                  />
                  {formData.launcherType === "local" && (
                    <>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverSelect}
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[11px] font-bold text-white/58 transition-all hover:bg-white/[0.06] hover:text-white"
                      >
                        <Upload size={13} /> {copy.upload}
                      </button>
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <label htmlFor="game-wallpaper-url" className="text-[11px] font-bold text-white/40">
                    {copy.wallpaper}
                  </label>
                  <div
                    className="h-24 rounded-xl border border-white/[0.08] bg-[#111116] bg-cover bg-center"
                    style={formData.backgroundImage ? { backgroundImage: "linear-gradient(to top, rgba(0,0,0,.35), transparent), url(" + JSON.stringify(formData.backgroundImage) + ")" } : undefined}
                  />
                  <input
                    id="game-wallpaper-url"
                    value={formData.backgroundImage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backgroundImage: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-white/60 outline-none placeholder:text-white/20 focus:border-white/20"
                  />
                  {formData.launcherType === "local" && (
                    <>
                      <input
                        ref={wallpaperInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWallpaperSelect}
                      />
                      <button
                        type="button"
                        onClick={() => wallpaperInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[11px] font-bold text-white/58 transition-all hover:bg-white/[0.06] hover:text-white"
                      >
                        <Upload size={13} /> {copy.upload}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {formData.launcherType === "local" && (
              <section>
                <div className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">{copy.launchTitle}</p>
                  <div className="mt-2 border-b border-white/[0.08]" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-bold text-white/40">
                      {copy.executable}
                    </label>
                    <input
                      ref={executableInputRef}
                      type="file"
                      accept=".exe,application/x-msdownload"
                      className="hidden"
                      onChange={(event) => handleExecutableFileFallback(event, "local")}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void handleChooseExecutable("local")}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-[11px] font-bold text-white/68 transition-all hover:bg-white/[0.06] hover:text-white"
                      >
                        <FolderOpen size={14} /> {copy.chooseExe}
                      </button>
                      <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="truncate text-[12px] text-white/52">
                          {formData.executablePath || copy.noExecutable}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </form>

          <aside
            aria-label={copy.previewPanel}
            className="relative flex min-h-[520px] flex-col overflow-hidden bg-white/[0.01] border-l border-white/[0.08] shadow-[inset_1px_0_0_rgba(255,255,255,0.02)] p-5 lg:min-h-0 lg:p-6"
          >
            <div className="relative flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/32">
                {copy.previewPanel}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white/48">
                <Globe size={11} /> {platformLabel}
              </span>
            </div>

            <div className="relative mx-auto mt-6 w-full max-w-[230px]">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/14 bg-[#101014]">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[#0d0d10]">
                    <Gamepad2 size={34} strokeWidth={1.4} className="text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <span className="mb-2 inline-flex rounded-md border border-white/12 bg-black/45 px-2 py-1 text-[9px] font-bold text-white/55">
                    {CATEGORIES.find((category) => category.id === formData.category)?.label || copy.category}
                  </span>
                  <h3 className="line-clamp-2 text-xl font-black leading-[1.05] tracking-[-0.035em] text-white">
                    {formData.title.trim() || copy.titlePlaceholder}
                  </h3>
                  <p className="mt-2 text-[10px] font-semibold text-white/45">
                    {platformLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-6">
              <ul className="space-y-2.5">
                {setupChecks.map((item) => (
                  <li key={item.label} className="flex items-center gap-2.5 text-[12px] text-white/45">
                    <CheckCircle2
                      size={14}
                      className={item.ready ? "text-white/80" : "text-white/16"}
                    />
                    <span className={item.ready ? "text-white/62" : undefined}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.08] bg-white/[0.02] px-5 py-4 md:px-7">
          <button
            type="button"
            onClick={() => handleClose()}
            className="rounded-xl border border-white/10 px-4 py-3 text-[12px] font-bold text-white/55 transition-all hover:bg-white/[0.06] hover:text-white"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            form="add-game-form"
            disabled={isSaving || loading || !isFormValid()}
            className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[12px] font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-black/50"
          >
            {isSaving ? (
              <LoadingState label={copy.saving} variant="working" dark size="sm" showTimer={false} />
            ) : (
              <>
                <Check size={14} strokeWidth={3} />
                {gameToEdit ? copy.saveChanges : copy.confirmAdd}
              </>
            )}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
};

export default AddGameModal;
