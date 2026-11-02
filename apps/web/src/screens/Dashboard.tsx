import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ChartCard } from '../components/charts/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { StatusCompare } from '../components/charts/StatusCompare';

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
  contatosPorComunidade: Array<{ comunidadeId: string; nome: string; totalContatos: number }>;
  interacoesPorDia: Array<{ dia: string; total: number }>;
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

  const seriePorDia = dados.interacoesPorDia.map((d) => ({
    label: new Date(`${d.dia}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: d.total,
  }));

  const rankingComunidades = dados.contatosPorComunidade.map((c) => ({
    label: c.nome,
    value: c.totalContatos,
  }));

  return (
    <div style={{ padding: 16 }}>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Contatos cadastrados" value={dados.totalContatos} />
        <Kpi label="Novos em 30 dias" value={dados.novosContatos30Dias} />
        <Kpi label="Lideranças" value={dados.liderancasCadastradas} />
        <Kpi label="Comunidades mapeadas" value={dados.comunidadesMapeadas} />
        <Kpi label="Interações em 30 dias" value={dados.interacoes30Dias} />
        <Kpi label="Aniversariantes do mês" value={dados.aniversariantesDoMes} />
      </div>

      <div className="chart-grid">
        {rankingComunidades.length > 0 && (
          <ChartCard
            title="Contatos por comunidade"
            subtitle={`Top ${rankingComunidades.length} comunidades cadastradas`}
            tableHeaders={['Comunidade', 'Contatos']}
            tableRows={rankingComunidades.map((c) => [c.label, c.value])}
          >
            <BarChart data={rankingComunidades} />
          </ChartCard>
        )}

        <ChartCard
          title="Interações nos últimos 14 dias"
          subtitle="Ligações, mensagens, visitas e reuniões registradas"
          tableHeaders={['Dia', 'Interações']}
          tableRows={seriePorDia.map((d) => [d.label, d.value])}
        >
          <LineChart data={seriePorDia} />
        </ChartCard>

        <ChartCard
          title="Demandas"
          subtitle="Abertas agora × resolvidas nos últimos 30 dias"
          tableHeaders={['Status', 'Quantidade']}
          tableRows={[
            ['Abertas', dados.demandasAbertas],
            ['Resolvidas (30d)', dados.demandasResolvidas30Dias],
          ]}
        >
          <StatusCompare
            items={[
              { label: 'Abertas', value: dados.demandasAbertas, color: 'var(--amber)' },
              { label: 'Resolvidas (30d)', value: dados.demandasResolvidas30Dias, color: 'var(--veryhigh)' },
            ]}
          />
        </ChartCard>
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
