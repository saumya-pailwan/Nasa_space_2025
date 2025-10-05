import { useEffect, useRef } from 'react';
import type { ImpactMetrics } from './BottomImpactBar';

type Props = {
  setInfo: (s: string | null) => void;
  setImpactData: (d: ImpactMetrics | null) => void;

  // injected from the hook in the parent:
  boot: (container: HTMLDivElement, setInfo: Props['setInfo'], setImpactData: Props['setImpactData']) => void;
  dispose: () => void;
};

export default function CesiumMap({ setInfo, setImpactData, boot, dispose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    boot(containerRef.current, setInfo, setImpactData);
    return () => { dispose(); };
  }, [boot, dispose, setInfo, setImpactData]);

  return <div ref={containerRef} className="cesiumContainer" />;
}
