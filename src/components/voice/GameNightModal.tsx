import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Gamepad2, Loader2, Lock, Search, Users, X } from "lucide-react";
import type { Game, SocialFriend } from "../../types/domain";
import { SfSymbol } from "../../design-system/sf-symbols";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { useOpenCloseSound } from "../../hooks/useOpenCloseSound";
import type { CallRoomConfig } from "../../types/voice-governance";
import { buildChannelInvitePayload, type ChannelInvitePayload, type NightKind } from "../../services/voiceCall/channelInvite";
import { pickResumeGame } from "../commandPaletteLogic";
import { formatLastSeen, isFriendOnline } from "../friends/friendsBoard";
import {
  NIGHT_KINDS,
  friendUid,
  gameNightRoomConfig,
  groupInvitees,
  maxInvitees,
  nightKindInfo,
  toggleInvitee,
} from "./gameNight";
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";

/**
 * Noite (jogo, cinema, resenha): escolhe o tipo, marca os amigos (online ou offline) e abre
 * uma sala de voz, com o convite caindo no chat de cada um. Na noite de jogo, quem já joga o título
 * vem marcado. Quem está offline recebe o cartão no chat e vê quando voltar.
 *
 * A criação da sala e o envio do convite entram por props: este componente só decide o quê, e
 * é por isso que dá para ver e testar a tela sem servidor de voz.
 */
export interface GameNightModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: readonly Game[];
  friends: readonly SocialFriend[];
  /** jogo sugerido ao abrir (o que está em foco na Home); sem ele, o último jogado */
  initialGame?: Game | null;
  hostName: string;
  hostAvatar?: string | null;
  onCreateRoom: (config: CallRoomConfig) => Promise<{ id: string }>;
  onSendInvite: (friendUid: string, payload: ChannelInvitePayload) => Promise<void>;
  notify: (message: string, type: "success" | "error" | "info") => void;
  /** Sons do tema sonoro escolhido (abrir/fechar o modal, escolhas e confirmação). */
  playSound?: (type: SoundEffectType) => void;
}

