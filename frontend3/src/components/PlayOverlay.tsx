import React from "react";

type Props = {
  visible: boolean;
  onPlay: () => void;
  label?: string;
};

export function PlayOverlay({ visible, onPlay, label = "PLAY" }: Props) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: 2000,
        pointerEvents: "none",
      }}
    >
      <button
        onClick={onPlay}
        style={{
          pointerEvents: "auto",
          padding: "14px 22px",
          borderRadius: 12,
          border: "1px solid #333",
          background: "#151515",
          color: "#eaeaea",
          fontSize: 18,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        {label}
      </button>
    </div>
  );
}
