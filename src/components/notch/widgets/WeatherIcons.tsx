import React, { useId } from "react";

/**
 * Ícones do clima desenhados aqui: o `lucide-react` do projeto aponta para o conjunto de símbolos
 * SF (PNG), que não tem tempo/clima. Traço fino, `currentColor`, mesma grade 24×24 dos demais.
 */
interface IconProps {
  size?: number;
  className?: string;
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({ size = 24, className, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CLOUD = "M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 .5 9H7Z";

export const SunIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </Svg>
);

export const CloudIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d={CLOUD} />
  </Svg>
);

/** Sol atrás da nuvem: a nuvem "recorta" o sol com uma máscara, senão os traços se cruzam. */
export const PartlyCloudyIcon: React.FC<IconProps> = (p) => {
  const maskId = useId();
  const cloud = "M8 20a3.5 3.5 0 0 1-.4-6.98A5 5 0 0 1 17 12.5a3.8 3.8 0 0 1 .5 7.5H8Z";
  return (
    <Svg {...p}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" />
        <path d={cloud} fill="black" stroke="black" strokeWidth={4} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx="8.5" cy="8.5" r="3.2" />
        <path d="M8.5 2.6v1.3M2.6 8.5h1.3M4.3 4.3l.9.9M12.7 4.3l-.9.9M4.3 12.7l.9-.9" />
      </g>
      <path d={cloud} />
    </Svg>
  );
};

export const RainIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6a4.5 4.5 0 0 1 .5 9H7Z" />
    <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
  </Svg>
);

export const SnowIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6a4.5 4.5 0 0 1 .5 9H7Z" />
    <path d="M9 18.5v.01M13 20v.01M17 18.5v.01M11 22v.01" strokeWidth={2.2} />
  </Svg>
);

export const StormIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6a4.5 4.5 0 0 1 .5 9H7Z" />
    <path d="m12 14-2 4h3l-1.5 4" />
  </Svg>
);

export const FogIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 13a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4a4.5 4.5 0 0 1 .5 9H7Z" />
    <path d="M5 17h14M7 20.5h10" />
  </Svg>
);

export const PinIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </Svg>
);
