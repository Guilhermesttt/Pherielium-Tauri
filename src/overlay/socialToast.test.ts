import { describe, expect, it } from "vitest";
import { normalizeSocialToast } from "./socialToast";

describe("normalizeSocialToast", () => {
  const card = JSON.stringify({ __type: "call_invite", chatId: "c", callerName: "Bia" });

  it("never shows the call_invite JSON as a message", () => {
    const toast = normalizeSocialToast({ kind: "message", senderName: "Ana", messageText: card });
    expect(toast.message).toBe("Bia convidou para uma chamada.");
    expect(toast.description).toBe("Bia convidou para uma chamada.");
  });

  it("keeps normal messages", () => {
    expect(normalizeSocialToast({ kind: "message", senderName: "Ana", messageText: "oi" }).message).toBe("oi");
  });
});
