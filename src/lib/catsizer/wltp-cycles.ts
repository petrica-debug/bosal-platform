/**
 * Shared WLTP / NEDC drive cycle data.
 * Used by both the standalone WLTP Simulation page and the AM Product Development wizard.
 */

export interface CyclePoint {
  time: number;
  speed: number;
  phase?: string;
}

export function interpolateCycle(keypoints: CyclePoint[], totalTime: number): CyclePoint[] {
  const result: CyclePoint[] = [];
  for (let t = 0; t <= totalTime; t++) {
    let i = 0;
    while (i < keypoints.length - 1 && keypoints[i + 1].time <= t) i++;
    if (i >= keypoints.length - 1) {
      result.push({
        time: t,
        speed: keypoints[keypoints.length - 1].speed,
        phase: keypoints[keypoints.length - 1].phase,
      });
      continue;
    }
    const t0 = keypoints[i].time;
    const t1 = keypoints[i + 1].time;
    const s0 = keypoints[i].speed;
    const s1 = keypoints[i + 1].speed;
    const frac = (t - t0) / (t1 - t0);
    const speed = s0 + frac * (s1 - s0);
    result.push({ time: t, speed: Math.max(0, speed), phase: keypoints[i].phase });
  }
  return result;
}

const WLTP_CLASS3_KEYPOINTS: CyclePoint[] = [
  // Low phase (0-589s)
  { time: 0, speed: 0, phase: "Low" },
  { time: 10, speed: 0, phase: "Low" },
  { time: 30, speed: 25, phase: "Low" },
  { time: 60, speed: 35, phase: "Low" },
  { time: 90, speed: 0, phase: "Low" },
  { time: 110, speed: 20, phase: "Low" },
  { time: 150, speed: 45, phase: "Low" },
  { time: 200, speed: 30, phase: "Low" },
  { time: 250, speed: 50, phase: "Low" },
  { time: 300, speed: 35, phase: "Low" },
  { time: 350, speed: 0, phase: "Low" },
  { time: 380, speed: 40, phase: "Low" },
  { time: 430, speed: 55, phase: "Low" },
  { time: 480, speed: 25, phase: "Low" },
  { time: 530, speed: 48, phase: "Low" },
  { time: 570, speed: 30, phase: "Low" },
  { time: 589, speed: 0, phase: "Low" },
  // Medium phase (589-1022s)
  { time: 590, speed: 0, phase: "Medium" },
  { time: 620, speed: 40, phase: "Medium" },
  { time: 660, speed: 60, phase: "Medium" },
  { time: 700, speed: 45, phase: "Medium" },
  { time: 740, speed: 70, phase: "Medium" },
  { time: 790, speed: 55, phase: "Medium" },
  { time: 840, speed: 75, phase: "Medium" },
  { time: 890, speed: 50, phase: "Medium" },
  { time: 940, speed: 65, phase: "Medium" },
  { time: 990, speed: 40, phase: "Medium" },
  { time: 1022, speed: 0, phase: "Medium" },
  // High phase (1022-1477s)
  { time: 1023, speed: 0, phase: "High" },
  { time: 1060, speed: 55, phase: "High" },
  { time: 1100, speed: 80, phase: "High" },
  { time: 1150, speed: 95, phase: "High" },
  { time: 1200, speed: 70, phase: "High" },
  { time: 1250, speed: 100, phase: "High" },
  { time: 1300, speed: 85, phase: "High" },
  { time: 1350, speed: 97, phase: "High" },
  { time: 1400, speed: 75, phase: "High" },
  { time: 1450, speed: 90, phase: "High" },
  { time: 1477, speed: 0, phase: "High" },
  // Extra High phase (1477-1800s)
  { time: 1478, speed: 0, phase: "Extra High" },
  { time: 1510, speed: 70, phase: "Extra High" },
  { time: 1550, speed: 110, phase: "Extra High" },
  { time: 1590, speed: 130, phase: "Extra High" },
  { time: 1630, speed: 120, phase: "Extra High" },
  { time: 1660, speed: 131, phase: "Extra High" },
  { time: 1700, speed: 110, phase: "Extra High" },
  { time: 1740, speed: 125, phase: "Extra High" },
  { time: 1770, speed: 100, phase: "Extra High" },
  { time: 1790, speed: 60, phase: "Extra High" },
  { time: 1800, speed: 0, phase: "Extra High" },
];

const NEDC_KEYPOINTS: CyclePoint[] = [
  // ECE-15 urban cycles (×4 repeats simplified)
  { time: 0, speed: 0, phase: "Urban" },
  { time: 15, speed: 0, phase: "Urban" },
  { time: 25, speed: 15, phase: "Urban" },
  { time: 40, speed: 15, phase: "Urban" },
  { time: 50, speed: 0, phase: "Urban" },
  { time: 75, speed: 0, phase: "Urban" },
  { time: 90, speed: 32, phase: "Urban" },
  { time: 115, speed: 32, phase: "Urban" },
  { time: 130, speed: 0, phase: "Urban" },
  { time: 155, speed: 0, phase: "Urban" },
  { time: 175, speed: 50, phase: "Urban" },
  { time: 195, speed: 50, phase: "Urban" },
  { time: 210, speed: 35, phase: "Urban" },
  { time: 225, speed: 35, phase: "Urban" },
  { time: 240, speed: 0, phase: "Urban" },
  // Repeat pattern (simplified)
  { time: 300, speed: 0, phase: "Urban" },
  { time: 330, speed: 32, phase: "Urban" },
  { time: 370, speed: 50, phase: "Urban" },
  { time: 410, speed: 35, phase: "Urban" },
  { time: 440, speed: 0, phase: "Urban" },
  { time: 500, speed: 0, phase: "Urban" },
  { time: 530, speed: 32, phase: "Urban" },
  { time: 570, speed: 50, phase: "Urban" },
  { time: 610, speed: 35, phase: "Urban" },
  { time: 640, speed: 0, phase: "Urban" },
  { time: 700, speed: 0, phase: "Urban" },
  { time: 730, speed: 32, phase: "Urban" },
  { time: 770, speed: 50, phase: "Urban" },
  { time: 780, speed: 0, phase: "Urban" },
  // EUDC extra-urban
  { time: 781, speed: 0, phase: "Extra-Urban" },
  { time: 820, speed: 70, phase: "Extra-Urban" },
  { time: 870, speed: 70, phase: "Extra-Urban" },
  { time: 910, speed: 50, phase: "Extra-Urban" },
  { time: 940, speed: 70, phase: "Extra-Urban" },
  { time: 980, speed: 100, phase: "Extra-Urban" },
  { time: 1020, speed: 100, phase: "Extra-Urban" },
  { time: 1060, speed: 120, phase: "Extra-Urban" },
  { time: 1100, speed: 120, phase: "Extra-Urban" },
  { time: 1140, speed: 80, phase: "Extra-Urban" },
  { time: 1160, speed: 50, phase: "Extra-Urban" },
  { time: 1180, speed: 0, phase: "Extra-Urban" },
];

export const WLTP_CYCLE = interpolateCycle(WLTP_CLASS3_KEYPOINTS, 1800);
export const NEDC_CYCLE = interpolateCycle(NEDC_KEYPOINTS, 1180);
