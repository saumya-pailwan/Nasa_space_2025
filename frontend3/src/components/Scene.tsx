import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Earth } from "./Earth";
import { StarsBackdrop } from "./StarsBackdrop";
import { Asteroid } from "./Asteroid";

/**
 * We wrap Earth + Stars in ONE top-level THREE.Group.
 * We rotate that group so BOTH Earth and the starfield move together.
 * (Earth still has its own axial spin inside its component.)
 */
function RotatingGroup() {
  const groupRef = useRef<THREE.Group>(null!);

  // Global rotation speed (radians/sec). Tweak as you like.
  const GLOBAL_SPIN = 0.03;

  const EARTH_SCALE = 0.2;

  useFrame((_state, delta) => {
    groupRef.current.rotation.y += GLOBAL_SPIN * delta;
  });

  return (
    <group ref={groupRef}>
      <StarsBackdrop />

      {/* Keep Earth centered; scale wrapper to control apparent size globally */}
      <group scale={EARTH_SCALE}>
        <Earth />
      </group>

      {/* Asteroid uses earthRadius to know when to "hit" and stop */}
      <Asteroid earthRadius={1 * EARTH_SCALE} />
    </group>
  );
}


export function Scene() {
    return (
      <Canvas
        // 🔒 Force the canvas to fill the whole viewport (no parent wrapper needed)
        style={{
          position: "fixed",
          inset: 0,              // top/right/bottom/left = 0
          width: "100vw",
          height: "100vh",
          display: "block",
        }}
        camera={{ position: [0, 0, 3.2], fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}   // solid background
      >
        {/* Pure black scene background */}
        <color attach="background" args={["#000000"]} />
  
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
  
        <RotatingGroup />
  
        

        {/* Mouse/touch controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minDistance={2.5}
        maxDistance={12}
      />


      </Canvas>
    );
  }