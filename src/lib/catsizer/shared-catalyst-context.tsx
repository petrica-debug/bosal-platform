"use client";

/**
 * Shared Catalyst Design Context
 *
 * Allows the AM Homologation Copilot, WLTP Simulation, and Product Configuration
 * tools to share a common catalyst design without page reloads or props drilling.
 *
 * Flow:
 *   Copilot Step 8 → setSharedDesign() → banner appears in WLTP and Products
 *   Products brick editor → setSharedDesign() → banner appears in WLTP
 *
 * Usage:
 *   const { sharedDesign, setSharedDesign, clearSharedDesign } = useSharedCatalyst();
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import type { FullAgingPrediction } from "./catalyst-chemistry";

/* ------------------------------------------------------------------ */
/*  Shared design type — bridges copilot, WLTP, and products          */
/* ------------------------------------------------------------------ */

export interface SharedCatalystDesign {
  /** Which tool created the design */
  source: "copilot" | "products";
  /** Human-readable label for the banner */
  label: string;
  /** ISO timestamp when it was shared */
  sharedAt: string;

  // Substrate geometry
  substrateDiameterMm: number;
  substrateLengthMm: number;
  substrateVolumeL: number;
  cpsi: number;
  wallMil: number;
  substrateFamily: "cordierite" | "metallic" | "sic";

  // PGM (g/L — per-component)
  pdGPerL: number;
  rhGPerL: number;
  ptGPerL: number;
  totalPgmGPerL: number;
  /** Converted for WLTP PGM loading input (g/ft³) */
  pgmLoadingGPerFt3: number;

  // Chemistry
  oscGPerL: number;
  cePercent: number;
  washcoatTotalGPerL: number;

  // Aging
  agingTempC: number;
  agingHours: number;
  /** 0–1 factor for WLTP aging slider (derived from OSC retention) */
  agingFactor: number;

  // Optional rich chemistry predictions (from copilot)
  agingPrediction?: FullAgingPrediction;

  // Context metadata
  emissionStandard?: string;
  engineFamily?: string;
  /** OEM fresh PGM for ratio display */
  oemPgmGPerL?: number;
  oemOscGPerL?: number;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface SharedCatalystContextValue {
  sharedDesign: SharedCatalystDesign | null;
  setSharedDesign: (design: SharedCatalystDesign) => void;
  clearSharedDesign: () => void;
}

const SharedCatalystContext = createContext<SharedCatalystContextValue>({
  sharedDesign: null,
  setSharedDesign: () => {},
  clearSharedDesign: () => {},
});

export function SharedCatalystProvider({ children }: { children: React.ReactNode }) {
  const [sharedDesign, setDesign] = useState<SharedCatalystDesign | null>(null);

  const setSharedDesign = useCallback((design: SharedCatalystDesign) => {
    setDesign(design);
  }, []);

  const clearSharedDesign = useCallback(() => {
    setDesign(null);
  }, []);

  return (
    <SharedCatalystContext.Provider value={{ sharedDesign, setSharedDesign, clearSharedDesign }}>
      {children}
    </SharedCatalystContext.Provider>
  );
}

export function useSharedCatalyst() {
  return useContext(SharedCatalystContext);
}

/* ------------------------------------------------------------------ */
/*  Conversion helpers                                                 */
/* ------------------------------------------------------------------ */

const G_PER_L_TO_G_PER_FT3 = 28.3168;

/** Convert g/L to g/ft³ */
export function gPerLToGPerFt3(gPerL: number): number {
  return +(gPerL * G_PER_L_TO_G_PER_FT3).toFixed(1);
}

/** Derive an aging factor (0–1) from OSC retention percentage */
export function oscRetentionToAgingFactor(retentionPct: number): number {
  // Map 100% retention → 1.0 (fresh), ~40% retention → 0.80 (heavily aged)
  return +(0.80 + (retentionPct - 40) / 300).toFixed(2);
}
