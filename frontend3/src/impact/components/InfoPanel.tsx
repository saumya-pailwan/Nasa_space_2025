import type { PropsWithChildren } from "react";

export default function InfoPanel({ children }: PropsWithChildren) {
  return (
    <div className="infoPanel">
      <div style={{ padding: 10, background: "rgba(42,42,42,0.8)", color: "white" }}>
        {children}
      </div>
    </div>
  );
}
