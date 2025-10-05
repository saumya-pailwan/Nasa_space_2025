import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";


import CesiumMap from "./components/CesiumMap";
import BottomImpactBar, { type ImpactMetrics } from "./components/BottomImpactBar";
import { useImpactSimulation } from "./hooks/useImpactSimulation";

export default function MapScreen() {
  const { boot, dispose, activeSection, setActiveSection } = useImpactSimulation();
  const [info, setInfo] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<ImpactMetrics | null>(null);

  const navigate = useNavigate();

  return (
    <>
      <CesiumMap
    setInfo={setInfo}
    setImpactData={setImpactData}
    boot={boot}
    dispose={dispose}
  />

  {/* BottomImpactBar already has className="impactBar" in CSS above */}
  <BottomImpactBar
    data={impactData}
    active={activeSection}
    onChange={setActiveSection}
  />

  {/* NEW: top-right (actually bottom-right above the bar) mission button */}
  {createPortal(
  <button
    type="button"
    onClick={() => navigate("/missile-chooser")}
    aria-label="Go to Mission"
    style={{
      position: "fixed",
      right: 12,
      bottom: 35,               // or use top: 12 if you want it at the top
      zIndex: 100000,             // guaranteed above Cesium + anything else
      padding: "10px 14px",
      marginBottom: '100px', // slightly more padding bottom for better touch
      borderRadius: 12,
      border: "1px solid #333",
      background: "rgba(20,20,20,0.95)",
      color: "#fff",
      cursor: "pointer",
      

    }}
  >
    Go to Mission →
  </button>,
  document.body
)}

  {info && <div className="mission__info">{info}</div>}
    </>
  );
}
