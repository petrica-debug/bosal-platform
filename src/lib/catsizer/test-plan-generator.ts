/**
 * R103 test plan generator — produces a structured, complete test plan
 * for AM catalyst type approval per UN ECE R103.
 */

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export interface TestPlanInput {
  /** Emission standard (e.g. "Euro 6d", "Euro 6e") */
  emissionStandard: string;
  /** Engine family codes */
  engineFamilyCodes: string[];
  /** Displacement range in cc */
  displacementRange: [number, number];
  /** Power range in kW */
  powerRange: [number, number];
  /** AM component list (e.g. ["CC-TWC", "GPF"]) */
  amComponents: string[];
  /** Selected test vehicle */
  testVehicleModel: string;
  testVehicleEngineCode: string;
  testVehicleInertiaKg: number;
  /** Aging protocol */
  agingProtocol: string;
  agingTempC: number;
  agingHours: number;
  /** Target mileage equivalence */
  targetMileageKm: number;
  /** Fuel type */
  fuelType: "gasoline" | "diesel";
  /** Whether Type 6 (-7°C) test is required */
  type6Required: boolean;
}

export interface TestPlanSection {
  number: string;
  title: string;
  content: string;
  items?: string[];
}

export interface TestPlanResult {
  title: string;
  reference: string;
  generatedDate: string;
  sections: TestPlanSection[];
  /** Estimated total test duration in working days */
  estimatedDurationDays: number;
  /** Estimated lab cost in EUR (rough order of magnitude) */
  estimatedCostEur: number;
}

/* ================================================================== */
/*  F. Test Plan Generator                                            */
/* ================================================================== */

