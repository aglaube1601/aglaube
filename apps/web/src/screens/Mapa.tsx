import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface LiderancaResumo {
  id: string;
  contatoId: string;
  nome: string;
  telefone: string | null;
  comunidadeNome: string;
  grupo: string | null;
  criadoEm: string;
}

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

const STATUS_DEMANDA_ROTULOS: Record<string, string> = {
  nova: 'Nova',
  em_analise: 'Em análise',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida',
  encerrada: 'Encerrada',
};

const STATUS_DEMANDA_CORES: Record<string, string> = {
  nova: 'var(--muted)',
  em_analise: 'var(--amber)',
  em_andamento: 'var(--teal)',
  resolvida: 'var(--veryhigh)',
  encerrada: 'var(--muted)',
};

interface EngajamentoAgregado {
  apoiador: number;
  simpatizante: number;
  neutro: number;
  percepcaoNegativa: number;
  desconhecido: number;
}

interface DadosEleitorais {
  candidatoNumero: number;
  candidatoNome: string;
  votosObtidos: number;
}

interface TerritorioMapa {
  comunidadeId: string;
  nome: string;
  bairroNome: string;
  totalContatos: number;
  liderancasAtivas: number;
  demandasAbertas: number;
  engajamentoAgregado: EngajamentoAgregado | null;
  dadosEleitorais: DadosEleitorais[];
}

type Metrica = 'contatos' | 'demandas' | 'liderancas';

const METRICAS: Array<{ key: Metrica; label: string }> = [
  { key: 'contatos', label: 'Contatos' },
  { key: 'demandas', label: 'Demandas' },
  { key: 'liderancas', label: 'Lideranças' },
];

function valorMetrica(t: TerritorioMapa, m: Metrica): number {
  if (m === 'contatos') return t.totalContatos;
  if (m === 'demandas') return t.demandasAbertas;
  return t.liderancasAtivas;
}

function corPorFaixa(v: number, max: number): string {
  if (max === 0) return 'var(--low)';
  const ratio = v / max;
  if (ratio < 0.25) return 'var(--low)';
  if (ratio < 0.5) return 'var(--mid)';
  if (ratio < 0.75) return 'var(--high)';
  return 'var(--veryhigh)';
}

