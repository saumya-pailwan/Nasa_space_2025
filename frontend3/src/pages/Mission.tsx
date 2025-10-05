import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomPanel } from "./../components/BottomPanel";
import { MissionScene } from "./../components/MissionScene";
import { PlayOverlay } from "./../components/PlayOverlay";
import { useSimStore } from "./../state/simStore";

export default function Mission() {
  const navigate = useNavigate();

  // store bindings
  const rocket = useSimStore((s) => s.rocket);
  const setRocket = useSimStore((s) => s.setRocket);
  const phase = useSimStore((s) => s.phase);
  const startRun = useSimStore((s) => s.startRun);
  const resetToIdle = useSimStore((s) => s.resetToIdle);

  const [open, setOpen] = useState(true);

  const isRunning = phase === "running";
  const canPlay = phase !== "running";

  return (
    <>
      {/* The 3D scene for Mission (reads launchNonce internally) */}
      <MissionScene />

      {/* Centered PLAY button when not running */}
      <PlayOverlay
        visible={canPlay}
        onPlay={() => {
          // simple validation / clamping
          const massKg = Math.max(1, rocket.massKg);
          const speed = Math.max(0.1, rocket.speed);
          const angleDeg = Math.max(-180, Math.min(180, rocket.angleDeg));
          setRocket({ massKg, speed, angleDeg });

          startRun(); // kicks off a fresh run (remounts asteroid/missile via launchNonce)
        }}
        label={phase === "done" ? "PLAY AGAIN" : "PLAY"}
      />

      {/* Bottom control panel */}
      <BottomPanel
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title="Mission Control"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {/* Mass (kg) */}
          <div>
            <label style={labelStyle}>Rocket Mass (kg)</label>
            <input
              type="number"
              value={rocket.massKg}
              min={1}
              step={50}
              onChange={(e) => setRocket({ massKg: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>

          {/* Velocity */}
          <div>
            <label style={labelStyle}>Rocket Speed</label>
            <input
              type="number"
              value={rocket.speed}
              min={0.1}
              step={0.1}
              onChange={(e) => setRocket({ speed: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>

          {/* Angle (deg) */}
          <div>
            <label style={labelStyle}>Angle (deg)</label>
            <input
              type="number"
              value={rocket.angleDeg}
              min={-180}
              max={180}
              step={1}
              onChange={(e) => setRocket({ angleDeg: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/")} style={btnStyle}>← Home</button>
          <button onClick={() => resetToIdle()} style={btnStyle} disabled={phase === "idle"}>
            Reset to Idle
          </button>
        </div>

        <p style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
          Tip: Press PLAY to start a new run with the current parameters. When the run ends, the PLAY button reappears.
        </p>
      </BottomPanel>
    </>
  );
}

const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 12, opacity: 0.75 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#151515",
  color: "#eaeaea",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#151515",
  color: "#eaeaea",
  cursor: "pointer",
};
