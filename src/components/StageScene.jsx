import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatContext } from "@/context/ChatContext";
import { useRouter } from "next/router";

/* -------------------- Spiral Galaxies (smaller, farther, scattered) -------------------- */
function SpiralGalaxy({
  arms = 3,
  count = 700,
  radius = 12,
  colorA = "#bcdcff",
  colorB = "#ffffff",
  position = [0, 0, -180],
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
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={size} vertexColors depthWrite={false} transparent opacity={0.95} />
    </points>
  );
}

/* -------------------- Meteor Showers (two belts crossing) -------------------- */
function MeteorShower({ count = 24, dir = new THREE.Vector3(-1, -0.4, 1), speedRange = [60, 90], area = [140, 70, 160] }) {
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
        vel: dir.clone().normalize().multiplyScalar(THREE.MathUtils.randFloat(speedRange[0], speedRange[1])),
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
      if (s.life <= 0 || Math.abs(m.position.x) > 200 || Math.abs(m.position.y) > 120 || Math.abs(m.position.z) > 200) {
        s.pos.set(
          THREE.MathUtils.randFloatSpread(area[0]),
          THREE.MathUtils.randFloat(area[1] * 0.25, area[1] * 0.48),
          -THREE.MathUtils.randFloat(area[2] * 0.4, area[2] * 0.9)
        );
        m.position.copy(s.pos);
        s.vel.copy(dir).normalize().multiplyScalar(THREE.MathUtils.randFloat(speedRange[0], speedRange[1]));
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

/* -------------------- A more realistic satellite -------------------- */
function RealSatellite({ position = [10, 2.5, -35], scale = 1.15 }) {
  return (
    <Float speed={0.7} rotationIntensity={0.35} floatIntensity={0.8}>
      <group position={position} scale={scale}>
        {/* Bus */}
        <mesh>
          <boxGeometry args={[1.8, 1.2, 1.2]} />
          <meshStandardMaterial color="#b7c2cc" metalness={0.75} roughness={0.35} />
        </mesh>
        {/* Solar arrays */}
        <mesh position={[-2.2, 0, 0]}>
          <boxGeometry args={[0.08, 3.2, 1.2]} />
          <meshStandardMaterial color="#204080" metalness={0.4} roughness={0.25} emissive="#1b2e6b" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[2.2, 0, 0]}>
          <boxGeometry args={[0.08, 3.2, 1.2]} />
          <meshStandardMaterial color="#204080" metalness={0.4} roughness={0.25} emissive="#1b2e6b" emissiveIntensity={0.5} />
        </mesh>
        {/* High-gain dish */}
        <mesh position={[0, -0.7, 0.95]} rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.7, 0.55, 28]} />
          <meshStandardMaterial color="#e2e9f1" metalness={0.6} roughness={0.25} />
        </mesh>
        {/* Boom */}
        <mesh position={[0, 0.85, -0.9]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 10]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </Float>
  );
}

