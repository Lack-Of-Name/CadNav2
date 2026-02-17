import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { computeGridCornersFromMapBounds, generateGridPoints } from './mapGrid';

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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    const runUpdate = () => {
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

        const gridOffsets = computeGridCornersFromMapBounds(originPt, { latitude: sw.lat, longitude: sw.lng }, { latitude: ne.lat, longitude: ne.lng }, 1000, gridConvergence ?? 0);
        const intersections = generateGridPoints(originPt, gridOffsets.offsets, 1000, gridConvergence ?? 0);

        const pts: Array<{ x: number; y: number; e: number; n: number }> = [];
        for (const inter of intersections) {
          try {
            const p = map.project([inter.longitude, inter.latitude]);
            pts.push({ x: p.x, y: p.y, e: inter.e, n: inter.n });
          } catch {
            // skip
          }
        }

        const es = Array.from(new Set(pts.map((p) => p.e))).sort((a, b) => a - b);
        const ns = Array.from(new Set(pts.map((p) => p.n))).sort((a, b) => a - b);

        const key = (e: number, n: number) => `${e}:${n}`;
        const ptMap = new Map<string, { x: number; y: number; e: number; n: number }>();
        for (const p of pts) ptMap.set(key(p.e, p.n), p);

        const vertical: string[] = es.map((e) => {
          const linePts = ns
            .map((n) => {
              const p = ptMap.get(key(e, n));
              return p ? `${p.x},${p.y}` : null;
            })
            .filter(Boolean) as string[];
          return linePts.join(' ');
        });

        const horizontal: string[] = ns.map((n) => {
          const linePts = es
            .map((e) => {
              const p = ptMap.get(key(e, n));
              return p ? `${p.x},${p.y}` : null;
            })
            .filter(Boolean) as string[];
          return linePts.join(' ');
        });

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

        // Compute cell centers for grid numbers using projected corners
        const centers: Array<{ x: number; y: number; e: number; n: number }> = [];
        if (es.length >= 2 && ns.length >= 2) {
          for (let i = 0; i < es.length - 1; i++) {
            for (let j = 0; j < ns.length - 1; j++) {
              const e0 = es[i];
              const n0 = ns[j];
              const e1 = es[i + 1];
              const n1 = ns[j + 1];
              const p00 = ptMap.get(key(e0, n0));
              const p10 = ptMap.get(key(e1, n0));
              const p01 = ptMap.get(key(e0, n1));
              const p11 = ptMap.get(key(e1, n1));
              if (!p00 || !p10 || !p01 || !p11) continue;
              const x = (p00.x + p10.x + p01.x + p11.x) / 4;
              const y = (p00.y + p10.y + p01.y + p11.y) / 4;
              centers.push({ x, y, e: e0, n: n0 });
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

    const scheduleUpdate = () => {
      if (!map) return;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        runUpdate();
      });
    };

    map.on('load', runUpdate);
    map.on('move', scheduleUpdate);
    map.on('zoom', scheduleUpdate);
    map.on('moveend', runUpdate);
    map.on('zoomend', runUpdate);
    setTimeout(runUpdate, 0);

    return () => {
      map.off('load', runUpdate);
      map.off('move', scheduleUpdate);
      map.off('zoom', scheduleUpdate);
      map.off('moveend', runUpdate);
      map.off('zoomend', runUpdate);
    };
  }, [map, origin, minZoom, gridConvergence]);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 40 }}>
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
            zIndex: 41,
          }}
        />
      ) : null}
    </div>
  );
}