export function generateTestPlan(input: TestPlanInput): TestPlanResult {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  const sections: TestPlanSection[] = [];

  // 1. Scope Declaration
  sections.push({
    number: "1",
    title: "Scope Declaration",
    content: `This test plan covers the R103 type approval of aftermarket replacement catalytic converter(s) for the following engine family.`,
    items: [
      `Emission Standard: ${input.emissionStandard}`,
      `Engine Family: ${input.engineFamilyCodes.join(", ")}`,
      `Displacement Range: ${input.displacementRange[0]}–${input.displacementRange[1]} cc`,
      `Power Range: ${input.powerRange[0]}–${input.powerRange[1]} kW`,
      `AM Components: ${input.amComponents.join(", ")}`,
      `Target Mileage Equivalence: ${(input.targetMileageKm / 1000).toFixed(0)}k km`,
      `Fuel Type: ${input.fuelType}`,
    ],
  });

  // 2. Reference Vehicle Selection
  sections.push({
    number: "2",
    title: "Reference Vehicle Selection",
    content: `The test vehicle is selected as the worst-case member of the engine family per R103 Annex I §2.2.`,
    items: [
      `Vehicle: ${input.testVehicleModel}`,
      `Engine Code: ${input.testVehicleEngineCode}`,
      `Inertia Class: ${input.testVehicleInertiaKg} kg`,
      `Selection Basis: Highest inertia class within the engine family, representing the most demanding emission test conditions.`,
    ],
  });

  // 3. Type 1 Test Matrix (WLTP)
  const type1Runs = input.emissionStandard.includes("6e") ? 3 : 3;
  sections.push({
    number: "3",
    title: "Type 1 Emission Test (WLTP)",
    content: `${type1Runs} consecutive WLTP cycles on chassis dynamometer per GTR 15 / EU 2017/1151 Annex XXI.`,
    items: [
      `Test Cycles: ${type1Runs}× complete WLTP (Low, Medium, High, Extra-High phases)`,
      `Soak Conditions: Minimum 6h at 20–30°C between tests`,
      `Measurement: CO, THC, NMHC, NOx, PM, PN (gaseous + particulate)`,
      `Cold Start: First cycle includes cold start (engine off ≥6h at 23±5°C)`,
      `Hot Start: Subsequent cycles after 10-minute hot soak`,
      `Emission Limits: Per ${input.emissionStandard} Table 2 (combined, cold+hot weighted)`,
      `Pass Criteria: All ${type1Runs} cycles must meet emission limits`,
    ],
  });

  // 4. Type 6 Test (-7°C Cold Start)
  if (input.type6Required) {
    sections.push({
      number: "4",
      title: "Type 6 Test (Low Temperature Cold Start)",
      content: "Cold start emission test at -7°C per EU 2017/1151 Annex VIII.",
      items: [
        "Temperature: -7 ± 2°C",
        "Cycle: Modified NEDC or WLTP Low+Medium phases (per standard version)",
        "Soak: Minimum 12h at -7°C",
        "Measurement: CO, THC (gasoline) or CO, THC, NOx (diesel)",
        `Limits: Per ${input.emissionStandard} Type 6 limits`,
      ],
    });
  } else {
    sections.push({
      number: "4",
      title: "Type 6 Test (Low Temperature Cold Start)",
      content: "Not required for this configuration. Type 6 is only mandatory when the AM component is in the close-coupled position and affects cold-start light-off.",
      items: [],
    });
  }

  // 5. OBD Verification
  sections.push({
    number: "5",
    title: "OBD Verification Protocol",
    content: "OBD catalyst monitor verification per R103 §6.3 and EU 2017/1151 Annex XI.",
    items: [
      `Test Cycles: 3× consecutive Type 1 WLTP cycles`,
      "MIL Check: Malfunction Indicator Lamp must remain OFF throughout all 3 cycles",
      "DTC Scan: OBD-II scan after each cycle — no P0420/P0430 codes permitted",
      "Readiness: Catalyst monitor must report READY after driving cycle",
      "Freeze Frame: Record any pending DTCs for analysis",
      "OBD Threshold: AM catalyst must not trigger OBD monitor at any point during 3-cycle sequence",
    ],
  });

  // 6. Durability / Aging
  sections.push({
    number: "6",
    title: "Durability Requirement (Bench Aging)",
    content: `Accelerated bench aging to simulate ${(input.targetMileageKm / 1000).toFixed(0)}k km of real-world use per R103 §5.2.`,
    items: [
      `Protocol: ${input.agingProtocol}`,
      `Temperature: ${input.agingTempC}°C inlet gas temperature`,
      `Duration: ${input.agingHours} hours`,
      `Equivalence: ${(input.targetMileageKm / 1000).toFixed(0)}k km (Arrhenius equivalence, Ea ≈ 130 kJ/mol)`,
      "Gas Composition: Stoichiometric exhaust with ±0.5 A/F oscillation at 0.5–1.0 Hz",
      "Thermal Cycling: Included per protocol specification",
      "Post-Aging: Visual inspection, weigh, photograph before emission testing",
    ],
  });

  // 7. Measurement Plan
  sections.push({
    number: "7",
    title: "Measurement Plan",
    content: "Complete measurement protocol for all test phases.",
    items: [
      "Emissions: CVS dilution tunnel, MEXA analyzers (CO, CO2, THC, NMHC, NOx, CH4)",
      "Particulates: PM filter gravimetric + PN condensation particle counter",
      "OBD: Generic scan tool (ISO 15765-4), record PIDs 01-02, 05, 06-09",
      "Backpressure: Differential pressure transducer at catalyst inlet/outlet, measure at 2000/3000/4000 RPM steady state",
      "Temperature: K-type thermocouples at catalyst inlet, mid-bed, outlet",
      "Lambda: Wideband O2 sensors upstream and downstream of each catalyst brick",
    ],
  });

  // 8. Equipment & Lab Booking
  const agingDays = Math.ceil(input.agingHours / 24) + 2; // +2 for setup/teardown
  const type1Days = type1Runs * 2; // 2 days per cycle (soak + test)
  const type6Days = input.type6Required ? 3 : 0;
  const obdDays = 4; // 3 cycles + analysis
  const bpDays = 1;
  const totalDays = agingDays + type1Days + type6Days + obdDays + bpDays + 3; // +3 buffer

  const agingCost = input.agingHours * 85; // ~85 EUR/h bench time
  const type1Cost = type1Runs * 3500; // ~3500 EUR per WLTP cycle
  const type6Cost = input.type6Required ? 5000 : 0;
  const obdCost = 2500;
  const bpCost = 800;
  const totalCost = agingCost + type1Cost + type6Cost + obdCost + bpCost;

  sections.push({
    number: "8",
    title: "Equipment & Lab Booking Estimate",
    content: `Estimated total duration: ${totalDays} working days. Estimated cost: €${totalCost.toLocaleString()}.`,
    items: [
      `Bench Aging: ${agingDays} days (${input.agingHours}h continuous + setup) — €${agingCost.toLocaleString()}`,
      `Type 1 WLTP: ${type1Days} days (${type1Runs} cycles) — €${type1Cost.toLocaleString()}`,
      input.type6Required ? `Type 6 (-7°C): ${type6Days} days — €${type6Cost.toLocaleString()}` : "Type 6: Not required",
      `OBD Verification: ${obdDays} days — €${obdCost.toLocaleString()}`,
      `Backpressure: ${bpDays} day — €${bpCost.toLocaleString()}`,
      `Buffer: 3 days for re-tests or schedule gaps`,
      "",
      "Required Equipment:",
      "• Chassis dynamometer (4WD capable)",
      "• CVS dilution tunnel with MEXA gas analyzers",
      "• Condensation particle counter (CPC) for PN",
      "• Catalyst aging bench with programmable gas/temp controller",
      "• Climate chamber (-10°C capable) for Type 6",
      "• OBD-II generic scan tool (ISO 15765-4)",
      "• Differential pressure measurement system",
    ],
  });

  return {
    title: `R103 Test Plan — ${input.amComponents.join(" + ")} — ${input.engineFamilyCodes.join("/")}`,
    reference: `TP-${dateStr}-${input.testVehicleEngineCode.replace(/\s/g, "")}`,
    generatedDate: dateStr,
    sections,
    estimatedDurationDays: totalDays,
    estimatedCostEur: totalCost,
  };
}
