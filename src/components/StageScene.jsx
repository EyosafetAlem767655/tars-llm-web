import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatContext } from "@/context/ChatContext";
import { useRouter } from "next/router";

/* ---------- Small, far spiral galaxies ---------- */
function SpiralGalaxy({
  arms = 3,
  count = 650,
  radius = 12,
  colorA = "#bcdcff",
  colorB = "#ffffff",
  position = [0, 0, -220],
  rotation = [0, 0, 0],
  size = 0.045,
}) {
  const pointsRef = useRef();
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = Math.random() ** 0.6 * radius;
      const arm = i % arms;
      const base = (arm / arms) * Math.PI * 2;
      const swirl = r * 0.28;
      const jitter = (Math.random() - 0.5) * 0.35;
      const angle = base + swirl + jitter;

      pos[i * 3 + 0] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.22 + r * 0.02);
      pos[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.4;

      color.set(colorA).lerp(new THREE.Color(colorB), Math.random());
      col[i * 3 + 0] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    return { positions: pos, colors: col };
  }, [arms, count, radius, colorA, colorB]);

  useFrame((_, dt) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.z += dt * 0.04;
  });

  return (
    <points ref={pointsRef} position={position} rotation={rotation}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        vertexColors
        depthWrite={false}
        transparent
        opacity={0.95}
      />
    </points>
  );
}

/* ---------- Meteor showers ---------- */
function MeteorShower({
  count = 24,
  dir = new THREE.Vector3(-1, -0.4, 1),
  speedRange = [60, 90],
  area = [140, 70, 160],
}) {
  const group = useRef();
  const shooters = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        pos: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(area[0]),
          THREE.MathUtils.randFloat(area[1] * 0.25, area[1] * 0.48),
          -THREE.MathUtils.randFloat(area[2] * 0.4, area[2] * 0.9)
        ),
        vel: dir
          .clone()
          .normalize()
          .multiplyScalar(
            THREE.MathUtils.randFloat(speedRange[0], speedRange[1])
          ),
        life: THREE.MathUtils.randFloat(1.1, 2.2),
        len: THREE.MathUtils.randFloat(1.7, 3.2),
      });
    }
    return arr;
  }, [count, dir, speedRange, area]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.children.forEach((m, i) => {
      const s = shooters[i];
      s.life -= dt;
      m.position.addScaledVector(s.vel, dt);
      m.lookAt(m.position.clone().add(s.vel));
      if (
        s.life <= 0 ||
        Math.abs(m.position.x) > 200 ||
        Math.abs(m.position.y) > 120 ||
        Math.abs(m.position.z) > 200
      ) {
        s.pos.set(
          THREE.MathUtils.randFloatSpread(area[0]),
          THREE.MathUtils.randFloat(area[1] * 0.25, area[1] * 0.48),
          -THREE.MathUtils.randFloat(area[2] * 0.4, area[2] * 0.9)
        );
        m.position.copy(s.pos);
        s.vel
          .copy(dir)
          .normalize()
          .multiplyScalar(
            THREE.MathUtils.randFloat(speedRange[0], speedRange[1])
          );
        s.life = THREE.MathUtils.randFloat(1.1, 2.2);
      }
    });
  });

  return (
    <group ref={group}>
      {shooters.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={[s.len, 0.05, 0.05]} />
          <meshBasicMaterial color="#cbe7ff" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- More realistic satellite ---------- */
function RealSatellite({ position = [12, 2.2, -38], scale = 1.1 }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.35;
  });
  return (
    <Float speed={0.7} rotationIntensity={0.35} floatIntensity={0.8}>
      <group ref={ref} position={position} scale={scale}>
        <mesh>
          <boxGeometry args={[1.8, 1.2, 1.2]} />
          <meshStandardMaterial
            color="#b7c2cc"
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[-2.2, 0, 0]}>
          <boxGeometry args={[0.08, 3.2, 1.2]} />
          <meshStandardMaterial
            color="#204080"
            metalness={0.4}
            roughness={0.25}
            emissive="#1b2e6b"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh position={[2.2, 0, 0]}>
          <boxGeometry args={[0.08, 3.2, 1.2]} />
          <meshStandardMaterial
            color="#204080"
            metalness={0.4}
            roughness={0.25}
            emissive="#1b2e6b"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh position={[0, -0.7, 0.95]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.7, 0.55, 28]} />
          <meshStandardMaterial color="#e2e9f1" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.85, -0.9]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 10]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </Float>
  );
}

