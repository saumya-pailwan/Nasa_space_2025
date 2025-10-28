// src/state/simStore.ts
import { create } from "zustand";
import type { ImpactResponse } from "../api";

export type RocketParams = { speed: number; angleDeg: number };

export type SimPhase = "idle" | "running" | "done";

type Vec3 = [number, number, number];

export type SimState = {
  // Run/scene
  phase: SimPhase;
  startRun: () => void;
  endRun: () => void;
  launchNonce: number; // bump to remount missile/asteroid

  // Rocket
  rocket: RocketParams;
  setRocket: (p: Partial<RocketParams>) => void;

  // Asteroid - backend data
  selectedAsteroidData: ImpactResponse | null;
  setSelectedAsteroidData: (data: ImpactResponse | null) => void;

  // Asteroid - simulation state
  asteroidPos: Vec3;
  setAsteroidPos: (p: Vec3) => void;
  asteroidAlive: boolean;
  setAsteroidAlive: (alive: boolean) => void;
  destroyAsteroid: () => void;

  asteroidMassKg: number;
  setAsteroidMassKg: (m: number) => void;

  asteroidDiameterKm: number | null;
  setAsteroidDiameterKm: (d: number | null) => void;

  asteroidVelocityKmS: number | null;
  setAsteroidVelocityKmS: (v: number | null) => void;

  // Heavy-impact deflection request from Missile → handled by Asteroid
  asteroidDeflectRotate: null | { angleDeg: number; axis?: Vec3 };
  setAsteroidDeflectRotate: (v: SimState["asteroidDeflectRotate"]) => void;
  clearAsteroidDeflectRotate: () => void;

  // Outcome bookkeeping (optional but handy for UI)
  outcome: "pending" | "earth_hit" | "escaped" | "deflected_heavy" | "light_destroyed";
  setOutcome: (o: SimState["outcome"]) => void;
};

const DEFAULT_ASTEROID_POS: Vec3 = [2.8, 0.8, -3.2];
const DEFAULT_ASTEROID_MASS_KG = 4500;

export const useSimStore = create<SimState>((set, get) => ({
  // Run/scene
  phase: "idle",
  launchNonce: 0,
  startRun: () => {
    // Fresh run: remount things via launchNonce and reset asteroid
    set({
      phase: "running",
      launchNonce: get().launchNonce + 1,
      asteroidAlive: true,
      asteroidPos: DEFAULT_ASTEROID_POS,
      asteroidDeflectRotate: null,
      outcome: "pending",
    });
  },
  endRun: () => set({ phase: "done" }),

  // Rocket defaults
  rocket: { speed: 1.0, angleDeg: 0 },
  setRocket: (p) =>
    set((s) => ({ rocket: { ...s.rocket, ...p } })),

  // Backend asteroid data
  selectedAsteroidData: null,
  setSelectedAsteroidData: (data) => {
    set({ selectedAsteroidData: data });
    // Auto-populate mass, diameter, velocity from backend data when available
    if (data) {
      if (data.mass_kg !== undefined) {
        set({ asteroidMassKg: data.mass_kg });
      }
      if (data.diameter_km !== undefined) {
        set({ asteroidDiameterKm: data.diameter_km });
      }
      if (data.velocity_km_s !== undefined) {
        set({ asteroidVelocityKmS: data.velocity_km_s });
      }
    }
  },

  // Asteroid simulation state
  asteroidPos: DEFAULT_ASTEROID_POS,
  setAsteroidPos: (p) => set({ asteroidPos: p }),
  asteroidAlive: true,
  setAsteroidAlive: (alive) => set({ asteroidAlive: alive }),
  destroyAsteroid: () => {
    const { phase } = get();
    set({ asteroidAlive: false });
    if (phase === "running") {
      set({ outcome: "light_destroyed" });
    }
  },

  // Asteroid physical properties
  asteroidMassKg: DEFAULT_ASTEROID_MASS_KG,
  setAsteroidMassKg: (m) => set({ asteroidMassKg: m }),

  asteroidDiameterKm: null,
  setAsteroidDiameterKm: (d) => set({ asteroidDiameterKm: d }),

  asteroidVelocityKmS: null,
  setAsteroidVelocityKmS: (v) => set({ asteroidVelocityKmS: v }),

  // Deflection pipe from Missile → Asteroid (heavy case)
  asteroidDeflectRotate: null,
  setAsteroidDeflectRotate: (v) => set({ asteroidDeflectRotate: v }),
  clearAsteroidDeflectRotate: () => set({ asteroidDeflectRotate: null }),

  // Outcome
  outcome: "pending",
  setOutcome: (o) => set({ outcome: o }),
}));