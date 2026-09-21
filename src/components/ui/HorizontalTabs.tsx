import React, { useRef, useState, useLayoutEffect } from "react";
import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

export interface HorizontalTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  tabClassName?: string;
}

export const HorizontalTabs: React.FC<HorizontalTabsProps> = ({
  tabs,
  activeId,
  onChange,
  className,
  tabClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !containerRef.current || !pillRef.current) return;

    const activeTab = containerRef.current.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement;
    if (!activeTab) return;

    const pill = pillRef.current;
    
    const updatePill = (snap = false) => {
      if (snap) {
        pill.style.transition = "none";
      }
      pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      pill.style.width = `${activeTab.offsetWidth}px`;
      pill.style.height = `${activeTab.offsetHeight}px`;
      pill.style.top = `${activeTab.offsetTop}px`;
      
      if (snap) {
        // Force reflow
        void pill.offsetHeight;
        pill.style.transition = "";
      }
    };

    updatePill(!mounted); // snap on mount

    const handleResize = () => updatePill(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeId, mounted]);

  return (
    <div className={cn("t-tabs", className)} role="tablist" ref={containerRef}>
      <span className="t-tabs-pill" aria-hidden="true" ref={pillRef}></span>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-tab-id={tab.id}
          className={cn("t-tab", tabClassName)}
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
