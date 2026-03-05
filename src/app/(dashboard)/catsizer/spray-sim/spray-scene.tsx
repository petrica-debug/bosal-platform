"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

// ─── Types ───────────────────────────────────────────────────────────────────

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

const PARTICLE_COUNT = 400;

const enum DropletState {
  Liquid = 0,
  Evaporating = 1,
  Gas = 2,
  Deposit = 3,
}

const STATE_COLORS = [
  new THREE.Color("#3B82F6"),
  new THREE.Color("#06B6D4"),
  new THREE.Color("#10B981"),
  new THREE.Color("#EF4444"),
];

// ─── Particle System ─────────────────────────────────────────────────────────

function ParticleSystem({
  params,
  onMetrics,
}: {
  params: SimParams;
  onMetrics: (m: SimMetrics) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pipeRadius = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const injectorZ = 0;

  const particles = useRef<
    {
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      life: number;
      maxLife: number;
      state: DropletState;
      size: number;
      radialOffset: number;
    }[]
  >([]);

  const colorArray = useMemo(
    () => new Float32Array(PARTICLE_COUNT * 3),
    []
  );

  const initParticle = useCallback(
    (i: number) => {
      const angleRad = (params.injectionAngle * Math.PI) / 180;
      const spread = 0.15 + (params.injectionPressure / 10) * 0.35;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;

      const vx = Math.sin(angleRad) * Math.cos(theta) * r * 2;
      const vy = Math.sin(angleRad) * Math.sin(theta) * r * 2;
      const baseSpeed = 0.8 + (params.exhaustFlowRate / 1000) * 2.5;
      const vz = baseSpeed * (0.7 + Math.random() * 0.6);

      const maxLife = 1.5 + Math.random() * 2.5;

      return {
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          injectorZ
        ),
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0,
        maxLife,
        state: DropletState.Liquid as DropletState,
        size: 0.008 + Math.random() * 0.012,
        radialOffset: Math.random(),
      };
    },
    [params.injectionAngle, params.injectionPressure, params.exhaustFlowRate, injectorZ]
  );

  if (particles.current.length === 0) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.current.push(initParticle(i));
    }
  }

  const metricsAccum = useRef({ frame: 0 });

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);

    const tempFactor = Math.max(0, (params.exhaustTemp - 150) / 350);
    const flowFactor = params.exhaustFlowRate / 500;
    const swirlStrength =
      params.mixerType === "swirl"
        ? 1.5
        : params.mixerType === "blade"
          ? 0.8
          : params.mixerType === "tab"
            ? 0.5
            : 0;

    let atSCR = 0;
    let totalSCR = 0;
    let evaporated = 0;
    let wallHits = 0;
    let totalResidence = 0;
    let activeCount = 0;

    const scrBins = new Array(8).fill(0);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles.current[i];
      p.life += dt;

      if (p.life > p.maxLife || p.pos.z > scrZ + 0.1) {
        particles.current[i] = initParticle(i);
        particles.current[i].life = Math.random() * 0.3;
        continue;
      }

      activeCount++;

      const exhaustPush = flowFactor * 0.3;
      p.vel.z += exhaustPush * dt;

      if (swirlStrength > 0) {
        const rx = p.pos.x;
        const ry = p.pos.y;
        const dist = Math.sqrt(rx * rx + ry * ry);
        if (dist > 0.001) {
          const tangentX = -ry / dist;
          const tangentY = rx / dist;
          p.vel.x += tangentX * swirlStrength * dt * 0.5;
          p.vel.y += tangentY * swirlStrength * dt * 0.5;
        }
      }

      p.vel.multiplyScalar(1 - 0.5 * dt);

      p.pos.addScaledVector(p.vel, dt);

      const radialDist = Math.sqrt(p.pos.x * p.pos.x + p.pos.y * p.pos.y);

      const progress = p.life / p.maxLife;
      const evapRate = 0.3 + tempFactor * 0.7;

      if (progress < evapRate * 0.4) {
        p.state = DropletState.Liquid;
      } else if (progress < evapRate * 0.75) {
        p.state = DropletState.Evaporating;
      } else {
        p.state = DropletState.Gas;
        evaporated++;
      }

      if (radialDist > pipeRadius * 0.9 && params.exhaustTemp < 250) {
        p.state = DropletState.Deposit;
        wallHits++;
        p.vel.multiplyScalar(0.1);
      } else if (radialDist > pipeRadius * 0.95) {
        const norm = new THREE.Vector2(p.pos.x, p.pos.y).normalize();
        p.pos.x = norm.x * pipeRadius * 0.94;
        p.pos.y = norm.y * pipeRadius * 0.94;
        p.vel.x *= -0.3;
        p.vel.y *= -0.3;
        if (params.exhaustTemp < 250) {
          p.state = DropletState.Deposit;
          wallHits++;
        }
      }

      if (p.pos.z >= scrZ * 0.9 && p.pos.z <= scrZ + 0.05) {
        const angle = Math.atan2(p.pos.y, p.pos.x);
        const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
        scrBins[bin]++;
        totalSCR++;
      }

      const sizeScale =
        p.state === DropletState.Gas
          ? 0.3
          : p.state === DropletState.Evaporating
            ? 0.6 + 0.4 * (1 - progress)
            : p.state === DropletState.Deposit
              ? 1.2
              : 1.0;
      const s = p.size * sizeScale;

      dummy.position.copy(p.pos);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const col = STATE_COLORS[p.state];
      colorArray[i * 3] = col.r;
      colorArray[i * 3 + 1] = col.g;
      colorArray[i * 3 + 2] = col.b;

      totalResidence += p.life;

      if (p.pos.z >= scrZ * 0.85) {
        atSCR++;
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    const colorAttr = meshRef.current.geometry.getAttribute("color");
    if (colorAttr) {
      (colorAttr as THREE.BufferAttribute).set(colorArray);
      colorAttr.needsUpdate = true;
    }

    metricsAccum.current.frame++;
    if (metricsAccum.current.frame % 10 === 0) {
      let ui = 1.0;
      if (totalSCR > 0) {
        const mean = totalSCR / 8;
        let sumDev = 0;
        for (let b = 0; b < 8; b++) {
          sumDev += Math.abs(scrBins[b] - mean);
        }
        ui = Math.max(0, 1 - sumDev / (2 * totalSCR));
      }

      const evapPct =
        activeCount > 0 ? (evaporated / activeCount) * 100 : 0;
      const wallPct = activeCount > 0 ? wallHits / activeCount : 0;
      const wallRisk: "Low" | "Medium" | "High" =
        wallPct > 0.15 ? "High" : wallPct > 0.05 ? "Medium" : "Low";
      const depositRisk: "Low" | "Medium" | "High" =
        params.exhaustTemp < 200
          ? "High"
          : params.exhaustTemp < 280
            ? "Medium"
            : "Low";
      const avgResidence =
        activeCount > 0 ? (totalResidence / activeCount) * 1000 : 0;

      onMetrics({
        uniformityIndex: Math.round(ui * 1000) / 1000,
        evaporationPct: Math.round(evapPct * 10) / 10,
        wallRisk,
        depositRisk,
        residenceTime: Math.round(avgResidence),
      });
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 6, 6);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      colors[i * 3] = 0.23;
      colors[i * 3 + 1] = 0.51;
      colors[i * 3 + 2] = 0.96;
    }
    geo.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colors, 3)
    );
    return geo;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
  );
}

