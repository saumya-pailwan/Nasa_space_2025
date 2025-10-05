import { useCallback, useRef, useState, useEffect } from "react";
import * as Cesium from "cesium";
import type { ImpactMetrics } from "../components/BottomImpactBar";



type ImpactZone = { lon: number; lat: number; radiusDeg: number };

export type ImpactSection = 'impact' | 'earthquake' | 'tsunami';

export function useImpactSimulation() {
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  const meteorEntityRef = useRef<Cesium.Entity | null>(null);
  const impactEntityRef = useRef<Cesium.Entity | null>(null);
  const shockwaveEntityRef = useRef<Cesium.Entity | null>(null);
  const activeImpactRef = useRef<boolean>(false);
  const impactZonesRef = useRef<ImpactZone[]>([]);
  

  // animation handles
  const meteorRafIdRef = useRef<number | null>(null);
  const shockRafIdRef = useRef<number | null>(null);
  const meteorTimeoutRef = useRef<number | null>(null); // <-- 2s delay timeout

  // constants
  const START_HEIGHT = 30000;           // meters
  const SHOCK_MAX_RADIUS = 3000;        // meters
  const SHOCK_EXPANSION_RATE = 300;     // meters per “tick”
  const IMPACT_HIDE_RADIUS_DEG = 0.009; // ~1km at mid-lat
  const METEOR_DURATION_MS = 2000;      // 2s descent

  const IMPACT_LON = -87.6224;
  const IMPACT_LAT = 41.8852;

  // Highlight band radii (in meters)
  const IMPACT_ZONE_RADIUS_M = 1000;       // entire impact zone (your example)
  const CENTER_RADIUS_M = IMPACT_ZONE_RADIUS_M; // center ring = full impact zone
  const MIDDLE_RADIUS_M = 1500;            // middle (tweak as you like)
  const OUTER_RADIUS_M  = SHOCK_MAX_RADIUS; // outer edge (3km)

  // highlight ring entities (created once then restyled)
  const centerRingRef = useRef<Cesium.Entity | null>(null);
  const middleRingRef = useRef<Cesium.Entity | null>(null);
  const outerRingRef  = useRef<Cesium.Entity | null>(null);

  // remember the last impact center so we can restyle rings when the user clicks the bar
  const lastImpactLonRef = useRef<number>(IMPACT_LON);
  const lastImpactLatRef = useRef<number>(IMPACT_LAT);

  // Active section controlled by BottomImpactBar
  const [activeSection, _setActiveSection] = useState<ImpactSection>('impact');

  // Map activeSection -> which ring is emphasized
  const isRingActive = (kind: 'center' | 'middle' | 'outer') => {
    if (activeSection === 'impact')      return kind === 'center';
    if (activeSection === 'earthquake')  return kind === 'middle';
    /* tsunami */                        return kind === 'outer';
  };

  // Create rings if missing
  const ensureHighlightRings = (lon: number, lat: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const pos = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

    const upsert = (
      ref: React.MutableRefObject<Cesium.Entity | null>,
      radiusM: number
    ) => {
      if (!ref.current) {
        ref.current = viewer.entities.add({
          position: pos,
          ellipse: {
            semiMinorAxis: new Cesium.ConstantProperty(radiusM),
            semiMajorAxis: new Cesium.ConstantProperty(radiusM),
            material: Cesium.Color.TRANSPARENT,
            outline: true,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.35),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      } else {
        // move & ensure correct radius
        if (ref.current.position instanceof Cesium.ConstantPositionProperty) {
            ref.current.position.setValue(pos);
          } else {
            ref.current.position = new Cesium.ConstantPositionProperty(pos);
          }
        if (ref.current.ellipse) {
          ref.current.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radiusM);
          ref.current.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radiusM);
        }
      }
    };

    upsert(centerRingRef, CENTER_RADIUS_M);
    upsert(middleRingRef, MIDDLE_RADIUS_M);
    upsert(outerRingRef,  OUTER_RADIUS_M);
  };

  const applyActiveStyles = (section: ImpactSection) => {
    const styleActive = (entity: Cesium.Entity | null, color: Cesium.Color) => {
      if (!entity || !entity.ellipse) return;
      entity.show = true;
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(color.withAlpha(0.95));
      entity.ellipse.outlineWidth = new Cesium.ConstantProperty(color.withAlpha(4));
      entity.ellipse.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.10));
    };

    const hide = (entity: Cesium.Entity | null) => {
      if (!entity || !entity.ellipse) return;
      entity.show = false;
    };

    // Only show the ring that matches the active section, with its color
    if (section === 'impact') {
      styleActive(centerRingRef.current, Cesium.Color.RED);
      hide(middleRingRef.current);
      hide(outerRingRef.current);
    } else if (section === 'earthquake') {
      styleActive(middleRingRef.current, Cesium.Color.MAROON);
      // hide(centerRingRef.current);
      hide(outerRingRef.current);
    } else { // 'tsunami'
      styleActive(outerRingRef.current, Cesium.Color.CYAN);
      hide(centerRingRef.current);
      // hide(middleRingRef.current);
    }
  };

  // Internal setter that also updates map styling immediately
  const setActiveSection = (next: ImpactSection) => {
    _setActiveSection(next);
    if (lastImpactLonRef.current != null && lastImpactLatRef.current != null) {
      ensureHighlightRings(lastImpactLonRef.current, lastImpactLatRef.current);
      applyActiveStyles(next); // fresh value
    }
  };

  useEffect(() => {
    if (lastImpactLonRef.current != null && lastImpactLatRef.current != null) {
      ensureHighlightRings(lastImpactLonRef.current, lastImpactLatRef.current);
      applyActiveStyles(activeSection);
    }
  }, [activeSection]);

  const setIon = () => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';
    if (!token) console.warn('[ImpactSim] VITE_CESIUM_ION_TOKEN not set.');
    Cesium.Ion.defaultAccessToken = token;
  };

  const cancelRaf = (idRef: React.MutableRefObject<number | null>) => {
    if (idRef.current != null) {
      cancelAnimationFrame(idRef.current);
      idRef.current = null;
    }
  };
  const clearTimeoutRef = (idRef: React.MutableRefObject<number | null>) => {
    if (idRef.current != null) {
      clearTimeout(idRef.current);
      idRef.current = null;
    }
  };

  const boot = useCallback(async (
    container: HTMLDivElement,
    setInfo: (s: string | null) => void,
    setImpactData: (d: ImpactMetrics | null) => void
  ) => {
    if (viewerRef.current) return;

    setIon();

    const viewer = new Cesium.Viewer(container, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      useBrowserRecommendedResolution: true,
    });

    viewer.shadows = false;
    viewer.scene.postProcessStages.fxaa.enabled = true;

    viewerRef.current = viewer;

    try {
      const tileset = await Cesium.createOsmBuildingsAsync();
      tilesetRef.current = tileset;
      viewer.scene.primitives.add(tileset);
    } catch {
      tilesetRef.current = null;
    }

    // initial camera and info
    viewer.scene.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(IMPACT_LON, IMPACT_LAT, 5000),
      orientation: { heading: Cesium.Math.toRadians(10), pitch: Cesium.Math.toRadians(-45) },
    });
    setInfo('Incoming meteor… impact in 2 seconds!');

    // cinematic pan (2s) then auto-fire meteor
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(IMPACT_LON, IMPACT_LAT - 0.03, 2000),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35) },
      duration: 2.0,
    });
    meteorTimeoutRef.current = window.setTimeout(() => {
      createMeteor(IMPACT_LON, IMPACT_LAT, setImpactData);
    }, 2000);
  }, []);

  const dispose = useCallback(() => {
    cancelRaf(meteorRafIdRef);
    cancelRaf(shockRafIdRef);
    clearTimeoutRef(meteorTimeoutRef);

    const viewer = viewerRef.current;
    if (viewer) {
      [meteorEntityRef.current, impactEntityRef.current, shockwaveEntityRef.current,
       centerRingRef.current, middleRingRef.current, outerRingRef.current
      ].forEach((e) => e && viewer.entities.remove(e));
    }
    centerRingRef.current = null;
    middleRingRef.current = null;
    outerRingRef.current = null;

    if (viewer && tilesetRef.current) {
      try { viewer.scene.primitives.remove(tilesetRef.current); } catch {}
    }
    tilesetRef.current = null;

    if (viewer) {
      try { viewer.destroy(); } catch {}
      viewerRef.current = null;
    }

    activeImpactRef.current = false;
    impactZonesRef.current = [];
  }, []);

  const hideImpactedBuildings = (centerLon: number, centerLat: number, radiusDeg: number) => {
    const tileset = tilesetRef.current;
    if (!tileset) return;
    impactZonesRef.current.push({ lon: centerLon, lat: centerLat, radiusDeg });
    const conditions = impactZonesRef.current.map(
      (z) =>
        `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${z.lon}, ${z.lat})) > ${z.radiusDeg}`
    );
    try {
      tileset.style = new Cesium.Cesium3DTileStyle({ show: conditions.join(' && ') });
    } catch {}
  };

  const createCrater = (lon: number, lat: number, asteroidRadius: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // viewer.entities.add({
    //   position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    //   ellipse: {
    //     semiMinorAxis: 1000,
    //     semiMajorAxis: 1000,
    //     material: Cesium.Color.SADDLEBROWN.withAlpha(0.7),
    //     outline: true,
    //     outlineColor: Cesium.Color.DARKRED,
    //     outlineWidth: 3,
    //     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    //   },
    // });
    // viewer.entities.add({
    //   position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    //   ellipse: {
    //     semiMinorAxis: 700,
    //     semiMajorAxis: 700,
    //     material: Cesium.Color.BROWN.withAlpha(0.8),
    //     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    //   },
    // });
    // viewer.entities.add({
    //   position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    //   ellipse: {
    //     semiMinorAxis: 400,
    //     semiMajorAxis: 400,
    //     material: Cesium.Color.BLACK.withAlpha(0.8),
    //     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    //   },
    // });
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    });
  };

  const pushImpactMetrics = (
    lon: number,
    lat: number,
    setImpactData: (d: ImpactMetrics | null) => void
  ) => {
    // Existing knowns
    const craterDiameterM = 100 * 20;

    // Depth: ~22% of diameter (simple heuristic for visuals)
    const craterDepthM = craterDiameterM * 0.22;

    // Quake magnitude (demo): scale with shockwave radius (3 km -> ~Mw 5.5)
    const SHOCK_MAX_RADIUS = 3000; // must match your constant above
    const quakeMagnitudeMw = Number((4.0 + (SHOCK_MAX_RADIUS / 1000) * 0.5).toFixed(1));

    // Tsunami (demo): height scales gently with diameter; index on a 0–10 band
    const tsunamiHeightM = Math.max(0, Math.round(craterDiameterM * 0.004)); // 2k m -> ~8 m
    const tsunamiIndex = Math.min(10, Number((tsunamiHeightM / 2).toFixed(1))); // simple 0–10 index

    const payload: ImpactMetrics = {
      lon,
      lat,
      impactTime: Date.now(),
      craterDiameterM,
      craterDepthM,
      quakeMagnitudeMw,
      tsunamiHeightM,
      tsunamiIndex,
    };

    setImpactData(payload);
  };

  const createImpactExplosion = (
    lon: number,
    lat: number,
    setImpactData: (d: ImpactMetrics | null) => void
  ) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    cancelRaf(shockRafIdRef);

    if (meteorEntityRef.current) {
      viewer.entities.remove(meteorEntityRef.current);
      meteorEntityRef.current = null;
    }

    hideImpactedBuildings(lon, lat, IMPACT_HIDE_RADIUS_DEG);
    createCrater(lon, lat, 100);
    pushImpactMetrics(lon, lat, setImpactData);

    lastImpactLonRef.current = lon;
    lastImpactLatRef.current = lat;
    ensureHighlightRings(lon, lat);

    applyActiveStyles('impact');      // use the version that takes a section
    _setActiveSection('impact');

    // const impactMat = new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW);
    // const impactMinor = new Cesium.ConstantProperty(1000);
    // const impactMajor = new Cesium.ConstantProperty(1000);

    // const impactEntity = viewer.entities.add({
    //   position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    //   ellipse: {
    //     semiMinorAxis: impactMinor,
    //     semiMajorAxis: impactMajor,
    //     material: impactMat,
    //     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    //   },
    // });
    // impactEntityRef.current = impactEntity;

    // const centerFlash = viewer.entities.add({
    //   position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    //   ellipse: {
    //     semiMinorAxis: new Cesium.ConstantProperty(300),
    //     semiMajorAxis: new Cesium.ConstantProperty(300),
    //     material: new Cesium.ColorMaterialProperty(Cesium.Color.GOLD),
    //     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    //   },
    // });

    let shockwaveRadius = 200;
    const shockMinor = new Cesium.ConstantProperty(shockwaveRadius);
    const shockMajor = new Cesium.ConstantProperty(shockwaveRadius);
    const shockColorProp = new Cesium.ConstantProperty(
      Cesium.Color.ORANGERED.withAlpha(0.4)
    );
    const shockMat = new Cesium.ColorMaterialProperty(shockColorProp);

    const shockwaveEntity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      ellipse: {
        semiMinorAxis: shockMinor,
        semiMajorAxis: shockMajor,
        material: shockMat,
        outline: true,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    shockwaveEntityRef.current = shockwaveEntity;

    const t0 = performance.now();
    const estTickMs = 100;
    const rate = SHOCK_EXPANSION_RATE;
    const maxRadius = SHOCK_MAX_RADIUS;

    const step = (t: number) => {
      const elapsed = t - t0;

      shockwaveRadius = 200 + (elapsed / estTickMs) * rate;

      if (shockwaveRadius < maxRadius) {
        shockMinor.setValue(shockwaveRadius);
        shockMajor.setValue(shockwaveRadius);

        const alpha = Math.max(0, 0.4 * (1 - shockwaveRadius / maxRadius));
        const c = shockColorProp.getValue() as Cesium.Color;
        if (c) {
          c.red = Cesium.Color.ORANGERED.red;
          c.green = Cesium.Color.ORANGERED.green;
          c.blue = Cesium.Color.ORANGERED.blue;
          c.alpha = alpha;
          shockColorProp.setValue(c);
        } else {
          shockColorProp.setValue(Cesium.Color.ORANGERED.withAlpha(alpha));
        }

        shockRafIdRef.current = requestAnimationFrame(step);
      } else {
        if (shockwaveEntity) viewer.entities.remove(shockwaveEntity);
        activeImpactRef.current = false;
        shockRafIdRef.current = null;
      }
    };
    shockRafIdRef.current = requestAnimationFrame(step);
  };

  const createMeteor = (
    targetLon: number,
    targetLat: number,
    setImpactData: (d: ImpactMetrics | null) => void
  ) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    cancelRaf(meteorRafIdRef);

    const startLon = targetLon - 0.05;
    const startLat = targetLat + 0.05;
    const startHeight = START_HEIGHT;

    if (meteorEntityRef.current) viewer.entities.remove(meteorEntityRef.current);
    if (impactEntityRef.current) viewer.entities.remove(impactEntityRef.current);
    if (shockwaveEntityRef.current) viewer.entities.remove(shockwaveEntityRef.current);

    activeImpactRef.current = true;

    const meteor = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(startLon, startLat, startHeight),
      point: {
        pixelSize: 15,
        color: Cesium.Color.ORANGE,
        outlineColor: Cesium.Color.YELLOW,
        outlineWidth: 2,
      },
    });
    meteorEntityRef.current = meteor;

    const start = performance.now();
    const duration = METEOR_DURATION_MS;

    const step = (t: number) => {
      const elapsed = Math.min(duration, t - start);
      const progress = elapsed / duration;

      const currentHeight = startHeight * (1 - progress);
      const currentLon = startLon + (targetLon - startLon) * progress;
      const currentLat = startLat + (targetLat - startLat) * progress;

      if (meteorEntityRef.current) {
        const cart = Cesium.Cartesian3.fromDegrees(currentLon, currentLat, currentHeight);
        const e = meteorEntityRef.current;
        if (e) {
        if (e.position instanceof Cesium.ConstantPositionProperty) {
            e.position.setValue(cart);
        } else {
            e.position = new Cesium.ConstantPositionProperty(cart);
        }
}
      }

      if (progress < 1) {
        meteorRafIdRef.current = requestAnimationFrame(step);
      } else {
        meteorRafIdRef.current = null;
        createImpactExplosion(targetLon, targetLat, setImpactData);
      }
    };
    meteorRafIdRef.current = requestAnimationFrame(step);

    // small reframe; matches your previous flyTo
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(targetLon, targetLat - 0.03, 2000),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35) },
      duration: 1.5,
    });
  };

  return { boot, dispose, activeSection, setActiveSection };
}