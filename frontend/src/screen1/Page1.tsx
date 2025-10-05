// src/pages/IntroA.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from './types';
import GlassButton from '../ui/glass-button';
import './Page1.css';
import Spline from '@splinetool/react-spline';

export default function IntroA() {
  const nav = useNavigate();
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

      <div className="landing-content">
        <div className="landing-card">
          <h1 className="landing-title">Welcome to Singularity</h1>
          <p className="landing-subtitle">Visualize, understand, and prepare for space threats.</p>
          <GlassButton wide className="landing-button" onClick={() => nav('/screen1/page2')}>
            <span>Continue</span>
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
