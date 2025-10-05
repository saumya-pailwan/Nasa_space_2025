import { useState } from 'react';
import CesiumMap from './components/CesiumMap';
import BottomImpactBar, { type ImpactMetrics } from './components/BottomImpactBar';
import { useImpactSimulation } from './hooks/useImpactSimulation';

export default function MapScreen() {
  const { boot, dispose, activeSection, setActiveSection } = useImpactSimulation();

  const [info, setInfo] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<ImpactMetrics | null>(null);

  return (
    <>
      <CesiumMap
        setInfo={setInfo}
        setImpactData={setImpactData}
        boot={boot}
        dispose={dispose}
      />

      <BottomImpactBar
        data={impactData}
        active={activeSection}
        onChange={setActiveSection}
      />
    </>
  );
}