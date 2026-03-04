/**
 * CATALYST CHEMICAL PROFILES DATABASE
 *
 * Comprehensive characterization data for real-world catalyst formulations,
 * compiled from published literature and typical industrial specifications.
 *
 * Each profile represents a fully characterized catalyst as a chemist would
 * document it after lab testing:
 *
 * - Physical characterization (BET, pore volume, pore size distribution)
 * - Chemical composition (active phase, support, promoters)
 * - Chemisorption data (CO/H₂ uptake, dispersion, metallic SA)
 * - Activity data (TOF for key reactions, light-off temperatures)
 * - Aging behavior (expected dispersion loss, deactivation)
 *
 * Data sources:
 * - Heck, Farrauto & Gulati, "Catalytic Air Pollution Control" (2009)
 * - Bartholomew & Farrauto, "Fundamentals of Industrial Catalytic Processes" (2006)
 * - Kašpar et al., Catal. Today 77 (2003) 419–449
 * - Twigg, "Catalyst Handbook" (1989)
 * - Johnson Matthey, BASF, Umicore published catalyst data
 */

import type { ChemisorptionData, TOFEntry, CatalystProfile, DispersionResult } from "./surface-science";
import { calculateDispersion, TOF_DATABASE, generateCatalystProfile } from "./surface-science";

// ============================================================
// DETAILED CATALYST PROFILES
// ============================================================

export interface DetailedCatalystProfile {
  id: string;
  name: string;
  catalystType: "DOC" | "TWC" | "SCR" | "ASC" | "SMR" | "WGS" | "POX" | "ATR";
  supplier: string;

  /** Physical characterization */
  physical: {
    BET_m2_g: number;
    poreVolume_cm3_g: number;
    avgPoreSize_nm: number;
    bulkDensity_kg_L: number;
    crushStrength_MPa?: number;
    thermalExpansion_ppm_K?: number;
  };

  /** Chemical composition */
  composition: {
    support: string;
    activePhase: string;
    promoters: string[];
    /** PGM loadings [g/ft³] — industry standard unit */
    Pt_g_ft3: number;
    Pd_g_ft3: number;
    Rh_g_ft3: number;
    /** Total PGM [g/ft³] */
    totalPGM_g_ft3: number;
    /** PGM weight percent on washcoat */
    pgm_wt_percent: number;
    /** Washcoat loading [g/L] */
    washcoatLoading_g_L: number;
    /** Washcoat thickness [µm] */
    washcoatThickness_um: number;
    /** Oxygen storage capacity [µmol O₂/g] — for CeZrO₂ containing catalysts */
    OSC_umol_g?: number;
  };

  /** Chemisorption characterization */
  chemisorption: {
    probeGas: "CO" | "H2";
    uptake_umol_gCat: number;
    uptake_umol_gPGM: number;
    dispersion_percent: number;
    metallicSA_m2_gPGM: number;
    avgParticleSize_nm: number;
    /** Temperature of measurement [°C] */
    measurementTemp_C: number;
  };

  /** Activity data */
  activity: {
    reactions: Array<{
      name: string;
      species: string;
      TOF_ref: number;
      T_ref_C: number;
      Ea_kJ_mol: number;
      T50_lightOff_C: number;
      T90_C: number;
      maxConversion_percent: number;
      conditions: string;
    }>;
  };

  /** Thermal stability */
  thermalStability: {
    maxOperatingTemp_C: number;
    sinteringOnsetTemp_C: number;
    /** Dispersion after 16h at 800°C in 10% H₂O/air */
    dispersionAfterAging_percent: number;
    /** Activity retention after standard aging [%] */
    activityRetention_percent: number;
    agingProtocol: string;
  };

  /** Poison tolerance */
  poisonTolerance: {
    sulfurTolerance: "low" | "moderate" | "high";
    sulfurRegenTemp_C: number;
    phosphorusTolerance: "low" | "moderate" | "high";
    /** Max allowable sulfur in feed [ppm] */
    maxSulfur_ppm: number;
  };

  /** Operating window */
  operatingWindow: {
    minTemp_C: number;
    maxTemp_C: number;
    optimalTemp_C: [number, number];
    minO2_percent?: number;
    maxO2_percent?: number;
    lambda_range?: [number, number];
  };

  /** Cost index (relative, 1.0 = baseline) */
  costIndex: number;

