import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Trail, Billboard } from "@react-three/drei";
import { useSimStore } from "./../state/simStore";

type Vec3 = [number, number, number];

type AsteroidProps = {
  earthRadius: number;
  earthPosition?: Vec3;
};

export function Asteroid({ earthRadius, earthPosition = [0, 0, 0] }: AsteroidProps) {
   const asteroidAlive = useSimStore((s) => s.asteroidAlive);
   const setAsteroidPos = useSimStore((s) => s.setAsteroidPos);
   const destroyAsteroidInStore = useSimStore((s) => s.destroyAsteroid);
  // ----- CONFIG -----
  const START_POS: Vec3 = [-6, 3, -5];
  const START_SPEED = 0.9;
  const MU = 0.6;
  const EPS = 0.25;
  const ASTEROID_RADIUS = 0.03;
  const SPIN = new THREE.Vector3(0.6, 1.1, 0.4);
  const HIT_TOL = 0.01;           // cushion to avoid stopping shy
  const BLAST_DURATION = 0.4;     // seconds
  // -------------------

  const pos = useRef(new THREE.Vector3(...START_POS));
  const vel = useRef(new THREE.Vector3());
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const [hit, setHit] = useState(false);
  const [blastT, setBlastT] = useState(0);     // [0..BLAST_DURATION]
  const [showRock, setShowRock] = useState(true);

  const earthCenter = useMemo(() => new THREE.Vector3(...earthPosition), [earthPosition]);

  // initial velocity aimed at Earth
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

    if (!asteroidAlive) {
              setShowRock(false);
              setAsteroidPos([pos.current.x, pos.current.y, pos.current.z]);
              groupRef.current.position.copy(pos.current);
              return;
            }
  

    if (!hit) {
      // vector from asteroid to Earth center
      const rVec = new THREE.Vector3().copy(earthCenter).sub(pos.current);
      const r = Math.max(rVec.length(), 1e-5);

      // softened inverse-square gravity
      const accel = rVec.normalize().multiplyScalar(MU / (r * r + EPS));

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
      if (r <= surface + HIT_TOL) {
        // >>> NEAR-SIDE PROJECTION <<<
        // center -> asteroid vector:
        const centerToAsteroid = new THREE.Vector3().copy(pos.current).sub(earthCenter);
        // clamp to surface on the *incoming* side:
        const impactPoint = new THREE.Vector3()
          .copy(earthCenter)
          .add(centerToAsteroid.normalize().multiplyScalar(earthRadius));

        pos.current.copy(impactPoint);   // move to surface point
        vel.current.set(0, 0, 0);        // stop motion

        setShowRock(false);              // hide asteroid immediately
        setHit(true);                    // trigger blast
        setBlastT(0);    
        destroyAsteroidInStore(); // reflect in store                // reset blast timer
      }
    } else {
      // run blast timer
      setBlastT((t) => Math.min(t + delta, BLAST_DURATION));
    }

    // keep group positioned at current asteroid/blast location
    groupRef.current.position.copy(pos.current);
    setAsteroidPos([pos.current.x, pos.current.y, pos.current.z]);
  });

  // blast visuals (billboarded ring + glow), driven by blastT
  const blastProgress = Math.min(blastT / BLAST_DURATION, 1);
  const blastScale = THREE.MathUtils.lerp(ASTEROID_RADIUS * 1.2, earthRadius * 0.25, blastProgress);
  const blastOpacity = 1 - blastProgress; // fade out

  return (
    <group ref={groupRef}>
      {/* asteroid + trail (hidden after impact) */}
      {showRock && (
        <Trail width={0.06} color={"white"} attenuation={(t) => Math.max(1.0 - t, 0)} length={20} decay={0.8}>
          <mesh ref={meshRef} castShadow>
            <icosahedronGeometry args={[ASTEROID_RADIUS, 1]} />
            <meshStandardMaterial color="#9e9c93" roughness={0.95} metalness={0.05} flatShading />
          </mesh>
        </Trail>
      )}

      {/* impact blast: quick yellow flash + expanding ring (billboarded) */}
      {hit && blastOpacity > 0 && (
        <>
          {/* core flash */}
          <Billboard>
            <mesh scale={blastScale * 0.6}>
              <circleGeometry args={[1, 32]} />
              <meshBasicMaterial color={"#ffd54a"} transparent opacity={0.85 * blastOpacity} />
            </mesh>
          </Billboard>

          {/* ring */}
          <Billboard>
            <mesh scale={blastScale}>
              <ringGeometry args={[0.7, 1.0, 64]} />
              <meshBasicMaterial color={"#ffaa00"} transparent opacity={0.7 * blastOpacity} side={THREE.DoubleSide} />
            </mesh>
          </Billboard>
        </>
      )}
    </group>
  );
}
