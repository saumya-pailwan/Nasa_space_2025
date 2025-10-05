// src/impact/components/CesiumMap.tsx
import { useEffect, useRef } from "react";
import type { ImpactMetrics } from "./BottomImpactBar";

type Props = {
  setInfo: (s: string | null) => void;
  setImpactData: (d: ImpactMetrics | null) => void;
  // injected from the hook in the parent:
  boot: (
    container: HTMLDivElement,
    setInfo: Props["setInfo"],
    setImpactData: Props["setImpactData"]
  ) => void;
  dispose: () => void;
};

export default function CesiumMap({ setInfo, setImpactData, boot, dispose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Boot the Cesium viewer into the container div
    boot(el, setInfo, setImpactData);

    // Cleanup on unmount/route-change
    return () => {
      dispose();
    };
  }, [boot, dispose, setInfo, setImpactData]);

  return (
    // Wrapper sits fixed to the viewport and *behind* overlays
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: "#000" }}

    >
      {/* Actual Cesium mount node must have explicit size */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100vw",
          height: "100vh",
        }}
        className="cesiumContainer" // optional: matches your CSS if you keep it
        aria-label="Cesium map container"
      />
    </div>
  );
}
