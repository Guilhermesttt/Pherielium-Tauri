import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../types/domain";

const mockGetUsableSession = vi.fn();
const mockApiFetch = vi.fn();
const mockFrom = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();
const mockSubscribeToGlobalEventBus = vi.fn();

vi.mock("./api", () => ({
  getUsableSession: (...args: unknown[]) => mockGetUsableSession(...args),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "" }, error: null }),
      }),
    },
  },
}));

vi.mock("./realtimeEventBus", () => ({
  subscribeToGlobalEventBus: (...args: unknown[]) => mockSubscribeToGlobalEventBus(...args),
  sendFastReadReceipt: vi.fn(),
  sendFastU2UMessage: vi.fn(),
}));

import { subscribeToChatMessages } from "./chat";

function createHistoryQuery(result: { data?: unknown[] | null; error?: { message: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function setupRealtimeChannel() {
  const channelHandlers: Record<string, (payload: unknown) => void> = {};
  const fastBus: { onMessage?: (message: ChatMessage) => void } = {};
  const channel = {
    on: vi.fn((_type: string, filter: { event?: string }, handler: (payload: unknown) => void) => {
      channelHandlers[(filter?.event ?? "INSERT").toLowerCase()] = handler;
      return channel;
    }),
    subscribe: vi.fn(),
  };
  mockChannel.mockReturnValue(channel);
  mockSubscribeToGlobalEventBus.mockImplementation(
    (_uid: unknown, handlers: { onMessage?: (message: ChatMessage) => void }) => {
      fastBus.onMessage = handlers.onMessage;
      return () => undefined;
    },
  );
  return { channel, channelHandlers, fastBus };
}

/** Linha como o Postgres devolve (snake_case), para o handler de INSERT. */
const dbRow = (over: Record<string, unknown> = {}) => ({
  id: "db-1",
  chat_id: "550e8400-e29b-41d4-a716-446655440000",
  sender_id: "friend-1",
  receiver_id: "user-1",
  text: "oi",
  read: false,
  created_at: new Date().toISOString(),
  ...over,
});

const fastMessage = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `fast_${Math.random().toString(36).slice(2, 8)}`,
  chatId: "550e8400-e29b-41d4-a716-446655440000",
  senderId: "friend-1",
  receiverId: "user-1",
  text: "oi",
  createdAt: new Date().toISOString(),
  read: false,
  ...over,
});

describe("subscribeToChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsableSession.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "token",
    });
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ chatId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    setupRealtimeChannel();
  });

  it("delivers an empty history without leaving the chat loading forever", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));

    const messages: ChatMessage[][] = [];
    const errors: Error[] = [];
    const unsubscribe = subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    await vi.waitFor(() => {
      expect(messages).toHaveLength(1);
    });

    expect(messages[0]).toEqual([]);
    expect(errors).toHaveLength(0);
    unsubscribe();
  });

  it("reports authentication failures through onError", async () => {
    mockGetUsableSession.mockResolvedValue(null);

    const messages: ChatMessage[][] = [];
    const errors: Error[] = [];
    subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    await vi.waitFor(() => {
      expect(errors).toHaveLength(1);
    });

    expect(errors[0]?.message).toMatch(/sess/i);
    expect(messages).toHaveLength(0);
  });

  it("reports query failures through onError", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: null, error: { message: "permission denied" } }));

    const messages: ChatMessage[][] = [];
    const errors: Error[] = [];
    subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    await vi.waitFor(() => {
      expect(errors).toHaveLength(1);
    });

    expect(errors[0]?.message).toMatch(/permission denied/i);
    expect(messages).toHaveLength(0);
  });

  it("does not emit callbacks after unsubscribe during hydration", async () => {
    let resolveHistory: ((value: { data: unknown[]; error: null }) => void) | undefined;
    const pendingHistory = new Promise<{ data: unknown[]; error: null }>((resolve) => {
      resolveHistory = resolve;
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue(pendingHistory),
    });

    const messages: ChatMessage[][] = [];
    const errors: Error[] = [];
    const unsubscribe = subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    unsubscribe();
    resolveHistory?.({ data: [], error: null });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(messages).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("succeeds after retry once initialization recovers", async () => {
    mockGetUsableSession
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        user: { id: "user-1" },
        access_token: "token",
      });
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));

    const messages: ChatMessage[][] = [];
    const errors: Error[] = [];

    subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    await vi.waitFor(() => {
      expect(errors).toHaveLength(1);
    });

    subscribeToChatMessages(
      "friend-1",
      (next) => messages.push(next),
      (error) => errors.push(error),
    );

    await vi.waitFor(() => {
      expect(messages).toHaveLength(1);
    });

    expect(messages[0]).toEqual([]);
  });

  it("pairs the fast message with its database row even after a long delay", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));
    const { channelHandlers, fastBus } = setupRealtimeChannel();

    const messages: ChatMessage[][] = [];
    const unsubscribe = subscribeToChatMessages("friend-1", (next) => messages.push(next));
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    const fast = fastMessage({ text: "bom dia" });
    fastBus.onMessage?.(fast);
    await vi.waitFor(() => expect(messages.at(-1)).toHaveLength(1));

    // Banco lento: a linha chega muito depois da antiga janela de 15s.
    const old = new Date(Date.now() - 120_000).toISOString();
    await channelHandlers.insert?.({
      new: dbRow({ id: "db-99", text: "bom dia", created_at: old }),
    });

    await vi.waitFor(() => {
      const last = messages.at(-1)!;
      expect(last).toHaveLength(1);
      expect(last[0].id).toBe("db-99");
    });
    unsubscribe();
  });

  it("keeps two identical messages sent back to back as two messages", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));
    const { channelHandlers, fastBus } = setupRealtimeChannel();

    const messages: ChatMessage[][] = [];
    const unsubscribe = subscribeToChatMessages("friend-1", (next) => messages.push(next));
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    fastBus.onMessage?.(fastMessage({ text: "oi" }));
    fastBus.onMessage?.(fastMessage({ text: "oi" }));
    await vi.waitFor(() => expect(messages.at(-1)).toHaveLength(2));

    await channelHandlers.insert?.({ new: dbRow({ id: "db-a", text: "oi" }) });
    await channelHandlers.insert?.({ new: dbRow({ id: "db-b", text: "oi" }) });

    await vi.waitFor(() => {
      const last = messages.at(-1)!;
      expect(last).toHaveLength(2);
      expect(last.map((m) => m.id).sort()).toEqual(["db-a", "db-b"]);
    });
    unsubscribe();
  });

  it("pairs by client_id, not by text, so edited text still replaces the fast copy", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));
    const { channelHandlers, fastBus } = setupRealtimeChannel();

    const messages: ChatMessage[][] = [];
    const unsubscribe = subscribeToChatMessages("friend-1", (next) => messages.push(next));
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    fastBus.onMessage?.(fastMessage({ text: "ola", clientId: "cid-1" }));
    await vi.waitFor(() => expect(messages.at(-1)).toHaveLength(1));

    // Mesmo client_id, texto diferente e muito mais velho: o pareamento por
    // texto/tempo erraria aqui e deixaria duas mensagens.
    await channelHandlers.insert?.({
      new: dbRow({
        id: "db-1",
        text: "ola!",
        client_id: "cid-1",
        created_at: new Date(Date.now() - 300_000).toISOString(),
      }),
    });

    await vi.waitFor(() => {
      const last = messages.at(-1)!;
      expect(last).toHaveLength(1);
      expect(last[0].id).toBe("db-1");
      expect(last[0].clientId).toBe("cid-1");
    });
    unsubscribe();
  });

  it("ignores an update broadcast for a message that is not loaded", async () => {
    mockFrom.mockReturnValue(createHistoryQuery({ data: [], error: null }));
    const { fastBus } = setupRealtimeChannel();

    const messages: ChatMessage[][] = [];
    const unsubscribe = subscribeToChatMessages("friend-1", (next) => messages.push(next));
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    fastBus.onMessage?.(
      fastMessage({ id: "db-antiga", text: "texto editado", isUpdate: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(messages.at(-1)).toHaveLength(0);
    unsubscribe();
  });
});
