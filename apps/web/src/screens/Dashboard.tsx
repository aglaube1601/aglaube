import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ResumoExecutivo {
  totalContatos: number;
  novosContatos30Dias: number;
  liderancasCadastradas: number;
  comunidadesMapeadas: number;
  regioesComBaixaCobertura: Array<{ comunidadeId: string; nome: string; totalContatos: number }>;
  interacoes30Dias: number;
  demandasAbertas: number;
  demandasResolvidas30Dias: number;
  proximosEventos: Array<{ id: string; tipo: string; data: string; comunidadeNome: string }>;
  aniversariantesDoMes: number;
  geradoEm: string;
}

export function Dashboard() {
  const { municipio } = useAuth();
  const [dados, setDados] = useState<ResumoExecutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!municipio) return;
    api
      .get<ResumoExecutivo>(`/municipios/${municipio.id}/dashboard/resumo-executivo`)
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Falha ao carregar painel.'));
  }, [municipio]);

  if (erro) return <div className="alert alert-error" style={{ margin: 16 }}>{erro}</div>;
  if (!dados) return <div className="spinner">Carregando painel…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div className="kpi-grid">
        <Kpi label="Contatos cadastrados" value={dados.totalContatos} />
        <Kpi label="Novos em 30 dias" value={dados.novosContatos30Dias} />
        <Kpi label="Lideranças" value={dados.liderancasCadastradas} />
        <Kpi label="Comunidades mapeadas" value={dados.comunidadesMapeadas} />
        <Kpi label="Interações em 30 dias" value={dados.interacoes30Dias} />
        <Kpi label="Aniversariantes do mês" value={dados.aniversariantesDoMes} />
        <Kpi label="Demandas abertas" value={dados.demandasAbertas} accent="amber" />
        <Kpi label="Demandas resolvidas (30d)" value={dados.demandasResolvidas30Dias} accent="green" />
      </div>

      {dados.regioesComBaixaCobertura.length > 0 && (
        <>
          <p className="section-title">Comunidades com baixa cobertura</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.regioesComBaixaCobertura.map((r) => (
              <div key={r.comunidadeId} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{r.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  {r.totalContatos} contato(s)
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {dados.proximosEventos.length > 0 && (
        <>
          <p className="section-title">Próximos eventos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.proximosEventos.map((ev) => (
              <div key={ev.id} className="card">
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{ev.tipo}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                  {ev.comunidadeNome} · {new Date(ev.data).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>
        Gerado em {new Date(dados.geradoEm).toLocaleString('pt-BR')}
      </p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: 'amber' | 'green' }) {
  const color = accent === 'amber' ? 'var(--amber)' : accent === 'green' ? 'var(--veryhigh)' : undefined;
  return (
    <div className="kpi-card">
      <span className="label">{label}</span>
      <p className="value" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
