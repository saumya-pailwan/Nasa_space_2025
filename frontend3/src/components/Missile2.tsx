// src/components/Missile2.tsx
import React, { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

type Vec3 = [number, number, number];

interface Missile2Props {
  startPosition: Vec3;
  targetPosition: Vec3;
  speed?: number;
  size?: "small" | "large";
  onHit?: (hitPosition: Vec3) => void;
  onMiss?: () => void;
}

export default function Missile2({
  startPosition,
  targetPosition,
  speed = 1.5,
  size = "small",
  onHit,
  onMiss,
}: Missile2Props) {
  const MISSILE_RADIUS = size === "large" ? 0.03 : 0.02;
  const ASTEROID_RADIUS = 0.03;
  const COLLISION_DISTANCE = MISSILE_RADIUS + ASTEROID_RADIUS + 0.01;
  const BOUNDS = 50;
  const STEERING_STRENGTH = 0.3;

  // Visual scaling based on size
  const SCALE = size === "large" ? 0.7 : 0.5;

  const groupRef = useRef<THREE.Group>(null!);
  const position = useRef(new THREE.Vector3(...startPosition));
  const velocity = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3(...targetPosition));
  
  const [isVisible, setIsVisible] = useState(true);
  const hasCollided = useRef(false);
  const frameCounter = useRef(0);

  useEffect(() => {
    const direction = target.current.clone()
      .sub(position.current)
      .normalize();
    velocity.current.copy(direction.multiplyScalar(speed));
    
    console.log("Missile2 launched from Earth");
    console.log("From:", startPosition);
    console.log("Speed:", speed);
    console.log("Size:", size);
  }, []);

  useFrame((_, delta) => {
    if (!isVisible || hasCollided.current) return;

    frameCounter.current++;
    const dt = Math.min(delta, 1 / 20);

    target.current.set(...targetPosition);

    const toTarget = target.current.clone().sub(position.current);
    const distance = toTarget.length();

    if (frameCounter.current % 60 === 0) {
      console.log("Missile distance to target:", distance.toFixed(3));
    }

    const desiredVelocity = toTarget.normalize().multiplyScalar(speed);
    velocity.current.lerp(desiredVelocity, STEERING_STRENGTH);

    position.current.add(velocity.current.clone().multiplyScalar(dt));

    if (velocity.current.lengthSq() > 0.001) {
      const lookTarget = position.current.clone().add(velocity.current);
      groupRef.current.lookAt(lookTarget);
    }

    groupRef.current.position.copy(position.current);

    if (distance <= COLLISION_DISTANCE && !hasCollided.current) {
      hasCollided.current = true;
      
      console.log("\n=== MISSILE HIT CONFIRMED ===");
      console.log("Frame:", frameCounter.current);
      console.log("Distance:", distance.toFixed(5));
      console.log("Missile size:", size);
      
      const hitPos: Vec3 = [
        position.current.x,
        position.current.y,
        position.current.z,
      ];
      
      onHit?.(hitPos);
      
      setIsVisible(false);
      console.log("Missile hidden after hit\n");
      return;
    }

    const { x, y, z } = position.current;
    if (
      Math.abs(x) > BOUNDS ||
      Math.abs(y) > BOUNDS ||
      Math.abs(z) > BOUNDS
    ) {
      console.log("Missile left bounds");
      setIsVisible(false);
      onMiss?.();
    }
  });

  if (!isVisible) return null;

  return (
    <group ref={groupRef}>
      {/* Missile body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={SCALE}>
        <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
        <meshStandardMaterial
          color="#d0e7ff"
          roughness={0.4}
          metalness={0.1}
          emissive="#4488ff"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, 0.07 * SCALE, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={SCALE}>
        <coneGeometry args={[0.02, 0.05, 12]} />
        <meshStandardMaterial 
          color="#b0c9ff" 
          roughness={0.6}
          emissive="#6699ff"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Exhaust trail */}
      <mesh position={[0, -0.08 * SCALE, 0]} scale={SCALE}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.6} />
      </mesh>

      {/* Side fins */}
      <mesh position={[0.02 * SCALE, -0.02 * SCALE, 0]} rotation={[0, 0, Math.PI / 4]} scale={SCALE}>
        <boxGeometry args={[0.03, 0.005, 0.02]} />
        <meshStandardMaterial color="#9999ff" />
      </mesh>
      <mesh position={[-0.02 * SCALE, -0.02 * SCALE, 0]} rotation={[0, 0, -Math.PI / 4]} scale={SCALE}>
        <boxGeometry args={[0.03, 0.005, 0.02]} />
        <meshStandardMaterial color="#9999ff" />
      </mesh>
    </group>
  );
}