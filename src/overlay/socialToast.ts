type FriendLike = {
  id?: string;
  name?: string;
  avatar?: string;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function extractSenderFromBody(body: string): string {
  const patterns = [
    /^(.+?)\s+est[áa] te ligando/i,
    /^Novo pedido de amizade de\s+(.+)$/i,
    /^Pedido de amizade de\s+(.+)$/i,
    /^Mensagem de\s+(.+)$/i,
    /^(.+?)\s+aceitou/i,
  ];
  for (const pattern of patterns) {
    const match = body.trim().match(pattern);
    const name = match?.[1]?.trim();
    if (name) return name.replace(/[.!]+$/, "").trim();
  }
  return "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function inferSocialKind(payload: Record<string, any>): string {
  const raw = firstString(payload.kind, payload.type).toLowerCase();
  const title = firstString(payload.title, payload.heading).toLowerCase();
  const body = firstString(
    payload.message,
    payload.messageText,
    payload.description,
    payload.subtitle,
  ).toLowerCase();

  if (
    raw === "incoming-call"
    || raw === "call"
    ||     title.includes("chamada")
    || body.includes("está te ligando")
    || body.includes("esta te ligando")
    || (body.includes("ligando") && body.includes("atender"))
  ) {
    return "incoming-call";
  }
  if (raw === "friend-request" || title.includes("pedido de amizade") || body.includes("pedido de amizade")) {
    return "friend-request";
  }
  if (raw === "friend-accepted" || (body.includes("aceitou") && body.includes("amizade"))) {
    return "friend-accepted";
  }
  if (raw === "dismiss") return "dismiss";
  if (raw === "friend-playing" || raw === "friend-message" || raw === "message") return raw === "friend-message" ? "message" : raw;
  if (raw === "game-start" || raw === "hint" || raw === "overlay-hint") return raw === "overlay-hint" ? "hint" : raw;
  if (title.includes("mensagem") || Boolean(payload.messageText)) return "message";
  return raw || "info";
}

export function normalizeSocialToast(
  payload: unknown,
  friends: FriendLike[] = [],
) {
  const data = asRecord(payload);
  const metadata = asRecord(data.metadata);
  const kind = inferSocialKind(data);

  const senderName = firstString(
    data.senderName,
    data.playerName,
    data.callerName,
    data.friendName,
    data.fromName,
    data.displayName,
    metadata.playerName,
    metadata.callerName,
    metadata.senderName,
  );

  const friendId = firstString(
    data.friendId,
    data.callerUid,
    data.callerId,
    data.fromUid,
    metadata.friendId,
    metadata.callerId,
  );

  const friend = friends.find((item) => {
    const id = String(item.id || "");
    const cleanFriend = friendId.replace(/^cp-friend:/, "");
    return (
      (friendId && (id === friendId || id.endsWith(`:${cleanFriend}`) || id === cleanFriend))
      || (senderName && item.name === senderName)
    );
  });

  const avatar = firstString(
    data.avatar,
    data.imageUrl,
    data.avatarUrl,
    data.photoURL,
    data.callerAvatar,
    metadata.avatar,
    metadata.imageUrl,
    friend?.avatar,
  );

  const message = firstString(
    data.messageText,
    kind === "message" || kind === "friend-message" ? data.message : "",
    kind === "message" || kind === "friend-message" ? data.description : "",
  );

  const description = firstString(
    kind === "message" || kind === "friend-message" ? message : "",
    data.description,
    data.message,
    data.subtitle,
  );

  const resolvedName =
    senderName
    || friend?.name
    || extractSenderFromBody(
      firstString(data.message, data.messageText, data.description, data.subtitle),
    );
  const fallbackTitle = firstString(data.title);
  const isGenericTitle =
    !resolvedName
    && /chamada|mensagem|pedido|notifica/i.test(fallbackTitle);

  return {
    kind,
    title: resolvedName || (isGenericTitle ? "Phelierium" : fallbackTitle) || "Phelierium",
    senderName: resolvedName || (isGenericTitle ? undefined : fallbackTitle) || undefined,
    subtitle: firstString(data.subtitle) || undefined,
    avatar: avatar || undefined,
    message: message || undefined,
    contentKind: firstString(data.contentKind) || undefined,
    description: description || undefined,
    gameTitle: firstString(data.gameTitle, metadata.gameTitle) || undefined,
    screenshotUrl: firstString(data.screenshotUrl) || undefined,
    callerUid: firstString(data.callerUid, data.callerId) || undefined,
    friendId: friendId || undefined,
  };
}
