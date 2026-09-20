import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

interface ContatoDetalhado {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  dataNascimento: string | null;
  endereco: string | null;
  profissao: string | null;
  comunidadeId: string;
  comunidade: { id: string; nome: string };
  criadoEm: string;
  engajamentoPolitico?: {
    status: string;
    origem: string;
    confianca: string;
    criadoEm: string;
  } | null;
}

interface Interacao {
  id: string;
  tipo: string;
  descricao: string;
  data: string;
}

interface ConsentimentoAtual {
  finalidade: string;
  status: string;
  origem: string | null;
  data: string;
}

const FINALIDADE_PADRAO = 'comunicacao_institucional';

const OPCOES_CONSENTIMENTO = [
  { valor: 'ativo', rotulo: 'Sim, aceitou' },
  { valor: 'opt_out', rotulo: 'Não aceitou' },
  { valor: 'nao_perguntado', rotulo: 'Não perguntado ainda' },
];

const TIPOS_INTERACAO = [
  'ligacao',
  'mensagem',
  'reuniao',
  'visita',
  'evento',
  'observacao',
  'tarefa',
  'retorno_agendado',
];

export function PerfilContato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contato, setContato] = useState<ContatoDetalhado | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarEngajamento, setMostrarEngajamento] = useState(false);

  const [novoTipo, setNovoTipo] = useState('visita');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);

  const [consentimentos, setConsentimentos] = useState<ConsentimentoAtual[]>([]);
  const [salvandoConsentimento, setSalvandoConsentimento] = useState(false);

  const [mostrarDemanda, setMostrarDemanda] = useState(false);
  const [categoriaDemanda, setCategoriaDemanda] = useState('');
  const [descricaoDemanda, setDescricaoDemanda] = useState('');
  const [salvandoDemanda, setSalvandoDemanda] = useState(false);
  const [demandaCriada, setDemandaCriada] = useState(false);

  function carregar() {
    if (!id) return;
    api
      .get<ContatoDetalhado>(`/contatos/${id}`)
      .then(setContato)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Falha ao carregar contato.'));
    api
      .get<Interacao[]>(`/contatos/${id}/interacoes`)
      .then(setInteracoes)
      .catch(() => undefined);
    api
      .get<ConsentimentoAtual[]>(`/contatos/${id}/consentimento`)
      .then(setConsentimentos)
      .catch(() => undefined);
  }

  useEffect(carregar, [id]);

  const statusAtualConsentimento = consentimentos.find((c) => c.finalidade === FINALIDADE_PADRAO)?.status;

  async function registrarConsentimento(status: string) {
    if (!id) return;
    setSalvandoConsentimento(true);
    try {
      await api.post(`/contatos/${id}/consentimento`, { finalidade: FINALIDADE_PADRAO, status });
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao registrar consentimento.');
    } finally {
      setSalvandoConsentimento(false);
    }
  }

  async function adicionarInteracao(e: FormEvent) {
    e.preventDefault();
    if (!id || !novaDescricao.trim()) return;
    setSalvandoInteracao(true);
    try {
      await api.post('/interacoes', { contatoId: id, tipo: novoTipo, descricao: novaDescricao });
      setNovaDescricao('');
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao registrar interação.');
    } finally {
      setSalvandoInteracao(false);
    }
  }

  async function abrirDemanda(e: FormEvent) {
    e.preventDefault();
    if (!id || !contato || !categoriaDemanda.trim() || !descricaoDemanda.trim()) return;
    setSalvandoDemanda(true);
    try {
      await api.post('/demandas', {
        categoria: categoriaDemanda,
        descricao: descricaoDemanda,
        comunidadeId: contato.comunidadeId,
        contatoId: id,
      });
      setDemandaCriada(true);
      setCategoriaDemanda('');
      setDescricaoDemanda('');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao abrir demanda.');
    } finally {
      setSalvandoDemanda(false);
    }
  }

  if (erro && !contato) return <div className="alert alert-error" style={{ margin: 16 }}>{erro}</div>;
  if (!contato) return <div className="spinner">Carregando contato…</div>;

  const iniciais = contato.nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        style={{ margin: '10px 0 0 12px', background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        ← Voltar
      </button>

      <div style={{ background: 'var(--navy)', padding: '16px 18px 22px', color: '#fff', marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {iniciais}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{contato.nome}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, opacity: 0.8 }}>{contato.comunidade.nome}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <Row label={contato.telefone ?? 'sem telefone'} />
          <Row label={contato.endereco ?? 'sem endereço'} />
          <Row label={contato.profissao ?? 'sem profissão informada'} last />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            💬 Consentimento de comunicação
            {statusAtualConsentimento && (
              <span
                className="badge"
                style={{
                  background:
                    statusAtualConsentimento === 'ativo'
                      ? 'rgba(45,110,79,0.12)'
                      : statusAtualConsentimento === 'opt_out'
                        ? 'rgba(184,84,80,0.12)'
                        : 'var(--line)',
                  color:
                    statusAtualConsentimento === 'ativo'
                      ? 'var(--veryhigh)'
                      : statusAtualConsentimento === 'opt_out'
                        ? 'var(--danger)'
                        : 'var(--muted)',
                }}
              >
                {OPCOES_CONSENTIMENTO.find((o) => o.valor === statusAtualConsentimento)?.rotulo}
              </span>
            )}
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--muted)' }}>
            A pessoa aceita receber mensagens institucionais (aniversário, notícias, lembretes)?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {OPCOES_CONSENTIMENTO.map((op) => (
              <button
                key={op.valor}
                onClick={() => registrarConsentimento(op.valor)}
                disabled={salvandoConsentimento}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 9,
                  textAlign: 'left',
                  border: statusAtualConsentimento === op.valor ? '2px solid var(--teal)' : '1px solid var(--line)',
                  background: statusAtualConsentimento === op.valor ? 'var(--teal-light)' : '#fff',
                  cursor: 'pointer',
                  fontSize: 12.5,
                }}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
        </div>

        {contato.engajamentoPolitico !== undefined && (
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setMostrarEngajamento((s) => !s)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: 14, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>🔒 Leitura de engajamento</span>
              <span>{mostrarEngajamento ? '▲' : '▼'}</span>
            </button>
            {mostrarEngajamento && (
              <div style={{ padding: '0 14px 14px' }}>
                <div className="alert alert-amber" style={{ marginBottom: 10 }}>
                  Percepção interna da equipe — não é declaração confirmada pela pessoa.
                </div>
                {contato.engajamentoPolitico ? (
                  <>
                    <Row label="Status" value={contato.engajamentoPolitico.status} />
                    <Row label="Origem" value={contato.engajamentoPolitico.origem} />
                    <Row label="Confiança" value={contato.engajamentoPolitico.confianca} last />
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhuma leitura registrada ainda.</p>
                )}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-outline" onClick={() => setMostrarDemanda((s) => !s)} style={{ marginBottom: 12 }}>
          📋 Abrir demanda
        </button>

        {mostrarDemanda && (
          <form onSubmit={abrirDemanda} className="card" style={{ marginBottom: 16 }}>
            {demandaCriada && <div className="alert alert-amber" style={{ marginBottom: 10 }}>Demanda registrada.</div>}
            <div className="field">
              <label>Categoria</label>
              <input value={categoriaDemanda} onChange={(e) => setCategoriaDemanda(e.target.value)} placeholder="ex: iluminação pública" />
            </div>
            <div className="field">
              <label>Descrição</label>
              <textarea value={descricaoDemanda} onChange={(e) => setDescricaoDemanda(e.target.value)} rows={3} />
            </div>
            <button className="btn btn-primary" disabled={salvandoDemanda}>
              {salvandoDemanda ? 'Salvando…' : 'Registrar demanda'}
            </button>
          </form>
        )}

        <p className="section-title">Histórico de interações</p>
        <form onSubmit={adicionarInteracao} className="card" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Tipo</label>
            <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)}>
              {TIPOS_INTERACAO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>O que aconteceu</label>
            <textarea value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} rows={2} />
          </div>
          <button className="btn btn-primary" disabled={salvandoInteracao || !novaDescricao.trim()}>
            {salvandoInteracao ? 'Registrando…' : 'Registrar interação'}
          </button>
        </form>

        <div style={{ position: 'relative', paddingLeft: 20 }}>
          {interacoes.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhuma interação registrada ainda.</p>}
          {interacoes.length > 0 && <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: 'var(--line)' }} />}
          {interacoes.map((it) => (
            <div key={it.id} style={{ position: 'relative', marginBottom: 14 }}>
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  top: 0,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '2px solid var(--teal)',
                }}
              />
              <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
                {new Date(it.data).toLocaleDateString('pt-BR')} · {it.tipo}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5 }}>{it.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--line)', fontSize: 12.5 }}>
      {value ? (
        <span>
          <span style={{ color: 'var(--muted)' }}>{label}: </span>
          <strong>{value}</strong>
        </span>
      ) : (
        <span style={{ color: 'var(--ink)' }}>{label}</span>
      )}
    </div>
  );
}
