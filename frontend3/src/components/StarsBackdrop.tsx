import React from "react";
import { Stars } from "@react-three/drei";

/**
 * Stars backdrop
 * - Must be a CHILD of the same top-level group as Earth so they rotate together.
 * - drei/Stars generates a performant starfield on a sphere shell.
 */
export function StarsBackdrop() {
  return (
    <Stars
      radius={120}     // outer radius of the starfield sphere
      depth={40}       // how “thick” the starfield is
      count={8000}     // number of stars
      factor={3}       // size factor
      saturation={0}   // grayscale stars
      fade             // fade at the edges for immersion
      speed={0.2}      // subtle twinkle/parallax
    />
  );
}
