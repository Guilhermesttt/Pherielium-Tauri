export {};

declare global {
  interface HIDDeviceFilter {
    vendorId?: number;
    productId?: number;
    usagePage?: number;
    usage?: number;
  }

  interface HIDDeviceRequestOptions {
    filters: HIDDeviceFilter[];
    exclusionFilters?: HIDDeviceFilter[];
  }

  interface HIDReportInfo {
    reportId: number;
  }

  interface HIDCollectionInfo {
    outputReports?: HIDReportInfo[];
  }

  interface HIDInputReportEvent extends Event {
    readonly device: HIDDevice;
    readonly reportId: number;
    readonly data: DataView;
  }

  interface HIDDeviceEventMap {
    inputreport: HIDInputReportEvent;
  }

  interface HIDDevice extends EventTarget {
    readonly opened: boolean;
    readonly vendorId: number;
    readonly productId: number;
    readonly productName: string;
    readonly collections?: HIDCollectionInfo[];
    open: () => Promise<void>;
    close: () => Promise<void>;
    sendReport: (reportId: number, data: BufferSource) => Promise<void>;
    addEventListener<K extends keyof HIDDeviceEventMap>(
      type: K,
      listener: (this: HIDDevice, ev: HIDDeviceEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof HIDDeviceEventMap>(
      type: K,
      listener: (this: HIDDevice, ev: HIDDeviceEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  interface HID extends EventTarget {
    getDevices: () => Promise<HIDDevice[]>;
    requestDevice: (options: HIDDeviceRequestOptions) => Promise<HIDDevice[]>;
  }

  interface Navigator {
    readonly hid: HID;
  }
}
