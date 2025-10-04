import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";

type Vec3 = [number, number, number];

type AsteroidProps = {
  /** Visual Earth radius in scene units (must match how big your Earth looks) */
  earthRadius: number;
  /** Earth position (leave [0,0,0] unless you moved Earth) */
  earthPosition?: Vec3;
};

/**
 * Simple, stable asteroid:
 * - Starts at a corner, flies toward Earth with softened inverse-square "gravity"
 * - Child of the same top-level rotating group, so it rotates with space
 * - Stops on impact and shows a brief glow
 * - Frame-rate independent (delta-based)
 */
export function Asteroid({ earthRadius, earthPosition = [0, 0, 0] }: AsteroidProps) {
  // ----- CONFIG (edit numbers to tune motion/appearance) -----
  const START_POS: Vec3 = [-6, 3, -5];   // spawn corner
  const START_SPEED = 0.9;               // units / second
  const MU = 0.6;                        // pseudo-gravity strength
  const EPS = 0.25;                      // softening to avoid spikes near center
  const ASTEROID_RADIUS = 0.03;          // visual size
  const SPIN = new THREE.Vector3(0.6, 1.1, 0.4); // tumbling spin (rad/s)
  // -----------------------------------------------------------

  // position / velocity as refs to avoid re-renders
  const pos = useRef(new THREE.Vector3(...START_POS));
  const vel = useRef(new THREE.Vector3()); // <-- hold a Vector3, not a function

  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const [hit, setHit] = useState(false);
  const [impactTicker, setImpactTicker] = useState(0); // for a quick glow

  const earthCenter = useMemo(() => new THREE.Vector3(...earthPosition), [earthPosition]);

  // Initialize velocity once based on initial direction to Earth
  useEffect(() => {
    const toEarth = new THREE.Vector3()
      .fromArray(earthPosition)
      .sub(pos.current)
      .normalize()
      .multiplyScalar(START_SPEED);
    vel.current.copy(toEarth);
  }, [earthPosition]);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    if (!hit) {
      // basic inverse-square gravity toward Earth's center (softened)
      const rVec = new THREE.Vector3().copy(earthCenter).sub(pos.current);
      const r = Math.max(rVec.length(), 1e-5);
      const accelMag = MU / (r * r + EPS);
      const accel = rVec.normalize().multiplyScalar(accelMag);

      // integrate
      vel.current.addScaledVector(accel, delta);
      pos.current.addScaledVector(vel.current, delta);

      // spin the rock
      if (meshRef.current) {
        meshRef.current.rotation.x += SPIN.x * delta;
        meshRef.current.rotation.y += SPIN.y * delta;
        meshRef.current.rotation.z += SPIN.z * delta;
      }

      // impact check
      const surface = earthRadius + ASTEROID_RADIUS;
      if (r <= surface) {
        // clamp to surface point and stop
        const hitDir = new THREE.Vector3().copy(rVec).normalize().multiplyScalar(earthRadius);
        pos.current.copy(earthCenter).add(hitDir);
        vel.current.set(0, 0, 0);
        setHit(true);
      }
    } else {
      // brief impact glow timer
      setImpactTicker((t) => Math.min(t + delta, 0.35));
    }

    // apply position to group
    groupRef.current.position.copy(pos.current);
  });

  // simple rocky look using flat-shaded icosahedron
  return (
    <group ref={groupRef}>
      {/* Trail that follows the asteroid */}
      <Trail
        width={0.06}
        color={"white"}
        attenuation={(t) => Math.max(1.0 - t, 0)}
        length={20}
        decay={0.8}
      >
        <mesh ref={meshRef} castShadow>
          <icosahedronGeometry args={[ASTEROID_RADIUS, 1]} />
          <meshStandardMaterial color="#9e9c93" roughness={0.95} metalness={0.05} flatShading />
        </mesh>
      </Trail>

      {/* quick impact glow */}
      {hit && (
        <mesh>
          <sphereGeometry
            args={[ASTEROID_RADIUS * (1 + 2.5 * (1 - impactTicker / 0.35)), 16, 16]}
          />
          <meshBasicMaterial
            color={"orange"}
            transparent
            opacity={0.6 * (1 - impactTicker / 0.35)}
          />
        </mesh>
      )}
    </group>
  );
}
