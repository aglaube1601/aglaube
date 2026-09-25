interface StatusItem {
  label: string;
  value: number;
  color: string;
}

// Comparação curta entre estados (ex.: demandas abertas x resolvidas) —
// cor de status é reservada e sempre acompanhada de ícone (o círculo) +
// rótulo, nunca só a cor (ver color-formula.md, seção "Status is fixed").
export function StatusCompare({ items }: { items: StatusItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div>
      {items.map((it, i) => (
        <div key={it.label} style={{ marginBottom: i === items.length - 1 ? 0 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{it.label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: it.color, fontVariantNumeric: 'tabular-nums' }}>
              {it.value}
            </span>
          </div>
          <div style={{ background: 'var(--paper)', borderRadius: 4, height: 12 }}>
            <div
              style={{
                width: `${Math.max(2, (it.value / max) * 100)}%`,
                height: 12,
                borderRadius: '0 4px 4px 0',
                background: it.color,
                transition: 'width 300ms',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