/* ---------- WORMHOLE: fixed tunnel with hard bends; camera travels inside ---------- */
function WormholeTunnel({ active, durationSec = 45, segments = 1200, sparkleCount = 600 }) {
  const tunnelRef = useRef();
  const ringsRef = useRef();
  const timeRef = useRef(0);
  const { camera } = useThree();

  // Build a bent path (segments is adjustable for performance)
  const { curve, points, frames, tubeGeom, ringPositions } = useMemo(() => {
    const cps = [];
    let p = new THREE.Vector3(0, 0, 0);
    cps.push(p.clone());
    for (let i = 0; i < 10; i++) {
      const axis = new THREE.Vector3(
        Math.random() < 0.5 ? 1 : 0,
        Math.random() < 0.5 ? 1 : 0,
        Math.random() < 0.5 ? 1 : 0
      ).normalize();
      const deg = THREE.MathUtils.randFloat(45, 90);
      const len = THREE.MathUtils.randFloat(14, 20);
      const dir = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1),
        THREE.MathUtils.randFloatSpread(1),
        -1
      )
        .normalize()
        .applyAxisAngle(axis, THREE.MathUtils.degToRad(deg));
      p = p.clone().add(dir.multiplyScalar(len));
      cps.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(cps, false, "catmullrom", 0.25);
    const points = curve.getSpacedPoints(segments);
    const frames = curve.computeFrenetFrames(segments, false);
    const tubeGeom = new THREE.TubeGeometry(curve, segments, 5.2, 24, false);

    // ring markers every ~2% of path
    const ringPositions = [];
    for (let i = 0; i <= 100; i += 2) {
      const t = i / 100;
      ringPositions.push({
        p: curve.getPointAt(t),
        t,
      });
    }
    return { curve, points, frames, tubeGeom, ringPositions };
  }, [segments]);

  // Materials for tunnel and rings (slight animated offset for flow)
  const tunnelMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#1ad9ff",
      roughness: 0.3,
      metalness: 0.0,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide, // we’re inside the tube
    });
    return m;
  }, []);

  const ringMatA = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#38f0ff", transparent: true, opacity: 0.9 }),
    []
  );
  const ringMatB = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#66c5ff", transparent: true, opacity: 0.85 }),
    []
  );
  const ringGeom = useMemo(() => new THREE.TorusGeometry(5.0, 0.09, 12, 72), []);

  // Place static rings along the curve (camera motion creates the sense of speed)
  useEffect(() => {
    if (!ringsRef.current) return;
    if (ringsRef.current.children.length) return;
    ringPositions.forEach((rp, i) => {
      const mesh = new THREE.Mesh(ringGeom, i % 2 ? ringMatA : ringMatB);
      mesh.position.copy(rp.p);
      // Orient perpendicular to tangent
      const tangent = new THREE.Vector3();
      const nextT = Math.min(rp.t + 0.001, 1);
      const nextP = curve.getPointAt(nextT);
      tangent.subVectors(nextP, rp.p).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        tangent
      );
      mesh.quaternion.copy(q);
      ringsRef.current.add(mesh);
    });
  }, [ringPositions, curve, ringGeom, ringMatA, ringMatB]);

  // Move camera steadily inside the tunnel
  const startRef = useRef(null);
  const saved = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 62 });

  useEffect(() => {
    if (!active) return;
    // save current camera to restore after exit
    saved.current.pos.copy(camera.position);
    saved.current.quat.copy(camera.quaternion);
    saved.current.fov = camera.fov;
    startRef.current = performance.now();
    return () => {
      // restore
      camera.position.copy(saved.current.pos);
      camera.quaternion.copy(saved.current.quat);
      camera.fov = saved.current.fov;
      camera.updateProjectionMatrix();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useFrame(() => {
    if (!active || !startRef.current) return;
    const elapsed = (performance.now() - startRef.current) / 1000;
    const t = Math.min(0.999, elapsed / durationSec); // 45s
    const p = curve.getPointAt(t);
    const ahead = curve.getPointAt(Math.min(0.999, t + 0.002));
    camera.position.copy(p);
    camera.lookAt(ahead);
  });

  return (
    <group>
      <mesh ref={tunnelRef} geometry={tubeGeom} material={tunnelMat} />
      <group ref={ringsRef} />
      <Sparkles count={sparkleCount} size={2} scale={[40, 40, 140]} speed={2.0} color="#bff6ff" />
    </group>
  );
}

/* ---------- Black hole: event horizon, photon ring & spaghettification ---------- */
function BlackHole({ active, progress }) {
  const hole = useRef();
  const ring = useRef();
  const disk1 = useRef();
  const disk2 = useRef();
  const jet1 = useRef();
  const jet2 = useRef();
  const spaghettiGroup = useRef();

  useEffect(() => {
    if (!spaghettiGroup.current || spaghettiGroup.current.children.length) return;
    const mat = new THREE.MeshBasicMaterial({ color: "#d6eeff", transparent: true, opacity: 0.4 });
    for (let i = 0; i < 80; i++) {
      const g = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
      const m = new THREE.Mesh(g, mat.clone());
      const ang = Math.random() * Math.PI * 2;
      const r = THREE.MathUtils.randFloat(8, 18);
      m.position.set(Math.cos(ang) * r, THREE.MathUtils.randFloatSpread(6), Math.sin(ang) * r - 22);
      spaghettiGroup.current.add(m);
    }
  }, []);

  useFrame((_, dt) => {
    if (!active) return;
    const accel = 1 + progress * 1.2;
    if (hole.current) hole.current.rotation.y += dt * 0.12 * accel;
    if (ring.current) ring.current.rotation.z += dt * 0.6 * accel;
    if (disk1.current) disk1.current.rotation.z -= dt * 1.2 * accel;
    if (disk2.current) disk2.current.rotation.z += dt * 0.9 * accel;

    if (disk1.current) {
      const c = new THREE.Color().setHSL(0.08 + progress * 0.04, 1, 0.55);
      disk1.current.material.emissive = c;
      disk1.current.material.emissiveIntensity = 1.8 - progress * 0.6;
    }
    if (disk2.current) {
      const c2 = new THREE.Color().setHSL(0.12 + progress * 0.03, 0.9, 0.6);
      disk2.current.material.emissive = c2;
      disk2.current.material.emissiveIntensity = 1.2 - progress * 0.4;
    }

    const flick1 = 0.5 + Math.sin(performance.now() / 300) * 0.25;
    const flick2 = 0.5 + Math.cos(performance.now() / 320) * 0.25;
    if (jet1.current) jet1.current.material.opacity = flick1;
    if (jet2.current) jet2.current.material.opacity = flick2;

    if (spaghettiGroup.current) {
      spaghettiGroup.current.children.forEach((m, idx) => {
        const base = 1 + progress * 8;
        const jitter = 0.2 * Math.sin(performance.now() / 150 + idx);
        m.scale.set(1, base + jitter, 1);
        m.material.opacity = 0.25 + progress * 0.45;
      });
    }
  });

  return (
    <group position={[0, 0, -22 + progress * 10]} scale={1 + progress * 1.6}>
      <mesh ref={hole}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <meshStandardMaterial color="#000" metalness={1} roughness={1} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.15, 0.14, 32, 256]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
      </mesh>
      <mesh ref={disk1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.5, 0.6, 16, 256]} />
        <meshStandardMaterial color="#ffb24a" emissive="#ff7b00" emissiveIntensity={1.8} roughness={0.5} />
      </mesh>
      <mesh ref={disk2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8.2, 0.45, 16, 256]} />
        <meshStandardMaterial color="#ffdca0" emissive="#ff9e3b" emissiveIntensity={1.2} roughness={0.6} />
      </mesh>
      <mesh ref={jet1} position={[0, 3.2, 0]}>
        <coneGeometry args={[0.35, 4.8, 16]} />
        <meshBasicMaterial color="#9ad4ff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={jet2} position={[0, -3.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.35, 4.8, 16]} />
        <meshBasicMaterial color="#9ad4ff" transparent opacity={0.6} />
      </mesh>
      <group ref={spaghettiGroup} />
    </group>
  );
}

