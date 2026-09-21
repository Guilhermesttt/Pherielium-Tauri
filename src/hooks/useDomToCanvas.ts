import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";

export function useDomToCanvas(
    sourceRef: React.RefObject<HTMLElement>,
    targetCanvasRef: React.RefObject<HTMLCanvasElement>,
    { fps = 2 }: { fps?: number } = {}
) {
    const rafRef = useRef<number>(0);

    useEffect(() => {
        let cancelled = false;
        let lastCapture = 0;
        const interval = 1000 / fps;

        const capture = (timestamp: number) => {
            if (cancelled) return;
            if (document.hidden) {
                rafRef.current = requestAnimationFrame(capture);
                return;
            }
            if (timestamp - lastCapture >= interval) {
                lastCapture = timestamp;
                const source = sourceRef.current;
                const target = targetCanvasRef.current;
                if (source && target) {
                    html2canvas(source, {
                        backgroundColor: null,
                        scale: Math.min(window.devicePixelRatio || 1, 2),
                        logging: false,
                    }).then((snap) => {
                        if (cancelled) return;
                        const ctx = target.getContext("2d");
                        if (ctx) {
                            target.width = snap.width;
                            target.height = snap.height;
                            ctx.clearRect(0, 0, target.width, target.height);
                            ctx.drawImage(snap, 0, 0);
                        }
                    }).catch(() => {});
                }
            }
            rafRef.current = requestAnimationFrame(capture);
        };

        rafRef.current = requestAnimationFrame(capture);
        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.current);
        };
    }, [sourceRef, targetCanvasRef, fps]);
}