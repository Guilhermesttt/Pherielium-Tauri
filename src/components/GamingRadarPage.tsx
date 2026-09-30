import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Radio,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { apiFetch, apiUrl } from "../services/api";
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
  featured: string; updatedRecently: string;
}> = {
  "pt-BR": {
    eyebrow: "Atualizações do mundo gamer",
    title: "Radar Gamer",
    subtitle: "Feed centralizado de notícias e novidades da indústria gamer.",
    refresh: "Atualizar",
    all: "Todas as Fontes",
    stale: "Cache offline",
    unavailable: "Radar temporariamente indisponível",
    loadError: "Não foi possível carregar as notícias.",
    read: "Ler matéria completa",
    communities: "Comunidades e Fóruns",
    adrenaline: "Hardware, análises, lançamentos e debates da comunidade.",
    steam: "Fóruns globais organizados por jogo e comunidade Steam.",
    featured: "Destaque Editorial",
    updatedRecently: "Atualizado recentemente",
  },
  "en-US": {
    eyebrow: "Gaming world updates",
    title: "Gaming Radar",
    subtitle: "Centralized feed for gaming industry news and releases.",
    refresh: "Refresh",
    all: "All Sources",
    stale: "Offline cache",
    unavailable: "Radar temporarily unavailable",
    loadError: "Could not load the news.",
    read: "Read full article",
    communities: "Communities and Forums",
    adrenaline: "Hardware, reviews, releases, and community debates.",
    steam: "Global forums organized by game and the Steam community.",
    featured: "Editorial Spotlight",
    updatedRecently: "Updated recently",
  },
  "es-ES": {
    eyebrow: "Actualizaciones del mundo gamer",
    title: "Radar Gamer",
    subtitle: "Feed centralizado de noticias y novedades de la industria.",
    refresh: "Actualizar",
    all: "Todas las Fuentes",
    stale: "Caché offline",
    unavailable: "Radar temporalmente no disponible",
    loadError: "No se pudieron cargar las noticias.",
    read: "Leer artículo completo",
    communities: "Comunidades y Foros",
    adrenaline: "Hardware, análisis, lanzamientos y debates comunitarios.",
    steam: "Foros globales organizados por juego y por la comunidad Steam.",
    featured: "Destacado Editorial",
    updatedRecently: "Actualizado recientemente",
  },
  "fr-FR": {
    eyebrow: "Actualités du monde du jeu",
    title: "Radar Gaming",
    subtitle: "Flux centralisé des actualités et sorties du jeu vidéo.",
    refresh: "Actualiser",
    all: "Toutes les sources",
    stale: "Cache hors-ligne",
    unavailable: "Radar temporairement indisponible",
    loadError: "Impossible de charger les actualités.",
    read: "Lire l’article complet",
    communities: "Communautés et Forums",
    adrenaline: "Matériel, tests, sorties et débats communautaires.",
    steam: "Forums mondiaux par jeu et communauté Steam.",
    featured: "À la une",
    updatedRecently: "Mis à jour récemment",
  },
  "de-DE": {
    eyebrow: "Neuigkeiten aus der Gaming-Welt",
    title: "Gaming-Radar",
    subtitle: "Zentraler Feed für Neuigkeiten und Veröffentlichungen.",
    refresh: "Aktualisieren",
    all: "Alle Quellen",
    stale: "Offline-Cache",
    unavailable: "Radar vorübergehend nicht verfügbar",
    loadError: "Nachrichten konnten nicht geladen werden.",
    read: "Vollständigen Artikel lesen",
    communities: "Communitys und Foren",
    adrenaline: "Hardware, Tests, Neuerscheinungen und Diskussionen.",
    steam: "Foren nach Spiel und Steam-Community geordnet.",
    featured: "Leitartikel",
    updatedRecently: "Kürzlich aktualisiert",
  },
  "it-IT": {
    eyebrow: "Aggiornamenti dal mondo gaming",
    title: "Radar Gaming",
    subtitle: "Feed centralizzato di notizie e uscite del mondo gaming.",
    refresh: "Aggiorna",
    all: "Tutte le fonti",
    stale: "Cache offline",
    unavailable: "Radar temporaneamente non disponible",
    loadError: "Impossibile caricare le notizie.",
    read: "Leggi articolo completo",
    communities: "Community e Forum",
    adrenaline: "Hardware, recensioni, uscite e discussioni della community.",
    steam: "Forum organizzati per gioco e dalla community Steam.",
    featured: "In primo piano",
    updatedRecently: "Aggiornato di recente",
  },
};

