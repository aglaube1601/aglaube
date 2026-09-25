import { useState, type ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  children: ReactNode;
}

// Card padrão pra todo gráfico do painel — título + botão de alternar pra
// visão em tabela, que é o par WCAG-clean de qualquer gráfico (ver skill
// de dataviz: "table view exists" faz parte do passe de acessibilidade).
export function ChartCard({ title, subtitle, tableHeaders, tableRows, children }: ChartCardProps) {
  const [modoTabela, setModoTabela] = useState(false);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>{title}</p>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{subtitle}</p>}
        </div>
        <button
          onClick={() => setModoTabela((s) => !s)}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 7,
            padding: '4px 9px',
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--muted)',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {modoTabela ? '📈 Gráfico' : '📋 Tabela'}
        </button>
      </div>

      {modoTabela ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {tableHeaders.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '6px 4px',
                    borderBottom: '1px solid var(--line)',
                    color: 'var(--muted)',
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '6px 4px',
                      borderBottom: '1px solid var(--line)',
                      fontVariantNumeric: j > 0 ? 'tabular-nums' : undefined,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </div>
  );
}
