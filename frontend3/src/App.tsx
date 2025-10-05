import { Routes, Route } from "react-router-dom";

// existing pages
import Home from "./pages/Home";
import Mission from "./pages/Mission"; // your rocket-hits-asteroid screen

// NEW: Cesium module entry
import ImpactMap from "./impact/MapScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* NEW: the Cesium impact module */}
      <Route path="/impact" element={<ImpactMap />} />

      {/* EXISTING: rocket mission (R3F) */}
      <Route path="/mission" element={<Mission />} />

      <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
    </Routes>
  );
}