const relativeTime = (date: string, language: LauncherLanguage) => {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "always", style: "narrow" });
  if (minutes < 1) return language === "pt-BR" ? "agora" : "just now";
  if (minutes < 60) return formatter.format(-minutes, "minute");
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      const response = await apiFetch("/api/gaming/news");
      const payload = await response.json() as NewsPayload;
      if (!response.ok) throw new Error(payload.error || copy.loadError);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSources(payload.sources || []);
      setStale(Boolean(payload.stale));
      setLastUpdated(new Date());
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

  const featuredItem = visibleItems[0];
  const remainingItems = visibleItems.slice(1);

  const lastUpdatedLabel = useMemo(() => {
    if (stale) return copy.stale;
    if (!lastUpdated) return copy.updatedRecently;
    return `Atualizado ${relativeTime(lastUpdated.toISOString(), language)}`;
  }, [stale, lastUpdated, copy.stale, copy.updatedRecently, language]);

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="relative flex-1 overflow-y-auto px-6 sm:px-10 pb-16 pt-6 thin-scrollbar font-sans"
      style={{ contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >
      <div className="relative mx-auto max-w-6xl space-y-6">
        {/* Compact, Focused Editorial Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-white/50 mb-1.5">
              <Radio className="h-3 w-3 text-white/70" />
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
              {copy.title}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-normal text-white/60 max-w-xl">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
            {/* Discreet update status */}
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-amber-400" : "bg-emerald-400"}`} />
              <span>{lastUpdatedLabel}</span>
            </span>

            <button
              type="button"
              disabled={loading}
              onClick={() => void loadNews()}
              className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] hover:bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-sm transition-all disabled:opacity-50 active:scale-95"
              title={copy.refresh}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span>{copy.refresh}</span>
            </button>
          </div>
        </header>

        {/* Source Filter Tags directly accessible */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {["__all__", ...(sources || []).filter((source) => source.available).map((source) => source.name)].map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-medium transition-all ${
                activeSource === source
                  ? "border-white bg-white text-black font-semibold shadow-sm"
                  : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
              }`}
            >
              {source === "__all__" ? copy.all : source}
            </button>
          ))}
        </div>

        {/* News Content Area */}
        {error ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-red-400/60" />
            <p className="font-semibold text-white/80">{copy.unavailable}</p>
            <p className="mt-1 text-xs text-white/40">{error}</p>
          </div>
        ) : loading && !items.length ? (
          <div className="space-y-4">
            <div className="h-64 sm:h-80 animate-pulse rounded-3xl border border-white/[0.06] bg-[#0E1015]" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0E1015]" />
              ))}
            </div>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-white/40 text-xs">
            Nenhuma notícia encontrada para a fonte selecionada.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Destaque Editorial: Primeira Notícia */}
            {featuredItem && (
              <article
                onClick={() => void openExternal(featuredItem.url)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-[#0C0D10] shadow-[0_24px_64px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:border-white/25 hover:bg-[#101217]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
                  {/* Imagem Widescreen */}
                  <div className="lg:col-span-7 relative aspect-video lg:aspect-auto lg:min-h-[300px] overflow-hidden bg-[#14161C]">
                    {featuredItem.imageUrl ? (
                      <img
                        src={proxyImage(featuredItem.imageUrl)}
                        alt=""
                        loading="eager"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <Newspaper className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D10] via-transparent to-transparent lg:hidden" />
                  </div>

                  {/* Conteúdo Editorial */}
                  <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                          <Sparkles className="h-2.5 w-2.5" />
                          {copy.featured}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-mono font-medium text-white/70">
                          {featuredItem.source}
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-2xl font-display font-bold text-white tracking-tight leading-snug group-hover:text-amber-200/90 transition-colors">
                        {featuredItem.title}
                      </h2>

                      {featuredItem.summary && (
                        <p className="mt-3 line-clamp-3 text-xs sm:text-sm text-white/60 leading-relaxed font-body">
                          {featuredItem.summary}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/50">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-white/40" />
                        {relativeTime(featuredItem.publishedAt, language)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-white group-hover:text-amber-300 transition-colors">
                        {copy.read}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* Demais Notícias em Grade Compacta */}
            {remainingItems.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {remainingItems.map((item) => (
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
          </div>
        )}

        {/* Communities Section */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-white/60" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {copy.communities}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void openExternal("https://forum.adrenaline.com.br/")}
              className="cursor-pointer group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]"
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
              className="cursor-pointer group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]"
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
