import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ImpactSection } from "../hooks/useImpactSimulation";

export type ImpactMetrics = {
  lon: number; lat: number; impactTime: number;
  craterDiameterM: number; craterDepthM: number;
  quakeMagnitudeMw: number; tsunamiHeightM: number; tsunamiIndex: number;
};

type Props = {
  data: ImpactMetrics | null;
  active?: ImpactSection;
  defaultActive?: ImpactSection;
  onChange?: (next: ImpactSection) => void;
};

export default function BottomImpactBar({
  data, active, defaultActive = "impact", onChange,
}: Props) {
  const controlled = typeof active !== "undefined";
  const [internalActive, setInternalActive] = useState<ImpactSection>(defaultActive);
  const current = controlled ? (active as ImpactSection) : internalActive;

  const select = (next: ImpactSection) => {
    if (!controlled) setInternalActive(next);
    onChange?.(next);
  };

  const { impactDepth, impactDiameter, quakeMw, waveHeight, waveMag } = useMemo(() => ({
    impactDepth: data ? Math.round(data.craterDepthM).toLocaleString() : "—",
    impactDiameter: data ? Math.round(data.craterDiameterM).toLocaleString() : "—",
    quakeMw: data ? data.quakeMagnitudeMw.toFixed(1) : "—",
    waveHeight: data ? Math.round(data.tsunamiHeightM).toString() : "—",
    waveMag: data ? data.tsunamiIndex.toFixed(1) : "—",
  }), [data]);

  const commonBtnStyle: React.CSSProperties = {
    flex: 1,                 // <-- make each button take equal width
    minWidth: 0,             // allow shrinking without overflow
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #333",
    background: "rgba(20,20,20,0.9)",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
    outline: "none",
  };

  const bar = (
    <div
      role="toolbar"
      aria-label="Impact details"
      style={{
        position: "fixed",
        left: 0,
        right: 0,                 // <-- full width
        bottom: 0,
        zIndex: 10000,
        display: "flex",
        gap: 12,
        padding: "10px 12px",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))", // mobile safe area
        background: "transparent", // keep map visible behind gaps
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={() => select("impact")}
        className={`impactBar__btn ${current === "impact" ? "is-selected" : ""}`}
        style={{
          ...commonBtnStyle,
          borderColor: current === "impact" ? "#666" : "#333",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.8 }}>Impact</div>
        <div style={{ display: "flex", gap: 10, fontSize: 20 }}>
          <div><strong>Depth:</strong> {impactDepth} m</div>
          <div><strong>Diameter:</strong> {impactDiameter} m</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => select("earthquake")}
        className={`impactBar__btn ${current === "earthquake" ? "is-selected" : ""}`}
        style={{
          ...commonBtnStyle,
          borderColor: current === "earthquake" ? "#666" : "#333",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.8 }}>Earthquake</div>
        <div style={{ display: "flex", gap: 10, fontSize: 20 }}>
          <div><strong>Mw:</strong> {quakeMw}</div>
          <div>Epicentral</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => select("tsunami")}
        className={`impactBar__btn ${current === "tsunami" ? "is-selected" : ""}`}
        style={{
          ...commonBtnStyle,
          borderColor: current === "tsunami" ? "#666" : "#333",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.9 }}>Tsunami</div>
        <div style={{ display: "flex", gap: 10, fontSize: 20 }}>
          <div><strong>Height:</strong> {waveHeight} m</div>
          <div><strong>Mag:</strong> {waveMag}</div>
        </div>
      </button>
    </div>
  );

  return createPortal(bar, document.body);
}
