// src/pages/Mission.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MissionScene } from "./../components/MissionScene";
import { BottomPanel } from "./../components/BottomPanel";
import { useSimStore } from "../state/simStore";

export default function Mission() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  // pull store controls
  const rocket     = useSimStore((s) => s.rocket);
  const setRocket  = useSimStore((s) => s.setRocket);
  const startRun   = useSimStore((s) => s.startRun);
  const endRun     = useSimStore((s) => s.endRun);
  const phase      = useSimStore((s) => s.phase);

  return (
    <>
      <MissionScene />

      <BottomPanel open={open} onToggle={() => setOpen((v) => !v)} title="Mission Control">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => navigate("/")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: "#151515", color: "#eaeaea", cursor: "pointer" }}
          >
            ← Back
          </button>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Angle°
            <input
              type="number"
              value={rocket.angleDeg}
              onChange={(e) => setRocket({ angleDeg: Number(e.target.value) })}
              style={{ width: 90, padding: 6, background: "#0d0d0d", color: "#eaeaea", border: "1px solid #333", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Speed
            <input
              type="number"
              value={rocket.speed}
              onChange={(e) => setRocket({ speed: Math.max(0.1, Number(e.target.value)) })}
              style={{ width: 90, padding: 6, background: "#0d0d0d", color: "#eaeaea", border: "1px solid #333", borderRadius: 8 }}
            />
          </label>

          <button
            onClick={() => startRun()}
            disabled={phase === "running"}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: phase === "running" ? "#222" : "#0f6", color: "#000", cursor: phase === "running" ? "not-allowed" : "pointer", fontWeight: 600 }}
            title="Mount a fresh asteroid and launch the rocket"
          >
            {phase === "running" ? "In Flight…" : "Launch"}
          </button>

          {phase === "running" && (
            <button
              onClick={() => endRun()}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: "#444", color: "#eaeaea", cursor: "pointer" }}
            >
              Abort
            </button>
          )}
        </div>
      </BottomPanel>
    </>
  );
}
