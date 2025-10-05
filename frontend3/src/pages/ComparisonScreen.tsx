import React from 'react';
import './ComparisonScreen.css';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import GlassButton from './ui/glass-button'
import { CheckCircle, XCircle, RotateCcw, LogOut, AlertTriangle, Shield } from 'lucide-react';
import type { Asteroid, MitigationStrategy } from '../App';
import MeteorDeflectionSim from './MeteorDeflectionSim';

interface ComparisonScreenProps {
  onExit: () => void;
  onSimulateAgain: () => void;
  asteroid: Asteroid | null;
  mitigation: MitigationStrategy | null;
}

export function ComparisonScreen({ onExit, onSimulateAgain, asteroid, mitigation }: ComparisonScreenProps) {
  const calculateImpactEffects = () => {
    if (!asteroid) return null;
    const diameter = asteroid.diameter;
    const velocity = asteroid.velocity;
    const energy = Math.pow(diameter, 3) * Math.pow(velocity, 2) / 1000;
    const craterDiameter = Math.round(diameter * 20);
    const earthquakeMagnitude = Math.min(9.5, 6 + Math.log10(energy));
    const tsunamiHeight = energy > 100 ? Math.min(50, energy / 10) : 0;
    const tsunamiMagnitude = tsunamiHeight > 0
      ? Math.min(9, Math.round((4 + 2 * Math.log10(tsunamiHeight)) * 10) / 10)
      : 0;
    const casualties = Math.round(energy * 10000);
    return { energy, craterDiameter, earthquakeMagnitude, tsunamiHeight, tsunamiMagnitude, casualties };
  };

  const calculateMitigationEffects = () => {
    if (!asteroid || !mitigation) return null;
    const successRate = parseFloat(mitigation.successRate.replace('%', '')) / 100;
    const deflectionAngle = (mitigation.mass * mitigation.velocity) / (asteroid.diameter * 1000);
    const isSuccessful = successRate > 0.8;
    if (isSuccessful) {
      return {
        status: 'deflected' as const,
        successRate,
        newTrajectory: 'Safe flyby at 2.5 LD',
        deflectionAngle: Math.round(deflectionAngle * 1000) / 1000,
      };
    }
    const effectsReduction = successRate * 0.7;
    const originalEffects = calculateImpactEffects();
    if (!originalEffects) return null;
    return {
      status: 'partial' as const,
      successRate,
      craterDiameter: Math.round(originalEffects.craterDiameter * (1 - effectsReduction)),
      earthquakeMagnitude: Math.round((originalEffects.earthquakeMagnitude * (1 - effectsReduction)) * 10) / 10,
      casualties: Math.round(originalEffects.casualties * (1 - effectsReduction)),
      effectsReduction: Math.round(effectsReduction * 100),
    };
  };

  const impactEffects = calculateImpactEffects();
  const mitigationEffects = calculateMitigationEffects();

  const getImpactSummary = () => {
    if (!impactEffects) return { title: 'No Data', body: 'Insufficient data to assess impact.' };
    const { energy, earthquakeMagnitude, tsunamiHeight, casualties } = impactEffects;
    if (energy < 50) return { title: 'Minor Regional Impact', body: 'Localized damage with limited seismic and coastal effects.' };
    if (energy < 300) return { title: 'Significant Impact', body: `Quake up to M${earthquakeMagnitude.toFixed(1)}; ${tsunamiHeight > 0 ? `tsunami ~${Math.round(tsunamiHeight)}m.` : 'limited coastal effects.'}` };
    if (energy < 1500) return { title: 'Severe, Multi-Regional Impact', body: `High casualties (~${casualties.toLocaleString()}). Long-term recovery required.` };
    return { title: 'Catastrophic / Global-Scale Impact', body: 'Potential global climate effects. International response required.' };
  };

  const summary = getImpactSummary();

  return (
    <div className="cs-screen cs-theme-navy">
      <div className="cs-header">
        <h1 className="cs-title">Impact Comparison</h1>
        <p className="cs-subtitle">Results: {asteroid?.name} vs {mitigation?.name}</p>
      </div>

      <div className="cs-container">
        <div className="cs-grid">
          {/* LEFT — Without Mitigation (glass card) */}
          <GlassButton as="div" className="cs-card cs-card--left">
            <div className="glass-card-title">
              <XCircle className="cs-icon" />
              Without Mitigation
            </div>

            {impactEffects && (
              <>
                <div className="cs-stats-grid">
                  <div className="cs-stat">
                    <p className="cs-stat-label">Crater Diameter</p>
                    <p className="cs-stat-value">{impactEffects.craterDiameter} m</p>
                  </div>
                  <div className="cs-stat">
                    <p className="cs-stat-label">Earthquake</p>
                    <p className="cs-stat-value">M{impactEffects.earthquakeMagnitude.toFixed(1)}</p>
                  </div>
                  <div className="cs-stat">
                    <p className="cs-stat-label">Casualties</p>
                    <p className="cs-stat-value">{impactEffects.casualties.toLocaleString()}</p>
                  </div>
                  <div className="cs-stat">
                    <p className="cs-stat-label">Tsunami Magnitude</p>
                    <p className="cs-stat-value">{impactEffects.tsunamiMagnitude || 0}</p>
                  </div>
                </div>

                {impactEffects.tsunamiHeight > 0 && (
                  <div className="cs-callout">
                    <p className="cs-callout-label">Tsunami Waves</p>
                    <p className="cs-callout-value">{Math.round(impactEffects.tsunamiHeight)} m</p>
                  </div>
                )}

                <div className="cs-alert">
                  <Badge className="cs-badge">HIGH SEVERITY</Badge>
                  <p className="cs-alert-text">{summary.title} {summary.body}</p>
                </div>
              </>
            )}
          </GlassButton>

          {/* RIGHT — With Mitigation (glass card; 2 rows, first row has 2 cards) */}
          <GlassButton as="div" className="cs-card cs-card--right">
            <div className="glass-card-title">
              <CheckCircle className="cs-icon" />
              With {mitigation?.name}
            </div>

            {mitigationEffects && (
              <>
                {mitigationEffects.status === 'deflected' ? (
                  <>
                    <div className="cs-right-stats-grid">
                      {/* Row 1 (2 cards) */}
                      <div className="cs-stat">
                        <p className="cs-stat-label">Deflection Angle</p>
                        <p className="cs-stat-value">{mitigationEffects.deflectionAngle}°</p>
                      </div>
                      <div className="cs-stat">
                        <p className="cs-stat-label">Success Probability</p>
                        <p className="cs-stat-value">{Math.round(mitigationEffects.successRate * 100)}%</p>
                      </div>
                      {/* Row 2 (1 wide card) */}
                      <div className="cs-stat cs-span-2">
                        <p className="cs-stat-label">Trajectory</p>
                        <p className="cs-stat-value">{mitigationEffects.newTrajectory}</p>
                      </div>
                    </div>

                    <div className="cs-panel cs-panel--success">
                      <Badge className="cs-badge">SUCCESSFUL DEFLECTION</Badge>
                      <p className="cs-panel-heading">Asteroid Deflected Successfully</p>
                      <p className="cs-panel-subtext">No impact, no casualties, no environmental damage.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cs-panel cs-panel--warning">
                      <Badge className="cs-badge">PARTIAL SUCCESS</Badge>
                      <p className="cs-panel-heading">Impact Severity Reduced</p>
                      <p className="cs-panel-subtext">
                        Effects reduced by {mitigationEffects.effectsReduction}% (Success probability: {Math.round(mitigationEffects.successRate * 100)}%)
                      </p>
                    </div>

                    <div className="cs-right-stats-grid">
                      {/* Row 1 (2 cards) */}
                      <div className="cs-stat">
                        <p className="cs-stat-label">Crater Diameter</p>
                        <p className="cs-stat-value">{mitigationEffects.craterDiameter} m</p>
                      </div>
                      <div className="cs-stat">
                        <p className="cs-stat-label">Earthquake</p>
                        <p className="cs-stat-value">M{mitigationEffects.earthquakeMagnitude}</p>
                      </div>
                      {/* Row 2 (1 wide card) */}
                      <div className="cs-stat cs-span-2">
                        <p className="cs-stat-label">Casualties</p>
                        <p className="cs-stat-value">
                          {mitigationEffects.casualties.toLocaleString()} (Lives saved: {impactEffects ? (impactEffects.casualties - mitigationEffects.casualties).toLocaleString() : '—'})
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </GlassButton>
        </div>

        {/* Mission Summary (glass card) */}
        <GlassButton as="div" className="cs-card cs-card--summary">
          <div className="glass-card-title cs-card-title--center">
            <Shield className="cs-icon-sm" />
            Mission Summary
          </div>

          <div className="cs-summary">
            {mitigationEffects?.status === 'deflected' ? (
              <div className="cs-summary-block cs-summary--success">
                <CheckCircle className="cs-summary-icon" />
                <h3 className="cs-summary-title">Mission Successful</h3>
                <p className="cs-summary-text">
                  The {mitigation?.name} successfully deflected {asteroid?.name}, preventing an impact.
                </p>
              </div>
            ) : (
              <div className="cs-summary-block cs-summary--warning">
                <AlertTriangle className="cs-summary-icon" />
                <h3 className="cs-summary-title">{summary.title}</h3>
                <p className="cs-summary-text">{summary.body}</p>
              </div>
            )}
          </div>
        </GlassButton>

        {/* Actions */}
        <div className="cs-actions">
          <Button onClick={onSimulateAgain} className="cs-btn cs-btn--primary" size="lg">
            <RotateCcw className="cs-btn-icon" />
            Simulate Again
          </Button>

          <Button onClick={onExit} className="cs-btn cs-btn--ghost" size="lg">
            <LogOut className="cs-btn-icon" />
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}