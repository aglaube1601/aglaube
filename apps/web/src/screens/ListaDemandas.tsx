import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface DemandaResumo {
  id: string;
  categoria: string;
  descricao: string;
  status: string;
  prioridade: string;
  criadoEm: string;
  comunidade: { id: string; nome: string };
  contato: { id: string; nome: string } | null;
}

interface ListagemDemandas {
  itens: DemandaResumo[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

const TAMANHO_PAGINA = 20;

const STATUS_ROTULOS: Record<string, string> = {
  nova: 'Nova',
  em_analise: 'Em análise',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida',
  encerrada: 'Encerrada',
};

const STATUS_CORES: Record<string, string> = {
  nova: 'var(--muted)',
  em_analise: 'var(--amber)',
  em_andamento: 'var(--teal)',
  resolvida: 'var(--veryhigh)',
  encerrada: 'var(--muted)',
};

const FILTROS_STATUS = ['todas', 'nova', 'em_analise', 'em_andamento', 'resolvida', 'encerrada'];

export function ListaDemandas() {
  const { municipio } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comunidadeId = searchParams.get('comunidadeId') ?? undefined;

  const [statusFiltro, setStatusFiltro] = useState('todas');
  const [itens, setItens] = useState<DemandaResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar(paginaAlvo: number, substituir: boolean) {
    if (!municipio) return;
    setCarregando(true);
    api
      .get<ListagemDemandas>('/demandas', {
        municipioId: municipio.id,
        comunidadeId,
        status: statusFiltro === 'todas' ? undefined : statusFiltro,
        pagina: String(paginaAlvo),
        tamanhoPagina: String(TAMANHO_PAGINA),
      })
      .then((resultado) => {
        setItens((atual) => (substituir ? resultado.itens : [...atual, ...resultado.itens]));
        setTotal(resultado.total);
        setPagina(resultado.pagina);
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Falha ao carregar demandas.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    setItens([]);
    carregar(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipio, comunidadeId, statusFiltro]);

  // Todo item já vem filtrado pra essa comunidade quando comunidadeId está
  // presente — usar o primeiro item carregado evita uma segunda chamada só
  // pra saber o nome.
  const nomeComunidadeFiltrada = comunidadeId ? itens[0]?.comunidade.nome ?? null : null;

  return (
    <div>
      <div style={{ padding: '14px 16px 10px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ marginBottom: 8, background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          ← Voltar
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Demandas{nomeComunidadeFiltrada ? ` — ${nomeComunidadeFiltrada}` : ''}
        </h2>
        {total > 0 && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{total} no total</p>}
      </div>

      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {FILTROS_STATUS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`chip ${statusFiltro === s ? 'active' : ''}`}
            style={{ flexShrink: 0 }}
          >
            {s === 'todas' ? 'Todas' : STATUS_ROTULOS[s]}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {erro && <div className="alert alert-error" style={{ marginBottom: 12 }}>{erro}</div>}

        {itens.length === 0 && !carregando && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhuma demanda encontrada.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {itens.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/demandas/${d.id}`)}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{d.categoria}</span>
                <span
                  className="badge"
                  style={{
                    background: `${STATUS_CORES[d.status] ?? 'var(--muted)'}22`,
                    color: STATUS_CORES[d.status] ?? 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  {STATUS_ROTULOS[d.status] ?? d.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.descricao}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>
                {d.comunidade.nome} · {new Date(d.criadoEm).toLocaleDateString('pt-BR')}
              </p>
            </button>
          ))}
        </div>

        {itens.length < total && (
          <button
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => carregar(pagina + 1, false)}
            disabled={carregando}
          >
            {carregando ? 'Carregando…' : `Carregar mais (${total - itens.length} restantes)`}
          </button>
        )}
      </div>
    </div>
  );
}
