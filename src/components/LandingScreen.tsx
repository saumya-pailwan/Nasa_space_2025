import React from 'react';
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
      </div>

      {/* Main Content */}
      <div className="landing-content">
        <div className="landing-card">
          <div>
            <h1 className="landing-title">Simulate the Next Impact.</h1>
            <p className="landing-subtitle">Experience Impactor-2025 — model asteroid collisions using real NASA data.</p>
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