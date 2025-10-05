import GlassButton from '../ui/glass-button';
import { Card, CardContent } from '../ui/card';
import { Rocket, Weight, Zap } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import '../styles/MissileChooser.css'; // reuse the same styles
// import {TestScene} from '../components/TestScene'

import Spline from '@splinetool/react-spline';

interface MissileChooser {
  onConfirm?: () => void; // optional callback when the user proceeds
}

export default function MissileChooser({ onConfirm }: MissileChooser) {
  const navigate = useNavigate();
  
  const handleUseDART = () => {
    if (onConfirm) onConfirm();
    navigate('/TestScene');
  };

  return (
    <div className="asteroid">
      <div className="asteroid-bg">
        <div className="landing-spline">
          <Spline 
            scene="https://prod.spline.design/UhcwzEzy5oqljf93/scene.splinecode"
            onLoad={(app: any) => {
              try {
                if (app && typeof app.setZoom === 'function') {
                  app.setZoom(0.9);
                }
                if (app && app.canvas) {
                  const canvas = app.canvas as HTMLCanvasElement;
                  canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
                }
              } catch {}
            }}
          />
        </div>
      </div>

      <div className="asteroid-content">
        <div className="asteroid-center">
          <div className="asteroid-panel">
        <Card className="asteroid-card">
          <CardContent className="asteroid-card-content">
            <div className="asteroid-header" style={{ marginBottom: 0 }}>
              <h2 className="asteroid-title" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
                DART Impactor
              </h2>
              <p className="asteroid-subtitle" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <Rocket className="w-5 h-5" />
                Double Asteroid Redirection Test (DART) Impactor
              </p>
            </div>

            <div className="asteroid-section">
              <h3>DART Parameters</h3>
              <div className="asteroid-grid">
                <div className="asteroid-stat">
                  <div className="asteroid-stat-label">
                    <Weight className="w-4 h-4" />
                    <span>Mass</span>
                  </div>
                  <p className="asteroid-stat-value">579.4 ± 0.7 kg</p>
                </div>

                <div className="asteroid-stat">
                  <div className="asteroid-stat-label">
                    <Zap className="w-4 h-4" />
                    <span>Normal Velocity</span>
                  </div>
                  <p className="asteroid-stat-value">5.858 km/s</p>
                </div>
              </div>
            </div>

            <GlassButton onClick={handleUseDART} className="asteroid-button" wide>
              Use DART Impactor
            </GlassButton>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