  /** Application notes */
  notes: string;
}

/**
 * Comprehensive database of catalyst profiles.
 */
export const CATALYST_PROFILES_DB: DetailedCatalystProfile[] = [
  // ============================================================
  // DOC PROFILES
  // ============================================================
  {
    id: "DOC-001",
    name: "Pt-Pd/Al₂O₃ Standard DOC",
    catalystType: "DOC",
    supplier: "Generic (JM/BASF class)",
    physical: {
      BET_m2_g: 150,
      poreVolume_cm3_g: 0.45,
      avgPoreSize_nm: 12,
      bulkDensity_kg_L: 1.2,
    },
    composition: {
      support: "γ-Al₂O₃",
      activePhase: "Pt-Pd bimetallic",
      promoters: [],
      Pt_g_ft3: 30,
      Pd_g_ft3: 50,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 80,
      pgm_wt_percent: 1.2,
      washcoatLoading_g_L: 120,
      washcoatThickness_um: 30,
    },
    chemisorption: {
      probeGas: "CO",
      uptake_umol_gCat: 45,
      uptake_umol_gPGM: 3750,
      dispersion_percent: 35,
      metallicSA_m2_gPGM: 85,
      avgParticleSize_nm: 3.2,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "CO oxidation",
          species: "CO",
          TOF_ref: 8.0,
          T_ref_C: 200,
          Ea_kJ_mol: 70,
          T50_lightOff_C: 175,
          T90_C: 210,
          maxConversion_percent: 99.5,
          conditions: "0.1% CO, 10% O₂, 5% H₂O, N₂ bal.",
        },
        {
          name: "HC oxidation (C₃H₆)",
          species: "HC",
          TOF_ref: 2.5,
          T_ref_C: 250,
          Ea_kJ_mol: 90,
          T50_lightOff_C: 220,
          T90_C: 265,
          maxConversion_percent: 98,
          conditions: "500 ppm C₃H₆, 10% O₂, 5% H₂O",
        },
        {
          name: "NO → NO₂",
          species: "NOx",
          TOF_ref: 0.8,
          T_ref_C: 300,
          Ea_kJ_mol: 45,
          T50_lightOff_C: 250,
          T90_C: 320,
          maxConversion_percent: 55,
          conditions: "200 ppm NO, 10% O₂ — equilibrium limited",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 700,
      sinteringOnsetTemp_C: 600,
      dispersionAfterAging_percent: 18,
      activityRetention_percent: 75,
      agingProtocol: "16h at 800°C, 10% H₂O/air",
    },
    poisonTolerance: {
      sulfurTolerance: "moderate",
      sulfurRegenTemp_C: 650,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: 10,
    },
    operatingWindow: {
      minTemp_C: 150,
      maxTemp_C: 700,
      optimalTemp_C: [200, 500],
    },
    costIndex: 1.0,
    notes: "Industry-standard DOC formulation. Pt provides low-T CO light-off; Pd provides HC activity and thermal stability. Bimetallic synergy reduces Pt sintering.",
  },
  {
    id: "DOC-002",
    name: "High-Pd DOC (NG/Methane)",
    catalystType: "DOC",
    supplier: "Generic (NG specialist)",
    physical: {
      BET_m2_g: 180,
      poreVolume_cm3_g: 0.50,
      avgPoreSize_nm: 10,
      bulkDensity_kg_L: 1.15,
    },
    composition: {
      support: "γ-Al₂O₃ / La-stabilized",
      activePhase: "Pd (Pt trace)",
      promoters: ["La₂O₃ (4 wt%)"],
      Pt_g_ft3: 5,
      Pd_g_ft3: 90,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 95,
      pgm_wt_percent: 1.5,
      washcoatLoading_g_L: 140,
      washcoatThickness_um: 35,
    },
    chemisorption: {
      probeGas: "CO",
      uptake_umol_gCat: 55,
      uptake_umol_gPGM: 3667,
      dispersion_percent: 38,
      metallicSA_m2_gPGM: 92,
      avgParticleSize_nm: 2.5,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "CH₄ oxidation",
          species: "HC",
          TOF_ref: 0.05,
          T_ref_C: 350,
          Ea_kJ_mol: 130,
          T50_lightOff_C: 420,
          T90_C: 510,
          maxConversion_percent: 95,
          conditions: "1000 ppm CH₄, 10% O₂, 5% H₂O — methane is extremely stable",
        },
        {
          name: "CO oxidation",
          species: "CO",
          TOF_ref: 5.2,
          T_ref_C: 200,
          Ea_kJ_mol: 75,
          T50_lightOff_C: 190,
          T90_C: 225,
          maxConversion_percent: 99.5,
          conditions: "0.1% CO, 10% O₂, 5% H₂O",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 750,
      sinteringOnsetTemp_C: 650,
      dispersionAfterAging_percent: 22,
      activityRetention_percent: 70,
      agingProtocol: "16h at 800°C, 10% H₂O/air",
    },
    poisonTolerance: {
      sulfurTolerance: "low",
      sulfurRegenTemp_C: 700,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: 5,
    },
    operatingWindow: {
      minTemp_C: 200,
      maxTemp_C: 750,
      optimalTemp_C: [350, 600],
    },
    costIndex: 1.15,
    notes: "Pd-rich formulation optimized for methane oxidation. La₂O₃ stabilizes alumina against sintering. CH₄ light-off is inherently high (~420°C) due to C-H bond strength (439 kJ/mol).",
  },

  // ============================================================
  // TWC PROFILES
  // ============================================================
  {
    id: "TWC-001",
    name: "Pd-Rh/CeZrO₂ Close-Coupled TWC",
    catalystType: "TWC",
    supplier: "Generic (Euro 6d class)",
    physical: {
      BET_m2_g: 120,
      poreVolume_cm3_g: 0.40,
      avgPoreSize_nm: 15,
      bulkDensity_kg_L: 1.3,
    },
    composition: {
      support: "CeO₂-ZrO₂ (40:60) + γ-Al₂O₃",
      activePhase: "Pd front brick, Rh rear brick",
      promoters: ["BaO (trap)", "La₂O₃ (stabilizer)", "Nd₂O₃"],
      Pt_g_ft3: 0,
      Pd_g_ft3: 80,
      Rh_g_ft3: 15,
      totalPGM_g_ft3: 95,
      pgm_wt_percent: 1.8,
      washcoatLoading_g_L: 150,
      washcoatThickness_um: 35,
      OSC_umol_g: 450,
    },
    chemisorption: {
      probeGas: "CO",
      uptake_umol_gCat: 60,
      uptake_umol_gPGM: 3333,
      dispersion_percent: 32,
      metallicSA_m2_gPGM: 78,
      avgParticleSize_nm: 3.5,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "CO oxidation",
          species: "CO",
          TOF_ref: 6.0,
          T_ref_C: 200,
          Ea_kJ_mol: 72,
          T50_lightOff_C: 195,
          T90_C: 240,
          maxConversion_percent: 99.8,
          conditions: "1% CO, 0.5% O₂, λ=1.0",
        },
        {
          name: "HC oxidation (C₃H₆)",
          species: "HC",
          TOF_ref: 3.0,
          T_ref_C: 250,
          Ea_kJ_mol: 88,
          T50_lightOff_C: 230,
          T90_C: 280,
          maxConversion_percent: 99,
          conditions: "500 ppm C₃H₆, λ=1.0",
        },
        {
          name: "NOₓ reduction (Rh)",
          species: "NOx",
          TOF_ref: 4.5,
          T_ref_C: 300,
          Ea_kJ_mol: 85,
          T50_lightOff_C: 260,
          T90_C: 310,
          maxConversion_percent: 99,
          conditions: "1000 ppm NO, 1% CO, λ=1.0",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 1050,
      sinteringOnsetTemp_C: 800,
      dispersionAfterAging_percent: 15,
      activityRetention_percent: 65,
      agingProtocol: "RAT-A: 50h at 1050°C, 2% O₂/N₂ with λ cycling",
    },
    poisonTolerance: {
      sulfurTolerance: "moderate",
      sulfurRegenTemp_C: 650,
      phosphorusTolerance: "low",
      maxSulfur_ppm: 10,
    },
    operatingWindow: {
      minTemp_C: 200,
      maxTemp_C: 1050,
      optimalTemp_C: [350, 900],
      lambda_range: [0.995, 1.005],
    },
    costIndex: 1.3,
    notes: "Close-coupled TWC with high OSC for lambda buffering. Pd handles oxidation; Rh is essential for NOₓ reduction. CeZrO₂ provides oxygen storage (450 µmol/g) for transient λ excursions.",
  },

  // ============================================================
  // SCR PROFILES
  // ============================================================
  {
    id: "SCR-001",
    name: "Cu-SSZ-13 (CHA) SCR",
    catalystType: "SCR",
    supplier: "Generic (BASF/JM class)",
    physical: {
      BET_m2_g: 600,
      poreVolume_cm3_g: 0.25,
      avgPoreSize_nm: 3.8,
      bulkDensity_kg_L: 1.1,
    },
    composition: {
      support: "SSZ-13 (CHA zeolite)",
      activePhase: "Cu²⁺ ion-exchanged",
      promoters: [],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 180,
      washcoatThickness_um: 50,
    },
    chemisorption: {
      probeGas: "H2",
      uptake_umol_gCat: 250,
      uptake_umol_gPGM: 0,
      dispersion_percent: 100,
      metallicSA_m2_gPGM: 0,
      avgParticleSize_nm: 0,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Standard SCR",
          species: "NOx",
          TOF_ref: 0.12,
          T_ref_C: 250,
          Ea_kJ_mol: 55,
          T50_lightOff_C: 200,
          T90_C: 280,
          maxConversion_percent: 98,
          conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂, 5% H₂O",
        },
        {
          name: "Fast SCR",
          species: "NOx",
          TOF_ref: 1.2,
          T_ref_C: 250,
          Ea_kJ_mol: 40,
          T50_lightOff_C: 175,
          T90_C: 220,
          maxConversion_percent: 99.5,
          conditions: "NO:NO₂ = 1:1, 500 ppm NH₃, 5% O₂",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 650,
      sinteringOnsetTemp_C: 750,
      dispersionAfterAging_percent: 95,
      activityRetention_percent: 85,
      agingProtocol: "HTA: 16h at 800°C, 10% H₂O/air",
    },
    poisonTolerance: {
      sulfurTolerance: "high",
      sulfurRegenTemp_C: 550,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: 50,
    },
    operatingWindow: {
      minTemp_C: 180,
      maxTemp_C: 650,
      optimalTemp_C: [250, 500],
    },
    costIndex: 0.7,
    notes: "Cu-CHA is the industry standard for HD diesel SCR. Small-pore CHA framework provides exceptional hydrothermal stability. Cu²⁺ sites in 6-ring are the active centers for NH₃-SCR. Low-T activity superior to Fe-zeolites.",
  },
  {
    id: "SCR-002",
    name: "Fe-ZSM-5 SCR (High-T)",
    catalystType: "SCR",
    supplier: "Generic",
    physical: {
      BET_m2_g: 350,
      poreVolume_cm3_g: 0.20,
      avgPoreSize_nm: 5.5,
      bulkDensity_kg_L: 1.05,
    },
    composition: {
      support: "ZSM-5 (MFI zeolite)",
      activePhase: "Fe³⁺ ion-exchanged",
      promoters: [],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 160,
      washcoatThickness_um: 45,
    },
    chemisorption: {
      probeGas: "H2",
      uptake_umol_gCat: 180,
      uptake_umol_gPGM: 0,
      dispersion_percent: 100,
      metallicSA_m2_gPGM: 0,
      avgParticleSize_nm: 0,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Standard SCR",
          species: "NOx",
          TOF_ref: 0.08,
          T_ref_C: 300,
          Ea_kJ_mol: 60,
          T50_lightOff_C: 280,
          T90_C: 350,
          maxConversion_percent: 95,
          conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂, 5% H₂O",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 700,
      sinteringOnsetTemp_C: 800,
      dispersionAfterAging_percent: 90,
      activityRetention_percent: 80,
      agingProtocol: "16h at 800°C, 10% H₂O/air",
    },
    poisonTolerance: {
      sulfurTolerance: "high",
      sulfurRegenTemp_C: 500,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: 50,
    },
    operatingWindow: {
      minTemp_C: 250,
      maxTemp_C: 700,
      optimalTemp_C: [350, 600],
    },
    costIndex: 0.6,
    notes: "Fe-ZSM-5 offers better high-temperature activity and N₂O selectivity than Cu-CHA. Preferred for applications with sustained high exhaust temperatures (e.g., heavy-duty highway). Lower low-T activity is the trade-off.",
  },
  {
    id: "SCR-003",
    name: "V₂O₅-WO₃/TiO₂ SCR",
    catalystType: "SCR",
    supplier: "Generic (marine/stationary)",
    physical: {
      BET_m2_g: 80,
      poreVolume_cm3_g: 0.35,
      avgPoreSize_nm: 20,
      bulkDensity_kg_L: 1.3,
    },
    composition: {
      support: "TiO₂ (anatase)",
      activePhase: "V₂O₅ (1–3 wt%)",
      promoters: ["WO₃ (6–10 wt%)"],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 200,
      washcoatThickness_um: 60,
    },
    chemisorption: {
      probeGas: "H2",
      uptake_umol_gCat: 120,
      uptake_umol_gPGM: 0,
      dispersion_percent: 100,
      metallicSA_m2_gPGM: 0,
      avgParticleSize_nm: 0,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Standard SCR",
          species: "NOx",
          TOF_ref: 0.03,
          T_ref_C: 300,
          Ea_kJ_mol: 50,
          T50_lightOff_C: 300,
          T90_C: 380,
          maxConversion_percent: 90,
          conditions: "500 ppm NO, 500 ppm NH₃, 5% O₂",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 450,
      sinteringOnsetTemp_C: 500,
      dispersionAfterAging_percent: 80,
      activityRetention_percent: 90,
      agingProtocol: "500h at 450°C, 10% H₂O/air",
    },
    poisonTolerance: {
      sulfurTolerance: "high",
      sulfurRegenTemp_C: 400,
      phosphorusTolerance: "high",
      maxSulfur_ppm: 200,
    },
    operatingWindow: {
      minTemp_C: 250,
      maxTemp_C: 450,
      optimalTemp_C: [300, 400],
    },
    costIndex: 0.4,
    notes: "V₂O₅-WO₃/TiO₂ is the workhorse for marine and stationary SCR. Excellent SO₂ tolerance. Max temp limited to 450°C (V₂O₅ sublimation). WO₃ widens the operating window and suppresses SO₂→SO₃ oxidation.",
  },

  // ============================================================
  // REFORMER PROFILES
  // ============================================================
  {
    id: "SMR-001",
    name: "Ni/α-Al₂O₃ Industrial SMR",
    catalystType: "SMR",
    supplier: "Generic (Haldor Topsoe / JM class)",
    physical: {
      BET_m2_g: 25,
      poreVolume_cm3_g: 0.30,
      avgPoreSize_nm: 50,
      bulkDensity_kg_L: 1.8,
      crushStrength_MPa: 30,
    },
    composition: {
      support: "α-Al₂O₃ (corundum)",
      activePhase: "Ni (reduced)",
      promoters: ["K₂O (0.5 wt%) — carbon suppression", "CaO (2 wt%) — structural"],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 800,
      washcoatThickness_um: 0,
    },
    chemisorption: {
      probeGas: "H2",
      uptake_umol_gCat: 80,
      uptake_umol_gPGM: 533,
      dispersion_percent: 5,
      metallicSA_m2_gPGM: 12,
      avgParticleSize_nm: 20,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Steam methane reforming",
          species: "CH4",
          TOF_ref: 12.0,
          T_ref_C: 550,
          Ea_kJ_mol: 240,
          T50_lightOff_C: 480,
          T90_C: 650,
          maxConversion_percent: 97,
          conditions: "S/C = 3.0, P = 1 atm",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 950,
      sinteringOnsetTemp_C: 700,
      dispersionAfterAging_percent: 2,
      activityRetention_percent: 60,
      agingProtocol: "1000h at 850°C, S/C=3.0",
    },
    poisonTolerance: {
      sulfurTolerance: "low",
      sulfurRegenTemp_C: 900,
      phosphorusTolerance: "high",
      maxSulfur_ppm: 0.1,
    },
    operatingWindow: {
      minTemp_C: 400,
      maxTemp_C: 950,
      optimalTemp_C: [700, 900],
    },
    costIndex: 0.3,
    notes: "Industrial Ni/Al₂O₃ SMR catalyst. Low dispersion (5%) is acceptable because Ni is cheap. K₂O promoter suppresses carbon whisker growth. α-Al₂O₃ support provides mechanical strength at high T. Must desulfurize feed to <0.1 ppm H₂S.",
  },
  {
    id: "SMR-002",
    name: "Rh/CeO₂-ZrO₂ Compact Reformer",
    catalystType: "SMR",
    supplier: "Generic (SOFC/APU class)",
    physical: {
      BET_m2_g: 60,
      poreVolume_cm3_g: 0.35,
      avgPoreSize_nm: 15,
      bulkDensity_kg_L: 1.4,
    },
    composition: {
      support: "CeO₂-ZrO₂ (50:50)",
      activePhase: "Rh",
      promoters: ["Pt trace (0.1 wt%) — light-off aid"],
      Pt_g_ft3: 5,
      Pd_g_ft3: 0,
      Rh_g_ft3: 50,
      totalPGM_g_ft3: 55,
      pgm_wt_percent: 0.5,
      washcoatLoading_g_L: 200,
      washcoatThickness_um: 40,
    },
    chemisorption: {
      probeGas: "CO",
      uptake_umol_gCat: 35,
      uptake_umol_gPGM: 7000,
      dispersion_percent: 72,
      metallicSA_m2_gPGM: 175,
      avgParticleSize_nm: 1.3,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Steam methane reforming",
          species: "CH4",
          TOF_ref: 45.0,
          T_ref_C: 550,
          Ea_kJ_mol: 185,
          T50_lightOff_C: 420,
          T90_C: 550,
          maxConversion_percent: 99,
          conditions: "S/C = 2.5, P = 1 atm",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 900,
      sinteringOnsetTemp_C: 800,
      dispersionAfterAging_percent: 40,
      activityRetention_percent: 75,
      agingProtocol: "500h at 800°C, S/C=2.5",
    },
    poisonTolerance: {
      sulfurTolerance: "moderate",
      sulfurRegenTemp_C: 700,
      phosphorusTolerance: "high",
      maxSulfur_ppm: 1,
    },
    operatingWindow: {
      minTemp_C: 350,
      maxTemp_C: 900,
      optimalTemp_C: [550, 800],
    },
    costIndex: 2.5,
    notes: "Rh on CeZrO₂ for compact SOFC fuel processors. Very high TOF (45 s⁻¹ at 550°C) enables 10× smaller beds than Ni. CeZrO₂ provides lattice oxygen for carbon gasification. Expensive but justified for mobile/APU applications.",
  },
  {
    id: "WGS-001",
    name: "Fe₂O₃-Cr₂O₃ HT-WGS",
    catalystType: "WGS",
    supplier: "Generic (industrial)",
    physical: {
      BET_m2_g: 30,
      poreVolume_cm3_g: 0.25,
      avgPoreSize_nm: 30,
      bulkDensity_kg_L: 2.0,
      crushStrength_MPa: 40,
    },
    composition: {
      support: "Fe₂O₃ (reduced to Fe₃O₄ in service)",
      activePhase: "Fe₃O₄ (magnetite)",
      promoters: ["Cr₂O₃ (8 wt%) — structural stabilizer"],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 1000,
      washcoatThickness_um: 0,
    },
    chemisorption: {
      probeGas: "CO",
      uptake_umol_gCat: 15,
      uptake_umol_gPGM: 0,
      dispersion_percent: 3,
      metallicSA_m2_gPGM: 0,
      avgParticleSize_nm: 30,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Water-gas shift",
          species: "CO",
          TOF_ref: 0.5,
          T_ref_C: 400,
          Ea_kJ_mol: 115,
          T50_lightOff_C: 350,
          T90_C: 420,
          maxConversion_percent: 85,
          conditions: "10% CO, 20% H₂O, bal. N₂ — equilibrium limited at high T",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 500,
      sinteringOnsetTemp_C: 550,
      dispersionAfterAging_percent: 2,
      activityRetention_percent: 85,
      agingProtocol: "2000h at 450°C, process gas",
    },
    poisonTolerance: {
      sulfurTolerance: "moderate",
      sulfurRegenTemp_C: 500,
      phosphorusTolerance: "high",
      maxSulfur_ppm: 50,
    },
    operatingWindow: {
      minTemp_C: 320,
      maxTemp_C: 500,
      optimalTemp_C: [350, 450],
    },
    costIndex: 0.2,
    notes: "Classic HT-WGS catalyst. Operates as Fe₃O₄ (magnetite) in service. Cr₂O₃ prevents sintering. Equilibrium-limited above 450°C. Must not be exposed to condensation (pyrophoric when reduced).",
  },
  {
    id: "WGS-002",
    name: "CuO-ZnO/Al₂O₃ LT-WGS",
    catalystType: "WGS",
    supplier: "Generic (industrial)",
    physical: {
      BET_m2_g: 60,
      poreVolume_cm3_g: 0.30,
      avgPoreSize_nm: 15,
      bulkDensity_kg_L: 1.6,
    },
    composition: {
      support: "Al₂O₃",
      activePhase: "Cu/ZnO",
      promoters: ["ZnO (30 wt%) — spacer/stabilizer"],
      Pt_g_ft3: 0,
      Pd_g_ft3: 0,
      Rh_g_ft3: 0,
      totalPGM_g_ft3: 0,
      pgm_wt_percent: 0,
      washcoatLoading_g_L: 900,
      washcoatThickness_um: 0,
    },
    chemisorption: {
      probeGas: "H2",
      uptake_umol_gCat: 100,
      uptake_umol_gPGM: 0,
      dispersion_percent: 15,
      metallicSA_m2_gPGM: 0,
      avgParticleSize_nm: 6,
      measurementTemp_C: 35,
    },
    activity: {
      reactions: [
        {
          name: "Water-gas shift",
          species: "CO",
          TOF_ref: 0.15,
          T_ref_C: 250,
          Ea_kJ_mol: 80,
          T50_lightOff_C: 220,
          T90_C: 280,
          maxConversion_percent: 95,
          conditions: "3% CO, 10% H₂O, 15% CO₂, 40% H₂",
        },
      ],
    },
    thermalStability: {
      maxOperatingTemp_C: 300,
      sinteringOnsetTemp_C: 280,
      dispersionAfterAging_percent: 8,
      activityRetention_percent: 70,
      agingProtocol: "1000h at 250°C, process gas",
    },
    poisonTolerance: {
      sulfurTolerance: "low",
      sulfurRegenTemp_C: 999,
      phosphorusTolerance: "moderate",
      maxSulfur_ppm: 0.1,
    },
    operatingWindow: {
      minTemp_C: 180,
      maxTemp_C: 300,
      optimalTemp_C: [200, 260],
    },
    costIndex: 0.25,
    notes: "LT-WGS catalyst. Cu/ZnO provides high equilibrium conversion at low T. Extremely sensitive to sulfur (irreversible poisoning). Must not exceed 300°C (Cu sintering). Pyrophoric when reduced — handle under inert.",
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getProfileById(id: string): DetailedCatalystProfile | undefined {
  return CATALYST_PROFILES_DB.find((p) => p.id === id);
}

export function getProfilesByType(type: string): DetailedCatalystProfile[] {
  return CATALYST_PROFILES_DB.filter((p) => p.catalystType === type);
}

/**
 * Convert a DetailedCatalystProfile to a CatalystProfile (for surface-science module).
 */
export function toSurfaceScienceProfile(dp: DetailedCatalystProfile): CatalystProfile {
  const chemData: ChemisorptionData = {
    probeGas: dp.chemisorption.probeGas,
    uptake_umol_g: dp.chemisorption.uptake_umol_gCat,
    pgmLoading_wt_percent: dp.composition.pgm_wt_percent,
    primaryMetal: metalNameToKey(dp),
    measurementTemp_C: dp.chemisorption.measurementTemp_C,
  };

  return generateCatalystProfile(
    dp.name,
    dp.catalystType,
    chemData,
    dp.physical.BET_m2_g,
    dp.composition.totalPGM_g_ft3,
    dp.composition.washcoatLoading_g_L,
    dp.composition.washcoatThickness_um,
    0.45,
    dp.physical.avgPoreSize_nm
  );
}

function metalNameToKey(dp: DetailedCatalystProfile): "Pt" | "Pd" | "Rh" | "Ni" | "Cu" | "Fe" | "V" | "Ru" {
  const phase = dp.composition.activePhase.toLowerCase();
  if (phase.includes("rh")) return "Rh";
  if (phase.includes("pd")) return "Pd";
  if (phase.includes("pt")) return "Pt";
  if (phase.includes("ni")) return "Ni";
  if (phase.includes("cu")) return "Cu";
  if (phase.includes("fe")) return "Fe";
  if (phase.includes("v₂o₅") || phase.includes("v2o5")) return "V";
  return "Pt";
}