export function Mapa() {
  const { municipio } = useAuth();
  const navigate = useNavigate();
  const [territorios, setTerritorios] = useState<TerritorioMapa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<Metrica>('contatos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [liderancasComunidade, setLiderancasComunidade] = useState<LiderancaResumo[] | null>(null);
  const [demandasComunidade, setDemandasComunidade] = useState<DemandaResumo[] | null>(null);

  useEffect(() => {
    if (!municipio) return;
    api
      .get<TerritorioMapa[]>(`/municipios/${municipio.id}/mapa/territorios`)
      .then((data) => {
        setTerritorios(data);
        if (data.length > 0) setSelecionadoId(data[0].comunidadeId);
      })
      .catch((e) =>
        setErro(
          e instanceof ApiError
            ? e.status === 403
              ? 'Seu perfil não tem acesso ao mapa territorial.'
              : e.message
            : 'Falha ao carregar o mapa.',
        ),
      );
  }, [municipio]);

  const max = useMemo(
    () => (territorios ? Math.max(...territorios.map((t) => valorMetrica(t, metrica)), 1) : 1),
    [territorios, metrica],
  );

  const selecionado = territorios?.find((t) => t.comunidadeId === selecionadoId) ?? null;

  useEffect(() => {
    if (!municipio || !selecionadoId) {
      setLiderancasComunidade(null);
      return;
    }
    api
      .get<LiderancaResumo[]>('/liderancas', { municipioId: municipio.id, comunidadeId: selecionadoId })
      .then(setLiderancasComunidade)
      .catch(() => setLiderancasComunidade(null));
  }, [municipio, selecionadoId]);

  useEffect(() => {
    if (!municipio || !selecionadoId) {
      setDemandasComunidade(null);
      return;
    }
    api
      .get<DemandaResumo[]>('/demandas', { municipioId: municipio.id, comunidadeId: selecionadoId })
      .then(setDemandasComunidade)
      .catch(() => setDemandasComunidade(null));
  }, [municipio, selecionadoId]);

  if (erro) return <div className="alert alert-error" style={{ margin: 16 }}>{erro}</div>;
  if (!territorios) return <div className="spinner">Carregando mapa…</div>;

  return (
    <div>
      <div style={{ padding: '12px 14px 8px', background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {METRICAS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetrica(m.key)}
              className={`chip ${metrica === m.key ? 'active' : ''}`}
              style={{ flex: 1, textAlign: 'center' }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 14, background: '#eae7dd' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {territorios.map((t) => {
            const isSel = t.comunidadeId === selecionadoId;
            return (
              <button
                key={t.comunidadeId}
                onClick={() => setSelecionadoId(t.comunidadeId)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  border: isSel ? '3px solid var(--navy)' : '3px solid transparent',
                  borderRadius: 10,
                  padding: '12px 10px',
                  cursor: 'pointer',
                  background: corPorFaixa(valorMetrica(t, metrica), max),
                  minHeight: 78,
                  boxShadow: isSel ? '0 0 0 2px #fff inset, 0 4px 10px rgba(21,34,56,0.35)' : '0 1px 3px rgba(21,34,56,0.08)',
                }}
              >
                {/* Indicador de SELEÇÃO — canto inferior-esquerdo, cheio de navy,
                    propositalmente diferente do badge branco de "tem liderança"
                    (canto superior-direito) pra nunca serem confundidos. */}
                {isSel && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: 'var(--navy)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                    title="comunidade selecionada"
                  >
                    ✓
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{t.nome}</span>
                {t.liderancasAtivas > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                    }}
                    title="tem liderança cadastrada"
                  >
                    🎖️
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--muted)' }}>
          <span>Baixa</span>
          {['var(--low)', 'var(--mid)', 'var(--high)', 'var(--veryhigh)'].map((c) => (
            <span key={c} style={{ width: 16, height: 8, background: c, borderRadius: 2 }} />
          ))}
          <span>Alta</span>
        </div>
      </div>

      {selecionado && (
        <div
          style={{
            background: '#fff',
            borderTop: '1px solid var(--line)',
            padding: 16,
            borderRadius: '16px 16px 0 0',
            marginTop: -8,
            position: 'relative',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--ink)', fontWeight: 700 }}>{selecionado.nome}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {selecionado.bairroNome} · {selecionado.totalContatos} contato(s)
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <MiniStat label="demandas abertas" value={selecionado.demandasAbertas} />
            <MiniStat label="lideranças ativas" value={selecionado.liderancasAtivas} />
          </div>

          <p className="section-title">Demandas desta comunidade</p>
          {demandasComunidade === null ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Carregando…</p>
          ) : demandasComunidade.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Nenhuma demanda registrada nesta comunidade ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {demandasComunidade.map((d) => (
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
                        background: `${STATUS_DEMANDA_CORES[d.status] ?? 'var(--muted)'}22`,
                        color: STATUS_DEMANDA_CORES[d.status] ?? 'var(--muted)',
                        flexShrink: 0,
                      }}
                    >
                      {STATUS_DEMANDA_ROTULOS[d.status] ?? d.status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.descricao}
                  </p>
                </button>
              ))}
            </div>
          )}

          <p className="section-title">Lideranças cadastradas</p>
          {liderancasComunidade === null ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Carregando…</p>
          ) : liderancasComunidade.length === 0 ? (
            <div className="alert alert-amber">
              Nenhuma liderança cadastrada nesta comunidade ainda. Abra o perfil de um
              contato e use "Marcar como liderança".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liderancasComunidade.map((l) => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/contatos/${l.contatoId}`)}
                  className="card"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, display: 'block' }}>{l.nome}</span>
                    {l.grupo && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{l.grupo}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--teal)' }}>Ver perfil →</span>
                </button>
              ))}
            </div>
          )}

          <p className="section-title">Engajamento agregado</p>
          {selecionado.engajamentoAgregado ? (
            <EngajamentoBar dados={selecionado.engajamentoAgregado} />
          ) : (
            <div className="alert alert-amber">
              🔒 Comunidade pequena demais para exibir engajamento agregado sem risco de
              reidentificação (mínimo de 5 contatos).
            </div>
          )}

          {selecionado.dadosEleitorais.length > 0 && (
            <>
              <p className="section-title">Resultado eleitoral (TSE, agregado)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selecionado.dadosEleitorais.map((d) => (
                  <div key={d.candidatoNumero} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span>
                      {d.candidatoNumero} · {d.candidatoNome}
                    </span>
                    <strong>{d.votosObtidos} votos</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: 'var(--paper)', borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}

function EngajamentoBar({ dados }: { dados: EngajamentoAgregado }) {
  const total =
    dados.apoiador + dados.simpatizante + dados.neutro + dados.percepcaoNegativa + dados.desconhecido;
  if (total === 0) {
    return <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem leituras de engajamento registradas ainda.</p>;
  }
  const pct = (n: number) => (n / total) * 100;
  const itens: Array<[string, number, string]> = [
    ['Apoio', dados.apoiador, 'var(--veryhigh)'],
    ['Simpatia', dados.simpatizante, 'var(--high)'],
    ['Neutro', dados.neutro, 'var(--mid)'],
    ['Negativo', dados.percepcaoNegativa, 'var(--danger)'],
    ['Desconhecido', dados.desconhecido, 'var(--line)'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
        {itens.map(([label, valor, cor]) => (
          <div key={label} style={{ width: `${pct(valor)}%`, background: cor }} title={label} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
        {itens.map(([label, valor]) => (
          <span key={label}>
            ● {label} {Math.round(pct(valor))}%
          </span>
        ))}
      </div>
    </div>
  );
}
