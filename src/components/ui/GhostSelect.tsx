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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--node)] pl-4 pr-3 text-[length:var(--step-0)] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-[var(--tone-2)]"
            : isOpen
            ? "bg-[var(--tone-3)]"
            : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)]"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon || selectedOption?.icon}
          <span className={`truncate ${!selectedOption ? "text-[var(--ink-faint)]" : "text-[var(--ink)]"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        >
          <ChevronDown className="h-4 w-4 text-[var(--ink-muted)]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            role="listbox"
            className={`absolute left-0 right-0 z-[200] mt-1 overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-3)] p-1 transform-origin-top ${menuClassName}`}
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
                    role="option"
                    aria-selected={isSelected}
                    className={`relative flex h-10 w-full cursor-pointer items-center justify-between rounded-[var(--node)] px-3.5 text-[length:var(--step-0)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 text-left ${
                      glideOff
                        ? isSelected
                          ? "bg-[var(--tone-4)] text-[var(--ink)] font-semibold"
                          : "text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                        : isSelected
                          ? "text-[var(--ink)] font-semibold"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {glideActive && (
                      <motion.span
                        aria-hidden
                        layoutId="ghost-select-glide"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 700, damping: 40 }}
                        className="absolute inset-0 rounded-[var(--node)] bg-[var(--tone-4)]"
                      />
                    )}
                    <div className="flex items-center gap-2 truncate z-10">
                      {option.icon}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-[var(--ink)] z-10" aria-hidden="true" />
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
