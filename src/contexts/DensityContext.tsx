import React, { createContext, useContext, useEffect, useState } from "react";

export type DensityLevel = "normal" | "compact" | "ultra-compact" | "micro";

export interface DensityOption {
  id: DensityLevel;
  label: string;
  badge: string;
  percentage: string;
  btnHeight: string;
  tablePadding: string;
  font: string;
  description: string;
}

export const DENSITY_OPTIONS: DensityOption[] = [
  {
    id: "normal",
    label: "Normal",
    badge: "100%",
    percentage: "100%",
    btnHeight: "40px",
    tablePadding: "10px 12px",
    font: "14px",
    description: "Confort standard sur grand écran",
  },
  {
    id: "compact",
    label: "Compact",
    badge: "88%",
    percentage: "88%",
    btnHeight: "32px",
    tablePadding: "6px 10px",
    font: "12.5px",
    description: "Écrans portables et fenêtres réduites (-15%)",
  },
  {
    id: "ultra-compact",
    label: "Ultra-Compact",
    badge: "75%",
    percentage: "75%",
    btnHeight: "26px",
    tablePadding: "4px 6px",
    font: "11px",
    description: "Visualisation dense de listes volumineuses (-25%)",
  },
  {
    id: "micro",
    label: "Micro",
    badge: "65%",
    percentage: "65%",
    btnHeight: "22px",
    tablePadding: "2px 4px",
    font: "9.5-10px",
    description: "Affichage compact maximal sans défilement (-35%)",
  },
];

interface DensityContextType {
  density: DensityLevel;
  setDensity: (density: DensityLevel) => void;
  currentOption: DensityOption;
}

const DensityContext = createContext<DensityContextType | undefined>(undefined);

const STORAGE_KEY = "sentinel_ui_density";

export const DensityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [density, setDensityState] = useState<DensityLevel>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as DensityLevel;
      if (saved && ["normal", "compact", "ultra-compact", "micro"].includes(saved)) {
        return saved;
      }
    }
    return "normal";
  });

  const setDensity = (newDensity: DensityLevel) => {
    setDensityState(newDensity);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newDensity);
      document.documentElement.setAttribute("data-density", newDensity);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const currentOption = DENSITY_OPTIONS.find((o) => o.id === density) || DENSITY_OPTIONS[0];

  return (
    <DensityContext.Provider value={{ density, setDensity, currentOption }}>
      {children}
    </DensityContext.Provider>
  );
};

export const useDensity = (): DensityContextType => {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error("useDensity must be used within a DensityProvider");
  }
  return context;
};
