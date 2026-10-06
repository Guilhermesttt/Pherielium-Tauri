"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export interface WheelCarouselItem {
  label: string;
  image: string;
  imageAlt?: string;
  id?: string;
  icon?: any;
  count?: number;
  subtitle?: string;
}

export type WheelCarouselMode = "system" | "light" | "dark" | "custom";

export interface WheelCarouselProps {
  items?: WheelCarouselItem[];
  mode?: WheelCarouselMode;
  photoSide?: "left" | "right";
  photoWidth?: number;
  photoAspect?: "3/4" | "1/1" | "4/3" | "3/2";
  contentWidth?: number;
  gap?: number;
  photoRadius?: number;
  crossfadeDuration?: number;
  radius?: number;
  spacing?: number;
  visibleItems?: number;
  apexInset?: number;
  textColor?: string;
  selectedColor?: string;
  showMarker?: boolean;
  markerColor?: string;
  markerSize?: number;
  markerGap?: number;
  background?: string;
  panelColor?: string;
  scrollSpeed?: number;
  dragSpeed?: number;
  snap?: boolean;
  momentum?: boolean;
  appear?: boolean;
  edgeFade?: boolean;
  edgeFadeSize?: number;
  initialIndex?: number;
  activeIndex?: number;
  onActiveChange?: (item: WheelCarouselItem, index: number) => void;
  onItemSelect?: (item: WheelCarouselItem, index: number) => void;
  renderCover?: (
    item: WheelCarouselItem,
    index: number,
    prevItem?: WheelCarouselItem,
    nextItem?: WheelCarouselItem,
  ) => React.ReactNode;
  captureWindowWheel?: boolean;
  showItemIcons?: boolean;
  showItemCounts?: boolean;
  minHeight?: number | string;
  className?: string;
  photoClassName?: string;
  itemClassName?: string;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

export const wheelCarouselDefaultItems: WheelCarouselItem[] = [
  { label: "Halcyon Fields", image: unsplash("1520529890308-f503006340b4") },
  { label: "Meridian House", image: unsplash("1483366774565-c783b9f70e2c") },
  { label: "Norlight Pavilion", image: unsplash("1496865534669-25ec2a3a0fd3") },
  { label: "Aperture Studio", image: unsplash("1549791084-5f78368b208b") },
  { label: "Solene Tower", image: unsplash("1534094830444-3a1e21f7e3e7") },
  { label: "Verdant Mile", image: unsplash("1622396481322-3b83d186701b") },
  { label: "Cobalt Works", image: unsplash("1602128110234-2d11c0aaadfe") },
  { label: "Lumen Atrium", image: unsplash("1522404419647-18cb51cc5c7a") },
  { label: "Marlowe Residence", image: unsplash("1576831371356-d6e9411ae501") },
  { label: "Ostara Gallery", image: unsplash("1738844153732-a485f0e78382") },
  { label: "Quill & Stone", image: unsplash("1548248823-ce16a73b6d49") },
  { label: "Everest Loft", image: unsplash("1665779736808-047a6bbf43a0") },
  { label: "Sable Courtyard", image: unsplash("1543067361-9bf996edf6ff") },
  { label: "Ridgeline Retreat", image: unsplash("1592274951725-1688461e2019") },
  { label: "Aurelia Plaza", image: unsplash("1599669846660-945c5c775181") },
  { label: "Northwind Cabin", image: unsplash("1491406213019-05b162a72c20") },
  { label: "Onyx Terrace", image: unsplash("1611570885483-095b1b449aa3") },
  { label: "Palladium Hall", image: unsplash("1564566698730-9903b9e4a08c") },
  { label: "Cirrus Offices", image: unsplash("1676144844767-b25cb5e6c896") },
  { label: "Bramble Cottage", image: unsplash("1522743791393-522312deeebf") },
  { label: "Vellum Library", image: unsplash("1628270680011-41792b21de87") },
  { label: "Halden Bridge", image: unsplash("1478979464727-af7d24e18554") },
  { label: "Ember & Ash", image: unsplash("1586073054612-fdd6537fc6d4") },
  { label: "Slate Meridian", image: unsplash("1567505477286-9c7269119db7") },
];

const aspectRatios = {
  "3/4": "3 / 4",
  "1/1": "1 / 1",
  "4/3": "4 / 3",
  "3/2": "3 / 2",
} as const;

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function shortestOffset(index: number, rotation: number, length: number) {
  let offset = index - rotation;
  while (offset > length / 2) offset -= length;
  while (offset < -length / 2) offset += length;
  return offset;
}

export function WheelCarousel({
  items = wheelCarouselDefaultItems,
  mode = "system",
  photoSide = "left",
  photoWidth = 24,
  photoAspect = "3/4",
  contentWidth = 900,
  gap = 0,
  photoRadius = 14,
  crossfadeDuration = 0.5,
  radius = 320,
  spacing = 14,
  visibleItems = 7,
  apexInset = 34,
  textColor = "rgba(180, 90, 20, 0.45)",
  selectedColor = "rgb(180, 84, 30)",
  showMarker = true,
  markerColor = "rgb(232, 121, 46)",
  markerSize = 16,
  markerGap = 20,
  background = "rgb(255, 246, 236)",
  panelColor,
  scrollSpeed = 0.008,
  dragSpeed = 0.02,
  snap = true,
  momentum = true,
  appear = true,
  edgeFade = true,
  edgeFadeSize = 30,
  initialIndex = 0,
  activeIndex,
  onActiveChange,
  onItemSelect,
  renderCover,
  captureWindowWheel = false,
  showItemIcons = true,
  showItemCounts = true,
  minHeight,
  className,
  photoClassName,
  itemClassName,
}: WheelCarouselProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const instanceId = useId();
  let resolvedTheme = "dark";
  try {
    const themeContext = useTheme();
    if (themeContext?.resolvedTheme) {
      resolvedTheme = themeContext.resolvedTheme;
    }
  } catch {
    resolvedTheme = "dark";
  }

  const [themeReady, setThemeReady] = useState(false);
  const resolvedMode =
    mode === "system"
      ? themeReady && resolvedTheme === "light"
        ? "light"
        : "dark"
      : mode;
  const carouselItems = items.length ? items : wheelCarouselDefaultItems;
  const itemCount = carouselItems.length;
  const startingIndex = wrapIndex(activeIndex ?? initialIndex, itemCount);
  const [rotation, setRotation] = useState(startingIndex);
  const [selectedIndex, setSelectedIndex] = useState(startingIndex);
  const [isDragging, setIsDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(startingIndex);
  const selectedRef = useRef(startingIndex);
  const appliedActiveIndexRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const dragOriginRef = useRef({ y: 0, rotation: startingIndex });
  const previousDragRotationRef = useRef(startingIndex);
  const frameRef = useRef<number | null>(null);

  useEffect(() => setThemeReady(true), []);

  useEffect(() => {
    const normalizedIndex = wrapIndex(selectedRef.current, itemCount);

    if (normalizedIndex === selectedRef.current) return;

    selectedRef.current = normalizedIndex;
    rotationRef.current = normalizedIndex;
    setSelectedIndex(normalizedIndex);
    setRotation(normalizedIndex);
  }, [itemCount]);

  const palette = useMemo(() => {
    if (resolvedMode === "dark") {
      return {
        background: "transparent",
        text: "rgba(255, 255, 255, 0.5)",
        selected: "#ffffff",
        marker: "#ffffff",
        panel: "#141414",
      };
    }
    if (resolvedMode === "light") {
      return {
        background: "#ffffff",
        text: "rgba(0, 0, 0, 0.32)",
        selected: "#0a0a0a",
        marker: "#2c6bff",
        panel: "#ededed",
      };
    }
    return {
      background,
      text: textColor,
      selected: selectedColor,
      marker: markerColor,
      panel: panelColor ?? background,
    };
  }, [
    background,
    markerColor,
    panelColor,
    resolvedMode,
    selectedColor,
    textColor,
  ]);

  const commitRotation = useCallback(
    (nextRotation: number) => {
      rotationRef.current = nextRotation;
      setRotation(nextRotation);
      const nextIndex = wrapIndex(Math.round(nextRotation), itemCount);
      if (nextIndex !== selectedRef.current) {
        selectedRef.current = nextIndex;
        setSelectedIndex(nextIndex);
        appliedActiveIndexRef.current = nextIndex;
        onActiveChange?.(carouselItems[nextIndex]!, nextIndex);
      }
    },
    [carouselItems, itemCount, onActiveChange],
  );

  const commitRotationRef = useRef(commitRotation);
  commitRotationRef.current = commitRotation;

  const runAnimation = useCallback(() => {
    if (frameRef.current !== null) return;

    const tick = () => {
      let keepAnimating = false;

      if (!draggingRef.current && Math.abs(velocityRef.current) > 0.0008) {
        commitRotation(rotationRef.current + velocityRef.current);
        velocityRef.current *=
          momentum && !reduceMotion ? (snap ? 0.9 : 0.94) : 0.8;
        keepAnimating = true;
      } else if (!draggingRef.current && snap) {
        velocityRef.current = 0;
        const target = Math.round(rotationRef.current);
        const delta = target - rotationRef.current;
        if (Math.abs(delta) > 0.001 && !reduceMotion) {
          commitRotation(rotationRef.current + delta * 0.22);
          keepAnimating = true;
        } else {
          commitRotation(target);
        }
      } else if (!draggingRef.current) {
        velocityRef.current = 0;
      }

      if (keepAnimating) frameRef.current = requestAnimationFrame(tick);
      else frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [commitRotation, momentum, reduceMotion, snap]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage && !captureWindowWheel) return;

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return; // don't hijack pinch-zoom
      event.preventDefault();
      const delta = event.deltaY * scrollSpeed;
      commitRotation(rotationRef.current + delta);
      velocityRef.current = delta * 0.2;
      runAnimation();
    };

    const targetElement = captureWindowWheel ? window : stage;
    if (!targetElement) return;
    targetElement.addEventListener("wheel", handleWheel as any, { passive: false });
    return () => targetElement.removeEventListener("wheel", handleWheel as any);
  }, [commitRotation, runAnimation, scrollSpeed, captureWindowWheel]);

  useEffect(() => {
    if (activeIndex === undefined) return;
    const controlledIndex = wrapIndex(activeIndex, itemCount);
    if (appliedActiveIndexRef.current === controlledIndex) return;
    appliedActiveIndexRef.current = controlledIndex;
    const currentIndex = wrapIndex(Math.round(rotationRef.current), itemCount);
    let delta = controlledIndex - currentIndex;
    if (delta > itemCount / 2) delta -= itemCount;
    if (delta < -itemCount / 2) delta += itemCount;
    selectedRef.current = controlledIndex;
    setSelectedIndex(controlledIndex);
    commitRotationRef.current(rotationRef.current + delta);
    runAnimation();
  }, [activeIndex, itemCount, runAnimation]);

  const moveBy = (amount: number) => {
    velocityRef.current = 0;
    commitRotation(rotationRef.current + amount);
    runAnimation();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    draggingRef.current = true;
    setIsDragging(true);
    velocityRef.current = 0;
    dragOriginRef.current = { y: event.clientY, rotation: rotationRef.current };
    previousDragRotationRef.current = rotationRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const distance = event.clientY - dragOriginRef.current.y;
    const nextRotation = dragOriginRef.current.rotation - distance * dragSpeed;
    velocityRef.current = nextRotation - previousDragRotationRef.current;
    previousDragRotationRef.current = nextRotation;
    commitRotation(nextRotation);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    runAnimation();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(1);
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(-1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      velocityRef.current = 0;
      commitRotation(rotationRef.current - selectedIndex);
      runAnimation();
    }
    if (event.key === "End") {
      event.preventDefault();
      velocityRef.current = 0;
      const lastIndex = itemCount - 1;
      commitRotation(rotationRef.current + lastIndex - selectedIndex);
      runAnimation();
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onItemSelect?.(selectedItem, safeSelectedIndex);
    }
  };

  const safeSelectedIndex = wrapIndex(selectedIndex, itemCount);
  const selectedItem = carouselItems[safeSelectedIndex]!;
  const mask = edgeFade
    ? `linear-gradient(to bottom, transparent 0%, black ${edgeFadeSize}%, black ${100 - edgeFadeSize}%, transparent 100%)`
    : undefined;

  return (
    <motion.div
      initial={appear && !reduceMotion ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        className,
      )}
      style={{
        backgroundColor: palette.background,
        height:
          typeof minHeight === "number"
            ? `${minHeight}px`
            : (minHeight ?? 440),
        minHeight:
          typeof minHeight === "number"
            ? `${minHeight}px`
            : (minHeight ?? 440),
      }}
    >
      <div
        ref={stageRef}
        role="listbox"
        aria-label="Wheel carousel"
        aria-activedescendant={
          Math.abs(shortestOffset(safeSelectedIndex, rotation, itemCount)) <=
          visibleItems + 1
            ? `${instanceId}-item-${safeSelectedIndex}`
            : undefined
        }
        tabIndex={0}
        className={cn(
          "flex h-full w-full touch-none select-none items-stretch outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current",
          photoSide === "right" && "flex-row-reverse",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ maxWidth: contentWidth, height: "100%", gap }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
      >
        <div
          className="flex h-full shrink-0 items-center justify-center"
          style={{
            width: `${photoWidth}%`,
            backgroundColor: palette.background,
          }}
        >
          <div
            className={cn(
              renderCover
                ? "relative w-full flex items-center justify-center cursor-pointer group"
                : "relative w-full max-h-full overflow-hidden cursor-pointer group transition-transform active:scale-[0.98]",
              photoClassName,
            )}
            onClick={() => onItemSelect?.(selectedItem, safeSelectedIndex)}
            style={{
              ...(renderCover
                ? {}
                : {
                    aspectRatio: aspectRatios[photoAspect],
                    borderRadius: photoRadius,
                  }),
              backgroundColor: renderCover ? "transparent" : palette.panel,
            }}
          >
            <AnimatePresence initial={false} mode="sync">
              {renderCover ? (
                <div
                  key={safeSelectedIndex}
                  className="flex items-center justify-center w-full"
                >
                  {renderCover(
                    selectedItem,
                    safeSelectedIndex,
                    carouselItems[wrapIndex(safeSelectedIndex - 1, itemCount)],
                    carouselItems[wrapIndex(safeSelectedIndex + 1, itemCount)],
                  )}
                </div>
              ) : (
                <motion.img
                  key={`${safeSelectedIndex}-${selectedItem.image}`}
                  src={selectedItem.image}
                  alt={selectedItem.imageAlt ?? selectedItem.label}
                  initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : crossfadeDuration }}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div
          className="relative h-full min-w-0 flex-1"
          style={{
            height: "100%",
            maskImage: mask,
            WebkitMaskImage: mask,
          }}
        >
          {showMarker && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              style={{
                left: `calc(${apexInset}% - ${markerGap}px)`,
                width: markerSize,
                height: markerSize,
                marginLeft: -markerSize,
                backgroundColor: palette.marker,
              }}
            />
          )}

          {carouselItems.map((item, index) => {
            const offset = shortestOffset(index, rotation, itemCount);
            if (Math.abs(offset) > visibleItems + 1) return null;

            const angle = offset * spacing;
            const radians = (angle * Math.PI) / 180;
            const x = -radius * (1 - Math.cos(radians));
            const y = radius * Math.sin(radians);
            const distance = Math.min(Math.abs(offset) / visibleItems, 1);
            const opacity = Math.cos((distance * Math.PI) / 2);
            const scale = 1 - Math.min(Math.abs(offset) * 0.04, 0.45);
            const selected = Math.abs(offset) < 0.5;

            return (
              <div
                id={`${instanceId}-item-${index}`}
                key={`${item.label}-${index}`}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (selected) {
                    onItemSelect?.(item, index);
                  } else {
                    commitRotation(rotationRef.current + offset);
                    runAnimation();
                  }
                }}
                className={cn(
                  "absolute top-1/2 origin-left whitespace-nowrap text-[clamp(1.15rem,2.4vw,1.75rem)] font-medium leading-none tracking-tight cursor-pointer select-none transition-all duration-150 flex items-center gap-3 py-1.5 px-3 rounded-xl group",
                  itemClassName,
                )}
                style={{
                  left: `${apexInset}%`,
                  color: selected ? palette.selected : palette.text,
                  opacity,
                  transform: `translate(${x}px, ${y}px) translateY(-50%) rotate(${angle}deg) scale(${scale})`,
                }}
              >
                {showItemIcons && item.icon && (
                  <span
                    className={cn(
                      "shrink-0 flex items-center justify-center transition-all duration-150 [&>svg]:w-5 [&>svg]:h-5 [&>img]:w-5 [&>img]:h-5",
                      selected
                        ? "opacity-100 scale-105"
                        : "opacity-45 group-hover:opacity-80 group-hover:scale-105",
                    )}
                  >
                    {item.icon}
                  </span>
                )}
                <span
                  className={cn(
                    "transition-all duration-150",
                    selected
                      ? "font-bold text-white tracking-tight scale-[1.03]"
                      : "font-medium text-white/40 group-hover:text-white/70",
                  )}
                >
                  {item.label}
                </span>
                {showItemCounts && item.count !== undefined && (
                  <span
                    className={cn(
                      "text-xs px-2.5 py-0.5 rounded-full font-normal transition-colors duration-150",
                      selected
                        ? "bg-white/15 text-white shadow-xs"
                        : "bg-white/5 text-white/40 group-hover:text-white/60",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {selectedItem.label}, item {safeSelectedIndex + 1} of {itemCount}
      </span>
    </motion.div>
  );
}

export default WheelCarousel;
