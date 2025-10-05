import { Routes, Route } from "react-router-dom";

export interface Asteroid {
  diameter: number;    // meters
  velocity: number;    // km/s
  mass: number;       // kg
  composition: string;
  approach: string;
}

export interface MitigationStrategy {
  type: string;
  effectiveness: number;
  cost: number;
  timeToImplement: number;
  success: boolean;
}

// existing pages
import Home from "./pages/Home";
import Mission from "./pages/Mission"; // your rocket-hits-asteroid screen
import Page1 from "./screen1/Page1";
import Page2 from "./screen1/Page2";
import { Navigate } from "react-router-dom";
import MissileChooser from "./pages/MissileChooser";
import TestScene from "./components/TestScene"
import {ComparisonScreen} from "./pages/ComparisonScreen"

// NEW: Cesium module entry
import ImpactMap from "./impact/MapScreen";
import { ImprovedNoise } from "three/examples/jsm/Addons.js";

export default function App() {
  return (
    <Routes>
      {/* 1) Boot at Page1 */}
      <Route path="/" element={<Navigate to="/screen1/page1" replace />} />

      {/* 2) First + second screens */}
      <Route path="/screen1/page1" element={<Page1 />} />
      <Route path="/screen1/page2" element={<Page2 />} />

      {/* 3) Third screen = your previous first screen */}
      <Route path="/landing" element={<Home />} />

      {/* Existing modules */}
      <Route path="/impact" element={<ImpactMap />} />
      <Route path="/missile-chooser" element={<MissileChooser />} />
      <Route path="/mission" element={<Mission />} />
      <Route path="/TestScene" element={<TestScene />} />
      <Route path="/comparison" element={
        <ComparisonScreen
          onExit={() => window.location.href = "/"}
          onSimulateAgain={() => window.location.href = "/TestScene"}
          asteroid={{
            diameter: 1000, // meters
            velocity: 20,   // km/s
            mass: 1e6,     // kg
            composition: "rocky",
            approach: "direct"
          }}
          mitigation={{
            type: "kinetic",
            effectiveness: 0.8,
            cost: 1000000000,
            timeToImplement: 365,
            success: true
          }}
        />
      } />

      {/* Fallback */}
      <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
    </Routes>
  );
}