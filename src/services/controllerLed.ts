import type { VisualTheme } from "../context/PreferencesContext";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Mesmos valores de --launcher-accent em index.css. */
export const THEME_ACCENT_COLORS: Record<VisualTheme, RgbColor> = {
  phelierium: { r: 255, g: 255, b: 255 },
  checkpoint: { r: 255, g: 255, b: 255 },
  ps5: { r: 255, g: 255, b: 255 },
  playstation: { r: 37, g: 99, b: 235 },
  ps4: { r: 0, g: 112, b: 209 },
  psp: { r: 6, g: 182, b: 212 },
  gamecube: { r: 124, g: 58, b: 237 },
  xbox360: { r: 132, g: 204, b: 22 },
  cyberpunk: { r: 255, g: 238, b: 0 },
};

type LedDeviceKind = "ds4" | "dualsense";

/**
 * Cor fixa da lightbar por modelo de controle — independente do tema visual.
 *
 * DS4      → #0029FF  (azul PlayStation clássico, como saiu de fábrica)
 * DualSense → #FFFFFF  (branco neutro do PS5)
 */
export const CONTROLLER_LED_COLORS: Record<LedDeviceKind, RgbColor> = {
  ds4:        { r: 0,   g: 41,  b: 255 }, // #0029FF
  dualsense:  { r: 255, g: 255, b: 255 }, // #FFFFFF
};

/** @deprecated Mantido apenas para compatibilidade — use CONTROLLER_LED_COLORS para LED físico. */
export const THEME_LED_COLORS: Record<VisualTheme, RgbColor> = {
  phelierium:  { r: 255, g: 255, b: 255 }, // branco
  checkpoint:  { r: 255, g: 255, b: 255 }, // branco
  ps5:         { r: 255, g: 255, b: 255 }, // #FFFFFF — branco (tema PS5)
  playstation: { r: 0,   g: 41,  b: 255 }, // #0029FF — azul PlayStation
  ps4:         { r: 0,   g: 41,  b: 255 }, // #0029FF — azul PS4 clássico
  psp:         { r: 6,   g: 182, b: 212 }, // ciano
  gamecube:    { r: 167, g: 0,   b: 255 }, // #A700FF
  xbox360:     { r: 33,  g: 255, b: 0   }, // #21FF00
  cyberpunk:   { r: 255, g: 238, b: 0   }, // amarelo
};

const SONY_VENDOR_ID = 0x054c;

/** Product IDs conhecidos: DS4, DS4 v2, DualSense, DualSense Edge */
const SONY_LED_PRODUCT_IDS = new Set([0x05c4, 0x09cc, 0x0ba0, 0x0ce6, 0x0df2]);

// LedDeviceKind movido para antes de CONTROLLER_LED_COLORS (hoisted)
interface LedDevice {
  device: HIDDevice;
  kind: LedDeviceKind;
}

export type ControllerLedStatus =
  | "unsupported"
  | "permission-required"
  | "connecting"
  | "connected"
  | "error";

export interface ControllerLedState {
  status: ControllerLedStatus;
  message: string;
}

let cachedDevice: LedDevice | null = null;
let crc32Table: Uint32Array | null = null;
let dualsenseOutputSequence = 0;
let ledState: ControllerLedState = {
  status: typeof navigator !== "undefined" && "hid" in navigator ? "permission-required" : "unsupported",
  message: typeof navigator !== "undefined" && "hid" in navigator
    ? "Autorize o controle PlayStation para sincronizar a luz."
    : "WebHID nao esta disponivel neste ambiente.",
};
const ledStateListeners = new Set<(state: ControllerLedState) => void>();

function updateLedState(status: ControllerLedStatus, message: string): void {
  ledState = { status, message };
  ledStateListeners.forEach((listener) => listener(ledState));
}

export function getControllerLedState(): ControllerLedState {
  return ledState;
}

export function subscribeControllerLedState(listener: (state: ControllerLedState) => void): () => void {
  ledStateListeners.add(listener);
  listener(ledState);
  return () => ledStateListeners.delete(listener);
}

function isHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

function clampRgb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function resolveLedKind(productId: number): LedDeviceKind {
  if (productId === 0x05c4 || productId === 0x09cc) return "ds4";
  return "dualsense";
}

function getOutputReportIds(device: HIDDevice): Set<number> {
  const reportIds = new Set<number>();
  for (const collection of device.collections ?? []) {
    for (const report of collection.outputReports ?? []) {
      reportIds.add(report.reportId);
    }
  }
  return reportIds;
}

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    crc32Table[i] = crc >>> 0;
  }
  return crc32Table;
}