/* ---------- Telemetry (top HUD) ---------- */
function Telemetry({ stage }) {
  const [vals, setVals] = useState({ temp: 233, rad: 0.6, vel: 12.3, dist: 0.02 });
  const targets = useRef({ ...vals });

  useEffect(() => {
    if (stage === 1) targets.current = { temp: 238, rad: 0.7, vel: 14.5, dist: 0.01 };
    else if (stage === 2) targets.current = { temp: 265, rad: 1.8, vel: 1200, dist: 0.0 };
    else if (stage === 3) targets.current = { temp: 540, rad: 8.5, vel: 3200, dist: 0.0 };
  }, [stage]);

  useEffect(() => {
    let raf;
    const tick = () => {
      setVals((v) => {
        const lerp = (a, b, t) => a + (b - a) * t;
        return {
          temp: lerp(v.temp, targets.current.temp, 0.05),
          rad: lerp(v.rad, targets.current.rad, 0.05),
          vel: lerp(v.vel, targets.current.vel, 0.05),
          dist: lerp(v.dist, targets.current.dist, 0.05),
        };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

  return (
    <Html fullscreen>
      <div className="telemetry">
        <div className="row">
          <div className="cell"><label>STAGE</label><span>{stage === 1 ? "CRUISE" : stage === 2 ? "WORMHOLE" : "BLACK HOLE"}</span></div>
          <div className="cell"><label>HULL TEMP</label><span>{fmt(vals.temp, 0)} K</span></div>
          <div className="cell"><label>RADIATION</label><span>{fmt(vals.rad, 1)} mSv/h</span></div>
          <div className="cell"><label>VELOCITY</label><span>{fmt(vals.vel, 1)} km/s</span></div>
          <div className="cell"><label>WAYPOINT</label><span>{fmt(vals.dist, 2)} AU</span></div>
        </div>
      </div>

      <style jsx global>{`
        .telemetry {
          position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
          color: #d9f1ff; font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
          background: linear-gradient(180deg, rgba(5,10,16,0.35), rgba(5,10,16,0.7));
          border: 1px solid rgba(120,160,200,0.35); border-radius: 10px;
          padding: 8px 12px; backdrop-filter: blur(2px); pointer-events: none;
        }
        .telemetry .row { display: flex; gap: 14px; align-items: center; }
        .telemetry .cell label { font-size: 10px; letter-spacing: 1px; opacity: 0.7; display: block; }
        .telemetry .cell span { font-size: 13px; }
      `}</style>
    </Html>
  );
}

/* ---------- Main Scene ---------- */
function SceneInner() {
  const { stage, setStage } = useContext(ChatContext);
  const router = useRouter();
  const { camera } = useThree();

  const [sector, setSector] = useState(1);
  const audio1 = useRef(null);
  const audio2 = useRef(null);
  const audio3 = useRef(null);

  const [showOutText, setShowOutText] = useState(false);
  const bhStartRef = useRef(0);
  const [bhProgress, setBhProgress] = useState(0);

  useEffect(() => {
    audio1.current = new Audio("/audio/stage1.mp3");
    audio2.current = new Audio("/audio/stage2.mp3");
    audio3.current = new Audio("/audio/stage3.mp3");
    if (audio1.current) { audio1.current.loop = true; audio1.current.volume = 0.35; }
    if (audio2.current) audio2.current.volume = 0.7;
    if (audio3.current) audio3.current.volume = 0.6;
    audio1.current?.play().catch(() => {});
    return () => { [audio1.current, audio2.current, audio3.current].forEach(a => a && a.pause()); };
  }, []);

  useEffect(() => {
    if (stage === 1) {
      audio2.current?.pause(); audio3.current?.pause();
      audio1.current?.play().catch(() => {});
      setBhProgress(0);
      camera.position.set(0, 0, 6);
      camera.fov = 62;
      camera.updateProjectionMatrix();
    } else if (stage === 2) {
      audio1.current?.pause(); audio3.current?.pause();
      if (audio2.current) {
        try { audio2.current.currentTime = 0; } catch {}
        audio2.current.play().catch(()=>{});
      }
      const t = setTimeout(() => {
        setSector(s => (s === 1 ? 2 : 1));
        setStage(1);
      }, 45000);
      return () => clearTimeout(t);
    } else if (stage === 3) {
      audio1.current?.pause(); audio2.current?.pause();
      if (audio3.current) {
        try { audio3.current.currentTime = 0; } catch {}
        audio3.current.play().catch(()=>{});
      }
      bhStartRef.current = performance.now();
      const t = setTimeout(() => {
        setShowOutText(true);
        setTimeout(() => { router.push("/"); setShowOutText(false); }, 4500);
      }, 30000);
      return () => clearTimeout(t);
    }
  }, [stage, setStage, router, camera]);

  const group = useRef();
  useFrame(() => {
    if (group.current) {
      group.current.rotation.y = Math.sin(performance.now() / 5000) * 0.03;
      group.current.rotation.x = Math.cos(performance.now() / 6000) * 0.02;
    }
    if (stage === 3) {
      const elapsed = (performance.now() - bhStartRef.current) / 1000;
      const p = Math.min(1, elapsed / 22);
      setBhProgress(p);
      camera.position.z = 6 - p * 1.6;
      camera.fov = 62 + p * 3.5;
      camera.updateProjectionMatrix();
    }
  });

  const galaxyProps = [
    { position: [-40, 12, -240], rotation: [0.05, 1.0, -0.1], radius: 11 },
    { position: [35, -8, -260],  rotation: [-0.1, -0.8, 0.15], radius: 12 },
    { position: [0, 18, -230],   rotation: [0.12, 0.3, -0.05], radius: 10 },
    { position: [-60, -22, -280],rotation: [-0.08, 0.6, 0.12], radius: 13 },
    { position: [58, 6, -250],   rotation: [0.02, -0.9, 0.08], radius: 12 },
  ];

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 8, 6]} intensity={0.75} color="#aaf0ff" />

      <group ref={group}>
        {stage !== 2 && (
          <>
            <Stars radius={150} depth={100} count={sector === 1 ? 7000 : 9000} factor={sector === 1 ? 3.6 : 4.8} saturation={0} fade speed={sector === 1 ? 0.9 : 1.4} />
            {galaxyProps.map((g, i) => (
              <SpiralGalaxy key={i} position={g.position} rotation={g.rotation} radius={g.radius} />
            ))}
          </>
        )}

        {stage === 1 && (
          <>
            <MeteorShower dir={new THREE.Vector3(-1, -0.4, 1)} />
            <MeteorShower dir={new THREE.Vector3(1, -0.3, 0.6)} speedRange={[55, 80]} />
            <RealSatellite position={[12, 2.2, -38]} />
            <Sparkles count={sector === 1 ? 160 : 260} size={sector === 1 ? 2 : 3} speed={1.4} scale={[60, 25, 60]} />
          </>
        )}

        {stage === 2 && (
          // lower geometry detail + fewer sparkles for performance while in wormhole
          <WormholeTunnel active durationSec={45} segments={400} sparkleCount={200} />
        )}
        {stage === 3 && <BlackHole active progress={bhProgress} />}
      </group>

      {/* Transparent cockpit frame (no tint over window) */}
      <Html fullscreen>
        <svg className="cockpit-window" viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden>
          <path d="M2,54 L98,54 98,6 70,2 30,2 2,6 Z" fill="none" stroke="rgba(8,12,18,0.9)" strokeWidth="2" />
          <path d="M6,50 L94,50 94,10 68,6 32,6 6,10 Z" fill="none" stroke="rgba(120,160,200,0.45)" strokeWidth="0.8" />
          <path d="M12,14 L44,10" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
          <path d="M56,9 L88,13" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
          {[8, 20, 80, 92].map((x, i) => <circle key={i} cx={x} cy={8} r={0.6} fill="rgba(160,200,240,0.5)" />)}
          {[8, 20, 80, 92].map((x, i) => <circle key={i + 4} cx={x} cy={52} r={0.6} fill="rgba(160,200,240,0.5)" />)}
        </svg>
      </Html>

      <Telemetry stage={stage} />

      {showOutText && (
        <Html fullscreen>
          <div className="blackout">You are out of the spacetime continuum</div>
        </Html>
      )}

      <Html fullscreen>
        <style jsx global>{`
          .cockpit-window { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
          .blackout {
            position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
            background:black; color:#d7eeff; font-size:26px; letter-spacing:1px;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial;
            animation: fadeIn 1.2s ease forwards;
          }
          @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        `}</style>
      </Html>
    </>
  );
}

// replace default export to allow Canvas dpr adjustment based on stage
export default function StageScene() {
  const { stage } = useContext(ChatContext);
  const clientDpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const dpr = stage === 2 ? 1 : [1, Math.min(clientDpr, 2)];
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 62 }} dpr={dpr} gl={{ antialias: true }}>
      <SceneInner />
    </Canvas>
  );
}
