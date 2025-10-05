// import { create } from "zustand";

// type SimState = {
//   asteroidPos: [number, number, number]; // world position
//   asteroidAlive: boolean;
//   setAsteroidPos: (p: [number, number, number]) => void;
//   destroyAsteroid: () => void;
//   resetAsteroid: () => void;
// };

// export const useSimStore = create<SimState>((set) => ({
//   asteroidPos: [9999, 9999, 9999], // far away until first update
//   asteroidAlive: true,
//   setAsteroidPos: (p) => set({ asteroidPos: p }),
//   destroyAsteroid: () => set({ asteroidAlive: false }),
//   resetAsteroid: () => set({ asteroidAlive: true, asteroidPos: [9999, 9999, 9999] }),

// }));


// import { create } from "zustand";

// export type RocketParams = {
//   massKg: number;
//   speed: number;     // units/sec (your scene units)
//   angleDeg: number;  // user-facing angle input
// };

// type SimPhase = "idle" | "running" | "done";

// type SimState = {
//   // asteroid telemetry (already useful for missile guidance later)
//   asteroidPos: [number, number, number];
//   asteroidAlive: boolean;

//   // user-configurable rocket params
//   rocket: RocketParams;

//   // run loop state
//   phase: SimPhase;
//   launchNonce: number; // bump to remount/reset missile/asteroid cleanly

//   // setters/actions
//   setAsteroidPos: (p: [number, number, number]) => void;
//   setAsteroidAlive: (alive: boolean) => void;

//   setRocket: (p: Partial<RocketParams>) => void;

//   startRun: () => void;
//   endRun: () => void;       // call when a run naturally ends
//   resetToIdle: () => void;  // manual reset back to idle (shows PLAY)
// };

// export const useSimStore = create<SimState>((set) => ({
//   asteroidPos: [9999, 9999, 9999],
//   asteroidAlive: true,

//   rocket: { massKg: 1000, speed: 2.5, angleDeg: 0 },

//   phase: "idle",
//   launchNonce: 0,

//   setAsteroidPos: (p) => set({ asteroidPos: p }),
//   setAsteroidAlive: (alive) => set({ asteroidAlive: alive }),

//   setRocket: (p) =>
//     set((s) => ({ rocket: { ...s.rocket, ...p } })),

//   startRun: () =>
//     set((s) => ({
//       phase: "running",
//       launchNonce: s.launchNonce + 1, // forces fresh mount (resets asteroid & missile)
//       asteroidAlive: true,            // new run = asteroid is alive again
//     })),

//   endRun: () => set({ phase: "done" }),
//   resetToIdle: () => set({ phase: "idle" }),
// }));



import { create } from "zustand";

export type RocketParams = {
  massKg: number;     // user input for mass
  speed: number;      // missile speed (scene units / sec)
  angleDeg: number;   // missile launch angle (deg)
};

export type SimPhase = "idle" | "running" | "done";

type SimState = {
  // --- Asteroid telemetry/state (used by Missile & scene) ---
  asteroidPos: [number, number, number];
  asteroidAlive: boolean;
  setAsteroidPos: (p: [number, number, number]) => void;
  setAsteroidAlive: (alive: boolean) => void;
  destroyAsteroid: () => void;
  resetAsteroid: () => void;

  // --- Rocket params (Mission bottom panel) ---
  rocket: RocketParams;
  setRocket: (p: Partial<RocketParams>) => void;

  // --- Run lifecycle / control (Mission flow) ---
  phase: SimPhase;        // "idle" (show PLAY), "running" (sim active), "done" (show PLAY AGAIN)
  launchNonce: number;    // increment to force fresh mounts per run
  startRun: () => void;   // set running + bump nonce + reset asteroid alive
  endRun: () => void;     // sim finished
  resetToIdle: () => void; // manually go back to idle
};

export const useSimStore = create<SimState>((set, get) => ({
  // asteroid defaults
  asteroidPos: [9999, 9999, 9999],
  asteroidAlive: true,
  setAsteroidPos: (p) => set({ asteroidPos: p }),
  setAsteroidAlive: (alive) => set({ asteroidAlive: alive }),
  destroyAsteroid: () => set({ asteroidAlive: false }),
  resetAsteroid: () => set({ asteroidAlive: true, asteroidPos: [9999, 9999, 9999] }),

  // rocket defaults
  rocket: { massKg: 1000, speed: 2.5, angleDeg: 0 },
  setRocket: (p) => set((s) => ({ rocket: { ...s.rocket, ...p } })),

  // run control
  phase: "idle",
  launchNonce: 0,
  startRun: () =>
    set((s) => ({
      phase: "running",
      launchNonce: s.launchNonce + 1,
      asteroidAlive: true,                   // new run assumes asteroid is back
      asteroidPos: [9999, 9999, 9999],      // clear last pos (optional)
    })),
  endRun: () => set({ phase: "done" }),
  resetToIdle: () => set({ phase: "idle" }),
}));

