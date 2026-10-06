import React from "react";
import { createSfSymbolIcon, type SfIconProps } from "./SfSymbol";
import type { SfSymbolName } from "./types";

export type LucideProps = SfIconProps;
export type LucideIcon = React.FC<LucideProps>;

function createLucideSfIcon(
  symbolName: SfSymbolName,
  fillVariant?: SfSymbolName,
): LucideIcon {
  return createSfSymbolIcon(symbolName, fillVariant) as LucideIcon;
}

// Mapped Apple SF Symbols for Lucide compatibility across all platform components
export const Gamepad2: LucideIcon = createLucideSfIcon("gamecontroller");
export const Star: LucideIcon = createLucideSfIcon("star");
export const Users: LucideIcon = createLucideSfIcon("person.2");
export const Users2: LucideIcon = createLucideSfIcon("person.2");
export const Radio: LucideIcon = createLucideSfIcon(
  "dot.radiowaves.left.and.right",
);
export const RadioReceiver: LucideIcon = createLucideSfIcon(
  "antenna.radiowaves.left.and.right",
);
export const Newspaper: LucideIcon = createLucideSfIcon("doc.plaintext");
export const Laptop: LucideIcon = createLucideSfIcon("desktopcomputer");

export const Puzzle: LucideIcon = createLucideSfIcon("hammer");
export const Folder: LucideIcon = createLucideSfIcon("folder");
export const FolderOpen: LucideIcon = createLucideSfIcon("folder.fill");
export const FolderPlus: LucideIcon = createLucideSfIcon("folder.badge.plus");
export const PanelLeft: LucideIcon = createLucideSfIcon("sidebar.left");
export const Settings: LucideIcon = createLucideSfIcon("gear");
export const Settings2: LucideIcon = createLucideSfIcon("slider.horizontal.3");
export const Sliders: LucideIcon = createLucideSfIcon("slider.horizontal.3");
export const SlidersHorizontal: LucideIcon = createLucideSfIcon(
  "slider.horizontal.3",
);
export const Filter: LucideIcon = createLucideSfIcon(
  "line.horizontal.3.decrease",
);
export const ListFilter: LucideIcon = createLucideSfIcon(
  "line.horizontal.3.decrease.circle",
);
export const X: LucideIcon = createLucideSfIcon("xmark");
export const XIcon: LucideIcon = createLucideSfIcon("xmark");
export const OctagonXIcon: LucideIcon = createLucideSfIcon("xmark.octagon");
export const Check: LucideIcon = createLucideSfIcon("checkmark");
export const CheckIcon: LucideIcon = createLucideSfIcon("checkmark");
export const CheckCircle2: LucideIcon = createLucideSfIcon("checkmark.circle");
export const CircleCheckIcon: LucideIcon =
  createLucideSfIcon("checkmark.circle");
