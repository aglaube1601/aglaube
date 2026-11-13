import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface DemandaDetalhada {
  id: string;
  categoria: string;
  descricao: string;
  status: string;
  prioridade: string;
  prazo: string | null;
  criadoEm: string;
  comunidade: { id: string; nome: string };
  contato: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
  historico: Array<{
    id: string;
    statusAnterior: string | null;
    statusNovo: string;
    justificativa: string | null;
    data: string;
    alteradoPor: { id: string; nome: string };
  }>;
}

const ORDEM_STATUS = ['nova', 'em_analise', 'em_andamento', 'resolvida', 'encerrada'];

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

const PRIORIDADE_ROTULOS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

export function DemandaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [demanda, setDemanda] = useState<DemandaDetalhada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avancando, setAvancando] = useState(false);

  function carregar() {
    if (!id) return;
    api
      .get<DemandaDetalhada>(`/demandas/${id}`)
      .then(setDemanda)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Falha ao carregar demanda.'));
  }

  useEffect(carregar, [id]);

  const podeAvancar = usuario && usuario.perfil !== 'visualizacao';
  const indiceAtual = demanda ? ORDEM_STATUS.indexOf(demanda.status) : -1;
  const proximoStatus = indiceAtual >= 0 && indiceAtual < ORDEM_STATUS.length - 1 ? ORDEM_STATUS[indiceAtual + 1] : null;

  async function avancarStatus() {
    if (!id || !proximoStatus) return;
    setAvancando(true);
    setErro(null);
    try {
      await api.patch(`/demandas/${id}/status`, { novoStatus: proximoStatus });
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao atualizar status.');
    } finally {
      setAvancando(false);
    }
  }

  if (erro && !demanda) return <div className="alert alert-error" style={{ margin: 16 }}>{erro}</div>;
  if (!demanda) return <div className="spinner">Carregando demanda…</div>;

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: 10, background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        ← Voltar
      </button>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{demanda.categoria}</h2>
          <span
            className="badge"
            style={{ background: `${STATUS_CORES[demanda.status]}22`, color: STATUS_CORES[demanda.status], flexShrink: 0 }}
          >
            {STATUS_ROTULOS[demanda.status] ?? demanda.status}
          </span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink)' }}>{demanda.descricao}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
          {demanda.comunidade.nome} · Prioridade {PRIORIDADE_ROTULOS[demanda.prioridade] ?? demanda.prioridade}
          {demanda.prazo && ` · Prazo ${new Date(demanda.prazo).toLocaleDateString('pt-BR')}`}
        </p>
        {demanda.contato && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>
            Contato:{' '}
            <Link to={`/contatos/${demanda.contato.id}`} style={{ color: 'var(--teal)', fontWeight: 700 }}>
              {demanda.contato.nome}
            </Link>
          </p>
        )}
        {demanda.responsavel && (
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
            Responsável: {demanda.responsavel.nome}
          </p>
        )}
      </div>

      {erro && <div className="alert alert-error" style={{ marginBottom: 12 }}>{erro}</div>}

      {podeAvancar && proximoStatus && (
        <button className="btn btn-primary" onClick={avancarStatus} disabled={avancando} style={{ marginBottom: 16 }}>
          {avancando ? 'Atualizando…' : `Avançar para "${STATUS_ROTULOS[proximoStatus]}"`}
        </button>
      )}
      {!proximoStatus && (
        <div className="alert alert-amber" style={{ marginBottom: 16 }}>
          Esta demanda já está encerrada — fim do fluxo.
        </div>
      )}

      <p className="section-title">Histórico</p>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {demanda.historico.length > 0 && (
          <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: 'var(--line)' }} />
        )}
        {demanda.historico.map((h) => (
          <div key={h.id} style={{ position: 'relative', marginBottom: 14 }}>
            <div
              style={{
                position: 'absolute',
                left: -20,
                top: 0,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                border: `2px solid ${STATUS_CORES[h.statusNovo] ?? 'var(--teal)'}`,
              }}
            />
            <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
              {new Date(h.data).toLocaleString('pt-BR')} · {h.alteradoPor.nome}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5 }}>
              {h.statusAnterior ? `${STATUS_ROTULOS[h.statusAnterior] ?? h.statusAnterior} → ` : 'Criada como '}
              <strong>{STATUS_ROTULOS[h.statusNovo] ?? h.statusNovo}</strong>
            </p>
            {h.justificativa && (
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>
                {h.justificativa}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
