import React from "react";

type BottomPanelProps = {
  open: boolean;
  onToggle: () => void;
  title?: string;
  children?: React.ReactNode;
};

export function BottomPanel({
  open,
  onToggle,
  title = "Controls",
  children,
}: BottomPanelProps) {
  // explicit, hardcoded heights so it never collapses unexpectedly
  const headerH = 40; // px
  const openH = Math.round(window.innerHeight / 6); // ~1/6 screen in px

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: open ? openH : headerH,
        background: "rgba(12,12,12,0.92)",
        borderTop: "1px solid #222",
        boxShadow: "0 -10px 24px rgba(0,0,0,0.25)",
        zIndex: 10000, // way above the canvas
        color: "#eaeaea",
        backdropFilter: "blur(4px)",
        transition: "height 200ms ease",
        // critical: allow interaction & keep it on top
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          height: headerH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          borderBottom: "1px solid #222",
          userSelect: "none",
        }}
      >
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="bp-body"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid #333",
            background: "#111",
            color: "#eaeaea",
            cursor: "pointer",
          }}
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▼" : "▲"}
        </button>
        <div style={{ fontSize: 14, letterSpacing: 0.3, color: "#9aa0a6" }}>
          {title}
        </div>
        <div style={{ width: 28, height: 28 }} />
      </div>

      <div
        id="bp-body"
        style={{
          height: open ? openH - headerH : 0,
          overflow: "auto",
          padding: open ? "10px 12px" : 0,
        }}
      >
        {open ? children : null}
      </div>
    </div>
  );
}