// ─── Streamlines ─────────────────────────────────────────────────────────────

function Streamlines({ params }: { params: SimParams }) {
  const ref = useRef<THREE.Group>(null);
  const pipeRadius = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;

  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const count = 12;
    const swirlAmount =
      params.mixerType === "swirl"
        ? 2.0
        : params.mixerType === "blade"
          ? 1.0
          : params.mixerType === "tab"
            ? 0.5
            : 0.1;

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const r = pipeRadius * 0.6;
      const points: THREE.Vector3[] = [];
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const z = -0.05 + t * (scrZ + 0.1);
        const angle = theta + t * swirlAmount * Math.PI;
        const rr = r * (0.8 + 0.2 * Math.sin(t * Math.PI));
        points.push(
          new THREE.Vector3(
            Math.cos(angle) * rr,
            Math.sin(angle) * rr,
            z
          )
        );
      }
      result.push(points);
    }
    return result;
  }, [pipeRadius, scrZ, params.mixerType]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.children.forEach((child) => {
        const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
        if (mat.opacity !== undefined) {
          mat.opacity = 0.15 + Math.sin(Date.now() * 0.002) * 0.05;
        }
      });
    }
  });

  const curvePoints = useMemo(
    () =>
      lines.map((pts) => {
        const curve = new THREE.CatmullRomCurve3(pts);
        return curve.getPoints(60).map((p) => [p.x, p.y, p.z] as [number, number, number]);
      }),
    [lines]
  );

  return (
    <group ref={ref}>
      {curvePoints.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#60A5FA"
          transparent
          opacity={0.15}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

// ─── Exhaust Pipe ────────────────────────────────────────────────────────────

function ExhaustPipe({ params }: { params: SimParams }) {
  const pipeRadius = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;
  const pipeLength = scrZ + 0.15;

  return (
    <group>
      <mesh position={[0, 0, pipeLength / 2 - 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, pipeLength, 32, 1, true]} />
        <meshStandardMaterial
          color="#9CA3AF"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Pipe edge rings */}
      <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[pipeRadius, 0.002, 8, 32]} />
        <meshStandardMaterial color="#6B7280" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, pipeLength - 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[pipeRadius, 0.002, 8, 32]} />
        <meshStandardMaterial color="#6B7280" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ─── Injector Nozzle ─────────────────────────────────────────────────────────

function InjectorNozzle({ params }: { params: SimParams }) {
  const pipeRadius = params.pipeDiameter / 2 / 1000;

  return (
    <group position={[0, pipeRadius + 0.015, 0]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.012, 0.035, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.025, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.015, 8]} />
        <meshStandardMaterial color="#1F2937" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Spray cone indicator */}
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.025, 0.04, 12, 1, true]} />
        <meshStandardMaterial
          color="#3B82F6"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── SCR Catalyst Face ───────────────────────────────────────────────────────

