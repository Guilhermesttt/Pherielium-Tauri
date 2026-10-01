const ROOM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Hard cap for voice calls (rooms and expanded 1:1 invites). */
export const MAX_CALL_PARTICIPANTS = 10;

export interface CallParticipantRef {
  uid: string;
}

/** Persistent backend voice room (single UUID, not `{uuid}_{uuid}`). */
export const isPersistentVoiceRoomId = (chatId: string): boolean => {
  const id = String(chatId || "").trim();
  return ROOM_UUID_RE.test(id) && !id.includes("_");
};

/** Count unique participants plus optional local user. */
export const countCallParticipants = (
  participants: CallParticipantRef[] | undefined,
  includeSelf = true,
): number => {
  const unique = new Set((participants || []).map((p) => p.uid).filter(Boolean));
  return unique.size + (includeSelf ? 1 : 0);
};

export const isCallAtCapacity = (
  participants: CallParticipantRef[] | undefined,
  max = MAX_CALL_PARTICIPANTS,
): boolean => countCallParticipants(participants) >= max;

/** Whether a new distinct user can join without exceeding the cap. */
export const canAcceptNewParticipant = (
  participants: CallParticipantRef[] | undefined,
  joiningUid?: string,
  max = MAX_CALL_PARTICIPANTS,
): boolean => {
  const list = participants || [];
  if (joiningUid && list.some((p) => p.uid === joiningUid)) return true;
  return countCallParticipants(list) < max;
};

export const callCapacityMessage = (max = MAX_CALL_PARTICIPANTS): string =>
  `A chamada está cheia (${max} participantes).`;
