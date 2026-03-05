"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

export interface SimParams {
  injectionAngle: number;
  injectionPressure: number;
  exhaustFlowRate: number;
  exhaustTemp: number;
  pipeDiameter: number;
  injectorToSCR: number;
  mixerType: "none" | "blade" | "swirl" | "tab";
  showPipe: boolean;
  showStreamlines: boolean;
}

export interface SimMetrics {
  uniformityIndex: number;
  evaporationPct: number;
  wallRisk: "Low" | "Medium" | "High";
  depositRisk: "Low" | "Medium" | "High";
  residenceTime: number;
}

// 350 particles — sparse enough to see individual shrinkage
const N = 350;

const C_LIQ  = new THREE.Color("#3B82F6");
const C_EVAP = new THREE.Color("#06B6D4");
const C_GAS  = new THREE.Color("#10B981");
const C_DEP  = new THREE.Color("#EF4444");

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  d: number;       // 1 = full size, 0 = gone
  baseR: number;   // max visual radius at d=1
  stuck: boolean;
  stuckT: number;
  mixer: boolean;  // passed mixer
  age: number;
}

function Particles({ params, onMetrics }: { params: SimParams; onMetrics: (m: SimMetrics) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const mxZ = scrZ * 0.35;

  const cols = useMemo(() => new Float32Array(N * 3), []);
  const ps = useRef<P[]>([]);

  const mk = useCallback((): P => {
    const aRad = (params.injectionAngle * Math.PI) / 180;
    const th = Math.random() * Math.PI * 2;
    const sp = Math.pow(Math.random(), 0.5) * (0.05 + params.injectionPressure * 0.018);
    const rv = Math.sin(aRad) * sp * 2.2;

    // Size: large enough to see clearly, varies 2x
    const baseR = pR * (0.025 + Math.random() * 0.025);

    return {
      x: (Math.random() - 0.5) * 0.003,
      y: pR * 0.78 + (Math.random() - 0.5) * 0.003,
      z: (Math.random() - 0.5) * 0.002,
      vx: rv * Math.cos(th),
      vy: rv * Math.sin(th) - 0.3,
      vz: (0.4 + (params.exhaustFlowRate / 1000) * 1.2) * (0.7 + Math.random() * 0.6),
      d: 1.0,
      baseR,
      stuck: false, stuckT: 0, mixer: false, age: 0,
    };
  }, [params.injectionAngle, params.injectionPressure, params.exhaustFlowRate, pR]);

  if (ps.current.length === 0) {
    for (let i = 0; i < N; i++) {
      const p = mk();
      // stagger so pipe isn't empty on load
      const pre = Math.random() * 0.8;
      p.age = pre;
      p.z += p.vz * pre * 0.3;
      p.y += p.vy * pre * 0.3;
      p.x += p.vx * pre * 0.3;
      p.d = Math.max(0.05, 1 - pre * 1.2);
      ps.current.push(p);
    }
  }

  const fr = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const dt = Math.min(delta, 0.033);

    // K: evaporation speed — calibrated so d goes 1→0 in ~0.4s at 350°C
    const tN = Math.max(0, (params.exhaustTemp - 100) / 350);
    const K = 0.5 + tN * tN * 3.5;

    const mxBrk = params.mixerType === "blade" ? 0.35 : params.mixerType === "swirl" ? 0.50 : params.mixerType === "tab" ? 0.45 : 1;
    const turb = params.mixerType === "blade" ? 2.5 : params.mixerType === "swirl" ? 2.0 : params.mixerType === "tab" ? 1.6 : 1;
    const swF = params.mixerType === "swirl" ? 2.0 : params.mixerType === "blade" ? 0.7 : params.mixerType === "tab" ? 0.4 : 0;
    const push = 0.12 + (params.exhaustFlowRate / 1000) * 0.8;

    let nE = 0, nW = 0, nA = 0, tR = 0;
    const bins = new Array(8).fill(0);
    let nS = 0;

    for (let i = 0; i < N; i++) {
      const p = ps.current[i];
      p.age += dt;

      if (p.d < 0.03 || p.z > scrZ + 0.02 || p.age > 3 || (p.stuck && p.stuckT > 3)) {
        ps.current[i] = mk();
        // hide this frame
        tmp.position.set(0, -10, 0);
        tmp.scale.set(0, 0, 0);
        tmp.updateMatrix();
        ref.current!.setMatrixAt(i, tmp.matrix);
        cols[i * 3] = 0; cols[i * 3 + 1] = 0; cols[i * 3 + 2] = 0;
        continue;
      }

      nA++;

      // ── Stuck ──
      if (p.stuck) {
        p.stuckT += dt;
        if (params.exhaustTemp > 280) p.d -= dt * 0.08;
        const r = p.baseR * p.d * 0.8;
        tmp.position.set(p.x, p.y, p.z);
        tmp.scale.set(r, r, r * 0.3);
        tmp.updateMatrix();
        ref.current!.setMatrixAt(i, tmp.matrix);
        cols[i * 3] = C_DEP.r; cols[i * 3 + 1] = C_DEP.g; cols[i * 3 + 2] = C_DEP.b;
        nW++;
        tR += p.age;
        continue;
      }

      // ── Evaporation: d² law ──
      const lK = K * (p.mixer ? turb : 1);
      p.d = Math.sqrt(Math.max(0, p.d * p.d - lK * dt));

      // ── Mixer ──
      if (!p.mixer && p.z > mxZ - 0.004 && p.z < mxZ + 0.012 && params.mixerType !== "none") {
        p.mixer = true;
        p.d *= mxBrk;
        const sc = params.mixerType === "blade" ? 0.8 : 0.4;
        p.vx += (Math.random() - 0.5) * sc;
        p.vy += (Math.random() - 0.5) * sc;
        p.vz *= 0.4;
        if (Math.random() < 0.2) {
          const wa = Math.random() * Math.PI * 2;
          p.vx = Math.cos(wa) * 0.5;
          p.vy = Math.sin(wa) * 0.5;
        }
      }

      // ── Swirl ──
      if (p.mixer && swF > 0) {
        const dist = Math.sqrt(p.x * p.x + p.y * p.y);
        if (dist > 0.001) {
          p.vx += (-p.y / dist) * swF * dt;
          p.vy += (p.x / dist) * swF * dt;
        }
      }

      // ── Flow + drag ──
      p.vz += push * dt * 0.3;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.vz *= 1 - 0.6 * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ── Wall ──
      const rD = Math.sqrt(p.x * p.x + p.y * p.y);
      if (rD > pR * 0.90) {
        const iV = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const We = iV * iV * p.d * 50;
        if (We < 0.3 || params.exhaustTemp < 220) {
          p.stuck = true; p.stuckT = 0;
          const f = pR * 0.93 / (rD + 1e-6);
          p.x *= f; p.y *= f;
          p.vx = 0; p.vy = 0; p.vz = 0;
        } else {
          const f = pR * 0.85 / (rD + 1e-6);
          p.x *= f; p.y *= f;
          const nr = 1 / (rD + 1e-6);
          const nx = p.x * nr, ny = p.y * nr;
          const dot = p.vx * nx + p.vy * ny;
          p.vx -= 2 * dot * nx * 0.3;
          p.vy -= 2 * dot * ny * 0.3;
          p.d *= 0.6;
        }
      }

      // ── State + color ──
      let c: THREE.Color;
      if (p.d > 0.55) { c = C_LIQ; }
      else if (p.d > 0.15) { c = C_EVAP; nE++; }
      else { c = C_GAS; nE++; }

      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;

      // ── SIZE: this is the key — radius = baseR * d ──
      // At d=1 → full size. At d=0.3 → 30% size. Clearly visible shrinkage.
      const r = p.baseR * p.d;
      tmp.position.set(p.x, p.y, p.z);
      tmp.scale.set(r, r, r);
      tmp.updateMatrix();
      ref.current!.setMatrixAt(i, tmp.matrix);

      // ── SCR ──
      if (p.z >= scrZ * 0.88 && p.z <= scrZ + 0.015) {
        bins[Math.floor(((Math.atan2(p.y, p.x) + Math.PI) / (2 * Math.PI)) * 8) % 8]++;
        nS++;
      }
      tR += p.age;
    }

    ref.current.instanceMatrix.needsUpdate = true;
    const ca = ref.current.geometry.getAttribute("color");
    if (ca) { (ca as THREE.BufferAttribute).set(cols); ca.needsUpdate = true; }

    fr.current++;
    if (fr.current % 10 === 0) {
      let ui = 1;
      if (nS > 2) { const m = nS / 8; let d = 0; for (let b = 0; b < 8; b++) d += Math.abs(bins[b] - m); ui = Math.max(0, 1 - d / (2 * nS)); }
      onMetrics({
        uniformityIndex: Math.round(ui * 1000) / 1000,
        evaporationPct: nA > 0 ? Math.round((nE / nA) * 1000) / 10 : 0,
        wallRisk: nA > 0 && nW / nA > 0.15 ? "High" : nA > 0 && nW / nA > 0.05 ? "Medium" : "Low",
        depositRisk: params.exhaustTemp < 200 ? "High" : params.exhaustTemp < 280 ? "Medium" : "Low",
        residenceTime: nA > 0 ? Math.round((tR / nA) * 1000) : 0,
      });
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 8, 8);
    const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { c[i * 3] = 0.23; c[i * 3 + 1] = 0.51; c[i * 3 + 2] = 0.96; }
    g.setAttribute("color", new THREE.InstancedBufferAttribute(c, 3));
    return g;
  }, []);

  return (
    <instancedMesh ref={ref} args={[geo, undefined, N]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ─── Deposit rings ───────────────────────────────────────────────────────────

function Deposits({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const mxZ = scrZ * 0.35;
  const zones = useMemo(() => {
    const z: { p: number; w: number }[] = [];
    if (params.exhaustTemp < 280) {
      z.push({ p: 0.03, w: 0.5 }, { p: 0.06, w: 0.35 });
      if (params.mixerType !== "none") z.push({ p: mxZ + 0.01, w: 0.45 }, { p: mxZ + 0.025, w: 0.25 });
    }
    if (params.exhaustTemp < 200) for (let v = 0.02; v < scrZ * 0.5; v += 0.03) z.push({ p: v, w: 0.2 + Math.random() * 0.2 });
    return z;
  }, [params.exhaustTemp, params.mixerType, mxZ, scrZ]);
  if (!zones.length) return null;
  return <group>{zones.map((z, i) => (
    <mesh key={i} position={[0, 0, z.p]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[pR * 0.96, 0.0012 * z.w, 6, 24]} />
      <meshStandardMaterial color="#EF4444" transparent opacity={z.w * 0.4} roughness={0.9} />
    </mesh>
  ))}</group>;
}

// ─── Wetting ─────────────────────────────────────────────────────────────────

function Wetting({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  if (params.exhaustTemp > 320) return null;
  const w = Math.max(0, 1 - (params.exhaustTemp - 150) / 170);
  return <group>
    <mesh position={[0, -pR * 0.94, scrZ * 0.06]}>
      <planeGeometry args={[pR * 0.4, scrZ * 0.1]} />
      <meshStandardMaterial color="#2563EB" transparent opacity={w * 0.25} side={THREE.DoubleSide} roughness={0.1} metalness={0.3} />
    </mesh>
    {params.mixerType !== "none" && <mesh position={[0, 0, scrZ * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[pR * 0.89, pR * 0.97, 24]} />
      <meshStandardMaterial color="#2563EB" transparent opacity={w * 0.18} side={THREE.DoubleSide} roughness={0.1} />
    </mesh>}
  </group>;
}

// ─── Streamlines ─────────────────────────────────────────────────────────────

function Streamlines({ params }: { params: SimParams }) {
  const ref = useRef<THREE.Group>(null);
  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const curves = useMemo(() => {
    const sw = params.mixerType === "swirl" ? 2 : params.mixerType === "blade" ? 1 : params.mixerType === "tab" ? 0.5 : 0.08;
    return Array.from({ length: 8 }, (_, i) => {
      const th = (i / 8) * Math.PI * 2;
      const pts = Array.from({ length: 30 }, (_, s) => {
        const t = s / 29;
        const z = -0.02 + t * (scrZ + 0.05);
        const a = th + t * sw * Math.PI;
        const r = pR * 0.5 * (0.8 + 0.2 * Math.sin(t * Math.PI));
        return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
      });
      return new THREE.CatmullRomCurve3(pts).getPoints(40).map(p => [p.x, p.y, p.z] as [number, number, number]);
    });
  }, [pR, scrZ, params.mixerType]);
  useFrame(() => { ref.current?.children.forEach(c => { const m = (c as THREE.Line).material as THREE.LineBasicMaterial; if (m.opacity !== undefined) m.opacity = 0.08 + Math.sin(Date.now() * 0.002) * 0.03; }); });
  return <group ref={ref}>{curves.map((pts, i) => <Line key={i} points={pts} color="#60A5FA" transparent opacity={0.08} lineWidth={1} />)}</group>;
}

// ─── Hardware ────────────────────────────────────────────────────────────────

function Pipe({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const len = scrZ + 0.1;
  return <group>
    <mesh position={[0, 0, len / 2 - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[pR, pR, len, 32, 1, true]} />
      <meshStandardMaterial color="#94A3B8" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {[-0.03, len - 0.03].map((z, i) => <mesh key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[pR, 0.001, 8, 32]} /><meshStandardMaterial color="#64748B" metalness={0.5} roughness={0.4} />
    </mesh>)}
  </group>;
}

function Injector({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  return <group position={[0, pR + 0.01, 0]}>
    <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.008, 0.025, 8]} /><meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} /></mesh>
    <mesh position={[0, -0.018, 0]} rotation={[Math.PI, 0, 0]}><cylinderGeometry args={[0.002, 0.002, 0.01, 8]} /><meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.2} /></mesh>
  </group>;
}

function SCR({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  return <group position={[0, 0, scrZ]}>
    <mesh><circleGeometry args={[pR, 32]} /><meshStandardMaterial color="#10B981" transparent opacity={0.18} side={THREE.DoubleSide} /></mesh>
    {Array.from({ length: 4 }).map((_, i) => <mesh key={i}><torusGeometry args={[(pR * (i + 1)) / 5, 0.0004, 4, 24]} /><meshStandardMaterial color="#059669" transparent opacity={0.2} /></mesh>)}
  </group>;
}

function MixerGeo({ params }: { params: SimParams }) {
  const pR = params.pipeDiameter / 2 / 1000;
  const mz = params.injectorToSCR / 1000 * 0.35;
  if (params.mixerType === "none") return null;
  const n = params.mixerType === "blade" ? 6 : params.mixerType === "swirl" ? 8 : 4;
  const tilt = params.mixerType === "swirl" ? 0.6 : params.mixerType === "blade" ? 0.3 : 0.15;
  return <group position={[0, 0, mz]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[pR * 0.85, 0.002, 6, 24]} /><meshStandardMaterial color="#94A3B8" metalness={0.6} roughness={0.3} /></mesh>
    {Array.from({ length: n }).map((_, i) => {
      const a = (i / n) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * pR * 0.48, Math.sin(a) * pR * 0.48, 0]} rotation={[tilt, 0, a]}>
        <boxGeometry args={[pR * 0.3, 0.001, pR * 0.18]} /><meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.2} transparent opacity={0.5} />
      </mesh>;
    })}
  </group>;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Inner({ params, onMetrics }: { params: SimParams; onMetrics: (m: SimMetrics) => void }) {
  const scrZ = params.injectorToSCR / 1000;
  return <>
    <ambientLight intensity={0.3} />
    <directionalLight position={[2, 4, 1]} intensity={0.8} />
    <directionalLight position={[-1, -2, 3]} intensity={0.2} />
    {params.showPipe && <Pipe params={params} />}
    <Injector params={params} />
    <SCR params={params} />
    <MixerGeo params={params} />
    <Deposits params={params} />
    <Wetting params={params} />
    <Particles params={params} onMetrics={onMetrics} />
    {params.showStreamlines && <Streamlines params={params} />}
    <OrbitControls target={[0, 0, scrZ / 2]} enableDamping dampingFactor={0.1} minDistance={0.08} maxDistance={2} />
    <gridHelper args={[1, 10, "#334155", "#1E293B"]} position={[0, -0.12, scrZ / 2]} />
  </>;
}

export default function SprayCanvas({ params, onMetrics }: { params: SimParams; onMetrics: (m: SimMetrics) => void }) {
  return (
    <Canvas camera={{ position: [0.25, 0.18, -0.08], fov: 50, near: 0.001, far: 10 }} gl={{ antialias: true, alpha: true }} style={{ background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)" }}>
      <Inner params={params} onMetrics={onMetrics} />
    </Canvas>
  );
}
