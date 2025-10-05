import { useState, useMemo } from 'react';
import type { ImpactSection } from '../hooks/useImpactSimulation';

export type ImpactMetrics = {
  lon: number;
  lat: number;
  impactTime: number;              // ms epoch
  craterDiameterM: number;         // e.g., 2000
  craterDepthM: number;            // derived (e.g., 20–25% of diameter)
  quakeMagnitudeMw: number;        // simulated moment magnitude
  tsunamiHeightM: number;          // simulated height at coast
  tsunamiIndex: number;            // simulated 0–10 intensity index
};

type Props = {
  data: ImpactMetrics | null;

  /** Controlled active section. If provided, the component becomes controlled. */
  active?: ImpactSection;

  /** Uncontrolled initial active section (ignored if `active` is provided). */
  defaultActive?: ImpactSection;

  /** Fired whenever the active section changes (both controlled & uncontrolled). */
  onChange?: (next: ImpactSection) => void;
};

export default function BottomImpactBar({
  data,
  active,
  defaultActive = 'impact',
  onChange,
}: Props) {
  const isControlled = typeof active !== 'undefined';
  const [internalActive, setInternalActive] = useState<ImpactSection>(defaultActive);
  const current = isControlled ? (active as ImpactSection) : internalActive;

  const select = (next: ImpactSection) => {
    if (!isControlled) setInternalActive(next);
    onChange?.(next);
  };

  // Pre-format values once
  const { impactDepth, impactDiameter, quakeMw, waveHeight, waveMag } = useMemo(() => {
    return {
      impactDepth: data ? Math.round(data.craterDepthM).toLocaleString() : '—',
      impactDiameter: data ? Math.round(data.craterDiameterM).toLocaleString() : '—',
      quakeMw: data ? data.quakeMagnitudeMw.toFixed(1) : '—',
      waveHeight: data ? Math.round(data.tsunamiHeightM).toString() : '—',
      waveMag: data ? data.tsunamiIndex.toFixed(1) : '—',
    };
  }, [data]);

  return (
    <div className="impactBar" role="toolbar" aria-label="Impact details">
      {/* Impact */}
      <button
        type="button"
        className={`impactBar__btn ${current === 'impact' ? 'is-selected' : ''}`}
        aria-pressed={current === 'impact'}
        onClick={() => select('impact')}
      >
        <div className="impactBar__title">Impact</div>
        <div className="impactBar__metrics">
          <div><strong>Depth:</strong> {impactDepth} m</div>
          <div><strong>Diameter:</strong> {impactDiameter} m</div>
        </div>
      </button>

      {/* Earthquake */}
      <button
        type="button"
        className={`impactBar__btn ${current === 'earthquake' ? 'is-selected' : ''}`}
        aria-pressed={current === 'earthquake'}
        onClick={() => select('earthquake')}
      >
        <div className="impactBar__title">Earthquake</div>
        <div className="impactBar__metrics">
          <div><strong>Mw:</strong> {quakeMw}</div>
          <div>Epicentral</div>
        </div>
      </button>

      {/* Tsunami */}
      <button
        type="button"
        className={`impactBar__btn ${current === 'tsunami' ? 'is-selected' : ''}`}
        aria-pressed={current === 'tsunami'}
        onClick={() => select('tsunami')}
      >
        <div className="impactBar__title">Tsunami</div>
        <div className="impactBar__metrics">
          <div><strong>Height:</strong> {waveHeight} m</div>
          <div><strong>Mag:</strong> {waveMag}</div>
        </div>
      </button>
    </div>
  );
}