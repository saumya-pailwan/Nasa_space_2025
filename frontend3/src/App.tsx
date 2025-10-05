import { Routes, Route } from "react-router-dom";

// existing pages
import Home from "./pages/Home";
import Mission from "./pages/Mission"; // your rocket-hits-asteroid screen
import Page1 from "./screen1/Page1";
import Page2 from "./screen1/Page2";
import { Navigate } from "react-router-dom";

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
      <Route path="/mission" element={<Mission />} />

      {/* Fallback */}
      <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
    </Routes>
  );
}