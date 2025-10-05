// src/types.ts
export const ROUTES = {
    introA: '/intro-a',
    introB: '/intro-b',
    landing: '/landing',
    asteroidSelection: '/asteroid-selection',
    asteroidSimulation: '/asteroid-simulation',
    impact: '/impact',
    mission: '/mission',
  } as const;
  
  export type RouteKey = keyof typeof ROUTES;
  
  // Keep this ONLY if you use it in selection/sim screens
  export interface Asteroid {
    id: string;
    name: string;
    diameter: number;          // km
    velocity: number;          // km/s
    closeApproachDate: string; // ISO date
    distanceFromEarth: string; // e.g., "4.2 LD"
    orbitingBody: string;
  }
  