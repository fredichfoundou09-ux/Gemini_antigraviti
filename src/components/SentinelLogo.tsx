import React from "react";

export interface SentinelLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * - "full" : Logo complet officiel avec le texte SENTINEL'S et le symbole 3D sur fond sombre métallique
   * - "symbol" : Symbole seul (emblème 3D rouge et noir) pour les icônes compactes, la navigation, badges et favicons
   */
  variant?: "full" | "symbol";
  /**
   * Taille raccourcie (largeur/hauteur en pixels ou classes)
   */
  size?: number | string;
  className?: string;
  alt?: string;
}

export const SENTINEL_ASSETS = {
  full: "/assets/branding/sentinel-full.png",
  symbol: "/assets/branding/sentinel-symbol.png",
} as const;

export function SentinelLogo({
  variant = "symbol",
  size,
  className = "",
  alt,
  style,
  ...rest
}: SentinelLogoProps) {
  const isFull = variant === "full";
  const defaultAlt = isFull ? "SENTINEL'S" : "Symbole SENTINEL'S";
  const src = isFull ? SENTINEL_ASSETS.full : SENTINEL_ASSETS.symbol;

  const sizeStyle: React.CSSProperties = {};
  if (typeof size === "number") {
    sizeStyle.width = `${size}px`;
    sizeStyle.height = `${size}px`;
  } else if (typeof size === "string" && size) {
    sizeStyle.width = size;
    sizeStyle.height = size;
  }

  return (
    <img
      src={src}
      alt={alt !== undefined ? alt : defaultAlt}
      loading="eager"
      decoding="async"
      style={{
        objectFit: "contain",
        ...sizeStyle,
        ...style,
      }}
      className={`shrink-0 select-none ${className}`}
      {...rest}
    />
  );
}

export default SentinelLogo;
