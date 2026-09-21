/**
 * controllerBatteryService.ts
 * Serviço unificado de monitoramento de bateria de controles (WebHID, Electron IPC, Gamepad API)
 * Arquitetura baseada em Clean Code, SRP e OCP.
 */

import { findBatteryAdapter } from "./controllers/battery-adapters";

export type ControllerConnectionType = "bluetooth" | "usb" | "unknown";

export interface ControllerBatteryState {
  batteryLevel: number | null; // 0 a 100
  isCharging: boolean;
  connectionType: ControllerConnectionType;
  deviceName: string | null;
  isLowBattery: boolean;
  isCriticalBattery: boolean;
}

export type BatteryListener = (state: ControllerBatteryState) => void;

export interface ParsedBatteryResult {
  batteryLevel: number;
  isCharging: boolean;
  connectionType: ControllerConnectionType;
  deviceName: string;
}

/* ==========================================================================
   1. OCP: Contrato e Estratégias de Parsers HID
   ========================================================================== */

export interface HidReportParser {
  readonly deviceName: string;
  matches(vendorId: number, productId: number): boolean;
  parse(event: HIDInputReportEvent): ParsedBatteryResult | null;
}

export class DualSenseParser implements HidReportParser {
  readonly deviceName = "PlayStation DualSense";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x0ce6, 0x0df2]);

  matches(vendorId: number, productId: number): boolean {
    return vendorId === DualSenseParser.VENDOR_ID && DualSenseParser.SUPPORTED_PIDS.has(productId);
  }

  parse({ reportId, data }: HIDInputReportEvent): ParsedBatteryResult | null {
    // 0x31: Bluetooth, 0x01: USB
    if (reportId === 0x31 && data.byteLength >= 54) {
      return this.extractBattery(data.getUint8(53), "bluetooth");
    }
    if (reportId === 0x01 && data.byteLength >= 53) {
      return this.extractBattery(data.getUint8(52), "usb");
    }
    return null;
  }

  private extractBattery(byte: number, connectionType: ControllerConnectionType): ParsedBatteryResult {
    const rawLevel = byte & 0x0f;
    // nibble superior: 0x10 = carregando, 0x20 = completo (não carregando)
    const isCharging = ((byte & 0xf0) >> 4) === 0x1;
    return {
      batteryLevel: Math.min(100, Math.max(0, rawLevel * 10)),
      isCharging,
      connectionType,
      deviceName: this.deviceName,
    };
  }
}

export class DualShock4Parser implements HidReportParser {
  readonly deviceName = "PlayStation DualShock 4";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x05c4, 0x09cc]);

  matches(vendorId: number, productId: number): boolean {
    return vendorId === DualShock4Parser.VENDOR_ID && DualShock4Parser.SUPPORTED_PIDS.has(productId);
  }

  parse({ reportId, data }: HIDInputReportEvent): ParsedBatteryResult | null {
    // 0x11: Bluetooth, USB varia entre relatórios menores
    const isBluetooth = reportId === 0x11;

    if (isBluetooth && data.byteLength >= 31) {
      return this.extractBattery(data.getUint8(30), "bluetooth");
    }
    if (!isBluetooth && data.byteLength >= 13) {
      return this.extractBattery(data.getUint8(12), "usb");
    }
    return null;
  }

  private extractBattery(byte: number, connectionType: ControllerConnectionType): ParsedBatteryResult {
    const rawLevel = byte & 0x0f;
    return {
      batteryLevel: Math.min(100, Math.max(0, Math.round((rawLevel / 8) * 100))),
      isCharging: (byte & 0x10) !== 0,
      connectionType,
      deviceName: this.deviceName,
    };
  }
}

class HidParserRegistry {
  private parsers: HidReportParser[] = [
    new DualSenseParser(),
    new DualShock4Parser(),
  ];

  public register(parser: HidReportParser): void {
    this.parsers.push(parser);
  }

  public resolve(vendorId: number, productId: number): HidReportParser | undefined {
    return this.parsers.find((p) => p.matches(vendorId, productId));
  }
}

