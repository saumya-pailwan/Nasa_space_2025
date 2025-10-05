import React from "react";
import "./glass-button.css";
type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  wide?: boolean;
};
export default function GlassButton({ wide, children, className, ...props }: GlassButtonProps) {
  return (
    <button
      className={`glass-btn ${wide ? "glass-btn--wide" : ""} ${className ?? ""}`}
      {...props}
    >
      <span className="glass-btn__label">{children}</span>
    </button>
  );
}