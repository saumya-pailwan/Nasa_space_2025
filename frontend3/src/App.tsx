// import React, { useState } from "react";
// import { Scene } from "./components/Scene";
// import { BottomPanel } from "./components/BottomPanel";

// export default function App() {
//   const [open, setOpen] = useState(true); // or false if you want header-only by default

//   return (
//     <>
//       <Scene />
//       <BottomPanel open={open} onToggle={() => setOpen(v => !v)} title="Simulation Panel">
//         {/* Placeholder content for now */}
//         <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
//           <button onClick={() => alert("Example")} style={btnStyle}>Example</button>
//           <button onClick={() => alert("Another")} style={btnStyle}>Another</button>
//         </div>
//       </BottomPanel>
//     </>
//   );
// }

// const btnStyle: React.CSSProperties = {
//   padding: "8px 12px",
//   borderRadius: 10,
//   border: "1px solid #333",
//   background: "#151515",
//   color: "#eaeaea",
//   cursor: "pointer",
// };


import React from "react";
import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Mission from "./pages/Mission";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mission" element={<Mission />} />
      {/* <Route path="*" element={<Navigate to="/mission" replace />} /> */}

    </Routes>
  );
}
