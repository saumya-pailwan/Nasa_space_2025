import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";

/**
 * Minimal, production-safe Earth:
 * - color (albedo) texture
 * - gentle self-rotation
 * - simple "atmosphere" shell (BackSide, transparent) for a subtle glow
 *
 * You can swap the texture URL later with a higher-res Blue Marble.
 */
const EARTH_MAP_URL =
  "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg"; // placeholder diffuse

export function Earth() {
  const groupRef = useRef<THREE.Group>(null!);
  const colorMap = useLoader(THREE.TextureLoader, EARTH_MAP_URL);

  // slow axial rotation
  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1; // ~6 deg/sec
    }
  });

  return (
    <group ref={groupRef} scale={0.4}>
      {/* main sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={colorMap}
          roughness={1}
          metalness={0}
          toneMapped={true}
        />
      </mesh>

      {/* super-simple atmosphere shell */}
      <mesh scale={1.02}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color={"#4aa3ff"}
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
