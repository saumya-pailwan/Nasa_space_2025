// src/state/asteroidStore.ts
import { create } from "zustand";

export type EnhancedAsteroid = {
  id: string;
  name: string;
  diameter: number;          // km
  velocity: number;          // km/s
  closeApproachDate: string | null;
  distanceFromEarth: string; // e.g. "4.2 LD"
  orbitingBody: string;
  // Optional richer backend payload (carry whatever you get from NASA)
  backendData?: any;
  // Optional coordinates (if your API provides an approach/impact hint)
  lon?: number;
  lat?: number;
};

type AsteroidState = {
  asteroid: EnhancedAsteroid | null;
  setAsteroid: (a: EnhancedAsteroid | null) => void;
  hydrateFromSession: () => void;
};

export const useAsteroidStore = create<AsteroidState>((set) => ({
  asteroid: null,
  setAsteroid: (a) => {
    if (a) {
      try { sessionStorage.setItem("selectedAsteroid", JSON.stringify(a)); } catch {}
    } else {
      try { sessionStorage.removeItem("selectedAsteroid"); } catch {}
    }
    set({ asteroid: a });
  },
  hydrateFromSession: () => {
    try {
      const raw = sessionStorage.getItem("selectedAsteroid");
      if (raw) set({ asteroid: JSON.parse(raw) });
    } catch {}
  },
}));
