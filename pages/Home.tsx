import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scene } from "../components/Scene";
import { BottomPanel } from "../components/BottomPanel";

export default function Home() {
  const [open, setOpen] = useState(true); // panel open by default (change if you prefer)
  const navigate = useNavigate();

  return (
    <>
      <Scene />
      <BottomPanel open={open} onToggle={() => setOpen((v) => !v)} title="Simulation Panel">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/impact")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#151515",
              color: "#eaeaea",
              cursor: "pointer",
            }}
          >
            Go to Mission Screen
          </button>
        </div>
      </BottomPanel>
    </>
  );
}