function crc32Le(initialCrc: number, data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = initialCrc >>> 0;
  for (const byte of data) {
    crc = (table[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return crc >>> 0;
}

function writeLe32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

export async function requestControllerLedAccess(): Promise<boolean> {
  if (!isHidSupported()) {
    updateLedState("unsupported", "WebHID nao esta disponivel neste ambiente.");
    return false;
  }

  try {
    updateLedState("connecting", "Aguardando autorizacao do controle...");
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: SONY_VENDOR_ID }],
    });
    const device = devices.find(
      (candidate) => candidate.vendorId === SONY_VENDOR_ID && SONY_LED_PRODUCT_IDS.has(candidate.productId),
    );
    if (!device) {
      updateLedState("permission-required", "Nenhum DualShock 4 ou DualSense foi autorizado.");
      return false;
    }
    cachedDevice = { device, kind: resolveLedKind(device.productId) };
    updateLedState("connecting", `Conectando a ${device.productName || "controle PlayStation"}...`);
    return true;
  } catch (error) {
    const wasCancelled = error instanceof DOMException && error.name === "NotFoundError";
    updateLedState(
      wasCancelled ? "permission-required" : "error",
      wasCancelled ? "Autorizacao cancelada. Tente novamente nos Ajustes." : "Nao foi possivel solicitar acesso ao LED.",
    );
    return false;
  }
}

async function findSonyHidDevice(): Promise<LedDevice | null> {
  if (!isHidSupported()) return null;

  const devices = await navigator.hid.getDevices();
  const supportedDevices = devices.filter(
    (device) => device.vendorId === SONY_VENDOR_ID && SONY_LED_PRODUCT_IDS.has(device.productId),
  );

  for (const device of supportedDevices) {
    const reportIds = getOutputReportIds(device);
    if (reportIds.size === 0 || reportIds.has(0x05) || reportIds.has(0x11) || reportIds.has(0x02) || reportIds.has(0x31)) {
      return { device, kind: resolveLedKind(device.productId) };
    }
  }
  return null;
}

async function ensureOpenDevice(): Promise<LedDevice | null> {
  if (cachedDevice?.device.opened) return cachedDevice;

  cachedDevice = await findSonyHidDevice();
  if (!cachedDevice) return null;

  if (!cachedDevice.device.opened) {
    try {
      await cachedDevice.device.open();
    } catch {
      cachedDevice = null;
      return null;
    }
  }

  return cachedDevice;
}

interface HidReportAttempt {
  label: string;
  send: () => Promise<void>;
}

async function sendCompatibleReports(attempts: HidReportAttempt[], errorMessage: string): Promise<string[]> {
  const successfulReports: string[] = [];
  let lastError: unknown = null;

  // Windows may resolve an incompatible output report and silently discard it.
  // Send the same color through every plausible transport instead of stopping early.
  for (const attempt of attempts) {
    try {
      await attempt.send();
      successfulReports.push(attempt.label);
    } catch (error) {
      lastError = error;
    }
  }

  if (successfulReports.length > 0) return successfulReports;
  throw lastError ?? new Error(errorMessage);
}

export function buildDs4UsbLightbarReport(
  r: number,
  g: number,
  b: number,
): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(31);
  // O driver HID do DS4 no Windows espera o conjunto completo de recursos.
  // Os motores continuam desligados porque seus bytes permanecem em zero.
  report[0] = 0x07;
  report[5] = clampRgb(r);
  report[6] = clampRgb(g);
  report[7] = clampRgb(b);
  return report;
}

export function buildDs4BluetoothLightbarReport(
  r: number,
  g: number,
  b: number,
): Uint8Array<ArrayBuffer> {
  const reportId = 0x11;
  const report = new Uint8Array(77);
  report[0] = 0xc0; // HID + CRC32
  // Mesmo formato aceito pelo DS4 Bluetooth no Windows (report 0x11 + CRC).
  // Os bytes dos dois motores permanecem em zero.
  report[2] = 0x07;
  report[7] = clampRgb(r);
  report[8] = clampRgb(g);
  report[9] = clampRgb(b);

  const crcInput = new Uint8Array(1 + report.length - 4);
  crcInput[0] = reportId;
  crcInput.set(report.subarray(0, report.length - 4), 1);
  const seedCrc = crc32Le(0xffffffff, new Uint8Array([0xa2]));
  writeLe32(report, report.length - 4, (~crc32Le(seedCrc, crcInput)) >>> 0);
  return report;
}