function SCRFace({ params }: { params: SimParams }) {
  const pipeRadius = params.pipeDiameter / 2 / 1000;
  const scrZ = params.injectorToSCR / 1000;

  return (
    <group position={[0, 0, scrZ]}>
      <mesh>
        <circleGeometry args={[pipeRadius, 32]} />
        <meshStandardMaterial
          color="#10B981"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Honeycomb grid lines */}
      {Array.from({ length: 5 }).map((_, i) => {
        const r = (pipeRadius * (i + 1)) / 6;
        return (
          <mesh key={`ring-${i}`}>
            <torusGeometry args={[r, 0.0008, 4, 24]} />
            <meshStandardMaterial color="#059669" transparent opacity={0.3} />
          </mesh>
        );
      })}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI;
        const pts: [number, number, number][] = [
          [-Math.cos(angle) * pipeRadius, -Math.sin(angle) * pipeRadius, 0],
          [Math.cos(angle) * pipeRadius, Math.sin(angle) * pipeRadius, 0],
        ];
        return (
          <Line
            key={`line-${i}`}
            points={pts}
            color="#059669"
            transparent
            opacity={0.3}
            lineWidth={1}
          />
        );
      })}
      {/* SCR label */}
      <mesh position={[0, pipeRadius + 0.02, 0]}>
        <planeGeometry args={[0.06, 0.015]} />
        <meshBasicMaterial color="#059669" transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ─── Mixer Visualization ─────────────────────────────────────────────────────

function Mixer({ params }: { params: SimParams }) {
  const pipeRadius = params.pipeDiameter / 2 / 1000;
  const mixerZ = params.injectorToSCR / 1000 * 0.35;

  if (params.mixerType === "none") return null;

  const bladeCount =
    params.mixerType === "blade" ? 6 : params.mixerType === "swirl" ? 8 : 4;

  return (
    <group position={[0, 0, mixerZ]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[pipeRadius * 0.85, 0.003, 6, 24]} />
        <meshStandardMaterial color="#9CA3AF" metalness={0.6} roughness={0.3} />
      </mesh>
      {Array.from({ length: bladeCount }).map((_, i) => {
        const angle = (i / bladeCount) * Math.PI * 2;
        const tilt =
          params.mixerType === "swirl"
            ? 0.6
            : params.mixerType === "blade"
              ? 0.3
              : 0.15;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * pipeRadius * 0.5,
              Math.sin(angle) * pipeRadius * 0.5,
              0,
            ]}
            rotation={[tilt, 0, angle]}
          >
            <boxGeometry
              args={[pipeRadius * 0.4, 0.001, pipeRadius * 0.25]}
            />
            <meshStandardMaterial
              color="#D1D5DB"
              metalness={0.7}
              roughness={0.2}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Scene Composition ───────────────────────────────────────────────────────

function SpraySceneInner({
  params,
  onMetrics,
}: {
  params: SimParams;
  onMetrics: (m: SimMetrics) => void;
}) {
  const scrZ = params.injectorToSCR / 1000;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <directionalLight position={[-2, -3, 4]} intensity={0.4} />

      {params.showPipe && <ExhaustPipe params={params} />}
      <InjectorNozzle params={params} />
      <SCRFace params={params} />
      <Mixer params={params} />
      <ParticleSystem params={params} onMetrics={onMetrics} />
      {params.showStreamlines && <Streamlines params={params} />}

      <OrbitControls
        target={[0, 0, scrZ / 2]}
        enableDamping
        dampingFactor={0.1}
        minDistance={0.2}
        maxDistance={3}
      />

      {/* Ground reference grid */}
      <gridHelper
        args={[2, 20, "#374151", "#1F2937"]}
        position={[0, -0.2, scrZ / 2]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}

// ─── Exported Canvas Wrapper ─────────────────────────────────────────────────

export default function SprayCanvas({
  params,
  onMetrics,
}: {
  params: SimParams;
  onMetrics: (m: SimMetrics) => void;
}) {
  const scrZ = params.injectorToSCR / 1000;

  return (
    <Canvas
      camera={{
        position: [0.4, 0.3, -0.2],
        fov: 50,
        near: 0.01,
        far: 10,
      }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)" }}
    >
      <SpraySceneInner params={params} onMetrics={onMetrics} />
    </Canvas>
  );
}
