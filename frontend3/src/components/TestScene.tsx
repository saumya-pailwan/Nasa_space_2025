// src/components/TestScene.tsx
import React, { useRef, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Asteroid2 from "./Asteroid2";
import type { Asteroid2Ref } from "./Asteroid2";
import Missile2 from "./Missile2";

const EARTH_MAP_URL = "https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg";

function Earth({ radius }: { radius: number }) {
  const earthTexture = useLoader(THREE.TextureLoader, EARTH_MAP_URL);
  const groupRef = useRef<THREE.Group>(null!);

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial map={earthTexture} roughness={1} metalness={0} />
      </mesh>
      <mesh scale={radius * 1.02}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color="#4aa3ff"
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export function TestScene() {
  const EARTH_RADIUS = 0.1;
  
  const asteroidRef = useRef<Asteroid2Ref>(null);
  const [asteroidPosition, setAsteroidPosition] = useState<[number, number, number]>([-4, 2, -3]);
  
  // Simulation state
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [launchMissile, setLaunchMissile] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  const [key, setKey] = useState(0);

  // User inputs
  const [thetaDegrees, setThetaDegrees] = useState<number>(10);
  const [missileSpeed, setMissileSpeed] = useState<number>(1.5);
  const [missileSize, setMissileSize] = useState<"small" | "large">("small");

  const handleStart = () => {
    setSimulationStarted(true);
    setOutcome("");
    console.log("\n========== SIMULATION STARTED ==========");
    console.log("Theta:", thetaDegrees, "degrees");
    console.log("Missile Speed:", missileSpeed);
    console.log("Missile Size:", missileSize);
  };

  const handleLaunch = () => {
    setLaunchMissile(true);
    setOutcome("");
    console.log("\n========== LAUNCH ==========");
    console.log("Theta angle:", thetaDegrees, "degrees");
    console.log("Positive = LEFT, Negative = RIGHT");
  };

  const handleReset = () => {
    setSimulationStarted(false);
    setLaunchMissile(false);
    setAsteroidPosition([-4, 2, -3]);
    setOutcome("");
    setKey(prev => prev + 1);
    console.log("Scene reset");
  };

  const handleMissileHit = (hitPos: [number, number, number]) => {
    console.log("Hit callback received at:", hitPos);
    
    if (asteroidRef.current) {
      const angle = Number(thetaDegrees) || 0;
      console.log("Calling asteroid.deflect() with theta:", angle);
      
      const deflectRight = angle < 0;
      const absoluteAngle = Math.abs(angle);
      
      asteroidRef.current.deflect(deflectRight, absoluteAngle);
    } else {
      console.error("Asteroid ref not available!");
    }
  };

  const handleAsteroidPositionUpdate = (pos: [number, number, number]) => {
    setAsteroidPosition(pos);
  };

  // Calculate missile start position on Earth surface
  const getMissileStartPosition = (): [number, number, number] => {
    const angle = Math.PI / 4; // 45 degrees
    const x = EARTH_RADIUS * Math.cos(angle);
    const y = EARTH_RADIUS * Math.sin(angle);
    return [x, y, 0];
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative" }}>
      <Canvas
        camera={{ position: [0, 1.5, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
        <pointLight position={[-5, 3, -5]} intensity={0.5} color="#4488ff" />

        <Earth radius={EARTH_RADIUS} />

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[EARTH_RADIUS * 1.1, EARTH_RADIUS * 1.15, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>

        {simulationStarted && (
          <Asteroid2
            key={`asteroid-${key}`}
            ref={asteroidRef}
            earthRadius={EARTH_RADIUS}
            earthPosition={[0, 0, 0]}
            onPositionUpdate={handleAsteroidPositionUpdate}
            onDeflected={() => {
              console.log("Asteroid deflected successfully");
            }}
            onEarthHit={() => {
              console.log("EARTH HIT - Mission Failed");
              setOutcome("EARTH HIT - Mission Failed");
              setLaunchMissile(false);
            }}
            onEscaped={() => {
              console.log("ESCAPED - Mission Success!");
              setOutcome("ESCAPED - Mission Success!");
              setLaunchMissile(false);
            }}
          />
        )}

        {simulationStarted && launchMissile && (
          <Missile2
            key={`missile-${key}`}
            startPosition={getMissileStartPosition()}
            targetPosition={asteroidPosition}
            speed={missileSpeed}
            size={missileSize}
            onHit={handleMissileHit}
            onMiss={() => {
              console.log("Missile missed");
              setOutcome("MISSED");
              setLaunchMissile(false);
            }}
          />
        )}

        <gridHelper args={[10, 20, "#333", "#111"]} position={[0, -EARTH_RADIUS - 0.01, 0]} />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          minDistance={0.5}
          maxDistance={15}
        />
      </Canvas>

      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(100vh / 7)",
        background: "rgba(12, 12, 12, 0.95)",
        borderTop: "2px solid #333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        zIndex: 1000,
      }}>
        <div style={{
          display: "flex",
          gap: "20px",
          alignItems: "center",
          width: "100%",
          maxWidth: "1200px",
        }}>
          {/* Theta Input */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <label style={{
              color: "#aaa",
              fontSize: "14px",
              fontWeight: "500",
            }}>
              Theta (degrees)
            </label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="number"
                value={thetaDegrees}
                onChange={(e) => setThetaDegrees(Number(e.target.value))}
                disabled={!simulationStarted || launchMissile}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  background: "#1a1a1a",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: "8px",
                  outline: "none",
                }}
                placeholder="Enter angle"
              />
              <button
                onClick={handleLaunch}
                disabled={!simulationStarted || launchMissile}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  background: !simulationStarted || launchMissile ? "#555" : "#00aa00",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: !simulationStarted || launchMissile ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {launchMissile ? "In Flight..." : "Launch"}
              </button>
            </div>
            <div style={{
              fontSize: "12px",
              color: "#888",
            }}>
              Positive = Left | Negative = Right
            </div>
          </div>

          {/* Missile Speed Input */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <label style={{
              color: "#aaa",
              fontSize: "14px",
              fontWeight: "500",
            }}>
              Missile Speed
            </label>
            <input
              type="number"
              value={missileSpeed}
              onChange={(e) => setMissileSpeed(Number(e.target.value))}
              disabled={simulationStarted}
              step="0.1"
              min="0.5"
              max="5"
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
              }}
              placeholder="Speed"
            />
            <div style={{
              fontSize: "12px",
              color: "#888",
            }}>
              Range: 0.5 - 5.0
            </div>
          </div>

          {/* Missile Size Selection */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <label style={{
              color: "#aaa",
              fontSize: "14px",
              fontWeight: "500",
            }}>
              Missile Size
            </label>
            <select
              value={missileSize}
              onChange={(e) => setMissileSize(e.target.value as "small" | "large")}
              disabled={simulationStarted}
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
                cursor: simulationStarted ? "not-allowed" : "pointer",
              }}
            >
              <option value="small">Small</option>
              <option value="large">Large</option>
            </select>
            <div style={{
              fontSize: "12px",
              color: "#888",
            }}>
              Size affects deflection
            </div>
          </div>
        </div>

        {/* Start/Reset Button */}
        <button
          onClick={simulationStarted ? handleReset : handleStart}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: "600",
            background: simulationStarted ? "#aa0000" : "#00aa00",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {simulationStarted ? "Reset" : "Start"}
        </button>

        {/* Outcome Display */}
        {outcome && (
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            padding: "8px 16px",
            background: outcome.includes("Failed") || outcome.includes("HIT") ? "#aa0000" : "#00aa00",
            color: "#fff",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
          }}>
            {outcome}
          </div>
        )}
      </div>
    </div>
  );
}

export default TestScene;