import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useSimStore } from "./../state/simStore";

type MissileProps = {
  /** World-space launch position */
  start: [number, number, number];
  /** Initial aim (used only at launch to initialize heading) */
  dir: [number, number, number];
  /** Units per second */
  speed?: number;
  /** Missile collision radius */
  radius?: number;
  /** Asteroid visual radius (must match asteroid’s) */
  asteroidRadius?: number;
  /** Max turn rate (radians/sec) for homing */
  turnRate?: number;
  /** Called once on collision */
  onExplode?: (where: [number, number, number]) => void;
};

export function Missile({
  start,
  dir,
  speed = 2.0,
  radius = 0.02,
  asteroidRadius = 0.03,
  turnRate = THREE.MathUtils.degToRad(120), // how sharply we can turn
  onExplode,
}: MissileProps) {
  const missileRef = useRef<THREE.Group>(null!);
  const pos = useRef(new THREE.Vector3(...start));
  const heading = useRef(new THREE.Vector3(...dir).normalize()); // mutable aim

  const asteroidPosArr = useSimStore((s) => s.asteroidPos);
  const asteroidAlive = useSimStore((s) => s.asteroidAlive);
  const destroyAsteroid = useSimStore((s) => s.destroyAsteroid);

  const [alive, setAlive] = useState(true);

  // Re-init when props.start changes
  useEffect(() => {
    pos.current.set(start[0], start[1], start[2]);
  }, [start[0], start[1], start[2]]);

  // Re-init heading when dir changes
  useEffect(() => {
    heading.current.set(dir[0], dir[1], dir[2]).normalize();
  }, [dir[0], dir[1], dir[2]]);

  useFrame((_state, delta) => {
    if (!missileRef.current) return;

    if (alive) {
      // === GUIDANCE ALGORITHM — PURE PURSUIT (easy & effective) ===
      // Feel free to replace the block below with your own algorithm.
      if (asteroidAlive) {
        const aPos = new THREE.Vector3(...asteroidPosArr); // current asteroid position
        const toTarget = aPos.clone().sub(pos.current);
        const dist = toTarget.length();

        if (dist > 1e-6) {
          const desired = toTarget.normalize();

          // Limit how fast we can turn toward the desired direction:
          // compute the angle between current heading and desired, clamp by turnRate*delta
          const angle = Math.acos(THREE.MathUtils.clamp(heading.current.dot(desired), -1, 1));
          if (angle > 1e-5) {
            const t = Math.min(1, (turnRate * delta) / angle); // fraction of the angle we can close this frame
            heading.current.lerp(desired, t).normalize();
          }
        }
      }
      // === END GUIDANCE BLOCK ===

      // advance missile forward along its heading
      pos.current.addScaledVector(heading.current, speed * delta);

      // collision with asteroid (sphere–sphere)
      if (asteroidAlive) {
        const aPos = new THREE.Vector3(...asteroidPosArr);
        const dist = pos.current.distanceTo(aPos);
        if (dist <= (radius + asteroidRadius)) {
          setAlive(false);
          destroyAsteroid();
          onExplode?.([pos.current.x, pos.current.y, pos.current.z]);
        }
      }
    }

    // update world transform
    missileRef.current.position.copy(pos.current);

    // orient the missile mesh to face its heading
    const lookAt = pos.current.clone().add(heading.current);
    missileRef.current.lookAt(lookAt);
  });

  return (
    <group ref={missileRef} visible={alive}>
      {/* simple missile shape aligned with local +Z after lookAt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
        <meshStandardMaterial color="#d0e7ff" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.02, 0.05, 12]} />
        <meshStandardMaterial color="#b0c9ff" roughness={0.6} />
      </mesh>
    </group>
  );
}