export const CircleIcon: LucideIcon = createLucideSfIcon("circle");
export const Plus: LucideIcon = createLucideSfIcon("plus");
export const Minus: LucideIcon = createLucideSfIcon("minus");
export const Search: LucideIcon = createLucideSfIcon("magnifyingglass");
export const FileSearch: LucideIcon = createLucideSfIcon(
  "doc.text.magnifyingglass",
);
export const RefreshCw: LucideIcon = createLucideSfIcon("arrow.clockwise");
export const RotateCw: LucideIcon = createLucideSfIcon("arrow.clockwise");
export const RotateCcw: LucideIcon = createLucideSfIcon(
  "arrow.counterclockwise",
);
export const Send: LucideIcon = createLucideSfIcon("paperplane");
export const Download: LucideIcon = createLucideSfIcon("arrow.down.circle");
export const Upload: LucideIcon = createLucideSfIcon("arrow.up.circle");
export const Copy: LucideIcon = createLucideSfIcon("doc.on.doc");
export const Edit3: LucideIcon = createLucideSfIcon("pencil");
export const Pencil: LucideIcon = createLucideSfIcon("pencil");
export const Trash2: LucideIcon = createLucideSfIcon("trash");
export const Delete: LucideIcon = createLucideSfIcon("trash");
export const ExternalLink: LucideIcon = createLucideSfIcon(
  "arrow.up.right.square",
);
export const Link: LucideIcon = createLucideSfIcon("link");
export const Link2: LucideIcon = createLucideSfIcon("link");
export const Pin: LucideIcon = createLucideSfIcon("pin");
export const Shuffle: LucideIcon = createLucideSfIcon("shuffle");
export const Move: LucideIcon = createLucideSfIcon("arrow.up.and.down");
export const Crop: LucideIcon = createLucideSfIcon("crop");
export const Play: LucideIcon = createLucideSfIcon("play");
export const Pause: LucideIcon = ({ size = 20, color = "currentColor", className = "", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} {...(props as any)}>
    <rect x="6" y="4" width="4" height="16" rx="1.5" />
    <rect x="14" y="4" width="4" height="16" rx="1.5" />
  </svg>
);
export const SkipBack: LucideIcon = ({ size = 20, color = "currentColor", className = "", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} {...(props as any)}>
    <polygon points="11 19 2 12 11 5 11 19" />
    <polygon points="22 19 13 12 22 5 22 19" />
  </svg>
);
export const SkipForward: LucideIcon = ({ size = 20, color = "currentColor", className = "", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} {...(props as any)}>
    <polygon points="13 19 22 12 13 5 13 19" />
    <polygon points="2 19 11 12 2 5 2 19" />
  </svg>
);
export const Camera: LucideIcon = createLucideSfIcon("camera");
export const Video: LucideIcon = createLucideSfIcon("video");
export const VideoOff: LucideIcon = createLucideSfIcon("video.slash");
export const Mic: LucideIcon = createLucideSfIcon("mic");
export const MicOff: LucideIcon = createLucideSfIcon("mic.slash");
export const Headphones: LucideIcon = createLucideSfIcon("headphones");
export const Music: LucideIcon = createLucideSfIcon("waveform");
export const Volume: LucideIcon = createLucideSfIcon("speaker.1");
export const Volume1: LucideIcon = createLucideSfIcon("speaker.1");
export const Volume2: LucideIcon = createLucideSfIcon("speaker.2");
export const VolumeX: LucideIcon = createLucideSfIcon("speaker.slash");
export const Monitor: LucideIcon = createLucideSfIcon("desktopcomputer");
export const MonitorUp: LucideIcon = createLucideSfIcon("arrow.up.circle");
export const MonitorOff: LucideIcon = createLucideSfIcon("desktopcomputer");
export const PictureInPicture2: LucideIcon = createLucideSfIcon("tv");
export const Tv: LucideIcon = createLucideSfIcon("tv");
export const MonitorSmartphone: LucideIcon =
  createLucideSfIcon("desktopcomputer");
