import { useEffect, useRef, useState, type ComponentType } from "react";

interface LazySectionProps {
  loader: () => Promise<{ default: ComponentType }>;
  minHeightClassName?: string;
}

export function LazySection({
  loader,
  minHeightClassName = "min-h-[360px]",
}: LazySectionProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        void loader().then((module) => setComponent(() => module.default));
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loader]);

  return (
    <div ref={anchorRef} className={Component ? undefined : minHeightClassName}>
      {Component ? <Component /> : null}
    </div>
  );
}