/* -------------------- Wormhole -------------------- */
function Wormhole({ active }) {
  const group = useRef();
  const core = useRef();
  const rings = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 80; i++) {
      const noise = (Math.sin(i * 0.37) + Math.cos(i * 0.22)) * 0.35;
      arr.push({ z: -i * 1.5, r: 5.2 + noise, rot: Math.random() * Math.PI * 2 });
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (!active || !group.current || !core.current) return;
    group.current.children.forEach((m) => {
      m.position.z += 24 * dt;
      m.rotation.z += dt * 1.6;
      if (m.position.z > 2) m.position.z = -110;
    });
    core.current.material.opacity = 0.65 + Math.sin(performance.now() / 400) * 0.1;
  });
  return (
    <group>
      <group ref={group}>
        {rings.map((r, i) => (
          <mesh key={i} position={[0, 0, r.z]} rotation={[0, 0, r.rot]}>
            <torusGeometry args={[r.r, 0.09, 12, 96]} />
            <meshBasicMaterial color={i % 3 ? "#38f0ff" : "#66c5ff"} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <mesh ref={core} position={[0, 0, -2]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial color="#baf2ff" transparent opacity={0.7} />
      </mesh>
      <Sparkles count={900} size={2} scale={[40, 40, 140]} speed={2.3} color="#bff6ff" />
    </group>
  );
}

/* -------------------- Black hole with approach growth -------------------- */
function BlackHole({ active, progress }) {
  const hole = useRef();
  const ring = useRef();
  const disk1 = useRef();
  const disk2 = useRef();
  const jet1 = useRef();
  const jet2 = useRef();

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
  });

  return (
    <group position={[0, 0, -22 + progress * 10]} scale={1 + progress * 1.6}>
      {/* event horizon */}
      <mesh ref={hole}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <meshStandardMaterial color="#000000" metalness={1} roughness={1} />
      </mesh>

      {/* photon ring */}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.15, 0.14, 32, 256]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
      </mesh>

      {/* accretion disk layers */}
      <mesh ref={disk1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.5, 0.6, 16, 256]} />
        <meshStandardMaterial color="#ffb24a" emissive="#ff7b00" emissiveIntensity={1.8} roughness={0.5} />
      </mesh>
      <mesh ref={disk2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8.2, 0.45, 16, 256]} />
        <meshStandardMaterial color="#ffdca0" emissive="#ff9e3b" emissiveIntensity={1.2} roughness={0.6} />
      </mesh>

      {/* jets */}
      <mesh ref={jet1} position={[0, 3.2, 0]}>
        <coneGeometry args={[0.35, 4.8, 16]} />
        <meshBasicMaterial color="#9ad4ff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={jet2} position={[0, -3.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.35, 4.8, 16]} />
        <meshBasicMaterial color="#9ad4ff" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* -------------------- Main Scene -------------------- */
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

  // Audio setup
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

  // Stage transitions and timers
  useEffect(() => {
    if (stage === 1) {
      audio2.current?.pause();
      audio3.current?.pause();
      if (audio1.current) { audio1.current.loop = true; audio1.current.play().catch(() => {}); }
      setBhProgress(0);
      camera.position.set(0, 0, 6);
      camera.fov = 62;
      camera.updateProjectionMatrix();
    } else if (stage === 2) {
      audio1.current?.pause(); audio3.current?.pause();
      if (audio2.current) { audio2.current.currentTime = 0; audio2.current.play().catch(() => {}); }
      const t = setTimeout(() => {
        setSector(s => (s === 1 ? 2 : 1));
        setStage(1);
      }, 30000);
      return () => clearTimeout(t);
    } else if (stage === 3) {
      audio1.current?.pause(); audio2.current?.pause();
      if (audio3.current) { audio3.current.currentTime = 0; audio3.current.play().catch(() => {}); }
      bhStartRef.current = performance.now();
      const t = setTimeout(() => {
        setShowOutText(true);
        setTimeout(() => { router.push("/"); setShowOutText(false); }, 4500);
      }, 30000);
      return () => clearTimeout(t);
    }
  }, [stage, setStage, router, camera]);

  // Camera drift and black-hole approach easing
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

  // Galaxy positions
  const galaxyProps = [
    { position: [-40, 12, -200], rotation: [0.05, 1.0, -0.1], radius: 11 },
    { position: [35, -8, -220],  rotation: [-0.1, -0.8, 0.15], radius: 12 },
    { position: [0, 18, -190],   rotation: [0.12, 0.3, -0.05], radius: 10 },
    { position: [-60, -22, -240],rotation: [-0.08, 0.6, 0.12], radius: 13 },
    { position: [58, 6, -210],   rotation: [0.02, -0.9, 0.08], radius: 12 },
  ];

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 8, 6]} intensity={0.75} color="#aaf0ff" />

      {/* Universe */}
      <group ref={group}>
        <Stars
          radius={150}
          depth={100}
          count={sector === 1 ? 7000 : 9000}
          factor={sector === 1 ? 3.6 : 4.8}
          saturation={0}
          fade
          speed={sector === 1 ? 0.9 : 1.4}
        />

        {galaxyProps.map((g, i) => (
          <SpiralGalaxy key={i} position={g.position} rotation={g.rotation} radius={g.radius} />
        ))}

        {stage === 1 && (
          <>
            <MeteorShower dir={new THREE.Vector3(-1, -0.4, 1)} />
            <MeteorShower dir={new THREE.Vector3(1, -0.3, 0.6)} speedRange={[55, 80]} />
            <RealSatellite position={[12, 2.2, -38]} />
            <Sparkles count={sector === 1 ? 160 : 260} size={sector === 1 ? 2 : 3} speed={1.4} scale={[60, 25, 60]} />
          </>
        )}

        {stage === 2 && <Wormhole active />}
        {stage === 3 && <BlackHole active progress={bhProgress} />}
      </group>

      {/* COCKPIT WINDOW + CONTROLS (transparent inner cutout) */}
      <Html fullscreen>
        <div className="cockpit-ui" aria-hidden>
          {/* Compound path: outer bezel minus inner window via evenodd */}
          <svg className="bezel" viewBox="0 0 100 56" preserveAspectRatio="none">
            <path
              d="
                M0,0 H100 V56 H0 Z
                M6,50 L94,50 V10 L68,6 H32 L6,10 Z
              "
              fill="rgba(8,12,18,0.95)"
              fillRule="evenodd"
            />
            <path
              d="M6,50 L94,50 V10 L68,6 H32 L6,10 Z"
              fill="none"
              stroke="rgba(110,200,255,0.35)"
              strokeWidth="0.8"
            />
            <path d="M14,15 L46,11" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <path d="M58,10 L88,14" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
          </svg>

          {/* Bottom console */}
          <div className="panel bottom">
            <div className="display grid">
              <div className="tile"><span className="label">VEL</span><span className="value">0.73c</span></div>
              <div className="tile"><span className="label">RANGE</span><span className="value">2.8 AU</span></div>
              <div className="tile"><span className="label">FUEL</span><span className="value">78%</span></div>
              <div className="tile"><span className="label">TEMP</span><span className="value">271K</span></div>
              <div className="tile"><span className="label">SHIELD</span><span className="value ok">OK</span></div>
              <div className="tile"><span className="label">COMMS</span><span className="value ok">LINK</span></div>
            </div>
            <div className="display strip">
              <div className="bar"><div className="fill" style={{width:"62%"}} /></div>
              <div className="bar"><div className="fill" style={{width:"41%"}} /></div>
              <div className="bar"><div className="fill" style={{width:"85%"}} /></div>
            </div>
          </div>

          {/* Left throttle stack */}
          <div className="panel left">
            <div className="module glass">
              <div className="ticks">
                {Array.from({length:10}).map((_,i)=>(<i key={i}/>))}
              </div>
              <div className="lever"/>
              <div className="readout">THRUST</div>
            </div>
            <div className="module mini">
              <div className="mini-led on"/> NAV
            </div>
            <div className="module mini">
              <div className="mini-led"/> AUX
            </div>
          </div>

          {/* Right radar + joystick */}
          <div className="panel right">
            <div className="radar">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" className="r1"/>
                <circle cx="50" cy="50" r="32" className="r2"/>
                <circle cx="50" cy="50" r="16" className="r3"/>
                <line x1="50" y1="50" x2="98" y2="50" className="sweep"/>
              </svg>
            </div>
            <div className="stick">
              <div className="base"/>
              <div className="shaft"/>
              <div className="grip"/>
            </div>
          </div>
        </div>

        <style jsx global>{`
          .cockpit-ui{position:absolute;inset:0;pointer-events:none;z-index:4}
          .bezel{position:absolute;inset:0;width:100%;height:100%}

          .panel{position:absolute;pointer-events:none}
          .panel.bottom{
            left:6%; right:6%; bottom:2.6%;
            display:flex; gap:12px; align-items:flex-end; justify-content:space-between;
          }
          .panel.left{left:1.6%; bottom:10%; display:flex; flex-direction:column; gap:10px}
          .panel.right{right:1.6%; bottom:8%; display:flex; align-items:flex-end; gap:14px}

          .display{
            pointer-events:auto;
            background:linear-gradient(180deg,rgba(10,18,28,.62),rgba(10,18,28,.38));
            border:1px solid rgba(120,220,255,.22);
            border-radius:12px;
            box-shadow:0 0 22px rgba(60,160,255,.12) inset, 0 0 18px rgba(30,120,180,.08);
            color:#bfe9ff; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            text-shadow:0 0 8px rgba(80,200,255,.25);
          }
          .display.grid{
            flex:1; min-height:62px; padding:8px 10px;
            display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px;
            background-image:repeating-linear-gradient(transparent 0 12px, rgba(130,220,255,.06) 12px 13px);
          }
          .tile{background:rgba(14,26,38,.5); border:1px solid rgba(120,220,255,.18); border-radius:8px; padding:6px 8px}
          .label{font-size:10px; opacity:.75}
          .value{display:block; font-size:13px; margin-top:2px}
          .value.ok{color:#9ff59f; text-shadow:0 0 8px rgba(80,255,120,.25)}

          .display.strip{width:260px; padding:10px; display:flex; flex-direction:column; gap:8px}
          .bar{height:8px; background:rgba(14,26,38,.55); border:1px solid rgba(120,220,255,.18); border-radius:999px; overflow:hidden}
          .fill{height:100%; background:linear-gradient(90deg,#79e0ff,#39b8ff)}

          .module.glass{
            width:120px; height:130px; position:relative;
            background:linear-gradient(180deg,rgba(10,18,28,.62),rgba(10,18,28,.38));
            border:1px solid rgba(120,220,255,.22); border-radius:12px;
            box-shadow:0 0 18px rgba(30,120,180,.1) inset;
          }
          .ticks{position:absolute; left:16px; right:16px; top:16px; bottom:36px; display:flex; flex-direction:column; justify-content:space-between}
          .ticks i{display:block; height:1px; background:rgba(140,220,255,.35)}
          .lever{
            position:absolute; left:50%; transform:translateX(-50%); bottom:38px;
            width:10px; height:64px; background:linear-gradient(180deg,#2a3a4a,#1a2632);
            border:1px solid rgba(200,230,255,.2); border-radius:6px;
            box-shadow:0 0 10px rgba(80,150,220,.25);
          }
          .readout{position:absolute; bottom:6px; width:100%; text-align:center; color:#bfe9ff; font:11px ui-monospace}
          .module.mini{
            display:flex; align-items:center; gap:6px; color:#bfe9ff;
            background:linear-gradient(180deg,rgba(10,18,28,.62),rgba(10,18,28,.38));
            border:1px solid rgba(120,220,255,.22); border-radius:10px; padding:6px 10px; font:11px ui-monospace;
          }
          .mini-led{width:8px; height:8px; border-radius:50%; background:#345}
          .mini-led.on{background:#64ff91; box-shadow:0 0 10px #64ff91aa}

          .radar{
            width:150px; height:150px; background:radial-gradient(ellipse at center, rgba(10,18,28,.62), rgba(10,18,28,.38));
            border:1px solid rgba(120,220,255,.22); border-radius:16px; padding:6px;
            box-shadow:0 0 18px rgba(30,120,180,.1) inset;
          }
          .radar svg{width:100%; height:100%}
          .radar .r1,.radar .r2,.radar .r3{fill:none; stroke:rgba(120,220,255,.23); stroke-width:.8}
          .radar .sweep{stroke:rgba(120,220,255,.45); stroke-width:1.2; transform-origin:50px 50px; animation:sweep 3.6s linear infinite}
          @keyframes sweep{to{transform:rotate(360deg)}}

          .stick{position:relative; width:110px; height:120px}
          .stick .base{position:absolute; bottom:0; left:10px; right:10px; height:16px; background:#1b2632; border:1px solid #2b3a4a; border-radius:10px}
          .stick .shaft{position:absolute; bottom:16px; left:50%; transform:translateX(-50%); width:12px; height:70px; background:#243243; border:1px solid #3a4b5e; border-radius:8px}
          .stick .grip{position:absolute; bottom:82px; left:50%; transform:translateX(-50%); width:48px; height:26px; background:#28394b; border:1px solid #45617a; border-radius:14px}

          .blackout{
            position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
            background:black;color:#d7eeff;font-size:26px;letter-spacing:1px;
            font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,"Helvetica Neue",Arial;
            animation:fadeIn 1.2s ease forwards;
          }
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        `}</style>
      </Html>

      {/* Exit text */}
      {showOutText && (
        <Html fullscreen>
          <div className="blackout">You are out of the spacetime continuum</div>
        </Html>
      )}
    </>
  );
}

export default function StageScene() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 62 }} gl={{ antialias: true }}>
      <SceneInner />
    </Canvas>
  );
}
