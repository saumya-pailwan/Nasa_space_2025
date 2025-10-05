// src/screen1/Page2.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ⬅️ Adjust these paths if your UI lives somewhere else
import GlassButton from '../ui/glass-button';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Icons (no versions in the import path)
import { Calendar, Ruler, Zap, Globe, Target } from 'lucide-react';

// Local styles for this page
import './Page2.css';
import Spline from '@splinetool/react-spline';

// Self-contained Asteroid interface
type Asteroid = {
  id: string;
  name: string;
  diameter: number;          // km
  velocity: number;          // km/s
  closeApproachDate: string; // ISO date
  distanceFromEarth: string; // e.g. "4.2 LD"
  orbitingBody: string;
};

// Mock NASA asteroid data
const mockAsteroids: Asteroid[] = [
  { id: '2025AB',  name: '2025 AB',        diameter: 0.34, velocity: 17.5, closeApproachDate: '2025-10-06', distanceFromEarth: '4.2 LD', orbitingBody: 'Earth' },
  { id: '99942',   name: '99942 Apophis',  diameter: 0.37, velocity: 7.4,  closeApproachDate: '2029-04-13', distanceFromEarth: '0.1 LD', orbitingBody: 'Earth' },
  { id: '2025CD1', name: '2025 CD1',       diameter: 0.52, velocity: 15.2, closeApproachDate: '2025-12-15', distanceFromEarth: '7.8 LD', orbitingBody: 'Earth' },
  { id: '2024PQ',  name: '2024 PQ',        diameter: 0.28, velocity: 19.3, closeApproachDate: '2025-08-22', distanceFromEarth: '3.1 LD', orbitingBody: 'Earth' },
  { id: '2023QF2', name: '2023 QF2',       diameter: 0.41, velocity: 12.8, closeApproachDate: '2025-11-30', distanceFromEarth: '5.5 LD', orbitingBody: 'Earth' },
];

export default function Page2() {
  const nav = useNavigate();
  const [selectedAsteroid, setSelectedAsteroid] = useState<Asteroid | null>(null);

  const handleAsteroidSelect = (asteroidId: string) => {
    const asteroid = mockAsteroids.find(a => a.id === asteroidId) || null;
    setSelectedAsteroid(asteroid);
  };

  const handleSimulate = () => {
    if (!selectedAsteroid) return;
    // If you want to persist this selection globally, store it in your state/store here.
    nav('/asteroid-simulation');
  };

  return (
    <div className="asteroid">
      <div className="asteroid-bg">
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

      <div className="asteroid-content">
        <div className="asteroid-header">
          <h1 className="asteroid-title">Select Asteroid</h1>
          <p className="asteroid-subtitle">Choose a celestial body from NASA&apos;s database</p>
        </div>

        <div className="asteroid-center">
          <div className="asteroid-panel">
            <Card className="asteroid-card">
              <CardContent className="asteroid-card-content">
                <div>
                  <label className="block text-base mb-4 text-center" style={{ color: '#cbd5e1' }}>
                    Select a Real Asteroid
                  </label>

                  <Select value={selectedAsteroid?.id ?? ''} onValueChange={handleAsteroidSelect}>
                    <SelectTrigger className="h-12" style={{ background: 'rgba(15,23,42,0.60)', borderColor: 'rgba(100,116,139,0.50)', color: '#e2e8f0', backdropFilter: 'blur(4px)' }}>
                      <SelectValue placeholder="Choose an asteroid..." />
                    </SelectTrigger>

                    <SelectContent style={{ background: 'rgba(2,6,23,0.95)', borderColor: 'rgba(71,85,105,0.50)', backdropFilter: 'blur(10px)' }}>
                      {mockAsteroids.map((asteroid) => (
                        <SelectItem key={asteroid.id} value={asteroid.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="text-base">{asteroid.name}</span>
                            <span className="asteroid-badge">{asteroid.diameter}km</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAsteroid && (
                  <>
                    <div className="asteroid-section">
                      <h3>{selectedAsteroid.name}</h3>

                      <div className="asteroid-grid">
                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Ruler className="w-4 h-4" />
                            <span>Diameter</span>
                          </div>
                          <p className="asteroid-stat-value">{selectedAsteroid.diameter} km</p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Zap className="w-4 h-4" />
                            <span>Velocity</span>
                          </div>
                          <p className="asteroid-stat-value">{selectedAsteroid.velocity} km/s</p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Calendar className="w-4 h-4" />
                            <span>Approach</span>
                          </div>
                          <p className="asteroid-stat-value" style={{ fontSize: '0.875rem' }}>
                            {selectedAsteroid.closeApproachDate}
                          </p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Target className="w-4 h-4" />
                            <span>Distance</span>
                          </div>
                          <p className="asteroid-stat-value" style={{ fontSize: '0.875rem' }}>
                            {selectedAsteroid.distanceFromEarth}
                          </p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Globe className="w-4 h-4" />
                            <span>Orbiting</span>
                          </div>
                          <p className="asteroid-stat-value">{selectedAsteroid.orbitingBody}</p>
                        </div>
                      </div>
                    </div>

                    <GlassButton onClick={handleSimulate} className="asteroid-button" wide>
                      <span>Simulate Impact</span>
                    </GlassButton>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
