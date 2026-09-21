"use client";
import {
  animate,
  motion,
  useMotionValue,
} from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselItem {
  id: string | number;
  url: string;
  title?: string;
}

interface FramerCarouselThumbnailsProps {
  items: CarouselItem[];
  onSelectCapture?: (index: number) => void;
  initialIndex?: number;
}

const FULL_WIDTH_PX = 120;
const COLLAPSED_WIDTH_PX = 35;
const GAP_PX = 2;
const MARGIN_PX = 2;

export function FramerCarouselThumbnails({ items, onSelectCapture, initialIndex = 0 }: FramerCarouselThumbnailsProps) {
  const [index, setIndex] = useState<number>(initialIndex);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Atualizar índice se a prop inicial mudar (quando a modal reabrir com outra foto)
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const x = useMotionValue(0);

  useEffect(() => {
    if (!isDragging && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth || 1;
      const targetX = -index * containerWidth;

      animate(x, targetX, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    }
  }, [index, x, isDragging]);

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full mx-auto p-2">
      <div className="flex flex-col gap-3">
        {/* Main Carousel */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_rgba(0,0,0,0.5)] bg-black/40" ref={containerRef}>
          <motion.div
            className="flex"
            drag="x"
            dragElastic={0.2}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e, info) => {
              setIsDragging(false);
              const containerWidth = containerRef.current?.offsetWidth || 1;
              const offset = info.offset.x;
              const velocity = info.velocity.x;

              let newIndex = index;

              // If fast swipe, use velocity
              if (Math.abs(velocity) > 500) {
                newIndex = velocity > 0 ? index - 1 : index + 1;
              }
              // Otherwise use offset threshold (30% of container width)
              else if (Math.abs(offset) > containerWidth * 0.3) {
                newIndex = offset > 0 ? index - 1 : index + 1;
              }

              // Clamp index
              newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
              setIndex(newIndex);
            }}
            style={{ x }}
          >
            {items.map((item, idx) => (
              <div 
                key={item.id} 
                className="shrink-0 w-full aspect-video cursor-pointer"
                onClick={() => {
                  if (!isDragging && onSelectCapture) {
                    onSelectCapture(idx);
                  }
                }}
              >
                <img
                  src={item.url}
                  alt={item.title || `Captura ${idx + 1}`}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  draggable={false}
                />
              </div>
            ))}
          </motion.div>

          {/* Navigation Buttons */}
          <motion.button
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform z-10
              ${
                index === 0
                  ? "opacity-0 cursor-not-allowed pointer-events-none"
                  : "bg-black/60 text-white backdrop-blur-md border border-white/20 hover:scale-110 hover:bg-black/80 opacity-100"
              }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>

          {/* Next Button */}
          <motion.button
            disabled={index === items.length - 1}
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform z-10
              ${
                index === items.length - 1
                  ? "opacity-0 cursor-not-allowed pointer-events-none"
                  : "bg-black/60 text-white backdrop-blur-md border border-white/20 hover:scale-110 hover:bg-black/80 opacity-100"
              }`}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>

        <Thumbnails index={index} setIndex={setIndex} items={items} />
      </div>
    </div>
  );
}

function Thumbnails({ index, setIndex, items }: { index: number; setIndex: (index: number) => void; items: CarouselItem[] }) {
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (thumbnailsRef.current) {
      let scrollPosition = 0;
      for (let i = 0; i < index; i++) {
        scrollPosition += COLLAPSED_WIDTH_PX + GAP_PX;
      }

      scrollPosition += MARGIN_PX;

      const containerWidth = thumbnailsRef.current.offsetWidth;
      const centerOffset = containerWidth / 2 - FULL_WIDTH_PX / 2;
      scrollPosition -= centerOffset;

      thumbnailsRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  }, [index]);

  return (
    <div
      ref={thumbnailsRef}
      className="overflow-x-auto scrollbar-hide py-1"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="flex gap-2 h-24 pb-2 px-1 items-center" style={{ width: "fit-content" }}>
        {items.map((item, i) => (
          <motion.button
            key={item.id}
            onClick={() => setIndex(i)}
            initial={i === index ? "active" : "inactive"}
            animate={i === index ? "active" : "inactive"}
            variants={{
              active: {
                width: FULL_WIDTH_PX,
                marginLeft: MARGIN_PX,
                marginRight: MARGIN_PX,
                opacity: 1,
              },
              inactive: {
                width: COLLAPSED_WIDTH_PX,
                marginLeft: 0,
                marginRight: 0,
                opacity: 0.5,
              },
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative flex-shrink-0 h-full overflow-hidden rounded-lg border border-white/20 hover:opacity-100 transition-opacity p-0 bg-black/50"
          >
            <img
              src={item.url}
              alt={item.title || `Captura ${i + 1}`}
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