const MAX_GAME_CHOICES = 8;

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const GameNightModal: React.FC<GameNightModalProps> = ({
  isOpen,
  onClose,
  games,
  friends,
  initialGame,
  hostName,
  hostAvatar,
  onCreateRoom,
  onSendInvite,
  notify,
  playSound,
}) => {
  useOpenCloseSound(isOpen, playSound, { open: "showModal", close: "modalClose" });
  const [kind, setKind] = useState<NightKind>("game");
  const [subject, setSubject] = useState("");
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ao abrir: jogo sugerido, seleção limpa
  useEffect(() => {
    if (!isOpen) return;
    const suggested = initialGame ?? pickResumeGame(games) ?? games[0] ?? null;
    setKind("game");
    setSubject("");
    setGameId(suggested?.id ?? null);
    setGameQuery("");
    setIsPrivate(false);
    setPassword("");
    setBusy(false);
    setTimeout(() => searchRef.current?.focus(), 50);
    // só quando abre: trocar de jogo depois não pode apagar o que a pessoa digitou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const game = useMemo(() => games.find((g) => g.id === gameId) ?? null, [games, gameId]);
  const info = nightKindInfo(kind);
  const groups = useMemo(
    () => groupInvitees(friends, info.needsGame ? (game?.title ?? "") : ""),
    [friends, info.needsGame, game?.title],
  );

  // Quem já joga o título vem marcado; ao trocar de jogo, a sugestão acompanha
  useEffect(() => {
    if (!isOpen) return;
    setSelected(groups.playingIt.slice(0, maxInvitees()).map(friendUid));
    // a sugestão depende do jogo, não da lista inteira de amigos (que muda com a presença)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, gameId, kind]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  const choices = useMemo(() => {
    const query = norm(gameQuery.trim());
    const list = query ? games.filter((g) => norm(g.title).includes(query)) : [...games];
    if (!query) {
      // sem busca: os jogados por último primeiro
      list.sort((a, b) => new Date(b.lastPlayedAt ?? 0).getTime() - new Date(a.lastPlayedAt ?? 0).getTime());
    }
    return list.slice(0, MAX_GAME_CHOICES);
  }, [games, gameQuery]);

  const needsPassword = isPrivate && !password.trim();
  const canSubmit = (!info.needsGame || Boolean(game)) && !busy && !needsPassword;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const config = gameNightRoomConfig({
        kind,
        subject: info.needsGame ? (game?.title ?? "") : subject,
        isPrivate,
        password,
        hostName,
      });
      const room = await onCreateRoom(config);

      const payload = buildChannelInvitePayload({
        roomId: room.id,
        roomName: config.roomName,
        category: config.category,
        isPrivate: config.isPrivate,
        callerName: hostName,
        callerAvatar: hostAvatar,
        nightKind: kind,
      });
      const results = await Promise.allSettled(selected.map((uid) => onSendInvite(uid, payload)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const sent = selected.length - failed;

      playSound?.("callEnter");
      if (selected.length === 0) notify("Sala aberta. Chame alguém pelo chat quando quiser.", "success");
      else if (failed === 0) notify(`Sala aberta e ${sent} ${sent === 1 ? "convite enviado" : "convites enviados"}.`, "success");
      else notify(`Sala aberta. ${sent} de ${selected.length} convites enviados; tente os outros pelo chat.`, "info");
      onClose();
    } catch {
      // createAndJoinRoom já avisou o motivo; aqui só destrava o botão
      setBusy(false);
    }
  };

  // Funções de render (e não componentes): como componentes internos, cada clique os recriaria
  // e o foco do teclado se perderia no checkbox que acabou de ser marcado.
  const renderRow = (friend: SocialFriend) => {
    const uid = friendUid(friend);
    const checked = selected.includes(uid);
    const full = !checked && selected.length >= maxInvitees();
    return (
      <li key={friend.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={full}
          onClick={() => {
            playSound?.(checked ? "switchOff" : "switchOn");
            setSelected((prev) => toggleInvitee(prev, uid));
          }}
          className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-[var(--node)] px-3 text-left transition-colors hover:bg-[var(--tone-2)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] ${
              checked ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]" : "bg-[var(--tone-3)]"
            }`}
          >
            {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </span>
          {friend.avatar ? (
            <img src={friend.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" draggable={false} />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tone-3)] text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
              {friend.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{friend.name}</span>
            <span className="block truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">
              {friend.status === "playing"
                ? `Jogando ${friend.playing || "um jogo"}`
                : isFriendOnline(friend)
                  ? "Online"
                  : formatLastSeen(friend.lastSeen)
                    ? `Offline, visto ${formatLastSeen(friend.lastSeen)}`
                    : "Offline"}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const renderGroup = (title: string, items: SocialFriend[]) =>
    items.length === 0 ? null : (
      <section key={title} aria-label={title} className="flex flex-col gap-1">
        <h3 className="px-3 text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">
          {title} <span className="font-metric">{items.length}</span>
        </h3>
        <ul className="flex flex-col gap-0.5">
          {items.map((friend) => renderRow(friend))}
        </ul>
      </section>
    );

  const noFriends = groups.playingIt.length + groups.online.length + groups.offline.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            {...modalBackdropMotion}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => !busy && onClose()}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={info.roomLabel}
            {...modalMotion}
            className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-1)] shadow-[var(--hairline),0_24px_64px_rgba(0,0,0,0.55)]"
          >
            <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
              <div>
                <h2 className="font-display text-[length:var(--step-4)] font-black leading-none tracking-[-0.03em] text-[var(--ink)]">
                  {info.roomLabel}
                </h2>
                <p className="mt-2 text-[length:var(--step-1)] text-[var(--ink-muted)]">
                  Escolha o tipo de noite, marque os amigos, online ou offline, e abra uma sala de voz com o convite no chat de cada um.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Fechar"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--tone-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-3)] hover:text-[var(--ink)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
              {/* 0. Tipo de noite */}
              <section aria-label="Tipo de noite" className="flex flex-col gap-3">
                <h3 className="text-[length:var(--step-1)] font-semibold text-[var(--ink)]">Tipo de noite</h3>
                <div role="radiogroup" aria-label="Tipo de noite" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {NIGHT_KINDS.map((option) => {
                    const active = option.id === kind;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          if (option.id !== kind) playSound?.("select");
                          setKind(option.id);
                        }}
                        className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--node)] text-[length:var(--step-1)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
                          active
                            ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]"
                            : "bg-[var(--tone-2)] text-[var(--ink-muted)] hover:bg-[var(--tone-3)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <SfSymbol name={option.symbol} size={18} active={active} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {!info.needsGame && (
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={28}
                    aria-label="Assunto da noite"
                    placeholder={info.subjectPlaceholder}
                    className="h-12 rounded-[var(--corner-sm)] bg-[var(--tone-2)] px-4 text-[length:var(--step-1)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                  />
                )}
              </section>

              {/* 1. Jogo (só na noite de jogo) */}
              {info.needsGame && (
              <section aria-label="Jogo" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
                    <Gamepad2 className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                    Jogo
                  </h3>
                  <label className="flex h-9 items-center gap-2 rounded-[var(--node)] bg-[var(--tone-2)] px-3">
                    <Search className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                    <input
                      ref={searchRef}
                      value={gameQuery}
                      onChange={(e) => setGameQuery(e.target.value)}
                      aria-label="Buscar jogo"
                      placeholder="Buscar jogo"
                      className="w-40 bg-transparent text-[length:var(--step-0)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus-visible:!shadow-none focus-visible:!outline-none"
                    />
                  </label>
                </div>
                {choices.length === 0 ? (
                  <p className="text-[length:var(--step-1)] text-[var(--ink-muted)]">Nenhum jogo com esse nome.</p>
                ) : (
                  <ul role="radiogroup" aria-label="Escolher o jogo" className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {choices.map((g) => {
                      const active = g.id === gameId;
                      const art = g.cardImage || g.image;
                      return (
                        <li key={g.id} className="shrink-0">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setGameId(g.id)}
                            title={g.title}
                            className="group flex w-[88px] cursor-pointer flex-col gap-2 text-left focus-visible:outline-none"
                          >
                            <span
                              className={`block h-[118px] w-[88px] overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)] transition-shadow duration-150 group-focus-visible:ring-2 group-focus-visible:ring-[var(--ink)] ${
                                active ? "shadow-[0_0_0_2px_var(--ink)]" : ""
                              }`}
                            >
                              {art ? (
                                <img src={art} alt="" className="h-full w-full object-cover" draggable={false} />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[var(--ink-faint)]">
                                  <Gamepad2 className="h-6 w-6" aria-hidden="true" />
                                </span>
                              )}
                            </span>
                            <span
                              className={`line-clamp-2 text-[length:var(--step-0)] leading-tight ${active ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
                            >
                              {g.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              )}

              {/* 2. Amigos */}
              <section aria-label="Amigos" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
                    <Users className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                    Amigos
                  </h3>
                  <span className="font-metric text-[length:var(--step-0)] text-[var(--ink-muted)]">
                    {selected.length} de {maxInvitees()}
                  </span>
                </div>
                {noFriends ? (
                  <p className="text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
                    Você ainda não tem amigos do Pherielium para convidar. A sala abre mesmo assim, e você chama alguém depois pelo chat.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {renderGroup(game ? `Já jogando ${game.title}` : "Jogando", groups.playingIt)}
                    {renderGroup("Online", groups.online)}
                    {renderGroup("Offline (recebem o convite no chat)", groups.offline)}
                  </div>
                )}
              </section>

              {/* 3. Sala */}
              <section aria-label="Sala" className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
                  <Lock className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                  Sala
                </h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPrivate}
                  onClick={() => {
                    playSound?.(isPrivate ? "switchOff" : "switchOn");
                    setIsPrivate((v) => !v);
                  }}
                  className="flex h-12 w-full cursor-pointer items-center justify-between rounded-[var(--node)] bg-[var(--tone-2)] px-4 text-left transition-colors hover:bg-[var(--tone-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                >
                  <span>
                    <span className="block text-[length:var(--step-1)] font-semibold text-[var(--ink)]">Sala com senha</span>
                    <span className="block text-[length:var(--step-0)] text-[var(--ink-muted)]">
                      {isPrivate ? "Quem recebe o convite digita a senha para entrar." : "Qualquer pessoa pode achar a sala em Canais de Voz."}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-11 shrink-0 rounded-[var(--node)] transition-colors ${isPrivate ? "bg-[var(--ink)]" : "bg-[var(--tone-4)]"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${isPrivate ? "left-[22px] bg-[var(--tone-0)]" : "left-0.5 bg-[var(--ink-muted)]"}`}
                    />
                  </span>
                </button>
                {isPrivate && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[length:var(--step-0)] font-medium text-[var(--ink-muted)]">Senha da sala</span>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={32}
                      autoComplete="off"
                      placeholder="Combine a senha com seus amigos"
                      className="h-12 rounded-[var(--corner-sm)] bg-[var(--tone-2)] px-4 text-[length:var(--step-1)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                    />
                  </label>
                )}
              </section>
            </div>

            <footer className="flex items-center justify-between gap-4 px-6 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
              <span className="min-w-0 truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">
                {info.needsGame && !game ? (
                  "Escolha um jogo para continuar"
                ) : (
                  <>
                    Sala{" "}
                    <span className="text-[var(--ink)]">
                      {gameNightRoomConfig({ kind, subject: info.needsGame ? (game?.title ?? "") : subject }).roomName}
                    </span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--node)] bg-[var(--ink)] px-7 text-[length:var(--step-1)] font-semibold text-[var(--tone-0)] transition-[transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.97] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tone-1)]"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy ? "Abrindo a sala" : selected.length > 0 ? `Abrir sala e convidar ${selected.length}` : "Abrir sala"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GameNightModal;
