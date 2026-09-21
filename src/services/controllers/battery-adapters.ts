/**
 * battery-adapters.ts
 * Adaptadores modulares de telemetria de bateria e conexão para controladores de jogos.
 * Suporta PlayStation DualSense, DualShock 4, Xbox e controladores genéricos.
 */

export type ControllerTransport = "bluetooth" | "usb" | "unknown";

export interface ControllerDeviceInfo {
  vendorId: number;
  productId: number;
  name?: string;
  transport?: ControllerTransport;
}

export interface BatteryReading {
  level: number; // 0 a 100
  charging: boolean;
  transport: ControllerTransport;
  deviceName: string;
  timestamp: number;
}

export interface ControllerBatteryAdapter {
  readonly deviceName: string;
  matches(info: ControllerDeviceInfo): boolean;
  parseInputReport(reportId: number, data: DataView): BatteryReading | null;
}


export class DualSenseBatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "PlayStation DualSense";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x0ce6, 0x0df2]);

  matches(info: ControllerDeviceInfo): boolean {
    if (info.vendorId === DualSenseBatteryAdapter.VENDOR_ID && DualSenseBatteryAdapter.SUPPORTED_PIDS.has(info.productId)) {
      return true;
    }
    return /dualsense|wireless controller/i.test(info.name ?? "") && (info.productId === 0x0ce6 || info.productId === 0x0df2);
  }

  parseInputReport(reportId: number, data: DataView): BatteryReading | null {
    // 0x31: Bluetooth (dados estendidos com telemetria de bateria)
    if (reportId === 0x31 && data.byteLength >= 54) {
      return this.extract(data.getUint8(53), "bluetooth");
    }
    // 0x01: Conexão direta via cabo USB
    if (reportId === 0x01 && data.byteLength >= 53) {
      return this.extract(data.getUint8(52), "usb");
    }
    return null;
  }

  private extract(byte: number, transport: ControllerTransport): BatteryReading {
    const rawLevel = byte & 0x0f;
    // nibble superior: 0x00 = descarregado/desconectado, 0x10 = carregando, 0x20 = completo (não carregando)
    const chargingNibble = (byte & 0xf0) >> 4;
    const isCharging = chargingNibble === 0x1; // apenas 0x10 = carregando de fato
    // rawLevel 0x0 a 0xa mapeia para 0% a 100%
    const level = Math.min(100, Math.max(0, Math.round(rawLevel * 10)));
    return {
      level,
      charging: isCharging,
      transport,
      deviceName: this.deviceName,
      timestamp: Date.now(),
    };
  }
}

/**
 * Sony PlayStation DualShock 4 (PS4)
 * VID: 0x054c | PIDs: 0x05c4, 0x09cc
 * - Bluetooth: Report ID 0x11 (byte 30 = battery/charging)
 * - USB: Report ID 0x01 ou genérico (byte 12 = battery/charging)
 */
export class DualShock4BatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "PlayStation DualShock 4";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x05c4, 0x09cc]);

  matches(info: ControllerDeviceInfo): boolean {
    if (info.vendorId === DualShock4BatteryAdapter.VENDOR_ID && DualShock4BatteryAdapter.SUPPORTED_PIDS.has(info.productId)) {
      return true;
    }
    return /dualshock|wireless controller/i.test(info.name ?? "");
  }

  parseInputReport(reportId: number, data: DataView): BatteryReading | null {
    const isBluetooth = reportId === 0x11;
    if (isBluetooth && data.byteLength >= 31) {
      return this.extract(data.getUint8(30), "bluetooth");
    }
    if (!isBluetooth && data.byteLength >= 13) {
      return this.extract(data.getUint8(12), "usb");
    }
    return null;
  }

  private extract(byte: number, transport: ControllerTransport): BatteryReading {
    const rawLevel = byte & 0x0f;
    // Bit 4 (0x10) = carregando. Bits 5+ são reservados ou flags de estado.
    const isCharging = (byte & 0x10) !== 0;
    // DS4 reporta rawLevel de 0 a 8 (0 = vazio, 8 = 100%)
    const level = Math.min(100, Math.max(0, Math.round((rawLevel / 8) * 100)));
    return {
      level,
      charging: isCharging,
      transport,
      deviceName: this.deviceName,
      timestamp: Date.now(),
    };
  }
}

/**
 * Microsoft Xbox Controller
 * Task 5: PIDs conhecidos para detecção correta.
 * Xbox utiliza XInput no Windows para bateria — via WebHID apenas detectamos se é USB ou BT.
 *
 * Xbox Series X|S Wireless: 0x02e0, 0x02fd, 0x0b12
 * Xbox One S Wireless:       0x02dd
 * Xbox 360 Wired:            0x028e
 * Xbox One Wired USB:        0x02d1
 */
export class XboxBatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "Xbox Controller";
  private static readonly VENDOR_ID = 0x045e;
  private static readonly WIRELESS_PIDS = new Set([0x02e0, 0x02fd, 0x0b12, 0x02dd]);
  private static readonly WIRED_PIDS    = new Set([0x028e, 0x02d1, 0x02ea]);

  matches(info: ControllerDeviceInfo): boolean {
    return info.vendorId === XboxBatteryAdapter.VENDOR_ID || /xbox|xinput/i.test(info.name ?? "");
  }

  parseInputReport(reportId: number, data: DataView): BatteryReading | null {
    // Xbox Series X|S BT envia report 0x01 com byte 14 contendo flags de bateria
    // (nível em 3 bits: 000=empty, 001=low, 010=medium, 011=full)
    if (reportId === 0x01 && data.byteLength >= 15) {
      const statusByte = data.getUint8(14);
      const isCharging = (statusByte & 0x10) !== 0;
      const levelRaw = (statusByte & 0x03); // bits 0-1: 0=empty,1=low,2=med,3=full
      const levelMap = [5, 35, 70, 100];
      const level = levelMap[levelRaw] ?? 100;
      // Transport inferido: se veio sem fio, é bluetooth
      const transport = this._info?.transport ?? "bluetooth";
      return {
        level,
        charging: isCharging,
        transport,
        deviceName: this.deviceName,
        timestamp: Date.now(),
      };
    }
    // Outros reports: Xbox não expõe bateria via WebHID no Windows — fallback é XInput (processo Electron)
    return null;
  }

  /** Contexto de dispositivo injetado para transport detection */
  private _info?: ControllerDeviceInfo;

  parseInputReportWithInfo(reportId: number, data: DataView, info: ControllerDeviceInfo): BatteryReading | null {
    this._info = info;
    try {
      return this.parseInputReport(reportId, data);
    } finally {
      this._info = undefined;
    }
  }
}

/**
 * Registro e resolução de adaptadores
 */
const defaultAdapters: ControllerBatteryAdapter[] = [
  new DualSenseBatteryAdapter(),
  new DualShock4BatteryAdapter(),
  new XboxBatteryAdapter(),
];

export function findBatteryAdapter(info: ControllerDeviceInfo): ControllerBatteryAdapter | undefined {
  return defaultAdapters.find((adapter) => adapter.matches(info));
}
