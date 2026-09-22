import React, { useEffect, useState, useRef } from "react";

export interface DigitPopInProps {
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  groupClassName?: string;
}

export const DigitPopIn: React.FC<DigitPopInProps> = ({
  value,
  prefix,
  suffix,
  className = "",
  groupClassName = "",
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [displayValue, setDisplayValue] = useState(String(value));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const nextVal = String(value);
    // Replay animation on value change
    setIsAnimating(false);
    setDisplayValue(nextVal);

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const chars = displayValue.split("");

  const alignClass = className.includes("items-") ? "" : "items-baseline";

  return (
    <span className={`inline-flex ${alignClass} ${className}`}>
      {prefix && <span className="mr-1">{prefix}</span>}
      <span className={`t-digit-group ${isAnimating ? "is-animating" : ""} ${groupClassName}`}>
        {chars.map((char, index) => (
          <span
            key={`${index}-${char}`}
            className="t-digit"
            data-stagger={index > 0 ? index : undefined}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
      {suffix && (
        <span className={typeof suffix === "string" && /^[a-zA-Z]/.test(suffix) ? "ml-0.5" : "ml-1"}>
          {suffix}
        </span>
      )}
    </span>
  );
};
