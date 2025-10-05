// src/debug.ts
export const DBG = true;
export const dlog = (...args: any[]) => { if (DBG) console.log(...args); };
export const dwarn = (...args: any[]) => { if (DBG) console.warn(...args); };
export const dtime = (label: string) => DBG && console.time(label);
export const dtimeEnd = (label: string) => DBG && console.timeEnd(label);