# app.py
import os
import math
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Tuple

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# -----------------------------------------
# Config
# -----------------------------------------
NASA_API_KEY = os.getenv("NASA_API_KEY", "DEMO_KEY")
REQ_TIMEOUT = (5, 20)  # (connect, read) seconds

app = Flask(__name__)
CORS(app)
# -----------------------------------------
# Vector helpers & constants
# -----------------------------------------
AU_KM = 149_597_870.7
SECS_PER_DAY = 86400.0
AU_PER_DAY_TO_KM_PER_S = AU_KM / SECS_PER_DAY  # ≈ 1731.456 km/s
MU_SUN = 1.32712440018e20     # m^3/s^2
AU_M   = 1.495978707e11       # m

def vec_add(a,b):   return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
def vec_sub(a,b):   return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
def vec_scale(a,s): return [a[0]*s, a[1]*s, a[2]*s]
def vec_dot(a,b):   return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
def vec_norm(a):    return math.sqrt(vec_dot(a,a))
def vec_cross(a,b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def unit(a):
    n = vec_norm(a)
    return [a[0]/n, a[1]/n, a[2]/n] if n > 0 else [0.0,0.0,0.0]

def clamp01(x): return max(0.0, min(1.0, x))

# -----------------------------------------
# Physics helpers
# -----------------------------------------
def mass_from_diameter(d_km: float, rho_kg_m3: float = 3000.0) -> float:
    """Mass (kg) from diameter (km) and density (kg/m^3)."""
    D_m = d_km * 1000.0
    volume = (4.0 / 3.0) * math.pi * (D_m / 2.0) ** 3
    return rho_kg_m3 * volume

def impact_energy(mass_kg: float, velocity_km_s: float) -> dict:
    """Kinetic energy in Joules and megatons TNT."""
    v_m_s = velocity_km_s * 1000.0
    E_J = 0.5 * mass_kg * v_m_s * v_m_s
    return {"E_J": E_J, "E_MtTNT": E_J / 4.184e15}

def crater_diameter(E_J: float) -> float:
    """Approx transient crater diameter (meters)."""
    return 0.07 * (E_J ** 0.25)

def equivalent_magnitude(E_J: float) -> float:
    """Very rough mapping: impact energy (J) -> moment magnitude."""
    return (2.0 / 3.0) * (math.log10(E_J) - 4.8)

def diameter_from_H(H: float, pV: float = 0.14) -> float:
    """Estimate diameter (km) from absolute magnitude H and albedo pV."""
    return 1329.0 / (pV ** 0.5) * (10 ** (-H / 5.0))

def orbital_period_days_from_a(a_au: float) -> float:
    """Kepler's 3rd law using Gaussian constant (days)."""
    n = K_GAUSS / (a_au ** 1.5)  # rad/day
    return 2.0 * math.pi / n

def _to_float(x):
    try:
        return float(x)
    except Exception:
        return None

# -----------------------------------------
# SBDB & NeoWs retrievers
# -----------------------------------------
@lru_cache(maxsize=256)
def get_sbdb_data(name_or_id: str) -> dict:
    """
    Fetch physical/orbital data from JPL SBDB.
    Returns density, diameter (if present), orbit_class, orbital elements,
    the orbit epoch (JD) and mean anomaly at that epoch.
    """
    url = f"https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={name_or_id}&phys-par=true"
    r = requests.get(url, timeout=REQ_TIMEOUT)
    r.raise_for_status()
    data = r.json()

    orbit_obj = data.get("orbit", {}) or {}
    orbital_list = orbit_obj.get("elements", []) or []

    density, diameter = None, None
    orbit_class = data.get("object", {}).get("orbit_class", {}).get("code", "")

    # Extract physical parameters if present
    for block in ("phys_par", "phys_pars"):
        if block in data:
            for item in data[block]:
                nm = (item.get("name") or "").lower()
                if nm == "density":
                    density = _to_float(item.get("value"))
                elif nm == "diameter":
                    diameter = _to_float(item.get("value"))

    # Fallback density by class
    if density is None:
        density = 3000.0 if orbit_class.upper().startswith(("AMO", "APO", "ATE")) else 2000.0

    # Collect orbital elements by 'name' field (e, a, q, i, om, w, ma, per, tp, n, ad/Q...)
    orbital_elements = {}
    for elem in orbital_list:
        nm = elem.get("name")
        if nm and "value" in elem:
            orbital_elements[nm] = elem["value"]

    # Orbit epoch & mean anomaly
    orbit_epoch_jd = _to_float(orbit_obj.get("cov_epoch"))
    mean_anomaly_deg = _to_float(orbital_elements.get("ma") or orbital_elements.get("M"))

    return {
        "source": "SBDB",
        "density": density,
        "diameter_km": diameter,
        "orbit_class": orbit_class,
        "orbital_elements": orbital_elements,  # strings
        "orbit_epoch_jd": orbit_epoch_jd,      # float JD if provided
        "mean_anomaly_deg": mean_anomaly_deg,  # float deg if provided
    }

@lru_cache(maxsize=256)
def get_neows_data(neo_id: str, api_key: str = NASA_API_KEY) -> dict | None:
    """
    Fetch NEO object from NeoWs by id. Returns mean diameter (km) and an
    Earth close-approach velocity/date/distance when available.
    """
    url = f"https://api.nasa.gov/neo/rest/v1/neo/{neo_id}?api_key={api_key}"
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        return None
    data = r.json()

    # --- mean diameter from min/max ---
    d_mean = None
    try:
        kms = (data.get("estimated_diameter") or {}).get("kilometers") or {}
        dmin = float(kms.get("estimated_diameter_min"))
        dmax = float(kms.get("estimated_diameter_max"))
        d_mean = 0.5 * (dmin + dmax)
    except Exception:
        pass

    # --- choose an Earth close-approach if present ---
    cad = data.get("close_approach_data") or []
    earth = [c for c in cad if (c.get("orbiting_body") or "").lower() == "earth"]
    ca = earth[0] if earth else (cad[0] if cad else None)

    velocity = None
    approach_date = None
    orbiting_body = None
    miss_km = None
    miss_ld = None

    if ca:
        try:
            velocity = float((ca.get("relative_velocity") or {}).get("kilometers_per_second"))
        except Exception:
            pass
        approach_date = ca.get("close_approach_date_full") or ca.get("close_approach_date")
        orbiting_body = ca.get("orbiting_body")
        try:
            miss_km = float((ca.get("miss_distance") or {}).get("kilometers"))
        except Exception:
            pass
        try:
            miss_ld = float((ca.get("miss_distance") or {}).get("lunar"))
        except Exception:
            pass

    return {
        "source": "NeoWs",
        "name": data.get("name"),
        "absolute_magnitude_h": data.get("absolute_magnitude_h"),
        "estimated_diameter_km_mean": d_mean,     # <— numeric
        "velocity_km_s": velocity,                # <— numeric (km/s)
        "approach_date": approach_date,           # <— string
        "orbiting_body": orbiting_body,           # <— "Earth" usually
        "miss_distance": {"kilometers": miss_km, "lunar": miss_ld},  # <— numeric
    }

# -----------------------------------------
# Impact profile
# -----------------------------------------
def build_impact_profile(name_or_id: str, velocity_km_s: float | None, api_key: str) -> dict:
    sbdb = get_sbdb_data(name_or_id)
    neows = get_neows_data(name_or_id, api_key)

    # --- diameter priority: SBDB > NeoWs mean > H-derived ---
    d_km = sbdb["diameter_km"]
    if d_km is None and neows and neows.get("estimated_diameter_km_mean") is not None:  # UPDATED
        d_km = float(neows["estimated_diameter_km_mean"])
    if d_km is None and neows and neows.get("absolute_magnitude_h") is not None:
        d_km = diameter_from_H(float(neows["absolute_magnitude_h"]), pV=0.14)
    if d_km is None:
        raise ValueError("No diameter available from SBDB/NeoWs; cannot compute impact properties.")

    rho = float(sbdb["density"])
    vel = float(velocity_km_s) if velocity_km_s is not None else (
        float(neows["velocity_km_s"]) if (neows and neows["velocity_km_s"] is not None) else 20.0
    )

    mass = mass_from_diameter(d_km, rho)
    energy = impact_energy(mass, vel)
    crater_m = crater_diameter(energy["E_J"])
    Mw = equivalent_magnitude(energy["E_J"])

    result = {
        "input": {
            "query": name_or_id,
            "velocity_km_s": vel,
            "albedo_assumed_if_H_used": 0.14 if (sbdb["diameter_km"] is None and (neows is None or neows.get("estimated_diameter_km_mean") is None)) else None,  # UPDATED
            "api_key_used": (api_key != "DEMO_KEY"),
        },
        "physical": {
            "diameter_km": d_km,
            "density_kg_m3": rho,
            "mass_kg": mass,
        },
        "impact": {
            "velocity_km_s": vel,
            "energy_J": energy["E_J"],
            "energy_MtTNT": energy["E_MtTNT"],
            "crater_diameter_km": crater_m / 1000.0,
            "seismic_Mw_equivalent": Mw,
        },
        "orbit": {
            "class": sbdb["orbit_class"],
            "elements": sbdb["orbital_elements"],
        },
        "sources": {"sbdb": True, "neows": neows is not None},
    }

    # --- Top-level mirrors (NEW) for the UI ---
    result["name"] = (neows.get("name") if neows else None) or name_or_id   # NEW
    result["diameter_km"] = float(d_km)                                      # NEW
    result["density_kg_m3"] = rho
    result["mass_kg"] = mass
    result["velocity_km_s"] = vel
    result["energy_J"] = energy["E_J"]
    result["energy_MtTNT"] = energy["E_MtTNT"]
    result["crater_diameter_km"] = crater_m / 1000.0

    if neows:
        result["approach"] = neows.get("approach_date")                      # NEW
        # expose numeric LD distance at top-level (NEW)
        try:
            result["distance_ld"] = float((neows.get("miss_distance") or {}).get("lunar"))
        except Exception:
            result["distance_ld"] = None
        result["orbiting_body"] = neows.get("orbiting_body")
        result["neo_display_name"] = neows.get("name")

    return result

# -----------------------------------------
# Simple Keplerian propagation (for /state)
# -----------------------------------------
K_GAUSS = 0.01720209895  # AU^(3/2) / day (sqrt(mu_sun))

@dataclass
class KeplerElements:
    a: float       # AU
    e: float       # -
    i: float       # deg
    Omega: float   # deg (ascending node)
    omega: float   # deg (argument of perihelion)
    M0: float      # deg (mean anomaly at epoch)
    epoch: float   # JD of M0

def _deg2rad(d): return d * math.pi / 180.0

def _rz(v, ang):
    c, s = math.cos(ang), math.sin(ang)
    x, y, z = v
    return (c*x - s*y, s*x + c*y, z)

def _rx(v, ang):
    c, s = math.cos(ang), math.sin(ang)
    x, y, z = v
    return (x, c*y - s*z, s*y + c*z)

def jd_now():
    # JD at Unix epoch is 2440587.5
    return time.time() / 86400.0 + 2440587.5

def propagate_to_cartesian(el: KeplerElements, t_jd: float):
    """Heliocentric ecliptic J2000 Cartesian (AU, AU/day) from Kepler elements."""
    a, e = el.a, el.e
    n = K_GAUSS / (a ** 1.5)                          # rad/day
    M = _deg2rad(el.M0) + n * (t_jd - el.epoch)

    # Solve Kepler: M = E - e sin E
    E = M if e < 0.8 else math.pi
    for _ in range(20):
        dE = -(E - e*math.sin(E) - M) / (1 - e*math.cos(E))
        E += dE
        if abs(dE) < 1e-12:
            break

    nu = 2 * math.atan2(math.sqrt(1+e)*math.sin(E/2), math.sqrt(1-e)*math.cos(E/2))
    r  = a * (1 - e * math.cos(E))                    # AU

    # In-plane pos/vel
    x_orb, y_orb, z_orb = r*math.cos(nu), r*math.sin(nu), 0.0
    rdot  = (K_GAUSS/a)/r * e*math.sin(nu)            # AU/day
    fdot  = (K_GAUSS/a)/r * math.sqrt(1 - e*e)        # rad/day
    vx_orb = rdot*math.cos(nu) - r*fdot*math.sin(nu)
    vy_orb = rdot*math.sin(nu) + r*fdot*math.cos(nu)
    vz_orb = 0.0

    # Rotate by ω, i, Ω
    i, Om, om = _deg2rad(el.i), _deg2rad(el.Omega), _deg2rad(el.omega)
    r_vec = _rz(_rx(_rz((x_orb, y_orb, z_orb), om), i), Om)
    v_vec = _rz(_rx(_rz((vx_orb, vy_orb, vz_orb), om), i), Om)
    return r_vec, v_vec

def get_earth_elements() -> KeplerElements:
    """Mean J2000 elements for Earth (sufficient for visualization & geocentric transform)."""
    return KeplerElements(
        a=1.00000011, e=0.01671022, i=0.00005,
        Omega=-11.26064, omega=102.94719,
        M0=100.46435, epoch=2451545.0  # J2000
    )

# -----------------------------------------
# Damage (Simulation 1)
# -----------------------------------------
def meteor_damage_approx(
    mass_kg: float,
    velocity_m_s: float,
    *,
    damage_constants_km: Tuple[float, float, float] = (16.0, 6.0, 2.2),  # light, moderate, severe
    crater_coeff_km: float = 0.405
) -> Dict[str, object]:
    """
    Compute approximate damage radii and crater diameter from a meteoroid's mass and velocity.
    Formulas (airburst-oriented approximations):
      1) E = 0.5 m v^2 (J)
      2) Y = E / 4.184e15 (Mt TNT)
      3) R_km = C * Y^(1/3) with C = 16, 6, 2.2 (light/moderate/severe)
      4) D_km = 0.405 * Y^(1/3) (very rough, ground-impact)
    """
    if mass_kg <= 0 or velocity_m_s <= 0:
        raise ValueError("mass_kg and velocity_m_s must be positive numbers.")
    energy_j = 0.5 * mass_kg * (velocity_m_s ** 2)
    yield_megatons = energy_j / 4.184e15
    y_cuberoot = yield_megatons ** (1.0 / 3.0)
    c_light, c_mod, c_sev = damage_constants_km
    radii_km = {
        "light": c_light * y_cuberoot,
        "moderate": c_mod * y_cuberoot,
        "severe": c_sev * y_cuberoot,
    }
    crater_diameter_km = crater_coeff_km * y_cuberoot
    return {
        "energy_j": energy_j,
        "yield_megatons": yield_megatons,
        "radii_km": radii_km,
        "crater_diameter_km": crater_diameter_km,
    }

# -----------------------------------------
# Earth rotation / impact helpers
# -----------------------------------------
EARTH_RADIUS_KM_MEAN = 6371.0
OMEGA_EARTH_RAD_S = 7.2921150e-5  # not directly used here

def gmst_from_jd(jd: float) -> float:
    """Greenwich Mean Sidereal Time (radians) from JD (IAU 1982 approx)."""
    T = (jd - 2451545.0) / 36525.0
    gmst_deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T*T - (T**3) / 38710000.0
    return math.radians(gmst_deg % 360.0)

def eci_to_ecef(r_eci_km: list, jd: float) -> list:
    """Rotate inertial (toy ECI) to Earth-fixed (ECEF) via GMST (spherical demo)."""
    theta = gmst_from_jd(jd)
    c, s = math.cos(theta), math.sin(theta)
    x, y, z = r_eci_km
    x_e =  c * x + s * y
    y_e = -s * x + c * y
    z_e =  z
    return [x_e, y_e, z_e]

def ecef_to_geodetic_sphere(r_ecef_km: list, R_km: float = EARTH_RADIUS_KM_MEAN) -> dict:
    """Spherical Earth geodetic conversion (good enough for a demo)."""
    x, y, z = r_ecef_km
    rho = math.hypot(x, y)
    r   = math.sqrt(x*x + y*y + z*z)
    lat_rad = math.atan2(z, rho)
    lon_rad = math.atan2(y, x)
    alt_km  = r - R_km
    return {
        "lat_deg": math.degrees(lat_rad),
        "lon_deg": (math.degrees(lon_rad) + 540.0) % 360.0 - 180.0,
        "alt_km": alt_km
    }

def ray_sphere_intersection_time(r0_km: list, v_km_s: list, R_km: float) -> dict:
    """Solve |r0 + v t| = R for t (seconds). Smallest positive root -> impact."""
    rx, ry, rz = r0_km
    vx, vy, vz = v_km_s
    a = vx*vx + vy*vy + vz*vz
    b = 2.0 * (rx*vx + ry*vy + rz*vz)
    c = rx*rx + ry*ry + rz*rz - R_km*R_km
    disc = b*b - 4*a*c
    if disc < 0:
        return {"hit": False, "t_s": None, "desc": "No intersection (discriminant < 0)", "d_min_km": None}
    sqrtD = math.sqrt(disc)
    t1 = (-b - sqrtD) / (2*a)
    t2 = (-b + sqrtD) / (2*a)
    ts = [t for t in (t1, t2) if t >= 0]
    if not ts:
        t_star = -b / (2*a)
        r_star = [rx + vx*t_star, ry + vy*t_star, rz + vz*t_star]
        d_min = vec_norm(r_star)
        return {"hit": False, "t_s": None, "desc": "Intersection in past", "d_min_km": d_min}
    return {"hit": True, "t_s": min(ts), "desc": "OK", "d_min_km": None}

# -----------------------------------------
# Kepler from state + orbit sampling (for dashboard)
# -----------------------------------------
def normalize_angle_deg(rad: float) -> float:
    d = math.degrees(rad) % 360.0
    return d if d >= 0 else d + 360.0

def kepler_from_rv(r_AU: list, v_km_s: list, epoch_jd: float) -> 'KeplerElements':
    """
    Convert heliocentric state (AU, km/s) -> Kepler elements (J2000) at epoch_jd.
    Assumes bound (elliptical) orbit (e<1). Good for NEOs.
    """
    # to SI
    r_m = [c * AU_M for c in r_AU]
    v_m = [c * 1000.0 for c in v_km_s]

    r = vec_norm(r_m)
    v2 = vec_dot(v_m, v_m)
    # specific angular momentum
    h = vec_cross(r_m, v_m)
    h_norm = vec_norm(h)
    # inclination
    i = math.acos(max(-1.0, min(1.0, h[2] / h_norm)))
    # node vector (k x h)
    n = vec_cross([0.0, 0.0, 1.0], h)
    n_norm = vec_norm(n)
    # eccentricity vector
    e_vec = vec_sub(vec_scale(vec_cross(v_m, h), 1.0 / MU_SUN), vec_scale(r_m, 1.0 / r))
    e = vec_norm(e_vec)
    # semi-major axis from vis-viva
    eps = 0.5 * v2 - MU_SUN / r  # specific orbital energy
    a = -MU_SUN / (2.0 * eps)    # meters (elliptic)
    # RAAN
    Omega = math.atan2(n[1], n[0]) if n_norm > 1e-12 else 0.0
    # argument of periapsis
    if n_norm > 1e-12 and e > 1e-10:
        cosw = vec_dot(n, e_vec) / (n_norm * e)
        sinw = (n[0]*e_vec[1] - n[1]*e_vec[0]) / (n_norm * e)
        omega = math.atan2(sinw, max(-1.0, min(1.0, cosw)))
    else:
        omega = 0.0
    # eccentric anomaly / mean anomaly (elliptic)
    if e < 1.0 and a > 0:
        rdotv = vec_dot(r_m, v_m)
        E = math.atan2(rdotv / math.sqrt(MU_SUN * a), 1.0 - r / a)
        M = E - e * math.sin(E)
        M_deg = normalize_angle_deg(M)
    else:
        M_deg = 0.0

    return KeplerElements(
        a=a / AU_M,
        e=e,
        i=normalize_angle_deg(i),
        Omega=normalize_angle_deg(Omega),
        omega=normalize_angle_deg(omega),
        M0=M_deg,
        epoch=epoch_jd
    )

def sample_orbit(el: KeplerElements, start_jd: float, window_days: float, samples: int,
                 include_helio: bool = True, include_geo: bool = True) -> dict:
    """
    Sample positions along an orbit from start_jd to start_jd+window_days.
    Returns arrays (AU) ready for plotting.
    """
    samples = max(2, min(int(samples), 1000))
    times = [start_jd + window_days * i / (samples - 1) for i in range(samples)]
    out_helio, out_geo = [], []

    for t in times:
        r, _ = propagate_to_cartesian(el, t)
        if include_helio:
            out_helio.append([r[0], r[1], r[2]])
        if include_geo:
            re, _ = propagate_to_cartesian(get_earth_elements(), t)
            out_geo.append([r[0] - re[0], r[1] - re[1], r[2] - re[2]])

    return {
        "t_jd": times,
        "helio_AU": out_helio if include_helio else None,
        "geo_AU": out_geo if include_geo else None
    }

# -----------------------------------------
# Routes: health, impact, state
# -----------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})

@app.route("/impact", methods=["GET"])
def impact():
    """
    GET /impact?target=Eros&velocity_km_s=5.3&api_key=YOUR_KEY
    Returns impact features (mass, energy, crater, Mw) + orbit metadata,
    plus top-level mirrors for key fields.
    """
    target = request.args.get("target") or request.args.get("id") or request.args.get("name")
    if not target:
        return jsonify({"error": "Missing 'target' (name or NEO id)."}), 400

    vel = request.args.get("velocity_km_s", type=float)
    api_key = request.args.get("api_key", default=NASA_API_KEY)

    try:
        profile = build_impact_profile(target, vel, api_key)
        return jsonify(profile), 200
    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

@app.route("/state", methods=["GET"])
def state():
    """
    GET /state?target=2000433&jd=2451545.0&frame=geo|helio
    Returns heliocentric or geocentric position (AU) at a given Julian date.
    - frame default: geo
    - jd default: now (approx)
    """
    target = request.args.get("target")
    if not target:
        return jsonify({"error": "Missing 'target'"}), 400

    jd = request.args.get("jd", type=float) or jd_now()
    frame = (request.args.get("frame") or "geo").lower()

    try:
        sb = get_sbdb_data(target)
        els = sb["orbital_elements"]

        # Build asteroid elements from SBDB
        a = _to_float(els.get("a"))
        e = _to_float(els.get("e"))
        i = _to_float(els.get("i"))
        Om = _to_float(els.get("om"))
        w  = _to_float(els.get("w"))
        M0 = sb["mean_anomaly_deg"] if sb["mean_anomaly_deg"] is not None else 0.0
        epoch = sb["orbit_epoch_jd"] if sb["orbit_epoch_jd"] is not None else 2451545.0

        if None in (a, e, i, Om, w):
            return jsonify({"error": "Insufficient orbital elements from SBDB to compute state."}), 422

        el_ast = KeplerElements(a=a, e=e, i=i, Omega=Om, omega=w, M0=M0, epoch=epoch)
        r_ast, v_ast = propagate_to_cartesian(el_ast, jd)
        r_e, v_e     = propagate_to_cartesian(get_earth_elements(), jd)

        if frame == "helio":
            r = r_ast
            tag = "heliocentric_ecliptic_J2000"
            earth_vec = None
        else:
            r = (r_ast[0]-r_e[0], r_ast[1]-r_e[1], r_ast[2]-r_e[2])
            tag = "geocentric_ecliptic_J2000"
            earth_vec = {"x": r_e[0], "y": r_e[1], "z": r_e[2]}

        dist_au = math.sqrt(r[0]**2 + r[1]**2 + r[2]**2)

        return jsonify({
            "target": target,
            "frame": tag,
            "jd": jd,
            "position_AU": {"x": r[0], "y": r[1], "z": r[2]},
            "distance_AU": dist_au,
            "earth_position_AU": earth_vec
        }), 200

    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

# -----------------------------------------
# /damage (Simulation 1)
# -----------------------------------------
@app.route("/damage", methods=["GET"])
def damage():
    """
    GET /damage?target=2000433
    Optional overrides:
      &mass_kg=...               (if omitted, mass is computed from diameter*density)
      &velocity_km_s=...         (if omitted, uses NeoWs approach speed or 20 km/s)
    Returns the damage radii (light/moderate/severe), yield, crater estimate, with inputs echoed.
    """
    print("\n[DAMAGE ENDPOINT] Request received")
    print("[DAMAGE ENDPOINT] Query params:", dict(request.args))
    
    target = request.args.get("target")
    if not target:
        print("[DAMAGE ENDPOINT] Error: Missing target parameter")
        return jsonify({"error": "Missing 'target'"}), 400
    print(f"[DAMAGE ENDPOINT] Target: {target}")

    mass_override = request.args.get("mass_kg", type=float)
    vel_km_s_override = request.args.get("velocity_km_s", type=float)
    api_key = request.args.get("api_key", default=NASA_API_KEY)
    print("[DAMAGE ENDPOINT] Overrides:", {
        "mass_kg": mass_override,
        "velocity_km_s": vel_km_s_override,
        "using_demo_key": api_key == "DEMO_KEY"
    })

    c_light = request.args.get("c_light_km", type=float)
    c_mod   = request.args.get("c_mod_km", type=float)
    c_sev   = request.args.get("c_sev_km", type=float)
    c_crtr  = request.args.get("crater_coeff_km", type=float)
    print("[DAMAGE ENDPOINT] Custom constants:", {
        "c_light_km": c_light,
        "c_mod_km": c_mod,
        "c_sev_km": c_sev,
        "crater_coeff_km": c_crtr
    })

    try:
        print("\n[DAMAGE ENDPOINT] Building impact profile...")
        profile = build_impact_profile(target, vel_km_s_override, api_key)
        print("[DAMAGE ENDPOINT] Impact profile:", {
            "name": profile.get("name"),
            "diameter_km": profile.get("diameter_km"),
            "velocity_km_s": profile.get("velocity_km_s"),
            "mass_kg": profile.get("mass_kg")
        })

        m = mass_override if (mass_override and mass_override > 0) else float(profile["physical"]["mass_kg"])
        v_km_s = float(profile["impact"]["velocity_km_s"])
        v_m_s = v_km_s * 1000.0
        print("[DAMAGE ENDPOINT] Using values:", {
            "mass_kg": m,
            "velocity_km_s": v_km_s
        })

        damage_consts = (
            (c_light if c_light else 16.0),
            (c_mod   if c_mod   else 6.0),
            (c_sev   if c_sev   else 2.2),
        )
        crater_coeff = c_crtr if c_crtr else 0.405
        print("[DAMAGE ENDPOINT] Using constants:", {
            "damage_constants_km": damage_consts,
            "crater_coeff_km": crater_coeff
        })

        print("\n[DAMAGE ENDPOINT] Calculating damage radii...")
        dmg = meteor_damage_approx(
            mass_kg=m,
            velocity_m_s=v_m_s,
            damage_constants_km=damage_consts,
            crater_coeff_km=crater_coeff
        )

        response_data = {
            "target": target,
            "inputs": {
              "mass_kg": m,
              "velocity_km_s": v_km_s
            },
            "constants_km": {
              "light": damage_consts[0],
              "moderate": damage_consts[1],
              "severe": damage_consts[2],
              "crater_coeff": crater_coeff
            },
            "results": dmg
        }
        print("\n[DAMAGE ENDPOINT] Success! Returning:", response_data)
        return jsonify(response_data), 200

    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

# -----------------------------------------
# /deflect_kinetic (Simulation 2) – vector mode + preset modes
# -----------------------------------------
def post_impact_velocity_vec(
    v_met_km_s: list,  # [vx, vy, vz]
    v_int_km_s: list,  # [vx, vy, vz]
    m_asteroid_kg: float,
    m_impactor_kg: float,
    beta: float = 1.0,
) -> dict:
    """Return new meteoroid velocity vector after a kinetic impact (vector mode)."""
    if m_asteroid_kg <= 0 or m_impactor_kg <= 0:
        raise ValueError("Masses must be positive.")
    u = vec_sub(v_int_km_s, v_met_km_s)                       # closing velocity (km/s)
    delta_v = vec_scale(u, beta * (m_impactor_kg / m_asteroid_kg))   # km/s
    v_plus = vec_add(v_met_km_s, delta_v)
    return {"v_plus_km_s": v_plus, "delta_v_km_s": delta_v}

@app.route("/deflect_kinetic", methods=["GET"])
def deflect_kinetic():
    """
    Two ways to call:

    A) Full vector (original behavior)
       /deflect_kinetic?target=2000433&frame=geo&jd=...&
         vix=...&viy=...&viz=...&m_impactor_kg=...&beta=1.0
       -> Uses Δv = β*(m_imp/m_ast)*(v_int - v_met)

    B) Preset mode (NEW)
       /deflect_kinetic?target=2000433&frame=geo&jd=...&
         mode=prograde|retrograde|radial_out|radial_in|normal_plus|normal_minus&
         delta_v_m_s=...
       (optional) &m_impactor_kg=...&beta=1.0 to report implied closing speed

       -> Applies Δv directly along chosen direction with magnitude delta_v_m_s.

    Returns:
      - pre/post velocity vectors (km/s), Δv (vector & magnitude)
      - approximate orbit effects: Δa/a and ΔP/P via tangential component
      - energies before/after (Mt TNT)
      - metadata about the chosen direction (for preset mode)
    """
    target = request.args.get("target")
    if not target:
        return jsonify({"error": "Missing 'target'"}), 400

    jd = request.args.get("jd", type=float) or jd_now()
    frame = (request.args.get("frame") or "geo").lower()  # default geocentric

    # Optional for energy baseline
    base_speed_override = request.args.get("velocity_km_s", type=float)
    api_key = request.args.get("api_key", default=NASA_API_KEY)

    # Choose vector vs preset
    has_vector = all(k in request.args for k in ("vix","viy","viz"))
    mode = (request.args.get("mode") or "").lower().strip()

    # Impactor params (optional in preset; required in vector)
    beta = request.args.get("beta", type=float) or 1.0
    m_imp_opt = request.args.get("m_impactor_kg", type=float)

    try:
        # Baseline mass & velocity
        profile = build_impact_profile(target, base_speed_override, api_key)
        m_ast = request.args.get("m_asteroid_kg", type=float) or float(profile["physical"]["mass_kg"])

        # Asteroid heliocentric state at jd
        sb = get_sbdb_data(target)
        els = sb["orbital_elements"]
        a_au = float(els["a"])
        el_ast = KeplerElements(
            a=float(els["a"]), e=float(els["e"]), i=float(els["i"]),
            Omega=float(els["om"]), omega=float(els["w"]),
            M0=sb["mean_anomaly_deg"] if sb["mean_anomaly_deg"] is not None else 0.0,
            epoch=sb["orbit_epoch_jd"] if sb["orbit_epoch_jd"] is not None else 2451545.0
        )
        r_ast_AU, v_ast_AUday = propagate_to_cartesian(el_ast, jd)
        v_ast_km_s = vec_scale(list(v_ast_AUday), AU_PER_DAY_TO_KM_PER_S)

        # Earth heliocentric (for geocentric frame if requested)
        r_e_AU, v_e_AUday = propagate_to_cartesian(get_earth_elements(), jd)
        v_e_km_s = vec_scale(list(v_e_AUday), AU_PER_DAY_TO_KM_PER_S)

        # Select velocity in requested frame for the meteoroid
        if frame == "geo":
            v_met_km_s = vec_sub(v_ast_km_s, v_e_km_s)
        else:
            v_met_km_s = v_ast_km_s

        # ========= Compute Δv =========
        meta_dir = {}
        if has_vector:
            # ---- Vector mode ----
            vix = float(request.args["vix"]); viy = float(request.args["viy"]); viz = float(request.args["viz"])
            if m_imp_opt is None or m_imp_opt <= 0:
                return jsonify({"error": "Provide positive m_impactor_kg for vector mode."}), 400
            out = post_impact_velocity_vec(v_met_km_s, [vix, viy, viz], m_ast, m_imp_opt, beta=beta)
            v_plus_km_s = out["v_plus_km_s"]
            delta_v_km_s_vec = out["delta_v_km_s"]

        elif mode in {"prograde","retrograde","radial_out","radial_in","normal_plus","normal_minus","normal"}:
            # ---- Preset mode ----
            delta_v_m_s = request.args.get("delta_v_m_s", type=float)
            if not delta_v_m_s:
                return jsonify({"error": "Preset mode requires 'delta_v_m_s' (m/s)."}), 400
            dv_mag_km_s = delta_v_m_s / 1000.0

            # Canonical directions from HELIOCENTRIC state
            r_helio_km = vec_scale(list(r_ast_AU), AU_KM)
            v_helio_km_s = v_ast_km_s
            r_hat = unit(r_helio_km)
            v_hat = unit(v_helio_km_s)
            h_hat = unit(vec_cross(r_helio_km, v_helio_km_s))  # orbital normal (+)

            if mode == "prograde":
                dir_hat = v_hat
            elif mode == "retrograde":
                dir_hat = vec_scale(v_hat, -1.0)
            elif mode == "radial_out":
                dir_hat = r_hat
            elif mode == "radial_in":
                dir_hat = vec_scale(r_hat, -1.0)
            elif mode in {"normal_plus","normal"}:
                dir_hat = h_hat
            elif mode == "normal_minus":
                dir_hat = vec_scale(h_hat, -1.0)
            else:
                return jsonify({"error": f"Unknown mode '{mode}'"}), 400

            delta_v_km_s_vec = vec_scale(dir_hat, dv_mag_km_s)
            v_plus_km_s = vec_add(v_met_km_s, delta_v_km_s_vec)

            meta_dir = {
                "mode": mode,
                "direction_unit": {"x": dir_hat[0], "y": dir_hat[1], "z": dir_hat[2]},
                "delta_v_m_s": delta_v_m_s
            }

            if m_imp_opt and m_imp_opt > 0:
                # |Δv| = β * (m_imp/m_ast) * |u|  =>  |u| = |Δv| / (β*m_imp/m_ast)
                u_needed_km_s = (dv_mag_km_s) / (beta * (m_imp_opt / m_ast))
                meta_dir["implied_closing_speed_km_s"] = u_needed_km_s

        else:
            return jsonify({"error": "Provide either vix,viy,viz + m_impactor_kg OR (mode + delta_v_m_s)."}), 400

        # ========= Orbit effects (approx via tangential Δv on HELIOCENTRIC velocity) =========
        v_orb_m_s = math.sqrt(MU_SUN / (a_au * AU_M))  # circular-speed-at-a (m/s)
        v_hat_helio = unit(v_ast_km_s)
        delta_v_tan_km_s = vec_dot(delta_v_km_s_vec, v_hat_helio)
        delta_a_frac = 2.0 * (delta_v_tan_km_s * 1000.0) / v_orb_m_s
        a_new_au = a_au * (1.0 + delta_a_frac)
        P_old_days = float(els["per"]) if "per" in els else orbital_period_days_from_a(a_au)
        delta_P_frac = 3.0 * delta_a_frac
        P_new_days = P_old_days * (1.0 + delta_P_frac)

        # Energies for context (before/after)
        base_speed_km_s = base_speed_override if base_speed_override is not None else float(profile["impact"]["velocity_km_s"])
        E_old = impact_energy(m_ast, base_speed_km_s)
        E_new = impact_energy(m_ast, vec_norm(v_plus_km_s))

        return jsonify({
            "target": target,
            "frame": "geocentric_ecliptic_J2000" if frame=="geo" else "heliocentric_ecliptic_J2000",
            "jd": jd,
            "inputs": {
                "m_asteroid_kg": m_ast,
                "m_impactor_kg": m_imp_opt,
                "beta": beta,
                "vector_mode": has_vector,
                "preset_meta": meta_dir if meta_dir else None
            },
            "pre_impact": {
                "velocity_km_s": {"x": v_met_km_s[0], "y": v_met_km_s[1], "z": v_met_km_s[2]},
                "speed_km_s": vec_norm(v_met_km_s),
                "energy_MtTNT": E_old["E_MtTNT"]
            },
            "post_impact": {
                "velocity_km_s": {"x": v_plus_km_s[0], "y": v_plus_km_s[1], "z": v_plus_km_s[2]},
                "speed_km_s": vec_norm(v_plus_km_s),
                "delta_v_km_s": {"x": delta_v_km_s_vec[0], "y": delta_v_km_s_vec[1], "z": delta_v_km_s_vec[2]},
                "delta_v_mag_m_s": vec_norm(delta_v_km_s_vec)*1000.0,
                "energy_MtTNT": E_new["E_MtTNT"]
            },
            "orbit_effects_approx": {
                "a_old_AU": a_au,
                "a_new_AU": a_new_au,
                "delta_a_frac": delta_a_frac,
                "P_old_days": P_old_days,
                "P_new_days": P_new_days,
                "delta_P_frac": delta_P_frac,
                "note": "Small-Δv tangential approximation using projection onto HELIOCENTRIC velocity."
            }
        }), 200

    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except KeyError as e:
        return jsonify({"error": f"Missing orbital element: {e}"}), 422
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

# -----------------------------------------
# /deflection_dashboard – pre/post orbits sampled for plotting
# -----------------------------------------
@app.route("/deflection_dashboard", methods=["GET"])
def deflection_dashboard():
    """
    Bundle pre/post orbits for plotting after a deflection at epoch jd.

    A) Vector mode:
       ?vix=..&viy=..&viz=..&m_impactor_kg=..&beta=..

    B) Preset mode:
       ?mode=prograde|retrograde|radial_out|radial_in|normal_plus|normal_minus
       &delta_v_m_s=...
       [&m_impactor_kg=..&beta=..]  (optional; reports implied closing speed)

    Other params:
      target=...        (required)
      jd=...            (defaults to now)
      samples=...       (default 240, max 1000)
      window_days=...   (default = old period)
      frame=geo|helio   (both frames are returned regardless)
      velocity_km_s=... (optional baseline speed for energy comparison)
    """
    target = request.args.get("target")
    if not target:
        return jsonify({"error": "Missing 'target'"}), 400

    jd = request.args.get("jd", type=float) or jd_now()
    samples = request.args.get("samples", type=int) or 240
    frame = (request.args.get("frame") or "geo").lower()
    base_speed_override = request.args.get("velocity_km_s", type=float)
    api_key = request.args.get("api_key", default=NASA_API_KEY)

    has_vector = all(k in request.args for k in ("vix","viy","viz"))
    mode = (request.args.get("mode") or "").lower().strip()
    beta = request.args.get("beta", type=float) or 1.0
    m_imp_opt = request.args.get("m_impactor_kg", type=float)

    try:
        # Baseline mass & nominal impact speed
        profile = build_impact_profile(target, base_speed_override, api_key)
        m_ast = request.args.get("m_asteroid_kg", type=float) or float(profile["physical"]["mass_kg"])

        # Asteroid heliocentric state at jd
        sb = get_sbdb_data(target)
        els = sb["orbital_elements"]
        el_ast_nom = KeplerElements(
            a=float(els["a"]), e=float(els["e"]), i=float(els["i"]),
            Omega=float(els["om"]), omega=float(els["w"]),
            M0=sb["mean_anomaly_deg"] if sb["mean_anomaly_deg"] is not None else 0.0,
            epoch=sb["orbit_epoch_jd"] if sb["orbit_epoch_jd"] is not None else 2451545.0
        )
        r_ast_AU, v_ast_AUday = propagate_to_cartesian(el_ast_nom, jd)
        v_ast_km_s = vec_scale(list(v_ast_AUday), AU_PER_DAY_TO_KM_PER_S)  # km/s heliocentric
        # Earth helio
        r_e_AU, v_e_AUday = propagate_to_cartesian(get_earth_elements(), jd)
        v_e_km_s = vec_scale(list(v_e_AUday), AU_PER_DAY_TO_KM_PER_S)

        # Frame velocity (for vector-mode relative closing)
        v_met_frame_km_s = vec_sub(v_ast_km_s, v_e_km_s) if frame == "geo" else v_ast_km_s

        # ---- Determine Δv ----
        meta_dir = {}
        if has_vector:
            vix = float(request.args["vix"]); viy = float(request.args["viy"]); viz = float(request.args["viz"])
            if m_imp_opt is None or m_imp_opt <= 0:
                return jsonify({"error": "Provide positive m_impactor_kg for vector mode."}), 400
            u = vec_sub([vix, viy, viz], v_met_frame_km_s)
            delta_v_km_s_vec = vec_scale(u, beta * (m_imp_opt / m_ast))  # km/s
        elif mode in {"prograde","retrograde","radial_out","radial_in","normal_plus","normal_minus","normal"}:
            delta_v_m_s = request.args.get("delta_v_m_s", type=float)
            if delta_v_m_s is None:
                return jsonify({"error": "Preset mode requires 'delta_v_m_s' (m/s)."}), 400
            dv_mag_km_s = delta_v_m_s / 1000.0

            # Canonical directions from HELIOCENTRIC state
            r_helio_km = vec_scale(list(r_ast_AU), AU_KM)
            v_helio_km_s = v_ast_km_s
            r_hat = unit(r_helio_km)
            v_hat = unit(v_helio_km_s)
            h_hat = unit(vec_cross(r_helio_km, v_helio_km_s))

            if mode == "prograde":
                dir_hat = v_hat
            elif mode == "retrograde":
                dir_hat = vec_scale(v_hat, -1.0)
            elif mode == "radial_out":
                dir_hat = r_hat
            elif mode == "radial_in":
                dir_hat = vec_scale(r_hat, -1.0)
            elif mode in {"normal_plus","normal"}:
                dir_hat = h_hat
            elif mode == "normal_minus":
                dir_hat = vec_scale(h_hat, -1.0)
            else:
                return jsonify({"error": f"Unknown mode '{mode}'"}), 400

            delta_v_km_s_vec = vec_scale(dir_hat, dv_mag_km_s)
            meta_dir = {
                "mode": mode,
                "direction_unit": {"x": dir_hat[0], "y": dir_hat[1], "z": dir_hat[2]},
                "delta_v_m_s": delta_v_m_s
            }
            if m_imp_opt and m_imp_opt > 0:
                meta_dir["implied_closing_speed_km_s"] = (dv_mag_km_s) / (beta * (m_imp_opt / m_ast))
        else:
            # No deflection specified -> Δv = 0 (post = pre)
            delta_v_km_s_vec = [0.0, 0.0, 0.0]
            meta_dir = {"mode": "none", "delta_v_m_s": 0.0}

        # Post-impact heliocentric velocity (Δv is frame-invariant under translation)
        v_plus_helio_km_s = vec_add(v_ast_km_s, delta_v_km_s_vec)

        # Kepler elements at epoch jd from (r, v_old) and (r, v_new)
        el_pre = kepler_from_rv(list(r_ast_AU), v_ast_km_s, jd)
        el_post = kepler_from_rv(list(r_ast_AU), v_plus_helio_km_s, jd)

        # Periods & window
        P_old = orbital_period_days_from_a(el_pre.a)
        P_new = orbital_period_days_from_a(el_post.a)
        window_days = request.args.get("window_days", type=float) or P_old

        # Sample both orbits
        pre_samples = sample_orbit(el_pre, jd, window_days, samples, include_helio=True, include_geo=True)
        post_samples = sample_orbit(el_post, jd, window_days, samples, include_helio=True, include_geo=True)

        # Energy context
        base_speed_km_s = base_speed_override if base_speed_override is not None else float(profile["impact"]["velocity_km_s"])
        E_old = impact_energy(m_ast, base_speed_km_s)
        E_new = impact_energy(m_ast, vec_norm(v_plus_helio_km_s))

        return jsonify({
            "target": target,
            "epoch_jd": jd,
            "samples": samples,
            "window_days": window_days,
            "deflection": {
                "delta_v_km_s": {"x": delta_v_km_s_vec[0], "y": delta_v_km_s_vec[1], "z": delta_v_km_s_vec[2]},
                "delta_v_mag_m_s": vec_norm(delta_v_km_s_vec) * 1000.0,
                "beta": beta,
                "m_impactor_kg": m_imp_opt,
                "preset_meta": meta_dir
            },
            "pre_orbit": {
                "elements": {
                    "a_AU": el_pre.a, "e": el_pre.e, "i_deg": el_pre.i,
                    "Omega_deg": el_pre.Omega, "omega_deg": el_pre.omega,
                    "M0_deg": el_pre.M0, "epoch_jd": el_pre.epoch,
                    "period_days": P_old
                },
                "positions": {
                    "helio_AU": pre_samples["helio_AU"],
                    "geo_AU": pre_samples["geo_AU"],
                    "t_jd": pre_samples["t_jd"]
                }
            },
            "post_orbit": {
                "elements": {
                    "a_AU": el_post.a, "e": el_post.e, "i_deg": el_post.i,
                    "Omega_deg": el_post.Omega, "omega_deg": el_post.omega,
                    "M0_deg": el_post.M0, "epoch_jd": el_post.epoch,
                    "period_days": P_new
                },
                "positions": {
                    "helio_AU": post_samples["helio_AU"],
                    "geo_AU": post_samples["geo_AU"],
                    "t_jd": post_samples["t_jd"]
                }
            },
            "energy_context": {
                "mass_kg": m_ast,
                "energy_old_MtTNT": E_old["E_MtTNT"],
                "energy_new_MtTNT": E_new["E_MtTNT"]
            }
        }), 200

    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except KeyError as e:
        return jsonify({"error": f"Missing orbital element: {e}"}), 422
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

# -----------------------------------------
# /impact_point – compute lat/lon for a straight-line intercept
# -----------------------------------------
@app.route("/impact_point", methods=["GET"])
def impact_point():
    """
    Estimate impact coordinates for the 'hit Earth' sim.
    Modes:
      - mode=real       : use actual geocentric r0,v0 at jd and test straight-line hit.
      - mode=aim_earth  : rotate velocity to Earth center (keep speed) and intersect.

    Query:
      target=...                 (required)
      jd=...                     (defaults to now)
      mode=real|aim_earth        (default: real)
      entry_alt_km=...           (default: 0 -> surface; try 100 for "entry interface")
      earth_radius_km=...        (default: 6371)
      speed_km_s=...             (optional; only used in aim_earth)
      frame=geo|helio            (ignored for math; uses geocentric)

    Returns: lat/lon (deg), time to impact (s), impact ECI/ECEF vectors, and notes.
    """
    target = request.args.get("target")
    if not target:
        return jsonify({"error": "Missing 'target'"}), 400

    jd0 = request.args.get("jd", type=float) or jd_now()
    mode = (request.args.get("mode") or "real").lower()
    entry_alt_km = request.args.get("entry_alt_km", type=float) or 0.0
    R_earth_km = request.args.get("earth_radius_km", type=float) or EARTH_RADIUS_KM_MEAN
    R_hit_km = R_earth_km + entry_alt_km

    try:
        # Heliocentric asteroid state at jd0
        sb = get_sbdb_data(target)
        els = sb["orbital_elements"]
        el_ast = KeplerElements(
            a=float(els["a"]), e=float(els["e"]), i=float(els["i"]),
            Omega=float(els["om"]), omega=float(els["w"]),
            M0=sb["mean_anomaly_deg"] if sb["mean_anomaly_deg"] is not None else 0.0,
            epoch=sb["orbit_epoch_jd"] if sb["orbit_epoch_jd"] is not None else 2451545.0
        )
        r_ast_AU, v_ast_AUday = propagate_to_cartesian(el_ast, jd0)

        # Earth heliocentric
        r_e_AU, v_e_AUday = propagate_to_cartesian(get_earth_elements(), jd0)

        # Geocentric initial state (ECI)
        r0_AU = [r_ast_AU[0]-r_e_AU[0], r_ast_AU[1]-r_e_AU[1], r_ast_AU[2]-r_e_AU[2]]
        v0_AUday = [v_ast_AUday[0]-v_e_AUday[0], v_ast_AUday[1]-v_e_AUday[1], v_ast_AUday[2]-v_e_AUday[2]]
        r0_km = vec_scale(r0_AU, AU_KM)
        v0_km_s = vec_scale(v0_AUday, AU_PER_DAY_TO_KM_PER_S)

        speed_km_s = vec_norm(v0_km_s)
        if mode == "aim_earth":
            # Redirect velocity toward Earth's center (keep speed or override)
            sp_override = request.args.get("speed_km_s", type=float)
            sp = sp_override if (sp_override and sp_override > 0) else speed_km_s
            dir_to_center = unit(vec_scale(r0_km, -1.0))
            v0_km_s = vec_scale(dir_to_center, sp)

        # Straight-line intersection with sphere
        isect = ray_sphere_intersection_time(r0_km, v0_km_s, R_hit_km)
        if not isect["hit"]:
            # Also return closest approach info
            a = vec_dot(v0_km_s, v0_km_s)
            b = 2.0 * vec_dot(r0_km, v0_km_s)
            t_star = -b / (2*a)
            r_star = vec_add(r0_km, vec_scale(v0_km_s, t_star))
            min_range_km = vec_norm(r_star)
            jd_star = jd0 + t_star / SECS_PER_DAY
            return jsonify({
                "target": target,
                "mode": mode,
                "jd_start": jd0,
                "hit": False,
                "note": isect["desc"],
                "closest_approach": {
                    "t_star_s": t_star,
                    "jd_star": jd_star,
                    "range_min_km": min_range_km
                },
                "limitations": "Straight-line geocentric path; ignores Earth gravity & atmosphere. Use a jd near close-approach for realism."
            }), 200

        t_imp_s = isect["t_s"]
        jd_imp = jd0 + t_imp_s / SECS_PER_DAY
        r_imp_km_eci = vec_add(r0_km, vec_scale(v0_km_s, t_imp_s))
        v_imp_km_s_eci = v0_km_s

        # Rotate to Earth-fixed at impact time
        r_imp_km_ecef = eci_to_ecef(r_imp_km_eci, jd_imp)
        geo = ecef_to_geodetic_sphere(r_imp_km_ecef, R_km=R_earth_km)

        return jsonify({
            "target": target,
            "mode": mode,
            "jd_start": jd0,
            "time_to_impact_s": t_imp_s,
            "jd_impact": jd_imp,
            "impact_point": {
                "lat_deg": geo["lat_deg"],
                "lon_deg": geo["lon_deg"],
                "alt_km": geo["alt_km"]
            },
            "vectors": {
                "r_eci_km": {"x": r_imp_km_eci[0], "y": r_imp_km_eci[1], "z": r_imp_km_eci[2]},
                "v_eci_km_s": {"x": v_imp_km_s_eci[0], "y": v_imp_km_s_eci[1], "z": v_imp_km_s_eci[2]},
                "r_ecef_km": {"x": r_imp_km_ecef[0], "y": r_imp_km_ecef[1], "z": r_imp_km_ecef[2]}
            },
            "params": {
                "earth_radius_km": R_earth_km,
                "entry_alt_km": entry_alt_km,
                "speed_km_s_used": speed_km_s if mode=="real" else (request.args.get("speed_km_s", type=float) or vec_norm(v0_km_s))
            },
            "limitations": "Straight-line geocentric intercept; ignores Earth gravity, drag, fragmentation, and ellipsoid. Good for demos; not hazard-grade."
        }), 200

    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API error", "detail": str(e)}), 502
    except KeyError as e:
        return jsonify({"error": f"Missing orbital element: {e}"}), 422
    except Exception as e:
        return jsonify({"error": "Internal error", "detail": str(e)}), 500

# -----------------------------------------
# Entrypoint
# -----------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=True)
