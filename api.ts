// src/api.ts
export const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5050";

export type ImpactResponse = {
  // Top-level mirrors (added by backend for UI convenience)
  name?: string;
  diameter_km?: number;
  density_kg_m3?: number;
  mass_kg?: number;
  velocity_km_s?: number;
  energy_J?: number;
  energy_MtTNT?: number;
  crater_diameter_km?: number;
  approach?: string | null;
  distance_ld?: number | null;
  orbiting_body?: string | null;
  neo_display_name?: string | null;

  // Nested structures
  input?: {
    query: string;
    velocity_km_s: number;
    albedo_assumed_if_H_used?: number | null;
    api_key_used: boolean;
  };
  physical?: {
    diameter_km: number;
    density_kg_m3: number;
    mass_kg: number;
  };
  impact?: {
    velocity_km_s: number;
    energy_J: number;
    energy_MtTNT: number;
    crater_diameter_km: number;
    seismic_Mw_equivalent: number;
  };
  orbit?: {
    class: string;
    elements: Record<string, string>;
  };
  sources?: {
    sbdb: boolean;
    neows: boolean;
  };
};

export type DamageResponse = {
  target: string;
  inputs: {
    mass_kg: number;
    velocity_km_s: number;
  };
  results: {
    energy_j: number;
    yield_megatons: number;
    radii_km: {
      light: number;
      moderate: number;
      severe: number;
    };
    crater_diameter_km: number;
  };
};

export type StateResponse = {
  target: string;
  frame: string;
  jd: number;
  position_AU: {
    x: number;
    y: number;
    z: number;
  };
  distance_AU: number;
  earth_position_AU?: {
    x: number;
    y: number;
    z: number;
  } | null;
};

export type DeflectionResponse = {
  target: string;
  frame: string;
  jd: number;
  inputs: {
    m_asteroid_kg: number;
    m_impactor_kg?: number | null;
    beta: number;
    vector_mode: boolean;
    preset_meta?: {
      mode: string;
      direction_unit: { x: number; y: number; z: number };
      delta_v_m_s: number;
      implied_closing_speed_km_s?: number;
    } | null;
  };
  pre_impact: {
    velocity_km_s: { x: number; y: number; z: number };
    speed_km_s: number;
    energy_MtTNT: number;
  };
  post_impact: {
    velocity_km_s: { x: number; y: number; z: number };
    speed_km_s: number;
    delta_v_km_s: { x: number; y: number; z: number };
    delta_v_mag_m_s: number;
    energy_MtTNT: number;
  };
  orbit_effects_approx: {
    a_old_AU: number;
    a_new_AU: number;
    delta_a_frac: number;
    P_old_days: number;
    P_new_days: number;
    delta_P_frac: number;
    note: string;
  };
};

export type ImpactPointResponse = {
  target: string;
  mode: string;
  jd_start: number;
  hit?: boolean;
  time_to_impact_s?: number;
  jd_impact?: number;
  impact_point?: {
    lat_deg: number;
    lon_deg: number;
    alt_km: number;
  };
  vectors?: {
    r_eci_km: { x: number; y: number; z: number };
    v_eci_km_s: { x: number; y: number; z: number };
    r_ecef_km: { x: number; y: number; z: number };
  };
  params?: {
    earth_radius_km: number;
    entry_alt_km: number;
    speed_km_s_used: number;
  };
  closest_approach?: {
    t_star_s: number;
    jd_star: number;
    range_min_km: number;
  };
  note?: string;
  limitations: string;
};

export async function fetchImpact(target: string): Promise<ImpactResponse> {
  const r = await fetch(
    `${API_BASE}/impact?target=${encodeURIComponent(target)}`
  );
  if (!r.ok) throw new Error(`Impact fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchDamage(
  target: string,
  massKg?: number,
  velocityKmS?: number
): Promise<DamageResponse> {
  const params = new URLSearchParams({ target });
  if (massKg !== undefined) params.append("mass_kg", massKg.toString());
  if (velocityKmS !== undefined)
    params.append("velocity_km_s", velocityKmS.toString());

  const r = await fetch(`${API_BASE}/damage?${params}`);
  if (!r.ok) throw new Error(`Damage fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchState(
  target: string,
  jd?: number,
  frame: "geo" | "helio" = "geo"
): Promise<StateResponse> {
  const params = new URLSearchParams({ target, frame });
  if (jd !== undefined) params.append("jd", jd.toString());

  const r = await fetch(`${API_BASE}/state?${params}`);
  if (!r.ok) throw new Error(`State fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchDeflection(params: {
  target: string;
  jd?: number;
  frame?: "geo" | "helio";
  mode?: string;
  delta_v_m_s?: number;
  vix?: number;
  viy?: number;
  viz?: number;
  m_impactor_kg?: number;
  beta?: number;
}): Promise<DeflectionResponse> {
  const searchParams = new URLSearchParams({ target: params.target });
  if (params.jd !== undefined) searchParams.append("jd", params.jd.toString());
  if (params.frame) searchParams.append("frame", params.frame);
  if (params.mode) searchParams.append("mode", params.mode);
  if (params.delta_v_m_s !== undefined)
    searchParams.append("delta_v_m_s", params.delta_v_m_s.toString());
  if (params.vix !== undefined) searchParams.append("vix", params.vix.toString());
  if (params.viy !== undefined) searchParams.append("viy", params.viy.toString());
  if (params.viz !== undefined) searchParams.append("viz", params.viz.toString());
  if (params.m_impactor_kg !== undefined)
    searchParams.append("m_impactor_kg", params.m_impactor_kg.toString());
  if (params.beta !== undefined)
    searchParams.append("beta", params.beta.toString());

  const r = await fetch(`${API_BASE}/deflect_kinetic?${searchParams}`);
  if (!r.ok) throw new Error(`Deflection fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchImpactPoint(params: {
  target: string;
  jd?: number;
  mode?: "real" | "aim_earth";
  entry_alt_km?: number;
  earth_radius_km?: number;
  speed_km_s?: number;
}): Promise<ImpactPointResponse> {
  const searchParams = new URLSearchParams({ target: params.target });
  if (params.jd !== undefined) searchParams.append("jd", params.jd.toString());
  if (params.mode) searchParams.append("mode", params.mode);
  if (params.entry_alt_km !== undefined)
    searchParams.append("entry_alt_km", params.entry_alt_km.toString());
  if (params.earth_radius_km !== undefined)
    searchParams.append("earth_radius_km", params.earth_radius_km.toString());
  if (params.speed_km_s !== undefined)
    searchParams.append("speed_km_s", params.speed_km_s.toString());

  const r = await fetch(`${API_BASE}/impact_point?${searchParams}`);
  if (!r.ok) throw new Error(`Impact point fetch failed: ${r.status}`);
  return r.json();
}