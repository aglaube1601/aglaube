import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

interface Parada {
  id: string;
  ordem: number;
  status: string;
  concluidaEm: string | null;
  contato: { id: string; nome: string; telefone: string | null; endereco: string | null };
}

interface RotaDetalhe {
  id: string;
  status: string;
  criadaEm: string;
  comunidade: { id: string; nome: string };
  responsavel: { id: string; nome: string };
  criadaPor: { id: string; nome: string };
  paradas: Parada[];
}

const STATUS_ROTA_ROTULOS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

const STATUS_ROTA_CORES: Record<string, string> = {
  planejada: 'var(--muted)',
  em_andamento: 'var(--teal)',
  concluida: 'var(--veryhigh)',
};

const OPCOES_PARADA = [
  { valor: 'visitado', rotulo: 'Visitado', cor: 'var(--veryhigh)' },
  { valor: 'ausente', rotulo: 'Ausente', cor: 'var(--amber)' },
  { valor: 'recusou', rotulo: 'Recusou', cor: 'var(--danger)' },
];

export function DetalheRotaCampo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rota, setRota] = useState<RotaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  function carregar() {
    if (!id) return;
    api
      .get<RotaDetalhe>(`/rotas-campo/${id}`)
      .then(setRota)
      .catch((e) =>
        setErro(
          e instanceof ApiError
            ? e.status === 403
              ? 'Você não tem acesso a esta rota.'
              : e.message
            : 'Falha ao carregar rota de campo.',
        ),
      );
  }

  useEffect(carregar, [id]);

  async function marcarParada(paradaId: string, status: string) {
    if (!id) return;
    setAtualizando(paradaId);
    try {
      await api.patch(`/rotas-campo/${id}/paradas/${paradaId}`, { status });
      carregar(); // re-busca a rota inteira — mais simples que recalcular status no cliente
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao atualizar parada.');
    } finally {
      setAtualizando(null);
    }
  }

  if (erro && !rota) {
    return (
      <div style={{ padding: 16 }}>
        <div className="alert alert-error">{erro}</div>
      </div>
    );
  }

  if (!rota) {
    return <div className="spinner">Carregando rota…</div>;
  }

  const total = rota.paradas.length;
  const concluidas = rota.paradas.filter((p) => p.status !== 'pendente').length;

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => navigate('/rotas-campo')}
        style={{ marginBottom: 8, background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        ← Rotas de campo
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{rota.comunidade.nome}</h3>
        <span
          className="badge"
          style={{
            background: `${STATUS_ROTA_CORES[rota.status] ?? 'var(--muted)'}22`,
            color: STATUS_ROTA_CORES[rota.status] ?? 'var(--muted)',
            flexShrink: 0,
          }}
        >
          {STATUS_ROTA_ROTULOS[rota.status] ?? rota.status}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '4px 0 0' }}>
        Responsável: {rota.responsavel.nome} · Criada por {rota.criadaPor.nome}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 18px' }}>
        <div style={{ flex: 1, background: 'var(--paper)', borderRadius: 4, height: 8 }}>
          <div
            style={{
              width: `${total === 0 ? 0 : (concluidas / total) * 100}%`,
              height: 8,
              borderRadius: 4,
              background: 'var(--teal)',
              transition: 'width 300ms',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>
          {concluidas}/{total} paradas
        </span>
      </div>

      {erro && <div className="alert alert-error" style={{ marginBottom: 14 }}>{erro}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rota.paradas.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--navy)',
                  color: '#fff',
                  fontSize: 10.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {p.ordem + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{p.contato.nome}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                  {[p.contato.endereco, p.contato.telefone].filter(Boolean).join(' · ') || 'Sem endereço/telefone cadastrado'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {OPCOES_PARADA.map((op) => (
                <button
                  key={op.valor}
                  disabled={atualizando === p.id}
                  onClick={() => marcarParada(p.id, op.valor)}
                  className={`chip ${p.status === op.valor ? 'active' : ''}`}
                  style={p.status === op.valor ? { borderColor: op.cor, background: op.cor } : undefined}
                >
                  {op.rotulo}
                </button>
              ))}
              {p.status !== 'pendente' && (
                <button
                  disabled={atualizando === p.id}
                  onClick={() => marcarParada(p.id, 'pendente')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: '0 4px' }}
                >
                  ↺ desfazer
                </button>
              )}
            </div>

            {p.status !== 'pendente' && (
              <button
                onClick={() => navigate(`/contatos/${p.contato.id}`)}
                style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Ver contato / registrar interação →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
