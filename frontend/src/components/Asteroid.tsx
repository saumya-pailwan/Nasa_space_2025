// src/components/Asteroid.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Trail, Billboard } from "@react-three/drei";
import { useSimStore } from "./../state/simStore";

type Vec3 = [number, number, number];

type AsteroidProps = {
  earthRadius: number;
  earthPosition?: Vec3;
  paused?: boolean;
  asteroidMassKg?: number; // NEW: allow override from parent
};

export function Asteroid({
  earthRadius,
  earthPosition = [0, 0, 0],
  paused = false,
  asteroidMassKg, // NEW
}: AsteroidProps) {
  const asteroidAlive = useSimStore((s) => s.asteroidAlive);
  const setAsteroidPos = useSimStore((s) => s.setAsteroidPos);
  const destroyAsteroidInStore = useSimStore((s) => s.destroyAsteroid);
  const setAsteroidMassKg = useSimStore((s) => s.setAsteroidMassKg);

  const deflectRotate = useSimStore((s) => s.asteroidDeflectRotate);
  const clearDeflectRotate = useSimStore((s) => s.clearAsteroidDeflectRotate);

  const outcome = useSimStore((s) => s.outcome);
  const setOutcome = useSimStore((s) => s.setOutcome);
  const endRun = useSimStore((s) => s.endRun);

  // CONFIG
  const START_POS: Vec3 = [-6, 3, -5];
  const START_SPEED = 0.9;
  const MU = 0.6;
  const EPS = 0.25;
  const ASTER_RAD = 0.03;
  const SPIN = new THREE.Vector3(0.6, 1.1, 0.4);
  const HIT_TOL = 0.01;
  const BLAST_DURATION = 0.4;
  const ESCAPE_BOUNDS = 60;

  const DEFAULT_MASS_KG = 33; // fallback if no data provided

  const pos = useRef(new THREE.Vector3(...START_POS));
  const vel = useRef(new THREE.Vector3());
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);

  const [hit, setHit] = useState(false);
  const [blastT, setBlastT] = useState(0);
  const [showRock, setShowRock] = useState(true);

  const earthCenter = useMemo(() => new THREE.Vector3(...earthPosition), [earthPosition]);

  // Map user angle to a small yaw; smooth growth with asymptotic cap
  function mapAngleToSmallDeflection(angleDeg: number): number {
    const A50 = 600;   // angle where we reach ~50% of D_MAX
    const D_MAX = 10;  // max yaw we'll ever apply (deg)
    const mag = Math.abs(angleDeg);
    const k = Math.log(2) / A50;
    const yaw = D_MAX * (1 - Math.exp(-k * mag));
    return Math.sign(angleDeg) * yaw;
  }

  // Compute extra yaw needed so straight-line (no gravity) path will miss Earth
  function yawNeededToMissInVacuum(vhat: THREE.Vector3, rVec: THREE.Vector3, Rsafe: number): number {
    const r = rVec.length();
    if (r <= 1e-6) return 0;
    const rhat = rVec.clone().multiplyScalar(1 / r);

    // beta = angle(vhat, rhat). We want beta_final >= asin(Rsafe / r)
    const dot = THREE.MathUtils.clamp(vhat.dot(rhat), -1, 1);
    const beta = Math.acos(dot);
    const s = THREE.MathUtils.clamp(Rsafe / r, 0, 1);
    const betaNeeded = Math.asin(s);

    const margin = THREE.MathUtils.degToRad(0.5); // tiny safety margin
    const extra = betaNeeded + margin - beta;     // if positive, we need at least this much more
    return Math.max(0, extra);
  }

  // NEW: Use provided mass or fallback to default
  useEffect(() => {
    const massToUse = asteroidMassKg ?? DEFAULT_MASS_KG;
    setAsteroidMassKg(massToUse);
  }, [asteroidMassKg, setAsteroidMassKg]);

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

    groupRef.current.position.copy(pos.current);
    setAsteroidPos([pos.current.x, pos.current.y, pos.current.z]);

    if (!asteroidAlive || paused) return;

    // One-shot deflections
    if (deflectRotate !== null) {
      // RAW user angle from Mission Control
      const userAngleDeg = deflectRotate.angleDeg;
    
      // Current geometry
      const rVec = earthCenter.clone().sub(pos.current); // to Earth center
      const vhat = vel.current.clone().normalize();
    
      // Prefer provided axis from missile; fallback to computed
      let axis: THREE.Vector3;
      if (deflectRotate.axis) {
        axis = new THREE.Vector3().fromArray(deflectRotate.axis).normalize();
        if (!isFinite(axis.x) || axis.lengthSq() < 1e-10) axis = new THREE.Vector3(0, 1, 0);
      } else {
        axis = new THREE.Vector3().crossVectors(vhat, rVec).normalize();
        if (!isFinite(axis.x) || axis.lengthSq() < 1e-10) axis = new THREE.Vector3(0, 1, 0);
      }
    
      // Base small yaw from user angle (smooth, monotonic)
      let yawDeg = mapAngleToSmallDeflection(userAngleDeg);
    
      // NEW: angle > 10° guarantees a miss (in vacuum) with extra safety margin
      const CUTOFF_DEG = 10;
      if (Math.abs(userAngleDeg) >= CUTOFF_DEG) {
        const Rsafe = earthRadius + ASTER_RAD + HIT_TOL; // slightly safer than surface
        const extraRad = yawNeededToMissInVacuum(vhat, rVec, Rsafe);
        const extraDeg = THREE.MathUtils.radToDeg(extraRad);
    
        // add 6° extra cushion to counter gravity curving it back
        const cushionDeg = 6;
        const yawAbs = Math.max(Math.abs(yawDeg), extraDeg + cushionDeg);
        yawDeg = Math.sign(userAngleDeg || 1) * yawAbs;
      }
    
      // Apply rotation once
      vel.current.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, THREE.MathUtils.degToRad(yawDeg)));
    
      clearDeflectRotate();
    }

    if (!hit) {
      // gravity pull
      const rVec = new THREE.Vector3().copy(earthCenter).sub(pos.current);
      const r = Math.max(rVec.length(), 1e-5);
      const accel = rVec.normalize().multiplyScalar(MU / (r * r + EPS));

      vel.current.addScaledVector(accel, delta);
      pos.current.addScaledVector(vel.current, delta);

      // spin
      if (meshRef.current) {
        meshRef.current.rotation.x += SPIN.x * delta;
        meshRef.current.rotation.y += SPIN.y * delta;
        meshRef.current.rotation.z += SPIN.z * delta;
      }

      // Earth impact?
      const surface = earthRadius + ASTER_RAD;
      if (r <= surface + HIT_TOL) {
        const centerToAsteroid = new THREE.Vector3().copy(pos.current).sub(earthCenter);
        const impactPoint = new THREE.Vector3()
          .copy(earthCenter)
          .add(centerToAsteroid.normalize().multiplyScalar(earthRadius));

        pos.current.copy(impactPoint);
        vel.current.set(0, 0, 0);

        setShowRock(false);
        setHit(true);
        setBlastT(0);
        destroyAsteroidInStore();

        if (outcome === "pending") {
          console.log("YES: asteroid hit the Earth");
          setOutcome("earth_hit");
          endRun();
        }
      } else if (outcome === "pending") {
        // Escape check
        const { x, y, z } = pos.current;
        if (Math.abs(x) > ESCAPE_BOUNDS || Math.abs(y) > ESCAPE_BOUNDS || Math.abs(z) > ESCAPE_BOUNDS) {
          console.log("NO: asteroid did not hit the Earth");
          setOutcome("escaped");
          endRun();
        }
      }
    } else {
      setBlastT((t) => Math.min(t + delta, BLAST_DURATION));
    }

    groupRef.current.position.copy(pos.current);
    setAsteroidPos([pos.current.x, pos.current.y, pos.current.z]);
  });

  const blastProgress = Math.min(blastT / BLAST_DURATION, 1);
  const blastScale = THREE.MathUtils.lerp(ASTER_RAD * 1.2, earthRadius * 0.25, blastProgress);
  const blastOpacity = 1 - blastProgress;

  return (
    <group ref={groupRef}>
      {showRock && (
        <Trail width={0.06} color={"white"} attenuation={(t) => Math.max(1.0 - t, 0)} length={20} decay={0.8}>
          <mesh ref={meshRef} castShadow>
            <icosahedronGeometry args={[ASTER_RAD, 1]} />
            <meshStandardMaterial color="#9e9c93" roughness={0.95} metalness={0.05} flatShading />
          </mesh>
        </Trail>
      )}

      {hit && blastOpacity > 0 && (
        <>
          <Billboard>
            <mesh scale={blastScale * 0.6}>
              <circleGeometry args={[1, 32]} />
              <meshBasicMaterial color={"#ffd54a"} transparent opacity={0.85 * blastOpacity} />
            </mesh>
          </Billboard>
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