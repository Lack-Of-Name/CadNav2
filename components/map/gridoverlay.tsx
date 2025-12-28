import maplibregl from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { computeGridCornersFromMapBounds, generateGridIntersections, gridOffsetMetersToLatLon } from './mapGrid';

type Origin = { latitude: number; longitude: number } | null;

export default function GridOverlay({
  map,
  origin,
  minZoom = 12,
  subdivisionsEnabled = true,
  numbersEnabled = false,
  gridConvergence = 0,
}: {
  map: maplibregl.Map | null | undefined;
  origin: Origin;
  minZoom?: number;
  subdivisionsEnabled?: boolean;
  numbersEnabled?: boolean;
  gridConvergence?: number;
}) {
  const [gridLines, setGridLines] = useState<{ vertical: string[]; horizontal: string[] }>({ vertical: [], horizontal: [] });
  const [gridSubLines, setGridSubLines] = useState<{ vertical: string[]; horizontal: string[] }>({ vertical: [], horizontal: [] });
  const [originScreenPoint, setOriginScreenPoint] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [cellCenters, setCellCenters] = useState<Array<{ x: number; y: number; e: number; n: number }>>([]);

  useEffect(() => {
    if (!map) return;

    const update = () => {
      if (!map) return;
      try {
        // project origin to screen
        try {
          const originForProj = origin ?? { latitude: -37.8136, longitude: 144.9631 };
          const op = map.project([originForProj.longitude, originForProj.latitude]);
          setOriginScreenPoint({ x: op.x, y: op.y });
        } catch {
          setOriginScreenPoint(null);
        }

        const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0;
        const gridVisible = zoom >= (minZoom ?? 12);
        setShowGrid(gridVisible);
        if (!gridVisible) {
          setGridLines({ vertical: [], horizontal: [] });
          setGridSubLines({ vertical: [], horizontal: [] });
          setCellCenters([]);
          return;
        }

        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const originPt = origin ?? { latitude: -37.8136, longitude: 144.9631 };

        const gridOffsets = computeGridCornersFromMapBounds(originPt, { latitude: sw.lat, longitude: sw.lng }, { latitude: ne.lat, longitude: ne.lng });
        const intersections = generateGridIntersections(gridOffsets.offsets, 1000);

        // Apply grid convergence (rotation) to easting/northing before converting to lat/lon
        function rotate(e: number, n: number, deg: number) {
          const rad = (deg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return {
            e: e * cos - n * sin,
            n: e * sin + n * cos,
          };
        }

        const pts: Array<{ x: number; y: number; e: number; n: number }> = [];
        for (const [easting, northing] of intersections) {
          const { e: eRot, n: nRot } = rotate(easting, northing, gridConvergence ?? 0);
          const ll = gridOffsetMetersToLatLon(originPt, eRot, nRot);
          try {
            const p = map.project([ll.longitude, ll.latitude]);
            pts.push({ x: p.x, y: p.y, e: easting, n: northing });
          } catch {
            // skip
          }
        }

        const es = Array.from(new Set(pts.map((p) => p.e))).sort((a, b) => a - b);
        const ns = Array.from(new Set(pts.map((p) => p.n))).sort((a, b) => a - b);

        const vertical: string[] = es.map((e) => {
          const linePts = ns
            .map((n) => {
              const p = pts.find((q) => q.e === e && q.n === n);
              return p ? `${p.x},${p.y}` : null;
            })
            .filter(Boolean) as string[];
          return linePts.join(' ');
        });

        const horizontal: string[] = ns.map((n) => {
          const linePts = es
            .map((e) => {
              const p = pts.find((q) => q.e === e && q.n === n);
              return p ? `${p.x},${p.y}` : null;
            })
            .filter(Boolean) as string[];
          return linePts.join(' ');
        });

        const key = (e: number, n: number) => `${e}:${n}`;
        const ptMap = new Map<string, { x: number; y: number; e: number; n: number }>();
        for (const p of pts) ptMap.set(key(p.e, p.n), p);

        const verticalSub: string[] = [];
        const horizontalSub: string[] = [];
        if (es.length >= 2 && ns.length >= 2) {
          const parts = 10;
          for (let i = 0; i < es.length - 1; i++) {
            const eA = es[i];
            const eB = es[i + 1];
            for (let k = 1; k < parts; k++) {
              const t = k / parts;
              const linePts: string[] = [];
              for (const n of ns) {
                const a = ptMap.get(key(eA, n));
                const b = ptMap.get(key(eB, n));
                if (!a || !b) continue;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
                linePts.push(`${x},${y}`);
              }
              if (linePts.length) verticalSub.push(linePts.join(' '));
            }
          }

          for (let j = 0; j < ns.length - 1; j++) {
            const nA = ns[j];
            const nB = ns[j + 1];
            for (let k = 1; k < parts; k++) {
              const t = k / parts;
              const linePts: string[] = [];
              for (const e of es) {
                const a = ptMap.get(key(e, nA));
                const b = ptMap.get(key(e, nB));
                if (!a || !b) continue;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
                linePts.push(`${x},${y}`);
              }
              if (linePts.length) horizontalSub.push(linePts.join(' '));
            }
          }
        }

        // Compute cell centers for grid numbers
        const centers: Array<{ x: number; y: number; e: number; n: number }> = [];
        if (es.length >= 2 && ns.length >= 2) {
          for (let i = 0; i < es.length - 1; i++) {
            for (let j = 0; j < ns.length - 1; j++) {
              // bottom left intersection
              const e0 = es[i];
              const n0 = ns[j];
              const e1 = es[i + 1];
              const n1 = ns[j + 1];
              // center in e/n
              const ec = (e0 + e1) / 2;
              const nc = (n0 + n1) / 2;
              // apply grid convergence
              const { e: ecRot, n: ncRot } = rotate(ec, nc, gridConvergence ?? 0);
              // get lat/lon and project to screen
              const ll = gridOffsetMetersToLatLon(originPt, ecRot, ncRot);
              try {
                const p = map.project([ll.longitude, ll.latitude]);
                centers.push({ x: p.x, y: p.y, e: e0, n: n0 });
              } catch {
                // skip
              }
            }
          }
        }
        setCellCenters(centers);

        setGridLines({ vertical, horizontal });
        setGridSubLines({ vertical: verticalSub, horizontal: horizontalSub });
      } catch (err) {
        console.error('GridOverlay update failed', err);
      }
    };

    map.on('load', update);
    map.on('move', update);
    map.on('zoom', update);
    setTimeout(update, 0);

    return () => {
      map.off('load', update);
      map.off('move', update);
      map.off('zoom', update);
    };
  }, [map, origin, minZoom, gridConvergence]);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 59 }}>
      <svg style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
        {subdivisionsEnabled && gridSubLines.vertical.map((pts, i) => (
          <polyline key={`sv-${i}`} points={pts} stroke="#000" strokeWidth={0.7} fill="none" opacity={0.18} />
        ))}
        {subdivisionsEnabled && gridSubLines.horizontal.map((pts, i) => (
          <polyline key={`sh-${i}`} points={pts} stroke="#000" strokeWidth={0.7} fill="none" opacity={0.18} />
        ))}
        {gridLines.vertical.map((pts, i) => (
          <polyline key={`v-${i}`} points={pts} stroke="#000" strokeWidth={1} fill="none" />
        ))}
        {gridLines.horizontal.map((pts, i) => (
          <polyline key={`h-${i}`} points={pts} stroke="#000" strokeWidth={1} fill="none" />
        ))}
        {numbersEnabled && cellCenters.map((c, i) => {
          const eNum = c.e / 1000;
          const nNum = c.n / 1000;
          if (eNum > 99 || nNum > 99) return null;
          return (
            <text
              key={`num-${c.e}-${c.n}`}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize="13"
              fontWeight="bold"
              fill="#000"
              stroke="#fff"
              strokeWidth="2"
              paintOrder="stroke"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {`${eNum},${nNum}`}
            </text>
          );
        })}
      </svg>
      {showGrid && originScreenPoint ? (
        <div
          key="grid-origin"
          style={{
            position: 'absolute',
            left: originScreenPoint.x - 10,
            top: originScreenPoint.y - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.9)',
            border: '2px solid white',
            pointerEvents: 'none',
            zIndex: 61,
          }}
        />
      ) : null}
    </div>
  );
}
