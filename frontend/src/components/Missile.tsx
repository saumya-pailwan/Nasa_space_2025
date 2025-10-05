// src/components/Missile.tsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
 import { useSimStore } from "./../state/simStore";

type Vec3 = [number, number, number];

type MissileProps = {
  start: Vec3;
  /** missile collision radius */
  radius?: number;
  /** asteroid visual/collision radius */
  asteroidRadius?: number;
  /** auto-terminate if the missile leaves a big box (scene units) */
  bounds?: number;
  /** optional visual/sound hook */
  onExplode?: (where: Vec3) => void;
};

/** Small helper to clamp dt to avoid tunneling on slow frames */
function clampDt(dt: number, max = 1 / 20) {
  return Math.min(dt, max);
}

export function Missile({
  start,
  radius = 0.02,
  asteroidRadius = 0.03,
  bounds = 50,
  onExplode,
}: MissileProps) {
  // ====== GLOBAL SIM STATE ======
  const rocket = useSimStore((s: any) => s.rocket); // { speed, angleDeg }
  const asteroidPosArr = useSimStore((s: any) => s.asteroidPos) as Vec3;
  const asteroidAlive = useSimStore((s: any) => s.asteroidAlive) as boolean;
  const asteroidMassKg = useSimStore((s: any) => s.asteroidMassKg) as number | undefined;
  const destroyAsteroid = useSimStore((s: any) => s.destroyAsteroid) as (() => void) | undefined;

  // Deflection request for heavy case
  const setAsteroidDeflectRotate = useSimStore(
    (s: any) => s.setAsteroidDeflectRotate
  ) as ((v: { angleDeg: number; axis?: Vec3 } | null) => void) | undefined;

  // ====== LOCAL STATE ======
  const missileRef = useRef<THREE.Group>(null!);
  const pos = useRef<THREE.Vector3>(new THREE.Vector3(...start));
  const vel = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const [visible, setVisible] = useState(true);

  // Initialize position on mount
  useEffect(() => {
    pos.current.set(start[0], start[1], start[2]);
    vel.current.set(0, 0, 0);
    if (missileRef.current) {
      missileRef.current.position.copy(pos.current);
      missileRef.current.visible = true;
    }
    setVisible(true);
  }, [start[0], start[1], start[2]]);

  useFrame((_, rawDt) => {
    if (!visible) return;
    const dt = clampDt(rawDt);

    // If asteroid is gone and this is the "light" aftermath, continue straight using last velocity
    const target = new THREE.Vector3(...asteroidPosArr);
    const toTarget = target.clone().sub(pos.current);
    const distance = toTarget.length();

    // Simple guidance: steer toward asteroid while it's alive
    const seekDir = toTarget.normalize();
    const speed = Math.max(0.1, Number(rocket?.speed ?? 1)); // guard
    // First-order steering — blend current vel toward seekDir * speed
    const desired = seekDir.multiplyScalar(speed);
    vel.current.lerp(desired, 0.2); // smooth turn

    // Integrate
    pos.current.addScaledVector(vel.current, dt);

    // Orient missile to its velocity
    if (vel.current.lengthSq() > 1e-5) {
      const lookAt = pos.current.clone().add(vel.current);
      missileRef.current.lookAt(lookAt);
    }
    missileRef.current.position.copy(pos.current);

    // ===== Bounds fail-safe =====
    const { x, y, z } = pos.current;
    if (Math.abs(x) > bounds || Math.abs(y) > bounds || Math.abs(z) > bounds) {
      setVisible(false);
      if (missileRef.current) missileRef.current.visible = false;
      return;
    }

    // ===== Collision with asteroid (only if asteroid is alive) =====
    if (asteroidAlive) {
      const hitDist = (radius ?? 0.02) + (asteroidRadius ?? 0.03);
      if (distance <= hitDist) {
        // Impact point for FX
        const impact: Vec3 = [pos.current.x, pos.current.y, pos.current.z];

        // const mass = Number(asteroidMassKg ?? 0);
        const mass = 4500;
        const approachDir = toTarget.lengthSq() > 0 ? toTarget.clone().normalize() : vel.current.clone().normalize();

        if (mass > 3000) {
          // ===== HEAVY: Rocket disappears. Asteroid deviates if angleDeg != 0, otherwise continues straight toward Earth. =====
          setVisible(false);
          if (missileRef.current) missileRef.current.visible = false;

          // Build a lateral rotation axis ⟂ to approach direction for asteroid to rotate about
          const up = new THREE.Vector3(0, 1, 0);
          let axis = new THREE.Vector3().crossVectors(approachDir, up);
          if (axis.lengthSq() > 1e-8) axis.set(1, 0, 0);
          else axis.normalize();

          const angleDeg = Number(rocket?.angleDeg ?? 0);
          if (Math.abs(angleDeg) > 0.001) {
            // Any non-zero angle => request asteroid deviation.
            setAsteroidDeflectRotate &&
              setAsteroidDeflectRotate({
                angleDeg,
                axis: [axis.x, axis.y, axis.z],
              });
          } else {
            // Zero angle => do nothing; asteroid continues on its current trajectory.
          }

          // Optional FX hook
          onExplode?.(impact);
          return;
        } else {
            setVisible(false);
          // ===== LIGHT: Asteroid disappears; rocket continues. =====
          destroyAsteroid && destroyAsteroid();
          // Optional FX hook
          onExplode?.(impact);
          // IMPORTANT: do NOT hide rocket or end the run. Let it keep flying.
          return;
        }
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={missileRef}>
      {/* simple missile shape aligned with +Z after lookAt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
        <meshStandardMaterial color={"#d0e7ff"} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.02, 0.05, 12]} />
        <meshStandardMaterial color={"#b0c9ff"} roughness={0.6} />
      </mesh>
    </group>
  );
}

export default Missile;
