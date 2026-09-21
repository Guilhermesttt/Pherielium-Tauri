import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, RotateCw, Check, X, Move, RefreshCw } from "lucide-react";
import ModalShell from "./ui/ModalShell";

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  // Reset state when opening a new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setImageLoaded(false);

      const img = new Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Handle Drag / Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(0.5, prev + delta), 4));
  };

  // Touch handlers for touchscreens/laptops
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Export cropped 1:1 image
  const handleApplyCrop = useCallback(() => {
    if (!imageSrc) return;

    const img = new Image();
    if (!imageSrc.startsWith("data:") && !imageSrc.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }

    img.onerror = (err) => {
      console.warn("[ImageCropModal] Erro ao carregar imagem para corte, usando original:", err);
      onCropComplete(imageSrc);
    };

    img.onload = () => {
      try {
        const OUTPUT_SIZE = 512;
        const CROP_CONTAINER_SIZE = 280; // Size in UI preview

        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onCropComplete(imageSrc);
          return;
        }

        // Fill with smooth background
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Center the canvas context
        ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
        ctx.rotate((rotation * Math.PI) / 180);

        // Calculate scale ratio between UI crop box and output size
        const uiToOutputRatio = OUTPUT_SIZE / CROP_CONTAINER_SIZE;

        // Base display scale
        const baseRatio = Math.max(
          CROP_CONTAINER_SIZE / (img.naturalWidth || OUTPUT_SIZE),
          CROP_CONTAINER_SIZE / (img.naturalHeight || OUTPUT_SIZE)
        );

        const renderWidth = (img.naturalWidth || OUTPUT_SIZE) * baseRatio * scale * uiToOutputRatio;
        const renderHeight = (img.naturalHeight || OUTPUT_SIZE) * baseRatio * scale * uiToOutputRatio;

        const drawX = position.x * uiToOutputRatio;
        const drawY = position.y * uiToOutputRatio;

        ctx.drawImage(
          img,
          drawX - renderWidth / 2,
          drawY - renderHeight / 2,
          renderWidth,
          renderHeight
        );

        const croppedDataUrl = canvas.toDataURL("image/webp", 0.9);
        onCropComplete(croppedDataUrl || imageSrc);
      } catch (cropErr) {
        console.warn("[ImageCropModal] Falha no canvas, repassando original:", cropErr);
        onCropComplete(imageSrc);
      }
    };
    img.src = imageSrc;
  }, [imageSrc, scale, position, rotation, onCropComplete]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[130]"
      ariaLabel="Ajustar e cortar foto de perfil"
    >
      <div className="glass-panel relative w-full overflow-hidden rounded-[22px] border border-white/12 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-white">
        <header className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Personalização
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-white tracking-tight">
              Ajustar foto de perfil
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 p-2 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Viewport Crop Box */}
        <div className="flex flex-col items-center justify-center">
          <div
            ref={containerRef}
            className="relative h-[280px] w-[280px] overflow-hidden rounded-full border-2 border-white/40 shadow-[0_0_50px_rgba(0,0,0,0.9)] bg-black/70 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {imageLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.05s ease-out",
                }}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Ajuste de corte"
                  className="max-w-none pointer-events-none select-none"
                  style={{
                    width:
                      naturalSize.width > naturalSize.height
                        ? "auto"
                        : "280px",
                    height:
                      naturalSize.width > naturalSize.height
                        ? "280px"
                        : "auto",
                    minWidth: "280px",
                    minHeight: "280px",
                    objectFit: "cover",
                  }}
                  draggable={false}
                />
              </div>
            )}

            {/* Subtle Crosshair Guide Overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-white/10" />
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-white/10" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
            <Move className="h-3.5 w-3.5" />
            <span>Arraste para posicionar ou use o scroll para zoom</span>
          </div>
        </div>

        {/* Controls: Zoom, Rotate, Reset */}
        <div className="mt-5 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-white/40 shrink-0" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-white outline-none"
            />
            <ZoomIn className="h-4 w-4 text-white/40 shrink-0" />
            <span className="min-w-[44px] text-right text-xs font-mono font-medium text-white/60">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={handleRotate}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5 text-white/80" /> Girar 90°
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Recentralizar
            </button>
          </div>
        </div>

        {/* Actions: Cancel & Apply */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-white/55 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            Cancelar
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleApplyCrop}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:bg-white/90 transition"
          >
            <Check className="h-4 w-4" /> Aplicar Corte
          </motion.button>
        </div>
      </div>
    </ModalShell>
  );
};

export default ImageCropModal;
