import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Radio,
  Users,
  Layers,
  Flame,
} from "lucide-react";
import { apiUrl } from "../services/api";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import { NewsCard } from "./ui/NewsCard";

const proxyImage = (url?: string) => {
  if (!url) return "";
  return apiUrl(`/api/proxy/image?url=${encodeURIComponent(url)}`);
};

interface GamingNewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
}

interface NewsPayload {
  items?: GamingNewsItem[];
  sources?: Array<{ name: string; available: boolean }>;
  stale?: boolean;
  error?: string;
}

const openExternal = async (url: string) => {
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const radarCopy: Record<LauncherLanguage, {
  eyebrow: string; title: string; subtitle: string; refresh: string; all: string;
  stale: string; unavailable: string; loadError: string; read: string;
  communities: string; adrenaline: string; steam: string;
}> = {
  "pt-BR": { eyebrow: "Atualizações do mundo gamer", title: "Radar Gamer", subtitle: "Feed centralizado de notícias e novidades da indústria gamer.", refresh: "Atualizar", all: "Todas as Fontes", stale: "Exibindo cache offline", unavailable: "Radar temporariamente indisponível", loadError: "Não foi possível carregar as notícias.", read: "Ler matéria", communities: "Comunidades e Fóruns", adrenaline: "Hardware, análises, lançamentos e debates da comunidade.", steam: "Fóruns globais organizados por jogo e comunidade Steam." },
  "en-US": { eyebrow: "Gaming world updates", title: "Gaming Radar", subtitle: "Centralized feed for gaming industry news and releases.", refresh: "Refresh", all: "All Sources", stale: "Showing offline cache", unavailable: "Radar temporarily unavailable", loadError: "Could not load the news.", read: "Read article", communities: "Communities and Forums", adrenaline: "Hardware, reviews, releases, and community debates.", steam: "Global forums organized by game and the Steam community." },
  "es-ES": { eyebrow: "Actualizaciones del mundo gamer", title: "Radar Gamer", subtitle: "Feed centralizado de noticias y novedades de la industria.", refresh: "Actualizar", all: "Todas las Fuentes", stale: "Mostrando caché offline", unavailable: "Radar temporalmente no disponible", loadError: "No se pudieron cargar las noticias.", read: "Leer artículo", communities: "Comunidades y Foros", adrenaline: "Hardware, análisis, lanzamientos y debates comunitarios.", steam: "Foros globales organizados por juego y por la comunidad Steam." },
  "fr-FR": { eyebrow: "Actualités du monde du jeu", title: "Radar Gaming", subtitle: "Flux centralisé des actualités et sorties du jeu vidéo.", refresh: "Actualiser", all: "Toutes les sources", stale: "Affichage du cache hors-ligne", unavailable: "Radar temporairement indisponible", loadError: "Impossible de charger les actualités.", read: "Lire l’article", communities: "Communautés et Forums", adrenaline: "Matériel, tests, sorties et débats communautaires.", steam: "Forums mondiaux par jeu et communauté Steam." },
  "de-DE": { eyebrow: "Neuigkeiten aus der Gaming-Welt", title: "Gaming-Radar", subtitle: "Zentraler Feed für Neuigkeiten und Veröffentlichungen.", refresh: "Aktualisieren", all: "Alle Quellen", stale: "Offline-Cache wird angezeigt", unavailable: "Radar vorübergehend nicht verfügbar", loadError: "Nachrichten konnten nicht geladen werden.", read: "Artikel lesen", communities: "Communitys und Foren", adrenaline: "Hardware, Tests, Neuerscheinungen und Diskussionen.", steam: "Foren nach Spiel und Steam-Community geordnet." },
  "it-IT": { eyebrow: "Aggiornamenti dal mondo gaming", title: "Radar Gaming", subtitle: "Feed centralizzato di notizie e uscite del mondo gaming.", refresh: "Aggiorna", all: "Tutte le fonti", stale: "Visualizzazione cache offline", unavailable: "Radar temporaneamente non disponibile", loadError: "Impossibile caricare le notizie.", read: "Leggi articolo", communities: "Community e Forum", adrenaline: "Hardware, recensioni, uscite e discussioni della community.", steam: "Forum organizzati per jogo e dalla community Steam." },
};

const relativeTime = (date: string, language: LauncherLanguage) => {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "always", style: "narrow" });
  if (minutes < 60) return formatter.format(-(minutes || 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
};

const GamingRadarPage: React.FC = () => {
  const { language } = usePreferences();
  const copy = radarCopy[language];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<GamingNewsItem[]>([]);
  const [sources, setSources] = useState<NewsPayload["sources"]>([]);
  const [activeSource, setActiveSource] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: true,
  });

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/gaming/news"));
      const payload = await response.json() as NewsPayload;
      if (!response.ok) throw new Error(payload.error || copy.loadError);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSources(payload.sources || []);
      setStale(Boolean(payload.stale));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadNews(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadNews]);

  const visibleItems = useMemo(
    () => activeSource === "__all__"
      ? items
      : items.filter((item) => item.source === activeSource),
    [activeSource, items],
  );

  const activeSourcesCount = (sources || []).filter((s) => s.available).length;

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="relative flex-1 overflow-y-auto px-10 pb-16 pt-8 thin-scrollbar font-sans"
      style={{ contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >
      <div className="relative mx-auto max-w-6xl space-y-6">
        {/* Editorial Atmospheric Header */}
        <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E0E] p-6 md:p-8 shadow-[0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 glass-panel px-3 py-1 text-xs font-medium tracking-wider text-white/70 mb-3">
                <Radio className="h-3 w-3 text-white" />
                <span>{copy.eyebrow}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent">
                {copy.title}
              </h1>
              <p className="mt-1 max-w-xl text-xs md:text-sm font-normal text-white/70">
                {copy.subtitle}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadNews()}
                className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border border-white/15 glass-panel hover:bg-white/[0.12] px-4 py-2 text-xs font-medium text-white shadow-md transition-all disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                <span>{copy.refresh}</span>
              </button>
            </div>
          </div>

          {/* Metric Bar in Clean Minimalist Style */}
          <div className="relative mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 border-t border-white/[0.06] pt-6">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">Notícias Carregadas</span>
              <span className="text-xl font-display font-semibold text-white">{items.length}</span>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">Fontes Ativas</span>
              <span className="text-xl font-display font-semibold text-white">{activeSourcesCount || "Auto"}</span>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">Status do Feed</span>
              <span className="text-xl font-display font-semibold text-white">{stale ? "Cache" : "Live"}</span>
            </div>
          </div>
        </header>

        {/* Source Filter Tags */}
        <div className="flex flex-wrap items-center gap-2">
          {["__all__", ...(sources || []).filter((source) => source.available).map((source) => source.name)].map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-all ${activeSource === source
                ? "border-white bg-white text-black shadow-md font-semibold"
                : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
                }`}
            >
              {source === "__all__" ? copy.all : source}
            </button>
          ))}
          {stale && (
            <span className="self-center text-xs font-medium text-amber-300/80 px-2">
              {copy.stale}
            </span>
          )}
        </div>

        {/* News Grid */}
        {error ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-red-400/60" />
            <p className="font-semibold text-white/80">{copy.unavailable}</p>
            <p className="mt-1 text-xs text-white/40">{error}</p>
          </div>
        ) : loading && !items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0E1015]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {visibleItems.map((item) => (
              <NewsCard
                key={item.id}
                title={item.title}
                source={item.source}
                publishedAt={relativeTime(item.publishedAt, language)}
                summary={item.summary}
                imageUrl={proxyImage(item.imageUrl)}
                url={item.url}
                readLabel={copy.read}
                onOpen={() => void openExternal(item.url)}
              />
            ))}
          </div>
        )}

        {/* Communities Section */}
        <section className="glass-panel relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 md:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-white/60" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {copy.communities}
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void openExternal("https://forum.adrenaline.com.br/")}
              className="cursor-pointer group rounded-2xl border border-white/[0.08] bg-[#0E1015] p-5 text-left transition-all duration-200 hover:border-white/20 hover:bg-[#12151B]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white tracking-tight">
                  Fórum Adrenaline
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white transition-colors" />
              </div>
              <p className="mt-1 text-xs text-white/40 leading-relaxed">
                {copy.adrenaline}
              </p>
            </button>

            <button
              type="button"
              onClick={() => void openExternal("https://steamcommunity.com/discussions/")}
              className="cursor-pointer group rounded-2xl border border-white/[0.08] bg-[#0E1015] p-5 text-left transition-all duration-200 hover:border-white/20 hover:bg-[#12151B]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white tracking-tight">
                  Discussões Steam
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white transition-colors" />
              </div>
              <p className="mt-1 text-xs text-white/40 leading-relaxed">
                {copy.steam}
              </p>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default GamingRadarPage;

