import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { useLowPerf } from "../PerformanceComponents";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface GhostSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const GhostSelect: React.FC<GhostSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className = "",
  menuClassName = "",
  icon,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const low = useLowPerf();
  const reduceMotion = useReducedMotion();
  const glideOff = low || reduceMotion;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-all outline-none ${
          disabled
            ? "opacity-50 cursor-not-allowed border-white/5 bg-white/[0.02]"
            : isOpen
            ? "border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon || selectedOption?.icon}
          <span className={`truncate ${!selectedOption ? "text-white/40" : "text-white/90"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        >
          <ChevronDown className="h-4 w-4 text-white/50" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className={`absolute left-0 right-0 z-[200] mt-1 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] transform-origin-top glass-panel ${menuClassName}`}
          >
            <div
              className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 p-1 flex flex-col gap-0.5"
              onMouseLeave={() => setHovered(null)}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                const glideActive = !glideOff && (hovered ?? value) === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHovered(option.value)}
                    onFocus={() => setHovered(option.value)}
                    onBlur={() => setHovered((prev) => (prev === option.value ? null : prev))}
                    className={`relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all outline-none text-left ${
                      glideOff
                        ? isSelected
                          ? "bg-white/10 text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                        : isSelected
                          ? "text-white font-medium"
                          : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    {glideActive && (
                      <motion.span
                        aria-hidden
                        layoutId="ghost-select-glide"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 700, damping: 40 }}
                        className="absolute inset-0 rounded-xl bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
                      />
                    )}
                    <div className="flex items-center gap-2 truncate z-10">
                      {option.icon}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-white z-10" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