export const AppWindow: LucideIcon = createLucideSfIcon("macwindow");
export const Keyboard: LucideIcon = createLucideSfIcon("keyboard");
export const Mouse: LucideIcon = createLucideSfIcon("hand.point.right");
export const MouseRight: LucideIcon = createLucideSfIcon("hand.point.right");
export const HardDrive: LucideIcon = createLucideSfIcon("archivebox");
export const Battery: LucideIcon = createLucideSfIcon("battery.100");
export const BatteryLow: LucideIcon = createLucideSfIcon("battery.25");
export const BatteryCharging: LucideIcon = createLucideSfIcon("battery.100");
export const Usb: LucideIcon = createLucideSfIcon("link");
export const Bluetooth: LucideIcon = createLucideSfIcon(
  "antenna.radiowaves.left.and.right",
);
export const WifiOff: LucideIcon = createLucideSfIcon("wifi.slash");
export const User: LucideIcon = createLucideSfIcon("person.crop.circle");
export const UserRound: LucideIcon = createLucideSfIcon("person.circle");
export const UserPlus: LucideIcon = createLucideSfIcon("person.badge.plus");
export const UserMinus: LucideIcon = createLucideSfIcon("person.badge.minus");
export const UserX: LucideIcon = createLucideSfIcon("person.badge.minus");
export const MessageSquare: LucideIcon = createLucideSfIcon(
  "bubble.left.and.bubble.right",
);
export const Phone: LucideIcon = createLucideSfIcon("phone");
export const PhoneOff: LucideIcon = createLucideSfIcon("phone.down.fill");
export const PhoneCall: LucideIcon = createLucideSfIcon("phone.arrow.up.right");
export const PhoneIncoming: LucideIcon = createLucideSfIcon(
  "phone.arrow.down.left",
);
export const AlertCircle: LucideIcon = createLucideSfIcon(
  "exclamationmark.circle",
);
export const AlertTriangle: LucideIcon = createLucideSfIcon(
  "exclamationmark.triangle",
);
export const TriangleAlertIcon: LucideIcon = createLucideSfIcon(
  "exclamationmark.triangle",
);
export const Info: LucideIcon = createLucideSfIcon("info.circle");
export const InfoIcon: LucideIcon = createLucideSfIcon("info.circle");
export const Lock: LucideIcon = createLucideSfIcon("lock");
export const Unlock: LucideIcon = createLucideSfIcon("lock.open");
export const KeyRound: LucideIcon = createLucideSfIcon("lock");
export const Shield: LucideIcon = createLucideSfIcon("shield");
export const ShieldAlert: LucideIcon = createLucideSfIcon(
  "exclamationmark.shield",
);
export const ShieldCheck: LucideIcon = createLucideSfIcon("checkmark.shield");
export const Loader2: LucideIcon = createLucideSfIcon("arrow.2.circlepath");
export const LoaderCircle: LucideIcon =
  createLucideSfIcon("arrow.2.circlepath");