/* ==========================================================================
   2. SRP: Disparador de Alertas (Notificações DOM e IPC)
   ========================================================================== */

// Task 10: State machine explícita para alertas de bateria
// Estados: 'ok' → 'low_warned' → 'critical_warned' (transições irreversíveis dentro de uma sessão BT)
type BatteryAlertState = "ok" | "low_warned" | "critical_warned";

class BatteryAlertManager {
  private state: BatteryAlertState = "ok";

  public evaluate(batteryState: ControllerBatteryState): void {
    const isEligible =
      batteryState.connectionType === "bluetooth" &&
      !batteryState.isCharging &&
      batteryState.batteryLevel !== null;

    if (!isEligible) {
      // Ao reconectar via USB ou carregar, reseta a máquina para a próxima sessão BT
      this.state = "ok";
      return;
    }

    const level = batteryState.batteryLevel!;

    // Transições de estado
    if (level > 20) {
      // Acima de 20% → reseta (ex: o usuário carregou e desconectou o cabo)
      this.state = "ok";
    } else if (level <= 10 && this.state !== "critical_warned") {
      this.state = "critical_warned";
      this.dispatch(level, true);
    } else if (level <= 20 && level > 10 && this.state === "ok") {
      this.state = "low_warned";
      this.dispatch(level, false);
    }
    // Se state === 'low_warned' e level cai para <=10, sobe para critical
    else if (level <= 10 && this.state === "low_warned") {
      this.state = "critical_warned";
      this.dispatch(level, true);
    }
  }

  public reset(): void {
    this.state = "ok";
  }

  private dispatch(level: number, isCritical: boolean): void {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("checkpoint:low-battery", {
        detail: {
          level,
          isCritical,
          message: isCritical
            ? `Bateria Crítica do Controle (${level}%) — Conecte o cabo imediatamente!`
            : `Bateria Fraca do Controle (${level}%) — Conecte o cabo USB para continuar jogando.`,
        },
      })
    );

    try {
      const electron = (window as unknown as { electronAPI?: { showOverlayNotification?: (opts: unknown) => Promise<void> } }).electronAPI;
      if (typeof electron?.showOverlayNotification === "function") {
        void electron.showOverlayNotification({
          type: "battery-low",
          title: isCritical ? "Bateria Crítica do Controle!" : "Bateria Fraca do Controle",
          message: `Nível em ${level}%. Conecte o cabo USB.`,
          action: { actionId: "custom" },
        });
      }
    } catch {
      // Notificação opcional falhou
    }
  }
}

/* ==========================================================================
   3. Gerenciamento de Estado e Polling
   ========================================================================== */

const parserRegistry = new HidParserRegistry();
const alertManager = new BatteryAlertManager();
const listeners = new Set<BatteryListener>();

let currentState: ControllerBatteryState = {
  batteryLevel: null,
  isCharging: false,
  connectionType: "unknown",
  deviceName: null,
  isLowBattery: false,
  isCriticalBattery: false,
};

let pollTimer: number | null = null;
let activeHidDevice: HIDDevice | null = null;
let lastWebHidReportTime = 0;

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch {
      // Listener isolado
    }
  });
}

