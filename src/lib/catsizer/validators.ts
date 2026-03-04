import { z } from "zod";

export const engineInputSchema = z
  .object({
    engineType: z.enum(["diesel", "natural_gas", "dual_fuel", "biogas"]),
    application: z.enum([
      "heavy_duty_onroad",
      "heavy_duty_offroad",
      "genset",
      "marine",
    ]),
    displacement_L: z.number().min(0.5).max(100),
    ratedPower_kW: z.number().min(10).max(5000),
    ratedSpeed_rpm: z.number().min(500).max(4000),
    peakTorque_Nm: z.number().min(50).max(25000),
    numberOfCylinders: z.number().int().min(1).max(24),
    exhaustFlowRate_kg_h: z.number().min(0).max(50000),
    exhaustTemp_C: z.number().min(100).max(900),
    exhaustPressure_kPa: z.number().min(90).max(500),
    ambientTemp_C: z.number().min(-40).max(55),
    altitude_m: z.number().min(0).max(5000),
    CO_ppm: z.number().min(0).max(10000),
    HC_ppm: z.number().min(0).max(5000),
    NOx_ppm: z.number().min(0).max(5000),
    NO2_fraction: z.number().min(0).max(1),
    PM_mg_Nm3: z.number().min(0).max(500),
    SO2_ppm: z.number().min(0).max(200),
    O2_percent: z.number().min(0).max(21),
    H2O_percent: z.number().min(0).max(20),
    CO2_percent: z.number().min(0).max(20),
    loadProfile: z
      .enum(["constant", "variable", "peaking", "standby"])
      .optional(),
    fuelConsumption_kg_h: z.number().min(0).max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.engineType === "diesel" && data.O2_percent < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Diesel engines always operate lean — O₂ must be > 3%",
        path: ["O2_percent"],
      });
    }
  });

export const fuelInputSchema = z
  .object({
    fuelType: z.enum([
      "pipeline_natural_gas",
      "biogas",
      "landfill_gas",
      "pure_methane",
      "associated_gas",
    ]),
    CH4_percent: z.number().min(0).max(100),
    C2H6_percent: z.number().min(0).max(30),
    C3H8_percent: z.number().min(0).max(20),
    CO2_percent: z.number().min(0).max(60),
    N2_percent: z.number().min(0).max(80),
    H2S_ppm: z.number().min(0).max(50000),
    siloxanes_ppm: z.number().min(0).max(1000).optional(),
    fuelFlowRate_Nm3_h: z.number().min(0.1).max(10000),
    fuelPressure_kPa: z.number().min(100).max(5000),
    fuelTemp_C: z.number().min(0).max(500),
    SOFC_power_kW: z.number().min(0.1).max(10000),
    SOFC_fuelUtilization: z.number().min(0.5).max(0.95),
    SOFC_operatingTemp_C: z.number().min(500).max(1100),
    SOFC_currentDensity_A_cm2: z.number().min(0.05).max(2.0),
    reformingStrategy: z.enum([
      "SMR",
      "POX",
      "ATR",
      "internal",
      "indirect_internal",
    ]),
    steamToCarbonRatio: z.number().min(0.5).max(8.0),
    oxygenToCarbonRatio: z.number().min(0).max(1.5).optional(),
    targetCH4_CO_ratio: z.number().min(0).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    const sum =
      data.CH4_percent +
      data.C2H6_percent +
      data.C3H8_percent +
      data.CO2_percent +
      data.N2_percent;
    if (Math.abs(sum - 100) > 0.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Fuel composition must sum to 100% (currently ${sum.toFixed(1)}%)`,
        path: ["CH4_percent"],
      });
    }
    if (data.reformingStrategy === "SMR" && data.oxygenToCarbonRatio && data.oxygenToCarbonRatio > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMR does not use oxygen — O/C ratio must be 0",
        path: ["oxygenToCarbonRatio"],
      });
    }
    if (
      (data.reformingStrategy === "POX" || data.reformingStrategy === "ATR") &&
      (!data.oxygenToCarbonRatio || data.oxygenToCarbonRatio <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${data.reformingStrategy} requires O/C ratio > 0`,
        path: ["oxygenToCarbonRatio"],
      });
    }
  });

export type EngineInputValues = z.infer<typeof engineInputSchema>;
export type FuelInputValues = z.infer<typeof fuelInputSchema>;
