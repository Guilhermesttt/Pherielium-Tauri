import React, { useState } from "react";
import { BadgeDollarSign, Bell } from "lucide-react";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import { SettingsHeader } from "../components/settings/AppUpdateSection";
import { usePreferences } from "../context/PreferencesContext";
import type { Game, PriceAlert } from "../types/domain";

type TranslationFn = ReturnType<typeof usePreferences>["t"];

export interface PriceAlertsPageProps {
  t: TranslationFn;
  games: Game[];
  alerts: PriceAlert[];
  onAddAlert: (game: Game) => void;
  onRemoveAlert: (id: string) => void;
}

export const PriceAlertsPage: React.FC<PriceAlertsPageProps> = React.memo(({
  t,
  games,
  alerts,
  onAddAlert,
  onRemoveAlert,
}) => {
  const [selectedGameId, setSelectedGameId] = useState("");
  const selectedGame = games.find((game) => game.id === selectedGameId) || games[0];

  const handleAddPriceAlert = () => {
    if (selectedGame) {
      onAddAlert(selectedGame);
    }
  };

  const handleSelectGameChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGameId(event.target.value);
  };

  return (
    <SystemPageShell eyebrow="Deals" title={t("priceAlerts")}>
      <section className="mb-5 rounded-2xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Bell className="h-5 w-5 text-white/70" />}
          title={
            <div className="flex items-center gap-2">
              {t("priceAlerts")}
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white/80">
                Em breve
              </span>
            </div>
          }
          description={t("priceAlertsHint")}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={selectedGame?.id ?? ""}
            onChange={handleSelectGameChange}
            className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {games.map((game) => (
              <option key={game.id} value={game.id} className="bg-black">
                {game.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedGame}
            onClick={handleAddPriceAlert}
            className="h-11 rounded-lg bg-white px-5 text-xs font-semibold uppercase tracking-wider text-black transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40"
          >
            {t("addAlert")}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/35 p-8 text-center md:col-span-2">
            <BadgeDollarSign className="mx-auto mb-4 h-8 w-8 text-white/35" />
            <p className="text-sm font-bold text-white/70">{t("noAlerts")}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">{alert.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">
                    {alert.source}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAlert(alert.id)}
                  className="rounded-lg px-3 py-2 text-[10px] font-black uppercase text-red-300/70 hover:bg-red-500/10"
                >
                  Remover
                </button>
              </div>
              <p className="mt-5 text-xs font-bold text-white/50">
                Avisaremos quando encontrarmos uma oferta relevante para este jogo.
              </p>
            </div>
          ))
        )}
      </div>
    </SystemPageShell>
  );
});

PriceAlertsPage.displayName = "PriceAlertsPage";
