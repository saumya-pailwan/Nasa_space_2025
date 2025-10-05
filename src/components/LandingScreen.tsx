import React from 'react';
import Spline from '@splinetool/react-spline';
import GlassButton from './ui/glass-button';
import type { Screen } from '../App';
import './LandingScreen.css';

interface LandingScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function LandingScreen({ onNavigate }: LandingScreenProps) {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="landing-spline">
          <Spline 
            scene="https://prod.spline.design/btFdBcZfJFlWFzfK/scene.splinecode"
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

      {/* Main Content */}
      <div className="landing-content">
        <div className="landing-card">
          <div>
            <h1 className="landing-title">Singularity</h1>
            <p className="landing-subtitle">Model asteroid collisions and witness the physics that shape worlds, powered by NASA.</p>
          </div>

          <GlassButton
            onClick={() => onNavigate('asteroid-selection')}
            className="landing-button"
            wide={true}
          >
            <span>Begin Simulation</span>
          </GlassButton>
        </div>
      </div>
    </div>
  );
}