import GlassButton from './../ui/glass-button'
import { CheckCircle, XCircle, RotateCcw, LogOut, AlertTriangle, Shield } from 'lucide-react';
import './ComparisonScreen.css';
import { useNavigate } from "react-router-dom";

export function ComparisonScreen() {
  // Hard-coded display values
  const nav = useNavigate();
  const asteroidName = "2025 QX1";
  const mitigationName = "DART Impactor";
  const impact = {
    craterDiameterM: 420,         // meters
    earthquakeMag: 6.8,           // Moment magnitude
    casualties: 125000,           // people
    tsunamiMagnitude: 5,          // arbitrary scale 0-9
    tsunamiHeightM: 12            // meters
  };
  const mitigation = {
    status: "partial" as "deflected" | "partial",
    deflectionAngleDeg: 0.37,
    successProbability: 84,       // %
    newTrajectory: "Safe flyby at 2.5 LD",
    reducedCraterM: 230,
    reducedQuakeMag: 5.4,
    reducedCasualties: 53000,
    effectsReductionPct: 58
  };

  const summary =
    mitigation.status === "deflected"
      ? { title: "Mission Successful", body: `The ${mitigationName} successfully deflected ${asteroidName}, preventing an impact.` }
      : { title: "Significant Impact, Reduced", body: "Impact energy and effects reduced, but regional damage remains likely." };

  return (
    <div className="cs-screen cs-theme-navy">
      <div className="cs-header">
        <h1 className="cs-title">Impact Comparison</h1>
        <p className="cs-subtitle">Results: {asteroidName} vs {mitigationName}</p>
      </div>

      <div className="cs-container">
        <div className="cs-grid">
          {/* LEFT — Without Mitigation */}
          <GlassButton as="div" className="cs-card cs-card--left">
            <div className="glass-card-title">
              <XCircle className="cs-icon" />
              Without Mitigation
            </div>

            <div className="cs-stats-grid">
              <div className="cs-stat">
                <p className="cs-stat-label">Crater Diameter</p>
                <p className="cs-stat-value">{impact.craterDiameterM} m</p>
              </div>
              <div className="cs-stat">
                <p className="cs-stat-label">Earthquake</p>
                <p className="cs-stat-value">M{impact.earthquakeMag.toFixed(1)}</p>
              </div>
              <div className="cs-stat">
                <p className="cs-stat-label">Casualties</p>
                <p className="cs-stat-value">{impact.casualties.toLocaleString()}</p>
              </div>
              <div className="cs-stat">
                <p className="cs-stat-label">Tsunami Magnitude</p>
                <p className="cs-stat-value">{impact.tsunamiMagnitude}</p>
              </div>
            </div>

            <div className="cs-alert">
              <span className="cs-tag cs-tag--danger">High Severity</span>
              <p className="cs-alert-text">Severe, multi-regional impact. High casualties and long-term recovery required.</p>
            </div>
          </GlassButton>

          <GlassButton as="div" className="cs-card cs-card--right">
  <div className="glass-card-title">
    <CheckCircle className="cs-icon" />
    With {mitigationName}
  </div>

  <div className="cs-right-stats-grid">
    <div className="cs-stat">
      <p className="cs-stat-label">Deflection Angle</p>
      <p className="cs-stat-value">{mitigation.deflectionAngleDeg}°</p>
    </div>
    <div className="cs-stat">
      <p className="cs-stat-label">Trajectory</p>
      <p className="cs-stat-value">{mitigation.newTrajectory}</p>
    </div>
  </div>

  <div className="cs-panel cs-panel--success">
    <span className="cs-tag cs-tag--success">Successful Deflection</span>
    <p className="cs-panel-heading">Asteroid Deflected Successfully</p>
    <p className="cs-panel-subtext">
      Minimal impact, minimal casualties, minimal environmental damage.
    </p>
  </div>
</GlassButton>
        </div>

        {/* Mission Summary */}
        <GlassButton as="div" className="cs-card cs-card--summary">
          <div className="glass-card-title cs-card-title--center">
            <Shield className="cs-icon-sm" />
            Mission Summary
          </div>

          <div className="cs-summary">
            <div className="cs-summary-block cs-summary--success">
              <CheckCircle className="cs-summary-icon" />
              <h3 className="cs-summary-title">Mission Successful</h3>
              <p className="cs-summary-text">
                The {mitigationName} successfully deflected {asteroidName}, preventing an impact.
              </p>
            </div>
          </div>
        </GlassButton>

        {/* Actions */}
        <div className="cs-actions">
          <GlassButton onClick={() => nav('/')} className="cs-btn cs-btn--primary" size="lg">
            <RotateCcw className="cs-btn-icon" />
            Simulate Again
          </GlassButton>

          <GlassButton onClick={() => console.log('exit')} className="cs-btn cs-btn--ghost" size="lg">
            <LogOut className="cs-btn-icon" />
            Exit
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

export default ComparisonScreen;