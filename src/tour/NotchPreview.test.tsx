import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTCH_CONFIG } from "../mascot/notchConfig";

// A prévia usa a Pherie (canvas/DOM) e o painel completo da notch: aqui só importa a estrutura renderizada.
vi.mock("../mascot/MascotView", () => ({ MascotView: () => <span data-testid="pherie" /> }));
vi.mock("../components/notch/DesktopNotch", () => ({
  NotchCard: ({ children }: { children: React.ReactNode }) => <section data-testid="music">{children}</section>,
}));
vi.mock("../components/notch/live/MediaProgress", () => ({ MediaProgress: () => <div data-testid="progress" /> }));

const render = async (patch: Partial<typeof DEFAULT_NOTCH_CONFIG>) => {
  const { NotchPreview } = await import("./NotchPreview");
  return renderToStaticMarkup(<NotchPreview config={{ ...DEFAULT_NOTCH_CONFIG, ...patch }} focus={null} />);
};

describe("NotchPreview", () => {
  it("mostra música, letra, calendário e clima de exemplo quando tudo está ligado", async () => {
    const html = await render({});
    expect(html).toContain('data-testid="music"');
    expect(html).toContain("Letra da música");
    expect(html).toContain('aria-label="Calendário"');
    expect(html).toContain('aria-label="Clima"');
    expect(html).toContain("Parcialmente nublado");
    expect(html).toContain('data-testid="pherie"');
  });

  it("cada interruptor tira o seu widget da prévia", async () => {
    const html = await render({ widgets: ["calendar"], showMascot: false });
    expect(html).not.toContain("Letra da música");
    expect(html).not.toContain('aria-label="Clima"');
    expect(html).toContain('aria-label="Calendário"');
    expect(html).not.toContain('data-testid="pherie"');
  });

  it("usa a cidade digitada no clima de exemplo e avisa quando a notch está desligada", async () => {
    expect(await render({ weatherCity: "Maceió" })).toContain("Maceió");
    const off = await render({ enabled: false });
    expect(off).toContain("Notch desligada");
    expect(off).not.toContain('data-testid="music"');
  });
});
