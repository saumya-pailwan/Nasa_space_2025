import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scene } from "../components/Scene";
import { BottomPanel } from "../components/BottomPanel";

export default function Home() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  // --- Controls state (defaults you can tweak)
  const [simSpeed, setSimSpeed] = useState(1.0);   // ×
  const [sizeKm, setSizeKm] = useState(0.30);      // km (asteroid size)
  const [velocity, setVelocity] = useState(5.858); // km/s
  const [angle, setAngle] = useState(45);          // degrees

  // --- Ranges/steps
  const SIM_MIN = 0.25, SIM_MAX = 2.0, SIM_STEP = 0.05;
  const SIZE_MIN = 0.01, SIZE_MAX = 50, SIZE_STEP = 0.01;     // km
  const VEL_MIN = 0.1, VEL_MAX = 70, VEL_STEP = 0.001;        // km/s
  const ANG_MIN = 0, ANG_MAX = 90, ANG_STEP = 0.1;            // degrees

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  return (
    <>
      <Scene />

      <BottomPanel open={open} onToggle={() => setOpen((v) => !v)} title="Simulation Panel">
        <div style={{ 
          position: "fixed",
          bottom: -10,
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
          gap: 45,
      }}>
          {/* Control group helper style */}
          {/* Each control: label row, slider, number input */}
          <div style={{ display: "grid", gap: 6, width: 240 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Simulation Speed</span>
            </label>
            <input
              type="range"
              min={SIM_MIN}
              max={SIM_MAX}
              step={SIM_STEP}
              value={simSpeed}
              onChange={(e) => setSimSpeed(Number(e.target.value))}
            />
            <input
              type="number"
              min={SIM_MIN}
              max={SIM_MAX}
              step={SIM_STEP}
              value={simSpeed}
              onChange={(e) => setSimSpeed(clamp(Number(e.target.value || 0), SIM_MIN, SIM_MAX))}
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, width: 240 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Asteroid Size (km)</span>
            </label>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={SIZE_STEP}
              value={sizeKm}
              onChange={(e) => setSizeKm(Number(e.target.value))}
            />
            <input
              type="number"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={SIZE_STEP}
              value={sizeKm}
              onChange={(e) => setSizeKm(clamp(Number(e.target.value || 0), SIZE_MIN, SIZE_MAX))}
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, width: 240 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Velocity (km/hr)</span>
            </label>
            <input
              type="range"
              min={VEL_MIN}
              max={VEL_MAX}
              step={VEL_STEP}
              value={velocity}
              onChange={(e) => setVelocity(Number(e.target.value))}
            />
            <input
              type="number"
              min={VEL_MIN}
              max={VEL_MAX}
              step={VEL_STEP}
              value={velocity}
              onChange={(e) => setVelocity(clamp(Number(e.target.value || 0), VEL_MIN, VEL_MAX))}
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, width: 240 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Impact Angle (degrees)</span>
            </label>
            <input
              type="range"
              min={ANG_MIN}
              max={ANG_MAX}
              step={ANG_STEP}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
            <input
              type="number"
              min={ANG_MIN}
              max={ANG_MAX}
              step={ANG_STEP}
              value={angle}
              onChange={(e) => setAngle(clamp(Number(e.target.value || 0), ANG_MIN, ANG_MAX))}
              style={{
                padding: "12px",
                fontSize: "16px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          {/* Go to Mission */}
          <button
            onClick={() => navigate("/impact")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#151515",
              color: "#eaeaea",
              cursor: "pointer",
              height: 40
            }}
          >
            Go to Mission Screen
          </button>
        </div>
      </BottomPanel>
    </>
  );
}
