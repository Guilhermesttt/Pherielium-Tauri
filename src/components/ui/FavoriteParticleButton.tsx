import React, { useState, useRef, useEffect } from "react";

export interface FavoriteParticleButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  playSound?: (type: any) => void;
}

const PARTICLE_COUNT = 8;

interface ParticleStyle extends React.CSSProperties {
  "--px"?: string;
  "--py"?: string;
  "--pdur"?: string;
  "--pdelay"?: string;
  "--p-end-scale"?: string;
  "--psize"?: string;
}

/**
 * FavoriteParticleButton
 * Transitions.dev — Like button
 * Includes SVG pop spring animation and 8-particle burst on favorite.
 */
export const FavoriteParticleButton: React.FC<FavoriteParticleButtonProps> = ({
  isFavorite,
  onToggle,
  size = 16,
  className = "",
  showLabel = false,
  label,
  playSound,
}) => {
  const [isBursting, setIsBursting] = useState(false);
  const [particles, setParticles] = useState<ParticleStyle[]>([]);
  const timeoutRef = useRef<number | null>(null);

  const generateParticles = () => {
    const newParticles: ParticleStyle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i * (360 / PARTICLE_COUNT) * Math.PI) / 180 + (Math.random() * 0.4 - 0.2);
      const dist = 18 + Math.random() * 8;
      const px = `${Math.round(Math.cos(angle) * dist)}px`;
      const py = `${Math.round(Math.sin(angle) * dist)}px`;
      const pdur = `${500 + Math.round(Math.random() * 150)}ms`;
      const pdelay = `${Math.round(Math.random() * 40)}ms`;
      const endScale = (0.5 + Math.random() * 0.3).toFixed(2);
      const psize = (0.85 + Math.random() * 0.35).toFixed(2);

      newParticles.push({
        "--px": px,
        "--py": py,
        "--pdur": pdur,
        "--pdelay": pdelay,
        "--p-end-scale": endScale,
        "--psize": psize,
      });
    }
    return newParticles;
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isFavorite) {
      // Favoriting: fire particle burst
      setParticles(generateParticles());
      setIsBursting(true);
      playSound?.("favoriteOn");

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIsBursting(false);
      }, 650);
    } else {
      playSound?.("favoriteOff");
    }

    onToggle();
  };

  return (
    <button
      type="button"
      className={`t-like select-none cursor-pointer ${isBursting ? "is-bursting" : ""} ${className}`}
      data-liked={isFavorite ? "true" : "false"}
      onClick={handleClick}
      aria-label={label || (isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos")}
      title={label || (isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos")}
    >
      <span className="relative flex items-center justify-center">
        <span className="t-like-icon flex items-center justify-center">
          <svg
            className="t-like-heart"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Star polygon with smooth curve */}
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>

        {/* 8-particle burst container */}
        <span className="t-like-particles" aria-hidden="true">
          {particles.map((pStyle, idx) => (
            <i key={idx} style={pStyle} />
          ))}
        </span>
      </span>

      {showLabel && (
        <span className="ml-2 font-medium text-[11.5px] uppercase tracking-wider text-current">
          {label || (isFavorite ? "Favorito" : "Favoritar")}
        </span>
      )}
    </button>
  );
};
