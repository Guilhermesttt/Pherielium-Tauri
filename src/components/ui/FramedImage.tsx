import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { framedRect, isDefaultFraming, parseFraming, type Rect, type Size } from "../../services/mediaFraming";

export interface FramedImageProps {
  /** URL da mídia, com ou sem o enquadramento (`#pf=...`) guardado nela. */
  src: string;
  alt?: string;
  /** Classes de quem usa (em geral `h-full w-full object-cover`); valem enquanto não há enquadramento. */
  className?: string;
  draggable?: boolean;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * Imagem de perfil com o enquadramento escolhido pela pessoa. A moldura é o elemento pai, que precisa
 * ser `relative` e `overflow-hidden`. Sem enquadramento guardado é só um `<img>` que cobre a moldura.
 */
export const FramedImage: React.FC<FramedImageProps> = ({ src, alt = "", className, draggable, onError }) => {
  const { src: clean, framing } = useMemo(() => parseFraming(src), [src]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const framingRef = useRef(framing);
  framingRef.current = framing;

  const measure = useCallback(() => {
    const img = imgRef.current;
    const parent = img?.parentElement;
    if (!img || !parent || !img.naturalWidth || !img.naturalHeight) return;
    const frame: Size = { w: parent.clientWidth, h: parent.clientHeight };
    if (!frame.w || !frame.h) return;
    setRect(framedRect(frame, { w: img.naturalWidth, h: img.naturalHeight }, framingRef.current));
  }, []);

  // refaz a conta quando a moldura muda de tamanho (janela, layout) ou o enquadramento muda
  useEffect(() => {
    const parent = imgRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    measure();
  }, [measure, clean, framing]);

  const active = !isDefaultFraming(framing) && rect;
  return (
    <img
      ref={imgRef}
      src={clean}
      alt={alt}
      draggable={draggable}
      onError={onError}
      onLoad={measure}
      className={className}
      style={active ? { position: "absolute", left: rect.left, top: rect.top, width: rect.width, height: rect.height, maxWidth: "none" } : undefined}
    />
  );
};
