import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface RotaCampoResumo {
  id: string;
  status: string;
  criadaEm: string;
  comunidade: { id: string; nome: string };
  responsavel: { id: string; nome: string };
  totalParadas: number;
  paradasConcluidas: number;
}

const STATUS_ROTULOS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

const STATUS_CORES: Record<string, string> = {
  planejada: 'var(--muted)',
  em_andamento: 'var(--teal)',
  concluida: 'var(--veryhigh)',
};

const FILTROS_STATUS = ['todas', 'planejada', 'em_andamento', 'concluida'];

export function ListaRotasCampo() {
  const { municipio, usuario } = useAuth();
  const navigate = useNavigate();
  const podeCriar = usuario?.perfil === 'administrador' || usuario?.perfil === 'coordenador';

  const [statusFiltro, setStatusFiltro] = useState('todas');
  const [rotas, setRotas] = useState<RotaCampoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!municipio) return;
    setCarregando(true);
    setErro(null);
    api
      .get<RotaCampoResumo[]>('/rotas-campo', {
        municipioId: municipio.id,
        status: statusFiltro === 'todas' ? undefined : statusFiltro,
      })
      .then(setRotas)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Falha ao carregar rotas de campo.'))
      .finally(() => setCarregando(false));
  }, [municipio, statusFiltro]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h3 style={{ fontSize: 16, margin: 0 }}>Rotas de campo</h3>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '2px 0 0' }}>
            {usuario?.perfil === 'operador' ? 'Suas rotas atribuídas' : 'Todas as rotas do município'}
          </p>
        </div>
      </div>

      {podeCriar && (
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/rotas-campo/nova')}>
          + Nova rota
        </button>
      )}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '14px 0' }}>
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

      {erro && <div className="alert alert-error" style={{ marginBottom: 12 }}>{erro}</div>}

      {!carregando && rotas.length === 0 && (
        <div className="alert alert-amber">
          {usuario?.perfil === 'operador'
            ? 'Nenhuma rota atribuída a você ainda.'
            : 'Nenhuma rota de campo cadastrada ainda.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rotas.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/rotas-campo/${r.id}`)}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{r.comunidade.nome}</span>
              <span
                className="badge"
                style={{
                  background: `${STATUS_CORES[r.status] ?? 'var(--muted)'}22`,
                  color: STATUS_CORES[r.status] ?? 'var(--muted)',
                  flexShrink: 0,
                }}
              >
                {STATUS_ROTULOS[r.status] ?? r.status}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
              Responsável: {r.responsavel.nome}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1, background: 'var(--paper)', borderRadius: 4, height: 6 }}>
                <div
                  style={{
                    width: `${r.totalParadas === 0 ? 0 : (r.paradasConcluidas / r.totalParadas) * 100}%`,
                    height: 6,
                    borderRadius: 4,
                    background: 'var(--teal)',
                  }}
                />
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>
                {r.paradasConcluidas}/{r.totalParadas}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
