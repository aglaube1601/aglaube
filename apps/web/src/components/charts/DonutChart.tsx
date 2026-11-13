import { useState } from 'react';

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

const RAIO = 46;
const ESPESSURA = 22;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
const VAO_SEGMENTO = 3; // "surface gap" entre fatias — ver skill dataviz (marks-and-anatomy.md)

// Rosca de composição (ex.: engajamento político) — rosca em vez de pizza
// cheia por dois motivos: sobra espaço pro número central (o "total"), e a
// fatia mais fina ainda fecha com ponta arredondada legível, sem precisar
// convergir no meio como numa pizza cheia. Cor é só identidade (categórica,
// paleta validada — ver skill dataviz), então o rótulo de cada fatia é quem
// carrega o significado ("Apoiador", "Percepção negativa" etc.), nunca a cor
// sozinha.
export function DonutChart({
  data,
  totalLabel = 'Total',
}: {
  data: DonutDatum[];
  totalLabel?: string;
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) {
    return <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sem leituras registradas ainda.</p>;
  }

  let acumulado = 0;
  const segmentos = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const fracao = d.value / total;
      const comprimento = Math.max(0, fracao * CIRCUNFERENCIA - VAO_SEGMENTO);
      const offset = CIRCUNFERENCIA * (1 - acumulado) + VAO_SEGMENTO / 2;
      acumulado += fracao;
      return { ...d, pct: Math.round(fracao * 100), comprimento, offset, i };
    });

  const centro =
    emFoco !== null
      ? segmentos.find((s) => s.i === emFoco)
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 148, height: 148 }}>
        <svg viewBox="0 0 120 120" width={148} height={148} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={60} cy={60} r={RAIO} fill="none" stroke="var(--paper)" strokeWidth={ESPESSURA} />
          {segmentos.map((s) => (
            <circle
              key={s.label}
              cx={60}
              cy={60}
              r={RAIO}
              fill="none"
              stroke={s.color}
              strokeWidth={ESPESSURA}
              strokeLinecap="round"
              strokeDasharray={`${s.comprimento} ${CIRCUNFERENCIA - s.comprimento}`}
              strokeDashoffset={s.offset}
              opacity={emFoco === null || emFoco === s.i ? 1 : 0.35}
              style={{ transition: 'opacity 120ms', cursor: 'pointer' }}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${s.value} (${s.pct}%)`}
              onMouseEnter={() => setEmFoco(s.i)}
              onMouseLeave={() => setEmFoco((h) => (h === s.i ? null : h))}
              onFocus={() => setEmFoco(s.i)}
              onBlur={() => setEmFoco((h) => (h === s.i ? null : h))}
            />
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 14px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {centro ? centro.value : total}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>
            {centro ? `${centro.label} · ${centro.pct}%` : totalLabel}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px' }}>
        {segmentos.map((s) => (
          <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            {s.label} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
