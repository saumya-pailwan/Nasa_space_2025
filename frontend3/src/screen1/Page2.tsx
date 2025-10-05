// src/screen1/Page2.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsteroidStore } from "../state/asteroidStore";

// UI components
import GlassButton from '../ui/glass-button';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Icons
import { Calendar, Ruler, Zap, Globe, Target, Loader2 } from 'lucide-react';

// API
import { fetchImpact, type ImpactResponse } from '../api';

// Local styles
import './Page2.css';
import Spline from '@splinetool/react-spline';

// Enhanced Asteroid interface with backend data
type Asteroid = {
  id: string;
  name: string;
  diameter: number;          // km
  velocity: number;          // km/s
  closeApproachDate: string | null; // ISO date or null
  distanceFromEarth: string; // e.g. "4.2 LD"
  orbitingBody: string;
  // Store full backend response for passing to simulation
  backendData?: ImpactResponse;
};

// Initial mock data (will be overridden with API data when selected)
const mockAsteroids: Asteroid[] = [
  { id: '2000433',  name: '433 Eros',        diameter: 0.34, velocity: 17.5, closeApproachDate: '2025-10-06', distanceFromEarth: '4.2 LD', orbitingBody: 'Earth' },
  { id: '2001221',   name: '1221 Amor',  diameter: 0.37, velocity: 7.4,  closeApproachDate: '2029-04-13', distanceFromEarth: '0.1 LD', orbitingBody: 'Earth' },
  { id: '2000719', name: '719 Albert',       diameter: 0.52, velocity: 15.2, closeApproachDate: '2025-12-15', distanceFromEarth: '7.8 LD', orbitingBody: 'Earth' },
  { id: '2000887',  name: '887 Alinda',        diameter: 0.28, velocity: 19.3, closeApproachDate: '2025-08-22', distanceFromEarth: '3.1 LD', orbitingBody: 'Earth' },
  { id: '2001036', name: '1036 Ganymed',       diameter: 0.41, velocity: 12.8, closeApproachDate: '2025-11-30', distanceFromEarth: '5.5 LD', orbitingBody: 'Earth' },
];

export default function Page2() {
  const nav = useNavigate();
  const [selectedAsteroid, setSelectedAsteroid] = useState<Asteroid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAsteroid = useAsteroidStore((s) => s.setAsteroid);

  const handleAsteroidSelect = async (asteroidId: string) => {
    const mockData = mockAsteroids.find(a => a.id === asteroidId);
    if (!mockData) return;

    // Show mock data immediately
    setSelectedAsteroid(mockData);
    setLoading(true);
    setError(null);

    try {
      // Fetch real data from backend
      const backendData = await fetchImpact(asteroidId);

      // Create enhanced asteroid with backend data
      const enhancedAsteroid: Asteroid = {
        id: asteroidId,
        name: backendData.neo_display_name || backendData.name || mockData.name,
        diameter: backendData.diameter_km ?? mockData.diameter,
        velocity: backendData.velocity_km_s ?? mockData.velocity,
        closeApproachDate: backendData.approach || mockData.closeApproachDate,
        distanceFromEarth: backendData.distance_ld 
          ? `${backendData.distance_ld.toFixed(2)} LD` 
          : mockData.distanceFromEarth,
        orbitingBody: backendData.orbiting_body || mockData.orbitingBody,
        backendData: backendData
      };

      setSelectedAsteroid(enhancedAsteroid);
      setAsteroid(enhancedAsteroid);
    } catch (err) {
      console.error('Failed to fetch asteroid data:', err);
      setError('Failed to load asteroid data. Using cached values.');
      // Keep the mock data displayed on error
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = () => {
    if (!selectedAsteroid) return;
    
    // Store the selected asteroid data in sessionStorage or global state
    // so the simulation page can access it
    sessionStorage.setItem('selectedAsteroid', JSON.stringify(selectedAsteroid));
    
    nav('/asteroid-simulation');
  };

  return (
    <div className="asteroid">
      <div className="asteroid-bg">
        <div className="landing-spline">
          <Spline 
            scene="https://prod.spline.design/hTPMGS6ldotFaQa1/scene.splinecode"
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

                  <Select 
                    value={selectedAsteroid?.id ?? ''} 
                    onValueChange={handleAsteroidSelect}
                    disabled={loading}
                  >
                    <SelectTrigger 
                      className="h-12" 
                      style={{ 
                        background: 'rgba(15,23,42,0.60)', 
                        borderColor: 'rgba(100,116,139,0.50)', 
                        color: '#e2e8f0', 
                        backdropFilter: 'blur(4px)' 
                      }}
                    >
                      <SelectValue placeholder="Choose an asteroid..." />
                    </SelectTrigger>

                    <SelectContent 
                      style={{ 
                        background: 'rgba(2,6,23,0.95)', 
                        borderColor: 'rgba(71,85,105,0.50)', 
                        backdropFilter: 'blur(10px)' 
                      }}
                    >
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

                  {error && (
                    <p style={{ 
                      color: '#fbbf24', 
                      fontSize: '0.875rem', 
                      marginTop: '0.5rem',
                      textAlign: 'center' 
                    }}>
                      {error}
                    </p>
                  )}
                </div>

                {loading && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    color: '#94a3b8'
                  }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading asteroid data...</span>
                  </div>
                )}

                {selectedAsteroid && !loading && (
                  <>
                    <div className="asteroid-section">
                      <h3>{selectedAsteroid.name}</h3>

                      <div className="asteroid-grid">
                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Ruler className="w-4 h-4" />
                            <span>Diameter</span>
                          </div>
                          <p className="asteroid-stat-value">
                            {selectedAsteroid.diameter.toFixed(2)} km
                          </p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Zap className="w-4 h-4" />
                            <span>Velocity</span>
                          </div>
                          <p className="asteroid-stat-value">
                            {selectedAsteroid.velocity.toFixed(1)} km/s
                          </p>
                        </div>

                        <div className="asteroid-stat">
                          <div className="asteroid-stat-label">
                            <Calendar className="w-4 h-4" />
                            <span>Approach</span>
                          </div>
                          <p className="asteroid-stat-value" style={{ fontSize: '0.875rem' }}>
                            {selectedAsteroid.closeApproachDate || 'N/A'}
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

                    <GlassButton onClick={() => nav('/landing')} className="asteroid-button" wide>
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