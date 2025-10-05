#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ML pipeline for tsunami impact prediction using your TSV.
- Cleans + canonicalizes columns
- Engineers features (geo/time + physics-informed placeholders)
- Trains Ridge (reg) and LogisticRegression (cls)
- Saves artifacts
- Predicts from a backend 'impact_json' (lat/lon + energy_mt + mw_equiv)

CLI:
  python ml_pipeline.py profile --tsv data/tsunami.tsv
  python ml_pipeline.py train   --tsv data/tsunami.tsv --out artifacts/
  python ml_pipeline.py predict --impact_json sample_impact.json --artifacts artifacts/
"""

import argparse, json, os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from joblib import dump, load

# ------------------------------
# Column detection
# ------------------------------
CANDIDATES = {
    "lat":      ["lat", "latitude", "latit", "event_latitude"],
    "lon":      ["lon", "long", "longitude", "event_longitude"],
    "year":     ["year", "yr"],
    "month":    ["month", "mo", "mon"],
    "day":      ["day", "dy", "d"],
    "hour":     ["hour", "hr", "hh"],
    "minute":   ["minute", "min", "mm"],
    "second":   ["second", "sec", "ss"],
    "date":     ["time", "date", "datetime", "origin_time", "event_time"],
    "magnitude":["magnitude", "mag", "primary_magnitude", "eq_mag", "mw", "ms", "ml"],
    "depth_km": ["depth", "depth_km", "eq_depth", "focal_depth"],
    "runup_m":  ["runup", "runup_height", "maximum_runup_height_m", "max_runup", "runup_ht", "max_runup_height", "h_runup"],
    "wave_h_m": ["wave_height", "max_wave_height", "maximum_wave_height_m", "h_max", "max_water_height", "water_ht_max", "tsunami_height_m"],
    "country":  ["country", "nation"],
    "location": ["location", "location_name", "region", "place", "area", "locality"]
}

def _find_col(df: pd.DataFrame, keys):
    cols = {c.lower(): c for c in df.columns}
    for k in keys:
        if k in cols: return cols[k]
    for k in keys:
        for lc, orig in cols.items():
            if k in lc: return orig
    return None

def detect_schema(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    return {k: _find_col(df, v) for k, v in CANDIDATES.items()}

# ------------------------------
# Load & clean
# ------------------------------
def load_tsv(path: str) -> pd.DataFrame:
    return pd.read_csv(path, sep="\t", dtype=str, keep_default_na=False, na_values=["", "NA", "NaN", "nan"])

def coerce_float(sr: pd.Series) -> pd.Series:
    return pd.to_numeric(sr, errors="coerce")

def build_datetime(df: pd.DataFrame, sch: Dict[str, Optional[str]]) -> pd.Series:
    if sch.get("date") and sch["date"] in df.columns:
        return pd.to_datetime(df[sch["date"]], errors="coerce", utc=True, infer_datetime_format=True)
    # Build from parts if available
    get = lambda key: coerce_float(df[sch[key]]) if sch.get(key) else None
    y = get("year"); m = get("month"); d = get("day")
    H = get("hour"); M = get("minute"); S = get("second")
    if y is None or m is None or d is None:
        return pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns, UTC]")
    if H is None: H = pd.Series(0.0, index=df.index)
    if M is None: M = pd.Series(0.0, index=df.index)
    if S is None: S = pd.Series(0.0, index=df.index)
    dtstr = pd.Series([
        f"{int(yy):04d}-{int(mm):02d}-{int(dd):02d} {int(H.iloc[i] if pd.notna(H.iloc[i]) else 0):02d}:{int(M.iloc[i] if pd.notna(M.iloc[i]) else 0):02d}:{int(S.iloc[i] if pd.notna(S.iloc[i]) else 0):02d}"
        if (pd.notna(yy) and pd.notna(mm) and pd.notna(dd)) else None
        for i,(yy,mm,dd) in enumerate(zip(y,m,d))
    ], index=df.index)
    return pd.to_datetime(dtstr, errors="coerce", utc=True)

def clean_dataframe(df: pd.DataFrame, sch: Dict[str, Optional[str]]) -> pd.DataFrame:
    out = df.copy()
    if sch.get("lat"): out["lat"] = coerce_float(out[sch["lat"]])
    if sch.get("lon"): out["lon"] = coerce_float(out[sch["lon"]])
    if sch.get("magnitude"): out["mag"] = coerce_float(out[sch["magnitude"]])
    if sch.get("depth_km"):  out["depth_km"] = coerce_float(out[sch["depth_km"]])
    if sch.get("runup_m"):   out["runup_m"] = coerce_float(out[sch["runup_m"]])
    if sch.get("wave_h_m"):  out["wave_height_m"] = coerce_float(out[sch["wave_h_m"]])
    if sch.get("country"):   out["country"] = out[sch["country"]].replace("", np.nan)
    if sch.get("location"):  out["location_name"] = out[sch["location"]].replace("", np.nan)

    out["event_dt_utc"] = build_datetime(out, sch)
    out["year"]  = out["event_dt_utc"].dt.year
    out["month"] = out["event_dt_utc"].dt.month
    out["hour"]  = out["event_dt_utc"].dt.hour

    # sanity ranges
    if "lat" in out: out = out[(out["lat"].isna()) | ((out["lat"]>=-90)&(out["lat"]<=90))]
    if "lon" in out: out = out[(out["lon"].isna()) | ((out["lon"]>=-180)&(out["lon"]<=180))]
    if "depth_km" in out: out.loc[out["depth_km"]<0, "depth_km"] = np.nan

    # unify target as runup_m (choose the better-populated of runup vs wave height)
    ru_cnt = out["runup_m"].notna().sum() if "runup_m" in out else 0
    wh_cnt = out["wave_height_m"].notna().sum() if "wave_height_m" in out else 0
    if wh_cnt > ru_cnt:
        out.rename(columns={"wave_height_m": "runup_m"}, inplace=True)

    # light outlier clipping for stability
    if "runup_m" in out and out["runup_m"].notna().sum() > 0:
        q98 = np.nanpercentile(out["runup_m"].dropna(), 98)
        out.loc[out["runup_m"]>q98, "runup_m"] = q98

    return out

# ------------------------------
# Features
# ------------------------------
def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "lat" in out:
        out["abs_lat"] = out["lat"].abs()
        out["is_north"] = (out["lat"] >= 0).astype(int)
    if "lon" in out:
        out["is_east"] = (out["lon"] >= 0).astype(int)
    if "month" in out:
        out["is_winter"] = out["month"].isin([12,1,2]).astype(int)
        out["is_summer"] = out["month"].isin([6,7,8]).astype(int)
    if "mag" in out:
        out["mag2"] = out["mag"] ** 2

    # Physics-informed placeholders; your backend can fill at predict-time:
    for col in ["energy_mt", "mw_equiv", "y_cuberoot"]:
        if col not in out.columns:
            out[col] = np.nan
    if "energy_mt" in out:
        with np.errstate(invalid="ignore"):
            out["y_cuberoot"] = np.cbrt(out["energy_mt"].astype(float))
    return out

def severity_from_runup(y: np.ndarray, thr=(1.0, 3.0)) -> np.ndarray:
    a,b = thr
    return np.where(y < a, 0, np.where(y < b, 1, 2))

# ------------------------------
# Train & save
# ------------------------------
def train(tsv_path: str, out_dir: str) -> Dict:
    os.makedirs(out_dir, exist_ok=True)
    raw = load_tsv(tsv_path)
    sch = detect_schema(raw)
    df = clean_dataframe(raw, sch)
    df = add_features(df)

    numeric_cols = [c for c in [
        "lat","lon","abs_lat","is_north","is_east",
        "mag","mag2","depth_km",
        "year","month","hour","is_winter","is_summer",
        "energy_mt","mw_equiv","y_cuberoot"
    ] if c in df.columns]

    if "runup_m" not in df.columns or df["runup_m"].notna().sum() < 200:
        raise ValueError("Not enough run-up targets to train (need > 200 non-null).")

    dfm = df[numeric_cols + ["runup_m"]].dropna(subset=["runup_m"])
    X, y = dfm[numeric_cols], dfm["runup_m"]

    Xtr, Xva, ytr, yva = train_test_split(X, y, test_size=0.2, random_state=42)

    pre = ColumnTransformer([(
        "num",
        Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]),
        numeric_cols
    )])

    # Regressor
    reg = Ridge(alpha=1.0)
    reg_pipe = Pipeline([("prep", pre), ("reg", reg)])
    reg_pipe.fit(Xtr, ytr)
    yhat = reg_pipe.predict(Xva)

    # Classifier (discretized run-up)
    cls = LogisticRegression(max_iter=500, multi_class="multinomial")
    ytr_cls = severity_from_runup(ytr.values)
    cls_pipe = Pipeline([("prep", pre), ("cls", cls)])
    cls_pipe.fit(Xtr, ytr_cls)
    yhat_cls = cls_pipe.predict(Xva)
    yva_cls  = severity_from_runup(yva.values)
    mse  = float(mean_squared_error(yva, yhat))  # returns MSE
    rmse = float(np.sqrt(mse))                   # take the square root

    metrics = {
        "n_train": int(len(Xtr)),
        "n_val": int(len(Xva)),
        "features": numeric_cols,
        "regression": {
            "MAE": float(mean_absolute_error(yva, yhat)),
            "RMSE": rmse,
            "R2": float(r2_score(yva, yhat))
        },
        "classification": {
            "report": classification_report(yva_cls, yhat_cls, output_dict=True),
            "thresholds_m": [1.0, 3.0]
        }
    }

    # Save artifacts
    from joblib import dump
    dump(reg_pipe, os.path.join(out_dir, "model_reg.pkl"))
    dump(cls_pipe, os.path.join(out_dir, "model_cls.pkl"))
    with open(os.path.join(out_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    with open(os.path.join(out_dir, "feature_spec.json"), "w") as f:
        json.dump({"numeric_features": numeric_cols}, f, indent=2)

    return metrics

# ------------------------------
# Predict from backend impact JSON
# ------------------------------
def build_row_from_impact(impact: Dict, feature_list: List[str]) -> Dict:
    # Accepts either:
    #  impact["impact_point"]["lat_deg"]/["lon_deg"]  OR  impact["lat"]/["lon"]
    #  impact["energy_MtTNT"] or impact["energy_mt"], impact["magnitude_equivalent"] or impact["Mw_eq"]
    if "impact_point" in impact:
        lat = impact["impact_point"].get("lat_deg")
        lon = impact["impact_point"].get("lon_deg")
    else:
        lat = impact.get("lat") or impact.get("latitude")
        lon = impact.get("lon") or impact.get("longitude")

    energy_mt = impact.get("energy_MtTNT") or impact.get("energy_mt") or impact.get("impact",{}).get("energy_MtTNT")
    mw_equiv  = impact.get("magnitude_equivalent") or impact.get("Mw_eq") or impact.get("impact",{}).get("seismic_Mw_equivalent")

    # Time: use provided or current UTC
    dt = impact.get("event_dt_utc")
    if dt:
        try:
            ts = pd.to_datetime(dt, utc=True)
            year, month, hour = ts.year, ts.month, ts.hour
        except Exception:
            year, month, hour = None, None, None
    else:
        now = pd.Timestamp.utcnow()
        year, month, hour = now.year, now.month, now.hour

    row = {k: np.nan for k in feature_list}
    row.update({
        "lat": lat, "lon": lon,
        "energy_mt": energy_mt, "mw_equiv": mw_equiv,
        "year": year, "month": month, "hour": hour
    })
    # Derived
    if "abs_lat" in row and row["lat"] is not None:
        try: row["abs_lat"] = abs(float(row["lat"]))
        except: pass
    if "is_north" in row and row["lat"] is not None:
        try: row["is_north"] = int(float(row["lat"]) >= 0)
        except: pass
    if "is_east" in row and row["lon"] is not None:
        try: row["is_east"] = int(float(row["lon"]) >= 0)
        except: pass
    if "y_cuberoot" in row and row["energy_mt"] is not None:
        try: row["y_cuberoot"] = float(row["energy_mt"]) ** (1/3)
        except: pass
    return row

def predict_from_artifacts(art_dir: str, impact: Dict) -> Dict:
    reg = load(os.path.join(art_dir, "model_reg.pkl"))
    cls = load(os.path.join(art_dir, "model_cls.pkl"))
    feat = json.load(open(os.path.join(art_dir, "feature_spec.json")))["numeric_features"]

    row = build_row_from_impact(impact, feat)
    X = pd.DataFrame([row], columns=feat)
    y_reg = float(reg.predict(X)[0])
    y_cls = int(cls.predict(X)[0])
    sev = {0:"light",1:"moderate",2:"severe"}[y_cls]
    return {"inputs": row, "predictions": {"runup_m": y_reg, "severity_class": sev}}

# ------------------------------
# CLI
# ------------------------------
def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("profile")
    p1.add_argument("--tsv", required=True)
    p1.add_argument("--out_json", default=None)

    p2 = sub.add_parser("train")
    p2.add_argument("--tsv", required=True)
    p2.add_argument("--out", required=True)

    p3 = sub.add_parser("predict")
    p3.add_argument("--impact_json", required=True)
    p3.add_argument("--artifacts", required=True)

    args = ap.parse_args()

    if args.cmd == "profile":
        df = load_tsv(args.tsv)
        sch = detect_schema(df)
        clean = clean_dataframe(df, sch)
        out = {
            "rows_raw": int(len(df)),
            "rows_clean": int(len(clean)),
            "schema": sch,
            "runup_nonnull": int(clean["runup_m"].notna().sum()) if "runup_m" in clean else 0
        }
        print(json.dumps(out, indent=2))
        if args.out_json:
            with open(args.out_json, "w") as f:
                json.dump(out, f, indent=2)

    elif args.cmd == "train":
        metrics = train(args.tsv, args.out)
        print(json.dumps(metrics, indent=2))

    elif args.cmd == "predict":
        impact = json.load(open(args.impact_json))
        out = predict_from_artifacts(args.artifacts, impact)
        print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
