import { Canvas, useLoader } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export default function StageScene({ stage }) {
  const textureURL =
    stage === 1
      ? "/textures/space.jpg"
      : stage === 2
      ? "/textures/wormhole.jpg"
      : "/textures/blackhole.jpg";
  const texture = useLoader(THREE.TextureLoader, textureURL);

  return (
    <Canvas
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}
      camera={{ position: [0, 0, 5] }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Stars />
      <mesh>
        <sphereGeometry args={[50, 32, 32]} />
        <meshBasicMaterial side={THREE.BackSide} map={texture} />
      </mesh>
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
