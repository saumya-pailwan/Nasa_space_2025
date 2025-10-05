// src/components/Asteroid2.tsx
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

type Vec3 = [number, number, number];

interface Asteroid2Props {
  earthRadius: number;
  earthPosition?: Vec3;
  
  paused?: boolean;
  onDeflected?: () => void;
  onEarthHit?: () => void;
  onEscaped?: () => void;
  onPositionUpdate?: (pos: Vec3) => void;
}

export interface Asteroid2Ref {
  deflect: (deflectRight?: boolean, customAngle?: number) => void;
  getPosition: () => Vec3;
}
const SURFACE_EPS = 1e-4;

const Asteroid2 = forwardRef<Asteroid2Ref, Asteroid2Props>(({
  earthRadius,
  earthPosition = [0, 0, 0],
  paused = false,
  onDeflected,
  onEarthHit,
  onEscaped,
  onPositionUpdate,
}, ref) => {
  // Physical constants
  const START_POS: Vec3 = [-4, 2, -3];
  const START_SPEED = 0.7;
  const GRAVITY = 0.4;
  const GRAVITY_SOFTENING = 0.25;
  const ASTEROID_RADIUS = 0.03;
  const HIT_TOLERANCE = 0.01;
  const ESCAPE_BOUNDS = 60;
  
  const DEFLECTION_ANGLE = 25; // Increased for guaranteed miss
  const SPEED_BOOST_MULTIPLIER = 2.2; // Stronger boost
  const POST_DEFLECT_GRAVITY_FACTOR = 0.05; // Almost no gravity after deflection

  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const position = useRef(new THREE.Vector3(...START_POS));
  const velocity = useRef(new THREE.Vector3());
  const earthCenter = useRef(new THREE.Vector3(...earthPosition));
  
  const [isAlive, setIsAlive] = useState(true);
  const [hasHitEarth, setHasHitEarth] = useState(false);
  const [isDeflected, setIsDeflected] = useState(false);
  const [flashIntensity, setFlashIntensity] = useState(0);
  
  const skipCollisionFrames = useRef(0);

  useEffect(() => {
    const direction = earthCenter.current.clone()
      .sub(position.current)
      .normalize();
    velocity.current.copy(direction.multiplyScalar(START_SPEED));
    
    console.log("Asteroid2 initialized at:", START_POS);
    console.log("Initial velocity:", velocity.current.toArray());
  }, []);

  const deflect = (deflectRight: boolean = true, customAngle?: number) => {
    if (isDeflected) {
      console.log("Already deflected");
      return;
    }

    // Use custom angle if provided, otherwise use default
    const angleToUse = customAngle !== undefined ? customAngle : DEFLECTION_ANGLE;

    console.log("\n=== DEFLECTION START ===");
    console.log("Position:", position.current.toArray().map(v => v.toFixed(3)));
    console.log("Deflection angle:", angleToUse, "degrees");
    console.log("Direction:", deflectRight ? "RIGHT" : "LEFT");
    
    const currentSpeed = velocity.current.length();
    const currentDirection = velocity.current.clone().normalize();
    
    // Create perpendicular rotation axis
    const worldUp = new THREE.Vector3(0, 1, 0);
    let rotationAxis = new THREE.Vector3().crossVectors(currentDirection, worldUp);
    
    if (rotationAxis.lengthSq() < 0.01) {
      rotationAxis.set(1, 0, 0);
    }
    rotationAxis.normalize();
    
    // Apply rotation
    const angleInRadians = THREE.MathUtils.degToRad(
      angleToUse * (deflectRight ? 1 : -1)
    );
    
    const rotationMatrix = new THREE.Matrix4().makeRotationAxis(
      rotationAxis,
      angleInRadians
    );
    const newDirection = currentDirection.applyMatrix4(rotationMatrix).normalize();
    
    // Strong speed boost
    const newSpeed = currentSpeed * SPEED_BOOST_MULTIPLIER;
    velocity.current.copy(newDirection.multiplyScalar(newSpeed));
    
    setIsDeflected(true);
    setFlashIntensity(1.0);
    skipCollisionFrames.current = 60; // Skip more frames
    
    console.log("Old velocity:", currentDirection.toArray().map(v => v.toFixed(3)));
    console.log("New velocity:", velocity.current.toArray().map(v => v.toFixed(3)));
    console.log("Speed: ", currentSpeed.toFixed(3), "->", newSpeed.toFixed(3));
    console.log("=== DEFLECTION COMPLETE ===\n");
    
    onDeflected?.();
  };

  const getPosition = (): Vec3 => {
    return [position.current.x, position.current.y, position.current.z];
  };

  useImperativeHandle(ref, () => ({
    deflect,
    getPosition
  }));

  useFrame((_, delta) => {
    if (!isAlive || paused || hasHitEarth) return;

    const dt = Math.min(delta, 1 / 20);

    const toEarth = earthCenter.current.clone().sub(position.current);
    const distanceToEarth = toEarth.length();
    
    // Apply gravity (minimal after deflection)
    if (!isDeflected) {
      const gravityAccel = toEarth.normalize().multiplyScalar(
        GRAVITY / (distanceToEarth * distanceToEarth + GRAVITY_SOFTENING)
      );
      velocity.current.add(gravityAccel.multiplyScalar(dt));
    } else {
      // Almost no gravity after deflection
      const gravityAccel = toEarth.normalize().multiplyScalar(
        POST_DEFLECT_GRAVITY_FACTOR * GRAVITY / (distanceToEarth * distanceToEarth + GRAVITY_SOFTENING)
      );
      velocity.current.add(gravityAccel.multiplyScalar(dt));
    }
    
    // Update position
    position.current.add(velocity.current.clone().multiplyScalar(dt));
    
    if (groupRef.current) {
      groupRef.current.position.copy(position.current);
    }
    
    // Notify position update for missile tracking
    if (onPositionUpdate) {
      onPositionUpdate([position.current.x, position.current.y, position.current.z]);
    }
    
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.6 * dt;
      meshRef.current.rotation.y += 1.1 * dt;
      meshRef.current.rotation.z += 0.4 * dt;
    }
    
    if (flashIntensity > 0) {
      setFlashIntensity(prev => Math.max(0, prev - dt * 2.5));
    }
    
    
    // Always check Earth collision (before or after deflection)
// If touching, clamp to the surface and hide immediately
{
  const surfaceRadius = earthRadius + ASTEROID_RADIUS;
  if (distanceToEarth <= surfaceRadius + HIT_TOLERANCE) {
    // Snap to the surface, nudged slightly outward
    const outward = position.current.clone().sub(earthCenter.current);
    const safeDir = outward.lengthSq() > 0 ? outward.normalize() : new THREE.Vector3(1, 0, 0);
    position.current.copy(
      earthCenter.current.clone().add(safeDir.multiplyScalar(surfaceRadius + SURFACE_EPS))
    );

    // Reflect the snapped position in the scene
    if (groupRef.current) {
      groupRef.current.position.copy(position.current);
      groupRef.current.visible = false; // hide asteroid immediately
    }
    if (meshRef.current) {
      meshRef.current.visible = false;  // extra safety: hide mesh
    }

    console.log("EARTH HIT! Distance:", distanceToEarth.toFixed(3));
    setHasHitEarth(true);
    setIsAlive(false);
    velocity.current.set(0, 0, 0);
    onEarthHit?.();
    return;
  }
}

// (Optional) keep skipCollisionFrames logic for other effects
if (skipCollisionFrames.current > 0) {
  skipCollisionFrames.current--;
}

    
    // Check escape
    const { x, y, z } = position.current;
    if (
      Math.abs(x) > ESCAPE_BOUNDS ||
      Math.abs(y) > ESCAPE_BOUNDS ||
      Math.abs(z) > ESCAPE_BOUNDS
    ) {
      console.log("ESCAPED! Position:", [x, y, z].map(v => v.toFixed(2)));
      console.log("Deflected:", isDeflected);
      setIsAlive(false);
      onEscaped?.();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <icosahedronGeometry args={[ASTEROID_RADIUS, 1]} />
        <meshStandardMaterial
          color={isDeflected ? "#9e9c93" : "#9e9c93"}
          roughness={0.95}
          metalness={0.05}
          flatShading
          emissive={isDeflected ? "#00ff44" : "#000000"}
          emissiveIntensity={flashIntensity * 0.8}
        />
      </mesh>

      {flashIntensity > 0 && (
        <mesh>
          <sphereGeometry args={[ASTEROID_RADIUS * 3, 16, 16]} />
          <meshBasicMaterial
            color="#00ffaa"
            transparent
            opacity={flashIntensity * 0.5}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Trail effect */}
      {isAlive && (
        <mesh position={[0, 0, -ASTEROID_RADIUS * 2]}>
          <sphereGeometry args={[ASTEROID_RADIUS * 0.5, 8, 8]} />
          <meshBasicMaterial
            color={isDeflected ? "#00ff88" : "#ffffff"}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
});

Asteroid2.displayName = 'Asteroid2';

export default Asteroid2;