async function sendDs4Lightbar(
  device: HIDDevice,
  r: number,
  g: number,
  b: number,
): Promise<string[]> {
  const reportIds = getOutputReportIds(device);
  const supportsUsbReport = reportIds.size === 0 || reportIds.has(0x05);
  const supportsBtReport = reportIds.size === 0 || reportIds.has(0x11);
  const attempts: HidReportAttempt[] = [];

  // DS4 Bluetooth uses 0x11. Try it first when Windows omits descriptors.
  if (supportsBtReport) {
    attempts.push({
      label: "Bluetooth 0x11",
      send: () => device.sendReport(0x11, buildDs4BluetoothLightbarReport(r, g, b)),
    });
  }

  if (supportsUsbReport) {
    attempts.push({
      label: "USB 0x05",
      send: () => device.sendReport(0x05, buildDs4UsbLightbarReport(r, g, b)),
    });
  }

  return sendCompatibleReports(attempts, "Nenhum output report DS4 compativel encontrado.");
}

export function buildDualSenseUsbLightbarReport(
  r: number,
  g: number,
  b: number,
): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(47);
  report[0] = 0x02;
  report[1] = 0x04;
  report[44] = clampRgb(r);
  report[45] = clampRgb(g);
  report[46] = clampRgb(b);
  return report;
}

export function buildDualSenseBluetoothLightbarReport(
  r: number,
  g: number,
  b: number,
  sequence = 0,
): Uint8Array<ArrayBuffer> {
  const reportId = 0x31;
  const report = new Uint8Array(77);
  report[0] = (sequence & 0x0f) << 4;
  report[1] = 0x10;
  report[2] = 0x02;
  report[3] = 0x04;
  report[46] = clampRgb(r);
  report[47] = clampRgb(g);
  report[48] = clampRgb(b);
  const crcInput = new Uint8Array(1 + report.length - 4);
  crcInput[0] = reportId;
  crcInput.set(report.subarray(0, report.length - 4), 1);
  const seedCrc = crc32Le(0xffffffff, new Uint8Array([0xa2]));
  writeLe32(report, report.length - 4, (~crc32Le(seedCrc, crcInput)) >>> 0);
  return report;
}

async function sendDualSenseLightbar(device: HIDDevice, r: number, g: number, b: number): Promise<string[]> {
  // USB output report 0x02 (48 bytes) — lightbar + player LED
  const reportIds = getOutputReportIds(device);
  const attempts: HidReportAttempt[] = [];

  if (reportIds.size === 0 || reportIds.has(0x02)) {
    attempts.push({ label: "USB 0x02", send: async () => {
      await device.sendReport(0x02, buildDualSenseUsbLightbarReport(r, g, b));
    } });
  }

  if (reportIds.size === 0 || reportIds.has(0x31)) {
    attempts.push({ label: "Bluetooth 0x31", send: async () => {
      await device.sendReport(
        0x31,
        buildDualSenseBluetoothLightbarReport(r, g, b, dualsenseOutputSequence++),
      );
    } });
  }

  return sendCompatibleReports(attempts, "Nenhum output report DualSense compativel encontrado.");
}

export async function setControllerLedColor(r: number, g: number, b: number): Promise<boolean> {
  updateLedState("connecting", "Sincronizando a luz do controle...");
  const led = await ensureOpenDevice();
  if (!led) {
    updateLedState("permission-required", "Autorize o controle PlayStation para sincronizar a luz.");
    return false;
  }

  try {
    const red = clampRgb(r);
    const green = clampRgb(g);
    const blue = clampRgb(b);
    const reports = led.kind === "ds4"
      ? await sendDs4Lightbar(led.device, red, green, blue)
      : await sendDualSenseLightbar(led.device, red, green, blue);
    updateLedState(
      "connected",
      `Comando enviado para ${led.device.productName || "controle PlayStation"} (${reports.join(" + ")}).`,
    );
    return true;
  } catch {
    cachedDevice = null;
    updateLedState("error", "O controle foi encontrado, mas nao aceitou o comando de LED.");
    return false;
  }
}

/**
 * Aplica a cor do LED conforme o **tema visual ativo** da aplicação.
 * ps4/playstation → #0029FF | ps5/phelierium/checkpoint → #FFFFFF
 */
export async function applyThemeLed(theme: VisualTheme): Promise<boolean> {
  const color = THEME_LED_COLORS[theme];
  return setControllerLedColor(color.r, color.g, color.b);
}

export function resetCachedLedDevice(): void {
  if (cachedDevice?.device.opened) {
    cachedDevice.device.close().catch(() => undefined);
  }
  cachedDevice = null;
  if (isHidSupported()) {
    updateLedState("permission-required", "Conecte e autorize o controle PlayStation.");
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/** Ciclo visual: WebHID confirma o envio, mas não confirma que a luz física mudou. */
export async function testControllerLed(theme: VisualTheme): Promise<boolean> {
  const colors = [
    { r: 255, g: 0, b: 80 },
    { r: 0, g: 180, b: 255 },
    { r: 120, g: 255, b: 0 },
  ];

  for (const color of colors) {
    if (!await setControllerLedColor(color.r, color.g, color.b)) return false;
    await wait(450);
  }
  return applyThemeLed(theme);
}
