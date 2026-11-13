import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ResultadoCenario {
  cenario: 'sucessao_unificada' | 'fragmentacao_50_50';
  votosMin: number;
  votosMax: number;
  pisoVitoria: number;
  retencaoMinimaParaVencer: number;
  vitoriaGarantidaNoIntervalo: boolean;
  observacao: string;
}

interface ResultadoProjecao {
  municipioId: string;
  eleicaoAnoBase: number;
  validosBase: number;
  votosBaseSituacionista: number;
  votosBaseOposicao: number;
  fatorCrescimentoAplicado: number;
  premissas: {
    taxaCrescimentoAnual: number;
    anosProjecao: number;
    retencaoMin: number;
    retencaoMax: number;
  };
  cenarios: ResultadoCenario[];
  avisoMetodologico: string;
}

const NOME_CENARIO: Record<string, string> = {
  sucessao_unificada: 'Sucessão unificada',
  fragmentacao_50_50: 'Fragmentação (split 50/50)',
};

export function PainelEleitoral() {
  const { municipio } = useAuth();
  const [eleicaoAnoBase, setEleicaoAnoBase] = useState('2024');
  const [candidatoSituacionista, setCandidatoSituacionista] = useState('12');
  const [candidatoOposicao, setCandidatoOposicao] = useState('15');
  const [retencaoMin, setRetencaoMin] = useState('0.7');
  const [retencaoMax, setRetencaoMax] = useState('0.95');
  const [taxaCrescimentoAnual, setTaxaCrescimentoAnual] = useState('0.0042');
  const [anosProjecao, setAnosProjecao] = useState('4');

  const [resultado, setResultado] = useState<ResultadoProjecao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  async function calcular(e: FormEvent) {
    e.preventDefault();
    if (!municipio) return;
    setErro(null);
    setCalculando(true);
    try {
      const resposta = await api.get<ResultadoProjecao>(
        `/municipios/${municipio.id}/projecao-eleitoral`,
        {
          eleicaoAnoBase,
          candidatoSituacionistaNumero: candidatoSituacionista,
          candidatoOposicaoNumero: candidatoOposicao,
          retencaoMin,
          retencaoMax,
          taxaCrescimentoAnual,
          anosProjecao,
        },
      );
      setResultado(resposta);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.status === 403
            ? 'Seu perfil não tem acesso ao painel eleitoral.'
            : e.message
          : 'Falha ao calcular projeção.',
      );
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '4px 0 4px' }}>Painel eleitoral</h3>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 14px' }}>
        Meta de votos com margem de erro — nunca um número único. Baseado em dado público
        agregado (TSE/IBGE), nunca em engajamento individual.
      </p>

      <form onSubmit={calcular} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Ano da eleição-base</label>
            <input value={eleicaoAnoBase} onChange={(e) => setEleicaoAnoBase(e.target.value)} inputMode="numeric" />
          </div>
          <div />
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Nº candidato situacionista</label>
            <input value={candidatoSituacionista} onChange={(e) => setCandidatoSituacionista(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Nº candidato oposição</label>
            <input value={candidatoOposicao} onChange={(e) => setCandidatoOposicao(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Retenção mín. (0–1)</label>
            <input value={retencaoMin} onChange={(e) => setRetencaoMin(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Retenção máx. (0–1)</label>
            <input value={retencaoMax} onChange={(e) => setRetencaoMax(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Crescimento anual eleitorado</label>
            <input value={taxaCrescimentoAnual} onChange={(e) => setTaxaCrescimentoAnual(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Anos de projeção</label>
            <input value={anosProjecao} onChange={(e) => setAnosProjecao(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        {erro && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {erro}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={calculando}>
          {calculando ? 'Calculando…' : 'Calcular projeção'}
        </button>
      </form>

      {resultado && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Base histórica {resultado.eleicaoAnoBase}
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{resultado.votosBaseSituacionista}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>situacionista</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{resultado.votosBaseOposicao}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>oposição</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{resultado.validosBase}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>válidos</p>
              </div>
            </div>
          </div>

          {resultado.cenarios.map((c) => (
            <div key={c.cenario} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{NOME_CENARIO[c.cenario]}</p>
                <span
                  className="badge"
                  style={{
                    background: c.vitoriaGarantidaNoIntervalo ? 'rgba(45,110,79,0.12)' : 'rgba(184,84,80,0.12)',
                    color: c.vitoriaGarantidaNoIntervalo ? 'var(--veryhigh)' : 'var(--danger)',
                  }}
                >
                  {c.vitoriaGarantidaNoIntervalo ? 'favorável no intervalo' : 'risco no intervalo'}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 800 }}>
                {c.votosMin.toLocaleString('pt-BR')} – {c.votosMax.toLocaleString('pt-BR')}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}> votos projetados</span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                Piso de vitória: {c.pisoVitoria.toLocaleString('pt-BR')} · retenção mínima necessária:{' '}
                {(c.retencaoMinimaParaVencer * 100).toFixed(1)}%
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 11.5 }}>{c.observacao}</p>
            </div>
          ))}

          <div className="alert alert-amber">{resultado.avisoMetodologico}</div>
        </>
      )}
    </div>
  );
}
