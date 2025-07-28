// src/components/StageScene.jsx
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useState, useEffect } from "react";

export default function StageScene({ stage }) {
  // pick URL based on stage
  const textureURL =
    stage === 1
      ? "/textures/space.jpg"
      : stage === 2
      ? "/textures/wormhole.jpg"
      : "/textures/blackhole.jpg";

  const [texture, setTexture] = useState(null);

  useEffect(() => {
    // load on client only
    const loader = new THREE.TextureLoader();
    loader.load(
      textureURL,
      (tex) => setTexture(tex),        // onLoad
      undefined,                       // onProgress
      (err) => console.error("Texture load failed:", err) // onError
    );
  }, [textureURL]);

  // wait until texture is ready
  if (!texture) return null;

  return (
    <Canvas
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
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