function updateBatteryState(partial: Partial<ControllerBatteryState>): void {
  const next: ControllerBatteryState = { ...currentState, ...partial };

  // Se o tipo de conexão mudou (ex: BT -> USB), descarta o batteryLevel antigo
  // para não mostrar dado stale de uma sessão anterior
  if (partial.connectionType !== undefined && partial.connectionType !== currentState.connectionType) {
    next.batteryLevel = partial.batteryLevel ?? null;
  }

  // --- FILTRO DE SANIDADE (ANTI-BUG DO BLUETOOTH) ---
  // Só aplica se a conexão não mudou (para não bloquear leituras legítimas ao reconectar)
  if (
    partial.batteryLevel !== undefined &&
    partial.batteryLevel !== null &&
    currentState.batteryLevel !== null &&
    next.connectionType === "bluetooth" &&
    (partial.connectionType === undefined || partial.connectionType === currentState.connectionType)
  ) {
    const diferenca = Math.abs(currentState.batteryLevel - partial.batteryLevel);

    // Controles piratas mandam "lixo de memória" que faz a bateria pular de 10% pra 90% do nada.
    // Se pular mais de 25% de uma vez na MESMA sessão de conexão, sabemos que é bug.
    if (diferenca > 25) {
      next.batteryLevel = currentState.batteryLevel;
    }
  }

  // Se o controle continua conectado no mesmo tipo e o novo poll veio temporariamente com batteryLevel null, preserva o último percentual conhecido
  if (partial.batteryLevel === null && currentState.batteryLevel !== null && (partial.connectionType === undefined || partial.connectionType === currentState.connectionType)) {
    next.batteryLevel = currentState.batteryLevel;
  }

  const { batteryLevel, isCharging, connectionType } = next;
  const isWireless = connectionType === "bluetooth";

  // Só alerta bateria fraca se estiver no Bluetooth, não estiver carregando, e com nível válido (> 0)
  // Nota: batteryLevel > 0 evita que um bug do controle mandando "0%" dispare o alerta de cara.
  next.isLowBattery = Boolean(isWireless && !isCharging && batteryLevel !== null && batteryLevel > 0 && batteryLevel <= 20);
  next.isCriticalBattery = Boolean(isWireless && !isCharging && batteryLevel !== null && batteryLevel > 0 && batteryLevel <= 10);

  const hasChanged =
    currentState.batteryLevel !== next.batteryLevel ||
    currentState.isCharging !== next.isCharging ||
    currentState.connectionType !== next.connectionType ||
    currentState.deviceName !== next.deviceName;

  currentState = next;

  if (hasChanged) {
    notifyListeners();
  }

  alertManager.evaluate(currentState);
}

function handleHidInputReport(event: HIDInputReportEvent): void {
  // 1. Tenta adaptador modular centralizado
  const adapter = findBatteryAdapter({
    vendorId: event.device.vendorId,
    productId: event.device.productId,
    name: event.device.productName,
  });

  if (adapter) {
    const reading = adapter.parseInputReport(event.reportId, event.data);
    if (reading) {
      lastWebHidReportTime = Date.now();
      updateBatteryState({
        batteryLevel: reading.level,
        isCharging: reading.charging,
        connectionType: reading.transport,
        deviceName: reading.deviceName,
      });
      return;
    }
  }

  // 2. Fallback para parser registrado
  const parser = parserRegistry.resolve(event.device.vendorId, event.device.productId);
  if (!parser) return;

  const result = parser.parse(event);
  if (result) {
    lastWebHidReportTime = Date.now();
    updateBatteryState(result);
  }
}

async function initWebHidBatteryListener(): Promise<void> {
  if (typeof navigator === "undefined" || !("hid" in navigator)) return;

  try {
    const devices = await navigator.hid.getDevices();
    for (const device of devices) {
      const adapter = findBatteryAdapter({
        vendorId: device.vendorId,
        productId: device.productId,
        name: device.productName,
      });
      const parser = parserRegistry.resolve(device.vendorId, device.productId);
      if (!adapter && !parser) continue;

      if (!device.opened) {
        try {
          await device.open();
        } catch {
          continue;
        }
      }

      if (device.opened) {
        activeHidDevice = device;
        device.addEventListener("inputreport", handleHidInputReport as EventListener);
        break;
      }
    }
  } catch {
    // WebHID indisponível ou permissão negada
  }
}

async function pollFallbackBatterySources(): Promise<void> {
  // Desativado: consulta periódica de bateria de controle removida para evitar overhead e chamadas contínuas.
  return;
}

/* ==========================================================================
   4. API Pública
   ========================================================================== */

export function registerCustomHidParser(parser: HidReportParser): void {
  parserRegistry.register(parser);
}

export function startControllerBatteryMonitoring(): () => void {
  // Desativado: monitoramento contínuo de bateria removido
  return () => {};
}

export function getControllerBatteryState(): ControllerBatteryState {
  return currentState;
}

export function subscribeControllerBattery(listener: BatteryListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}