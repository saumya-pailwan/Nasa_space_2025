// import React, { useRef } from "react";
// import { Canvas, useFrame } from "@react-three/fiber";
// import { OrbitControls } from "@react-three/drei";
// import * as THREE from "three";
// import { StarsBackdrop } from "./../components/StarsBackdrop";
// import { Earth } from "./../components/Earth";
// import { Asteroid } from "./../components/Asteroid";
// import { Missile } from "./../components/Missile";
// import { useSimStore } from "./../state/simStore";

// /**
//  * This scene remounts Asteroid & Missile on each startRun()
//  * using `launchNonce`, so both reset to their initial state.
//  */
// export function MissionScene() {
//   const EARTH_SCALE = 0.1;

//   const phase = useSimStore((s) => s.phase);
//   const launchNonce = useSimStore((s) => s.launchNonce);
//   const rocket = useSimStore((s) => s.rocket);

//   const groupRef = useRef<THREE.Group>(null!);
//   const GLOBAL_SPIN = 0.03;

//   useFrame((_s, d) => {
//     if (groupRef.current) groupRef.current.rotation.y += GLOBAL_SPIN * d;
//   });

//   return (
//     <Canvas
//       style={{
//         position: "fixed",
//         inset: 0,
//         width: "100vw",
//         height: "100vh",
//         display: "block",
//         zIndex: 0,
//       }}
//       camera={{ position: [0, 0, 3.2], fov: 45, near: 0.1, far: 1000 }}
//       gl={{ antialias: true, alpha: false }}
//     >
//       <color attach="background" args={["#000000"]} />
//       <ambientLight intensity={0.5} />
//       <directionalLight position={[5, 5, 5]} intensity={1.2} />

//       <group ref={groupRef}>
//         <StarsBackdrop />
//         <group scale={EARTH_SCALE}>
//           <Earth />
//         </group>

//         {/* Remount asteroid on each run */}
//         <Asteroid key={`a-${launchNonce}`} earthRadius={1 * EARTH_SCALE} />

//         {/* Mount missile only while running; it will read params later in step 2 */}
//         {phase === "running" && (
//           <Missile
//             key={`m-${launchNonce}`}
//             start={[-0.8, 0.1, 0]}     // placeholder start (we'll compute from angle later)
//             dir={[1, 0, 0]}           // placeholder heading (we'll compute from angle later)
//             speed={rocket.speed}
//             // we’ll use mass + angle logic in step 2; for now, mass is just stored
//             onExplode={(_where) => {
//               // For step 1, ending the run immediately after an explosion is fine.
//               // You can also end when missile leaves bounds—add that in step 2.
//               useSimStore.getState().endRun();
//             }}
//           />
//         )}
//       </group>

//       <OrbitControls enableDamping dampingFactor={0.08} rotateSpeed={0.6} minDistance={0.3} maxDistance={12} />
//     </Canvas>
//   );
// }



// src/components/MissionScene.tsx
import React, {  useRef } from "react";
import type { PropsWithChildren } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StarsBackdrop } from "./../components/StarsBackdrop";
import { Earth } from "./../components/Earth";
import { Asteroid } from "./../components/Asteroid";
import { Missile } from "./../components/Missile";
import { useSimStore } from "./../state/simStore";

/** Child component that lives inside <Canvas> so useFrame is legal */
function RotatingGroup({ children }: PropsWithChildren) {
  const ref = useRef<THREE.Group>(null!);
  const GLOBAL_SPIN = 0.03;

  useFrame((_s, d) => {
    if (ref.current) ref.current.rotation.y += GLOBAL_SPIN * d;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Mission-only scene. Note there is NO useFrame here anymore.
 * All hooks that need R3F must be in descendants of <Canvas>.
 */
export function MissionScene() {
  const EARTH_SCALE = 0.1;

  const phase = useSimStore((s) => s.phase);
  const launchNonce = useSimStore((s) => s.launchNonce);
  const rocket = useSimStore((s) => s.rocket);

  return (
    <Canvas
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        zIndex: 0,
      }}
      camera={{ position: [0, 0, 3.2], fov: 45, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />

      <RotatingGroup>
        <StarsBackdrop />
        <group scale={EARTH_SCALE}>
          <Earth />
        </group>

        {/* Remount asteroid on each run */}
        <Asteroid key={`a-${launchNonce}`} earthRadius={1 * EARTH_SCALE} />

        {/* Mount missile only while running */}
        {phase === "running" && (
          <Missile
            key={`m-${launchNonce}`}
            start={[-0.8, 0.1, 0]}
            dir={[1, 0, 0]}
            speed={rocket.speed}
            onExplode={(_where) => {
              useSimStore.getState().endRun();
            }}
          />
        )}
      </RotatingGroup>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minDistance={0.3}
        maxDistance={12}
      />
    </Canvas>
  );
}

