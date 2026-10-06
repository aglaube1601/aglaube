import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { JornalComposer, criarSecaoVazia, type SecaoJornal } from './comunicacao/JornalComposer';

interface Comunidade {
  id: string;
  nome: string;
}

const TEMPLATES = [
  { valor: 'aniversario', rotulo: 'Aniversário' },
  { valor: 'noticia', rotulo: 'Notícia' },
  { valor: 'lembrete_evento', rotulo: 'Lembrete de evento' },
  { valor: 'convite_evento', rotulo: 'Convite para evento' },
  { valor: 'resposta_demanda', rotulo: 'Resposta a demanda' },
  { valor: 'jornal_medico', rotulo: 'Jornal' },
];

const PUBLICOS = [
  { valor: 'aniversariantes_semana', rotulo: 'Aniversariantes da semana' },
  { valor: 'por_comunidade', rotulo: 'Por comunidade' },
  { valor: 'todos_com_consentimento', rotulo: 'Todos com consentimento ativo' },
  { valor: 'liderancas_e_apoiadores', rotulo: 'Lideranças e apoiadores' },
];

interface ResultadoCampanha {
  campanhaId: string;
  destinatariosElegiveis: number;
  enviosEnfileirados: number;
  enviosIgnoradosPorDuplicidade: number;
  sinalizadoParaRevisao: boolean;
}

export function Comunicacao() {
  const { municipio } = useAuth();
  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [template, setTemplate] = useState('aniversario');
  const [publico, setPublico] = useState('aniversariantes_semana');
  const [comunidadeId, setComunidadeId] = useState('');
  const [mensagem, setMensagem] = useState(
    'Oi {{primeiro_nome}}! Passando pra desejar um feliz aniversário 🎉 Um abraço da nossa equipe.',
  );
  const [revisado, setRevisado] = useState(false);

  const [avisoRevisao, setAvisoRevisao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCampanha | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Rascunho do Jornal Médico fica fora do JornalComposer (que é só a view)
  // pra sobreviver a fechar/reabrir a tela de montagem sem perder o que já
  // foi digitado.
  const [jornalAberto, setJornalAberto] = useState(false);
  const [jornalTitulo, setJornalTitulo] = useState('');
  const [jornalSubtitulo, setJornalSubtitulo] = useState('');
  const [jornalSecoes, setJornalSecoes] = useState<SecaoJornal[]>([criarSecaoVazia()]);

  useEffect(() => {
    api
      .get<Comunidade[]>('/comunidades')
      .then((data) => {
        setComunidades(data);
        if (data.length > 0) setComunidadeId(data[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function enviarParaFila() {
    if (!municipio) return;
    setErro(null);
    setAvisoRevisao(false);
    setEnviando(true);
    try {
      const resposta = await api.post<ResultadoCampanha>(`/municipios/${municipio.id}/campanhas`, {
        tipoTemplate: template,
        corpoMensagem: mensagem,
        criterioPublico: publico,
        comunidadeId: publico === 'por_comunidade' ? comunidadeId : undefined,
        revisadoPelaCoordenacao: revisado || undefined,
      });
      setResultado(resposta);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const payload = e.payload as { sinalizadoParaRevisao?: boolean } | undefined;
        if (payload?.sinalizadoParaRevisao) {
          setAvisoRevisao(true);
          setErro(null);
        } else {
          setErro(e.message);
        }
      } else {
        setErro('Falha ao criar campanha.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (jornalAberto) {
    return (
      <JornalComposer
        municipioNome={municipio?.nome ?? ''}
        titulo={jornalTitulo}
        subtitulo={jornalSubtitulo}
        secoes={jornalSecoes}
        onTituloChange={setJornalTitulo}
        onSubtituloChange={setJornalSubtitulo}
        onSecoesChange={setJornalSecoes}
        onConcluir={(corpo) => {
          setMensagem(corpo);
          setJornalAberto(false);
        }}
        onCancelar={() => setJornalAberto(false)}
      />
    );
  }

  if (resultado) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 40 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--veryhigh)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: '#fff',
            fontSize: 26,
          }}
        >
          ✓
        </div>
        <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>Campanha enviada para fila</h3>
        <div className="card" style={{ textAlign: 'left', marginTop: 16 }}>
          <Row label="Destinatários elegíveis" value={String(resultado.destinatariosElegiveis)} />
          <Row label="Enfileirados" value={String(resultado.enviosEnfileirados)} />
          <Row label="Ignorados (duplicidade)" value={String(resultado.enviosIgnoradosPorDuplicidade)} last />
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
          Envio ainda é simulado neste MVP — nenhuma mensagem real sai do WhatsApp ainda.
        </p>
        <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => setResultado(null)}>
          Nova campanha
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '4px 0 14px' }}>Nova mensagem</h3>

      <p style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 6px' }}>Modelo</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {TEMPLATES.map((t) => (
          <button
            key={t.valor}
            className={`chip ${template === t.valor ? 'active' : ''}`}
            onClick={() => {
              if (t.valor === 'jornal_medico') {
                // Primeira vez trocando pra este modelo: limpa o texto genérico
                // (ex: placeholder de aniversário) pra nunca enviar aquele
                // conteúdo rotulado como Jornal se o usuário cancelar a
                // montagem sem concluir. Reabrir pra editar (botão "Editar
                // jornal") não passa por aqui, então não perde o que já foi montado.
                if (template !== 'jornal_medico') setMensagem('');
                setJornalAberto(true);
              }
              setTemplate(t.valor);
            }}
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 6px' }}>Público-alvo</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {PUBLICOS.map((p) => (
          <button
            key={p.valor}
            onClick={() => setPublico(p.valor)}
            className="card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              border: publico === p.valor ? '2px solid var(--teal)' : '1px solid var(--line)',
              background: publico === p.valor ? 'var(--teal-light)' : '#fff',
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.rotulo}</span>
          </button>
        ))}
      </div>

      {publico === 'por_comunidade' && (
        <div className="field">
          <label>Comunidade</label>
          <select value={comunidadeId} onChange={(e) => setComunidadeId(e.target.value)}>
            {comunidades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px' }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, margin: 0 }}>Mensagem</p>
        {template === 'jornal_medico' && (
          <button
            onClick={() => setJornalAberto(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}
          >
            ✏️ Editar jornal
          </button>
        )}
      </div>
      <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} style={{ width: '100%' }} />

      {avisoRevisao && (
        <div className="alert alert-amber" style={{ marginTop: 14 }}>
          <div>
            ⚠️ Este modelo pode se aproximar de propaganda antecipada. Confirme a revisão da coordenação
            antes de enviar.
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontWeight: 700 }}>
              <input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
              Revisado pela coordenação
            </label>
          </div>
        </div>
      )}

      {erro && (
        <div className="alert alert-error" style={{ marginTop: 14 }}>
          {erro}
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={enviarParaFila} disabled={enviando || !mensagem.trim()}>
        {enviando ? 'Enviando…' : 'Enviar para fila'}
      </button>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: last ? 'none' : '1px solid var(--line)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
