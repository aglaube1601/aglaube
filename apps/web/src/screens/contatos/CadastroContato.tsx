import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Comunidade {
  id: string;
  nome: string;
  bairro: { id: string; nome: string };
}

interface CandidatoDuplicata {
  id: string;
  nome: string;
  telefone: string | null;
  comunidadeNome: string;
  similaridade: number;
}

const STATUS_OPCOES = [
  { valor: 'apoiador', rotulo: 'Apoiador' },
  { valor: 'simpatizante', rotulo: 'Simpatizante' },
  { valor: 'neutro', rotulo: 'Neutro' },
  { valor: 'percepcao_negativa', rotulo: 'Percepção negativa' },
  { valor: 'desconhecido', rotulo: 'Desconhecido' },
];
const ORIGEM_OPCOES = [
  { valor: 'autodeclarado', rotulo: 'Autodeclarado' },
  { valor: 'percepcao_lideranca', rotulo: 'Percepção da liderança' },
  { valor: 'percepcao_equipe', rotulo: 'Percepção da equipe' },
];
const CONFIANCA_OPCOES = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

export function CadastroContato() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const nomeSugerido = (location.state as { nomeSugerido?: string } | null)?.nomeSugerido ?? '';

  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [step, setStep] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [duplicatas, setDuplicatas] = useState<CandidatoDuplicata[] | null>(null);

  const [nome, setNome] = useState(nomeSugerido);
  const [telefone, setTelefone] = useState('');
  const [comunidadeId, setComunidadeId] = useState('');
  const [endereco, setEndereco] = useState('');

  const [status, setStatus] = useState('');
  const [origem, setOrigem] = useState('');
  const [confianca, setConfianca] = useState('');

  const podeRegistrarEngajamento = usuario?.permissaoEngajamentoPolitico ?? false;
  const steps = podeRegistrarEngajamento ? ['Dados', 'Leitura', 'Confirmar'] : ['Dados', 'Confirmar'];

  useEffect(() => {
    api
      .get<Comunidade[]>('/comunidades')
      .then((data) => {
        setComunidades(data);
        if (data.length > 0) setComunidadeId(data[0].id);
      })
      .catch(() => setErro('Falha ao carregar lista de comunidades.'));
  }, []);

  const stepDadosValido = nome.trim().length > 0 && comunidadeId.length > 0;

  async function salvar(ignorarDuplicatasIds?: string[]) {
    setErro(null);
    setSalvando(true);
    try {
      const engajamentoPolitico =
        podeRegistrarEngajamento && status && origem && confianca
          ? { status, origem, confianca }
          : undefined;

      const contato = await api.post<{ id: string }>('/contatos', {
        nome,
        telefone: telefone || undefined,
        whatsapp: telefone || undefined,
        comunidadeId,
        endereco: endereco || undefined,
        origemCadastro: 'web',
        engajamentoPolitico,
        ignorarDuplicatasIds,
      });
      navigate(`/contatos/${contato.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const payload = e.payload as { candidatos?: CandidatoDuplicata[] } | undefined;
        if (payload?.candidatos?.length) {
          setDuplicatas(payload.candidatos);
          setErro(null);
          return;
        }
      }
      setErro(e instanceof ApiError ? e.message : 'Falha ao salvar contato.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarPessoaDiferente() {
    if (!duplicatas) return;
    const ids = duplicatas.map((d) => d.id);
    setDuplicatas(null);
    salvar(ids);
  }

  const ultimoStep = steps.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ display: 'flex', padding: '14px 16px 10px', gap: 4 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: i <= step ? 'var(--teal)' : 'var(--line)',
                marginBottom: 4,
              }}
            />
            <span style={{ fontSize: 9.5, color: i <= step ? 'var(--teal)' : 'var(--muted)', fontWeight: i === step ? 700 : 500 }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 16px 16px', flex: 1 }}>
        {step === 0 && (
          <div>
            <h3 style={{ fontSize: 16, color: 'var(--ink)', margin: '8px 0 14px' }}>Dados básicos</h3>
            <div className="field">
              <label>Nome completo *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do contato" />
            </div>
            <div className="field">
              <label>Telefone / WhatsApp</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="field">
              <label>Comunidade *</label>
              <select value={comunidadeId} onChange={(e) => setComunidadeId(e.target.value)}>
                {comunidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.bairro.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Endereço</label>
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número" />
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: -4 }}>
              * obrigatório — sem comunidade não é possível territorializar o contato.
            </p>
          </div>
        )}

        {podeRegistrarEngajamento && step === 1 && (
          <div>
            <h3 style={{ fontSize: 16, color: 'var(--ink)', margin: '8px 0 4px' }}>Leitura de engajamento</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>
              Registro interno da equipe — trate como percepção, não como fato confirmado. Opcional.
            </p>

            <p style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 6px' }}>Status</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {STATUS_OPCOES.map((s) => (
                <button
                  key={s.valor}
                  className={`chip ${status === s.valor ? 'active' : ''}`}
                  onClick={() => setStatus(s.valor)}
                  type="button"
                >
                  {s.rotulo}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 6px' }}>Origem</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {ORIGEM_OPCOES.map((s) => (
                <button
                  key={s.valor}
                  className={`chip ${origem === s.valor ? 'active' : ''}`}
                  onClick={() => setOrigem(s.valor)}
                  type="button"
                >
                  {s.rotulo}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 6px' }}>Confiança</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONFIANCA_OPCOES.map((s) => (
                <button
                  key={s.valor}
                  className={`chip ${confianca === s.valor ? 'active' : ''}`}
                  onClick={() => setConfianca(s.valor)}
                  type="button"
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === ultimoStep && (
          <div>
            <h3 style={{ fontSize: 16, color: 'var(--ink)', margin: '8px 0 14px' }}>Confirmar cadastro</h3>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Linha label="Nome" valor={nome} />
              <Linha label="Telefone" valor={telefone || '—'} />
              <Linha
                label="Comunidade"
                valor={comunidades.find((c) => c.id === comunidadeId)?.nome ?? '—'}
              />
              {podeRegistrarEngajamento && status && (
                <Linha label="Engajamento" valor={`${status} · ${origem || '—'} · ${confianca || '—'}`} />
              )}
            </div>
          </div>
        )}

        {duplicatas && (
          <div className="alert alert-amber" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
            <strong>Registro(s) parecido(s) encontrado(s)</strong>
            {duplicatas.map((d) => (
              <div key={d.id} style={{ fontSize: 11.5 }}>
                {d.nome} · {d.telefone ?? 'sem telefone'} · {d.comunidadeNome} (
                {Math.round(d.similaridade * 100)}% parecido)
              </div>
            ))}
            <button className="btn btn-outline" style={{ marginTop: 4 }} onClick={confirmarPessoaDiferente}>
              É pessoa diferente — cadastrar mesmo assim
            </button>
          </div>
        )}

        {erro && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {erro}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 18px', borderTop: '1px solid var(--line)', background: '#fff' }}>
        {step > 0 && (
          <button className="btn btn-outline" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setStep((s) => s - 1)}>
            ←
          </button>
        )}
        {step < ultimoStep && (
          <button
            className="btn btn-primary"
            disabled={step === 0 && !stepDadosValido}
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar →
          </button>
        )}
        {step === ultimoStep && (
          <button className="btn btn-success" onClick={() => salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar contato'}
          </button>
        )}
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <strong>{valor}</strong>
    </div>
  );
}
