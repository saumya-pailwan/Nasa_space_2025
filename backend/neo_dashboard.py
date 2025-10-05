import requests
import numpy as np
import plotly.graph_objects as go
from dash import Dash, html, dcc, Input, Output

# ---------------- NASA API Helper ----------------
API_KEY = "Hzyerdq68aDegvqvUGXFZQxMSP2JaSUMJgsKR9aZ"  # Replace with your valid key

def get_neo_orbital_data(asteroid_id: str):
    """Fetch NEO orbital and physical parameters from NASA API"""
    url = f"https://api.nasa.gov/neo/rest/v1/neo/{asteroid_id}?api_key={API_KEY}"
    data = requests.get(url).json()

    if "orbital_data" not in data:
        raise ValueError("Invalid NEO ID or API limit exceeded.")

    od = data["orbital_data"]
    diameter = data["estimated_diameter"]["kilometers"]["estimated_diameter_max"]
    hazardous = data["is_potentially_hazardous_asteroid"]
    rel_vel = None
    try:
        rel_vel = float(data["close_approach_data"][0]["relative_velocity"]["kilometers_per_second"])
    except:
        rel_vel = None

    return {
        "a": float(od.get("semi_major_axis", 1.0)),
        "e": float(od.get("eccentricity", 0.0)),
        "i": np.radians(float(od.get("inclination", 0.0))),
        "omega": np.radians(float(od.get("perihelion_argument", 0.0))),
        "Omega": np.radians(float(od.get("ascending_node_longitude", 0.0))),
        "name": data.get("name", "Unknown NEO"),
        "diameter": diameter,
        "hazard": hazardous,
        "velocity": rel_vel
    }

# ---------------- Orbital computation ----------------
def orbit_coords(a, e, i, omega, Omega, nu):
    r = a * (1 - e**2) / (1 + e * np.cos(nu))
    x = r * (np.cos(Omega)*np.cos(omega+nu) - np.sin(Omega)*np.sin(omega+nu)*np.cos(i))
    y = r * (np.sin(Omega)*np.cos(omega+nu) + np.cos(Omega)*np.sin(omega+nu)*np.cos(i))
    z = r * (np.sin(omega+nu)*np.sin(i))
    return x, y, z

def compute_orbits(a, e, i, omega, Omega, delta_v):
    """Approximate deflection by modifying semi-major axis proportionally to delta-v"""
    G, M_sun, AU = 6.67430e-11, 1.989e30, 1.496e11
    v_orb = np.sqrt(G * M_sun / (a * AU))
    delta_a_frac = 2 * (delta_v / v_orb)
    a_new = a * (1 + delta_a_frac)
    return a_new

# ---------------- Impact profile computation ----------------
def compute_impact_profile(diameter_km, velocity_kms, density=2700):
    """Estimate impact energy (megaton TNT)"""
    if not diameter_km or not velocity_kms:
        return "Impact data unavailable."
    d_m = diameter_km * 1000
    v_m = velocity_kms * 1000
    mass = (4/3) * np.pi * (d_m / 2)**3 * density
    energy_joules = 0.5 * mass * v_m**2
    energy_mt = energy_joules / 4.184e15  # megatons of TNT
    risk = "Severe" if energy_mt > 1000 else "Major" if energy_mt > 100 else "Moderate" if energy_mt > 10 else "Low"
    return f"Impact Energy: {energy_mt:.1f} Mt TNT ({risk} Impact Potential)"

# ---------------- Plot generation ----------------
def generate_orbit_figure(a, e, i, omega, Omega, delta_v):
    nu = np.linspace(0, 2*np.pi, 400)
    a_new = compute_orbits(a, e, i, omega, Omega, delta_v)
    x, y, z = orbit_coords(a, e, i, omega, Omega, nu)
    x_new, y_new, z_new = orbit_coords(a_new, e, i, omega, Omega, nu)

    # Earth orbit (a=1 AU, e≈0.0167)
    theta = np.linspace(0, 2*np.pi, 400)
    x_earth, y_earth, z_earth = np.cos(theta), np.sin(theta), np.zeros_like(theta)

    fig = go.Figure()
    fig.add_trace(go.Scatter3d(x=x_earth, y=y_earth, z=z_earth,
                               mode='lines', name='Earth Orbit', line=dict(color='blue')))
    fig.add_trace(go.Scatter3d(x=x, y=y, z=z,
                               mode='lines', name='Original Orbit', line=dict(color='orange')))
    fig.add_trace(go.Scatter3d(x=x_new, y=y_new, z=z_new,
                               mode='lines', name=f'After Δv={delta_v:.0f} m/s',
                               line=dict(color='green', dash='dash')))
    fig.add_trace(go.Scatter3d(x=[0], y=[0], z=[0],
                               mode='markers', marker=dict(size=6, color='yellow'), name='Sun'))
    fig.update_layout(scene=dict(xaxis_title='X (AU)', yaxis_title='Y (AU)', zaxis_title='Z (AU)',
                                 aspectmode='data'),
                      title=f"Orbit Deflection Simulation (Δv = {delta_v:.0f} m/s)")
    return fig

# ---------------- Dash app ----------------
app = Dash(__name__)
app.title = "NEO Orbit Deflection Simulator"

app.layout = html.Div([
    html.H2("🌍 NEO Orbit Deflection Simulator"),
    html.Div([
        dcc.Input(id='neo-id', type='text', placeholder='Enter NEO ID (e.g. 2000433, 99942)', debounce=True),
        html.Button("Fetch Orbit", id='fetch-btn', n_clicks=0),
    ], style={'marginBottom':'10px'}),
    dcc.Slider(0, 1000, 50, value=100, id='dv-slider',
               marks={0:'0', 250:'250', 500:'500', 750:'750', 1000:'1000'},
               tooltip={'always_visible':True}),
    html.Div(id='neo-info', style={'marginTop':'15px', 'fontSize':'16px', 'fontWeight':'bold'}),
    html.Div(id='impact-info', style={'marginTop':'10px', 'fontSize':'15px', 'color':'darkred'}),
    dcc.Graph(id='orbit-graph')
])

@app.callback(
    Output('orbit-graph', 'figure'),
    Output('neo-info', 'children'),
    Output('impact-info', 'children'),
    Input('fetch-btn', 'n_clicks'),
    Input('dv-slider', 'value'),
    Input('neo-id', 'value')
)
def update_graph(n_clicks, delta_v, neo_id):
    if not neo_id:
        return go.Figure(), "Enter a valid NEO ID.", ""
    try:
        neo = get_neo_orbital_data(neo_id)
        fig = generate_orbit_figure(neo['a'], neo['e'], neo['i'], neo['omega'], neo['Omega'], delta_v)
        info = f"NEO: {neo['name']} | a = {neo['a']:.3f} AU, e = {neo['e']:.3f} | Δv = {delta_v:.1f} m/s | Hazardous: {neo['hazard']}"
        impact = compute_impact_profile(neo['diameter'], neo['velocity'])
        return fig, info, impact
    except Exception as e:
        return go.Figure(), f"Error: {e}", ""

if __name__ == "__main__":
    app.run(debug=True)
