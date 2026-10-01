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
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: (payload: unknown) => void) => {
      channelHandlers.insert = handler;
      return channel;
    }),
    subscribe: vi.fn(),
  };
  mockChannel.mockReturnValue(channel);
  mockSubscribeToGlobalEventBus.mockReturnValue(() => undefined);
  return { channel, channelHandlers };
}

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
});
