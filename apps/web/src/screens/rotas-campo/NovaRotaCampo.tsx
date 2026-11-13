import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Comunidade {
  id: string;
  nome: string;
}

interface UsuarioResumo {
  id: string;
  nome: string;
  perfil: string;
}

interface ContatoResumo {
  id: string;
  nome: string;
  telefone: string | null;
}

export function NovaRotaCampo() {
  const navigate = useNavigate();
  const { municipio, usuario } = useAuth();
  const podeCriar = usuario?.perfil === 'administrador' || usuario?.perfil === 'coordenador';

  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  const [comunidadeId, setComunidadeId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');

  const [buscaContato, setBuscaContato] = useState('');
  const [disponiveis, setDisponiveis] = useState<ContatoResumo[]>([]);
  const [selecionados, setSelecionados] = useState<ContatoResumo[]>([]);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!municipio || !podeCriar) return;
    api.get<Comunidade[]>('/comunidades').then(setComunidades).catch(() => undefined);
    api
      .get<UsuarioResumo[]>('/usuarios', { municipioId: municipio.id })
      .then(setUsuarios)
      .catch(() => undefined);
  }, [municipio, podeCriar]);

  // Sempre que troca de comunidade, a seleção da rota anterior não faz
  // mais sentido (territorialização: uma rota é de UMA comunidade só).
  useEffect(() => {
    setSelecionados([]);
    setDisponiveis([]);
    setBuscaContato('');
  }, [comunidadeId]);

  useEffect(() => {
    if (!municipio || !comunidadeId) return;
    const timer = setTimeout(() => {
      api
        .get<{ itens: ContatoResumo[] }>('/contatos', {
          municipioId: municipio.id,
          comunidadeId,
          q: buscaContato || undefined,
          tamanhoPagina: '100',
        })
        .then((r) => setDisponiveis(r.itens))
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [municipio, comunidadeId, buscaContato]);

  if (!podeCriar) {
    return (
      <div style={{ padding: 16 }}>
        <div className="alert alert-error">Só Coordenador ou Administrador podem criar rotas de campo.</div>
      </div>
    );
  }

  const idsSelecionados = new Set(selecionados.map((c) => c.id));

  function adicionar(c: ContatoResumo) {
    if (idsSelecionados.has(c.id)) return;
    setSelecionados((atual) => [...atual, c]);
  }

  function remover(id: string) {
    setSelecionados((atual) => atual.filter((c) => c.id !== id));
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const rota = await api.post<{ id: string }>('/rotas-campo', {
        comunidadeId,
        responsavelId,
        contatoIds: selecionados.map((c) => c.id),
      });
      navigate(`/rotas-campo/${rota.id}`, { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao criar rota de campo.');
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = comunidadeId.length > 0 && responsavelId.length > 0 && selecionados.length > 0;

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: 8, background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        ← Voltar
      </button>
      <h3 style={{ fontSize: 16, margin: '0 0 14px' }}>Nova rota de campo</h3>

      <div className="field">
        <label>Comunidade *</label>
        <select value={comunidadeId} onChange={(e) => setComunidadeId(e.target.value)}>
          <option value="">Selecione…</option>
          {comunidades.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Responsável pela rota *</label>
        <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
          <option value="">Selecione…</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} ({u.perfil})
            </option>
          ))}
        </select>
      </div>

      {comunidadeId && (
        <>
          {selecionados.length > 0 && (
            <>
              <p style={{ fontSize: 11.5, fontWeight: 700, margin: '14px 0 6px' }}>
                Ordem da rota ({selecionados.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {selecionados.map((c, i) => (
                  <div
                    key={c.id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--navy)',
                        color: '#fff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{c.nome}</span>
                    <button className="link-remover" onClick={() => remover(c.id)}>
                      remover
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="field">
            <label>Adicionar contatos da comunidade</label>
            <input
              placeholder="Filtrar por nome…"
              value={buscaContato}
              onChange={(e) => setBuscaContato(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {disponiveis
              .filter((c) => !idsSelecionados.has(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => adicionar(c)}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{c.nome}</p>
                    {c.telefone && <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>{c.telefone}</p>}
                  </div>
                  <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 13 }}>+</span>
                </button>
              ))}
            {disponiveis.length === 0 && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Nenhum contato encontrado nessa comunidade.</p>
            )}
          </div>
        </>
      )}

      {erro && <div className="alert alert-error" style={{ marginBottom: 14 }}>{erro}</div>}

      <button className="btn btn-primary" onClick={salvar} disabled={!podeSalvar || salvando}>
        {salvando ? 'Criando…' : 'Criar rota'}
      </button>
    </div>
  );
}
