import { useRef, useState, type PointerEvent } from 'react';

interface Ponto {
  label: string;
  value: number;
}

const W = 600;
const H = 170;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

// Linha + área (série única) com crosshair — "trend over time: line; area
// for a single series" (choosing-a-form.md). Coordenadas num viewBox fixo,
// escaladas por CSS (width: 100%) — sem depender de medir o container.
export function LineChart({ data, color = 'var(--teal)' }: { data: Ponto[]; color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.value));
  const passoY = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 20 : Math.ceil(max / 4 / 10) * 10;
  const maxEixo = Math.max(passoY, Math.ceil(max / passoY) * passoY);

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_LEFT + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - (v / maxEixo) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const areaPath =
    data.length > 0
      ? `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`
      : '';

  const ticksY = Array.from(new Set([0, Math.round(maxEixo / 2), maxEixo]));

  function handleMove(e: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let melhorDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(x(i) - relX);
      if (dist < melhorDist) {
        melhorDist = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  if (data.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem dados no período.</p>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Gráfico de linha"
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />

        {hoverIdx !== null && (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
            <circle cx={x(hoverIdx)} cy={y(data[hoverIdx].value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}

        <text x={x(0)} y={H - 4} fontSize={9} fill="var(--muted)" textAnchor="start">
          {data[0].label}
        </text>
        <text x={x(data.length - 1)} y={H - 4} fontSize={9} fill="var(--muted)" textAnchor="end">
          {data[data.length - 1].label}
        </text>
      </svg>

      {hoverIdx !== null && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${(x(hoverIdx) / W) * 100}%`,
            top: `${(y(data[hoverIdx].value) / H) * 100}%`,
            transform: 'translate(-50%, -140%)',
            background: 'var(--navy)',
            color: '#fff',
            fontSize: 11,
            padding: '5px 9px',
            borderRadius: 7,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <strong>{data[hoverIdx].value}</strong> · {data[hoverIdx].label}
        </div>
      )}
    </div>
  );
}