export const Loader2Icon: LucideIcon = createLucideSfIcon("arrow.2.circlepath");
export const Eye: LucideIcon = createLucideSfIcon("eye");
export const EyeOff: LucideIcon = createLucideSfIcon("eye.slash");
export const Clock: LucideIcon = createLucideSfIcon("clock");
export const Calendar: LucideIcon = createLucideSfIcon("calendar");
export const Activity: LucideIcon = createLucideSfIcon("waveform.path.ecg");
export const Vibrate: LucideIcon = createLucideSfIcon("waveform");
export const VibrateOff: LucideIcon = createLucideSfIcon("speaker.slash");
export const Bell: LucideIcon = createLucideSfIcon("bell");
export const BellOff: LucideIcon = createLucideSfIcon("bell.slash");
export const ChevronDown: LucideIcon = createLucideSfIcon("chevron.down");
export const ChevronUp: LucideIcon = createLucideSfIcon("chevron.up");
export const ChevronLeft: LucideIcon = createLucideSfIcon("chevron.left");
export const ChevronRight: LucideIcon = createLucideSfIcon("chevron.right");
export const ChevronRightIcon: LucideIcon = createLucideSfIcon("chevron.right");
export const ArrowRight: LucideIcon = createLucideSfIcon("arrow.right");
export const ArrowLeft: LucideIcon = createLucideSfIcon("arrow.left");
export const ArrowUpDown: LucideIcon = createLucideSfIcon(
  "arrow.up.arrow.down",
);
export const ArrowUpRight: LucideIcon = createLucideSfIcon("arrow.up.right");
export const CornerDownLeft: LucideIcon = createLucideSfIcon("return");
export const Maximize: LucideIcon = createLucideSfIcon(
  "arrow.up.left.and.arrow.down.right",
);
export const Maximize2: LucideIcon = createLucideSfIcon(
  "arrow.up.left.and.arrow.down.right",
);
export const Minimize2: LucideIcon = createLucideSfIcon(
  "arrow.down.right.and.arrow.up.left",
);
export const MoreVertical: LucideIcon = createLucideSfIcon("ellipsis");
export const MoreHorizontal: LucideIcon = createLucideSfIcon("ellipsis");
export const Menu: LucideIcon = createLucideSfIcon("line.horizontal.3");
export const LayoutGrid: LucideIcon = createLucideSfIcon("square.grid.2x2");
export const Layers: LucideIcon = createLucideSfIcon("rectangle.stack");
export const Square: LucideIcon = createLucideSfIcon("square");
export const Space: LucideIcon = createLucideSfIcon("capslock");
export const Scaling: LucideIcon = createLucideSfIcon("aspectratio");
export const Scan: LucideIcon = createLucideSfIcon("viewfinder");
export const Gauge: LucideIcon = createLucideSfIcon("gauge");
export const TrendingUp: LucideIcon = createLucideSfIcon("chart.bar");
export const Sparkles: LucideIcon = createLucideSfIcon("sparkles");
export const Palette: LucideIcon = createLucideSfIcon("paintbrush");
export const Contrast: LucideIcon = createLucideSfIcon("circle.lefthalf.fill");
export const Zap: LucideIcon = createLucideSfIcon("bolt");
export const Flame: LucideIcon = createLucideSfIcon("flame");
export const Swords: LucideIcon = createLucideSfIcon("shield.fill");
export const Trophy: LucideIcon = createLucideSfIcon("rosette");
export const Crown: LucideIcon = createLucideSfIcon("rosette");
export const Globe: LucideIcon = createLucideSfIcon("globe");
export const BookOpen: LucideIcon = createLucideSfIcon("book");
export const LibraryBig: LucideIcon = createLucideSfIcon("book");
export const Compass: LucideIcon = createLucideSfIcon("safari");
export const Skull: LucideIcon = createLucideSfIcon("xmark.octagon");
export const Ghost: LucideIcon = createLucideSfIcon("moon.stars");
export const Bomb: LucideIcon = createLucideSfIcon("burst");
export const Cpu: LucideIcon = createLucideSfIcon("bolt.circle");
export const Terminal: LucideIcon = createLucideSfIcon(
  "chevron.left.slash.chevron.right",
);
export const Package: LucideIcon = createLucideSfIcon("archivebox");
export const PackageOpen: LucideIcon = createLucideSfIcon("archivebox");
export const Image: LucideIcon = createLucideSfIcon("photo");
export const ImagePlus: LucideIcon = createLucideSfIcon("photo.on.rectangle");
export const PartyPopper: LucideIcon = createLucideSfIcon("sparkles");
export const Home: LucideIcon = createLucideSfIcon("house");
export const Power: LucideIcon = createLucideSfIcon("power");
export const LogOut: LucideIcon = createLucideSfIcon("arrow.right.to.line");
export const LogIn: LucideIcon = createLucideSfIcon("arrow.left.to.line");
export const Rocket: LucideIcon = createLucideSfIcon("paperplane.fill");
export const Dices: LucideIcon = createLucideSfIcon("square.grid.2x2");
export const Heart: LucideIcon = createLucideSfIcon("heart");
export const BadgeDollarSign: LucideIcon =
  createLucideSfIcon("dollarsign.circle");
export const Languages: LucideIcon = createLucideSfIcon("globe");
export const ZoomIn: LucideIcon = createLucideSfIcon("plus.magnifyingglass");
export const ZoomOut: LucideIcon = createLucideSfIcon("minus.magnifyingglass");
export const Database: LucideIcon = createLucideSfIcon("archivebox");

// Default export proxy to safeguard against any unlisted Lucide icon imports
const iconsProxy = new Proxy({} as Record<string, LucideIcon>, {
  get: (_target, prop: string) => {
    if (typeof prop !== "string" || prop === "__esModule") return undefined;
    return createLucideSfIcon("circle");
  },
});

export default iconsProxy;
