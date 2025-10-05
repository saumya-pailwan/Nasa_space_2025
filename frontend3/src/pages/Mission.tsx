// src/pages/Mission.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MissionScene } from "./../components/MissionScene";
import { BottomPanel } from "./../components/BottomPanel";
import { useSimStore } from "../state/simStore";

export default function Mission() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  // pull store controls (keep existing hit/miss logic intact)
  const rocket     = useSimStore((s) => s.rocket);
  const setRocket  = useSimStore((s) => s.setRocket);
  const startRun   = useSimStore((s) => s.startRun);
  const endRun     = useSimStore((s) => s.endRun);
  const phase      = useSimStore((s) => s.phase);

  // ---- Slider ranges / defaults
  const SIM_MIN = 0.25, SIM_MAX = 2.0, SIM_STEP = 0.05;
  const MASS_MIN = 100, MASS_MAX = 2000, MASS_STEP = 1;        // kg
  const VEL_MIN = 0.5, VEL_MAX = 10, VEL_STEP = 0.001;         // km/s
  const DENS_MIN = 300, DENS_MAX = 8000, DENS_STEP = 1;        // kg/m^3
  const ANG_MIN = 0, ANG_MAX = 90, ANG_STEP = 0.1;             // degrees

  // ---- Local UI state for the 5 inputs (we only write speed/angle to the store)
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [mass, setMass] = useState(579.4);     // DART mass default
  const [velocity, setVelocity] = useState(5.858);
  const [density, setDensity] = useState(3500);
  const [angle, setAngle] = useState(rocket.angleDeg ?? 45);

  // Track whether each slider has been touched at least once
  const [touched, setTouched] = useState({
    sim: false,
    mass: false,
    vel: false,
    dens: false,
    ang: false,
  });

  const inputsComplete = useMemo(
    () => touched.sim && touched.mass && touched.vel && touched.dens && touched.ang,
    [touched]
  );

  // ---- Helpers
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const invLerp = (a: number, b: number, v: number) => (v - a) / (b - a);

  // When MASS changes, linearly map mass -> velocity (monotonic increase)
  const handleMass = (m: number) => {
    setMass(m);
    setTouched((t) => ({ ...t, mass: true }));
    const t = invLerp(MASS_MIN, MASS_MAX, m);
    const vFromMass = lerp(VEL_MIN, VEL_MAX, t);
    setVelocity(vFromMass);
    // velocity increase should reduce density (inverse map)
    const tVel = invLerp(VEL_MIN, VEL_MAX, vFromMass);
    const densFromVel = lerp(DENS_MAX, DENS_MIN, tVel);
    setDensity(densFromVel);
    // keep existing sim logic: only update store fields that already exist
    setRocket({ speed: Math.max(0.1, vFromMass), angleDeg: angle });
  };

  // When VELOCITY changes, set speed in store and adjust density inversely
  const handleVelocity = (v: number) => {
    setVelocity(v);
    setTouched((t) => ({ ...t, vel: true }));
    const tVel = invLerp(VEL_MIN, VEL_MAX, v);
    const densFromVel = lerp(DENS_MAX, DENS_MIN, tVel);
    setDensity(densFromVel);
    setRocket({ speed: Math.max(0.1, v), angleDeg: angle });
  };

  // Density is still user-adjustable, but velocity↑ will always nudge it down via the rule above
  const handleDensity = (d: number) => {
    setDensity(d);
    setTouched((t) => ({ ...t, dens: true }));
  };

  const handleAngle = (a: number) => {
    setAngle(a);
    setTouched((t) => ({ ...t, ang: true }));
    setRocket({ angleDeg: a, speed: Math.max(0.1, velocity) });
  };

  const handleSimSpeed = (s: number) => {
    setSimSpeed(s);
    setTouched((t) => ({ ...t, sim: true }));
    // If your engine supports it, you could store sim speed via a setSimSpeed action here.
  };

  const canLaunch = inputsComplete && phase !== "running";

  return (
    <>
      <MissionScene />

      <BottomPanel open={open} onToggle={() => setOpen((v) => !v)} title="Mission Control">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => navigate("/missile-chooser")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#151515",
              color: "#eaeaea",
              cursor: "pointer"
            }}
          >
            ← Back
          </button>

          {/* Simulation Speed */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Simulation Speed
              <span style={{ opacity: 0.8 }}>{simSpeed.toFixed(2)}×</span>
            </label>
            <input
              type="range"
              min={SIM_MIN}
              max={SIM_MAX}
              step={SIM_STEP}
              value={simSpeed}
              onChange={(e) => handleSimSpeed(Number(e.target.value))}
              style={{ width: 220 }}
            />
          </div>

          {/* Mass */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Mass
              <span style={{ opacity: 0.8 }}>{mass.toFixed(1)} kg</span>
            </label>
            <input
              type="range"
              min={MASS_MIN}
              max={MASS_MAX}
              step={MASS_STEP}
              value={mass}
              onChange={(e) => handleMass(Number(e.target.value))}
              style={{ width: 220 }}
            />
          </div>

          {/* Density */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Density
              <span style={{ opacity: 0.8 }}>{density.toFixed(0)} kg/m³</span>
            </label>
            <input
              type="range"
              min={DENS_MIN}
              max={DENS_MAX}
              step={DENS_STEP}
              value={density}
              onChange={(e) => handleDensity(Number(e.target.value))}
              style={{ width: 220 }}
            />
          </div>

          {/* Velocity */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Velocity
              <span style={{ opacity: 0.8 }}>{velocity.toFixed(3)} km/s</span>
            </label>
            <input
              type="range"
              min={VEL_MIN}
              max={VEL_MAX}
              step={VEL_STEP}
              value={velocity}
              onChange={(e) => handleVelocity(Number(e.target.value))}
              style={{ width: 220 }}
            />
          </div>

          {/* Angle */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Angle°
              <span style={{ opacity: 0.8 }}>{angle.toFixed(1)}°</span>
            </label>
            <input
              type="range"
              min={ANG_MIN}
              max={ANG_MAX}
              step={ANG_STEP}
              value={angle}
              onChange={(e) => handleAngle(Number(e.target.value))}
              style={{ width: 220 }}
            />
          </div>

          {/* Controls */}
          <button
            onClick={() => canLaunch && startRun()}
            disabled={!canLaunch}
            title={
              inputsComplete
                ? "Mount a fresh asteroid and launch the rocket"
                : "Please set all sliders before launching"
            }
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: canLaunch ? "#0f6" : "#222",
              color: canLaunch ? "#000" : "#999",
              cursor: canLaunch ? "pointer" : "not-allowed",
              fontWeight: 600
            }}
          >
            {phase === "running" ? "In Flight…" : "Launch"}
          </button>

          {phase === "running" && (
            <button
              onClick={() => endRun()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "#444",
                color: "#eaeaea",
                cursor: "pointer"
              }}
            >
              Abort
            </button>
          )}
        </div>

        {!inputsComplete && (
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Animation paused — set all sliders to enable launch.
          </p>
        )}
      </BottomPanel>
    </>
  );
}
