import React, { useState } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { AsteroidSelectionScreen } from './components/AsteroidSelectionScreen';
import { AsteroidSimulationScreen } from './components/AsteroidSimulationScreen';
import { ImpactScreen } from './components/ImpactScreen';
import { MitigationSelectionScreen } from './components/MitigationSelectionScreen';
import { MitigationSimulationScreen } from './components/MitigationSimulationScreen';
import { ComparisonScreen } from './components/ComparisonScreen';

export type Screen = 
  | 'landing'
  | 'asteroid-selection'
  | 'asteroid-simulation'
  | 'impact'
  | 'mitigation-selection'
  | 'mitigation-simulation'
  | 'comparison';

export interface Asteroid {
  id: string;
  name: string;
  diameter: number;
  velocity: number;
  closeApproachDate: string;
  distanceFromEarth: string;
  orbitingBody: string;
}

export interface MitigationStrategy {
  id: string;
  name: string;
  type: string;
  mass: number;
  velocity: number;
  interceptTime: string;
  successRate: string;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [selectedAsteroid, setSelectedAsteroid] = useState<Asteroid | null>(null);
  const [selectedMitigation, setSelectedMitigation] = useState<MitigationStrategy | null>(null);

  const navigateToScreen = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const selectAsteroid = (asteroid: Asteroid) => {
    setSelectedAsteroid(asteroid);
  };

  const selectMitigation = (mitigation: MitigationStrategy) => {
    setSelectedMitigation(mitigation);
  };

  const resetSimulation = () => {
    setSelectedAsteroid(null);
    setSelectedMitigation(null);
    setCurrentScreen('asteroid-selection');
  };

  const exitApp = () => {
    setCurrentScreen('landing');
    setSelectedAsteroid(null);
    setSelectedMitigation(null);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return <LandingScreen onNavigate={navigateToScreen} />;
      case 'asteroid-selection':
        return (
          <AsteroidSelectionScreen
            onNavigate={navigateToScreen}
            onSelectAsteroid={selectAsteroid}
            selectedAsteroid={selectedAsteroid}
          />
        );
      case 'asteroid-simulation':
        return (
          <AsteroidSimulationScreen
            onNavigate={navigateToScreen}
            asteroid={selectedAsteroid}
          />
        );
      case 'impact':
        return (
          <ImpactScreen
            onNavigate={navigateToScreen}
            asteroid={selectedAsteroid}
          />
        );
      case 'mitigation-selection':
        return (
          <MitigationSelectionScreen
            onNavigate={navigateToScreen}
            onSelectMitigation={selectMitigation}
            selectedMitigation={selectedMitigation}
          />
        );
      case 'mitigation-simulation':
        return (
          <MitigationSimulationScreen
            onNavigate={navigateToScreen}
            mitigation={selectedMitigation}
            asteroid={selectedAsteroid}
          />
        );
      case 'comparison':
        return (
          <ComparisonScreen
            onExit={exitApp}
            onSimulateAgain={resetSimulation}
            asteroid={selectedAsteroid}
            mitigation={selectedMitigation}
          />
        );
      default:
        return <LandingScreen onNavigate={navigateToScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden">
      {renderScreen()}
    </div>
  );
}