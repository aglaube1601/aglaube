import { useState } from 'react';

interface BarDatum {
  label: string;
  value: number;
}

// Barras horizontais, série única — por isso uma hue só (nominal
// categórica de série única, sem legenda: ver color-formula.md "1-3
// séries: cor sozinha é confortável, sem caixa de legenda quando é 1").
export function BarChart({ data, color = 'var(--teal)', unidade = '' }: { data: BarDatum[]; color?: string; unidade?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        const emFoco = hover === null || hover === i;
        return (
          <div
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
            tabIndex={0}
            style={{
              marginBottom: i === data.length - 1 ? 0 : 12,
              position: 'relative',
              outline: 'none',
              padding: '2px 0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.label}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {d.value}
                {unidade}
              </span>
            </div>
            <div style={{ background: 'var(--paper)', borderRadius: 4, height: 12 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: 12,
                  borderRadius: '0 4px 4px 0',
                  background: color,
                  opacity: emFoco ? 1 : 0.5,
                  boxShadow: hover === i ? `0 0 0 2px ${color}33` : 'none',
                  transition: 'opacity 120ms, width 300ms, box-shadow 120ms',
                }}
              />
            </div>

            {hover === i && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: -4,
                  right: 0,
                  transform: 'translateY(-100%)',
                  background: 'var(--navy)',
                  color: '#fff',
                  fontSize: 11,
                  padding: '5px 9px',
                  borderRadius: 7,
                  whiteSpace: 'nowrap',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              >
                <strong>
                  {d.value}
                  {unidade}
                </strong>{' '}
                · {d.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
