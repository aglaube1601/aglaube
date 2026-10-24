import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface ContatoResumo {
  id: string;
  nome: string;
  telefone: string | null;
  comunidade: { id: string; nome: string };
}

interface ListagemContatos {
  itens: ContatoResumo[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

const TAMANHO_PAGINA = 20;

export function BuscarContato() {
  const navigate = useNavigate();
  const { municipio } = useAuth();
  const [q, setQ] = useState('');
  const [itens, setItens] = useState<ContatoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!municipio) return;
    // debounce simples — evita 1 request por tecla digitada
    const timer = setTimeout(() => carregar(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, municipio]);

  async function carregar(paginaAlvo: number) {
    if (!municipio) return;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get<ListagemContatos>('/contatos', {
        municipioId: municipio.id,
        q: q || undefined,
        pagina: String(paginaAlvo),
        tamanhoPagina: String(TAMANHO_PAGINA),
      });
      setItens(paginaAlvo === 1 ? resposta.itens : [...itens, ...resposta.itens]);
      setTotal(resposta.total);
      setPagina(paginaAlvo);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar contatos.');
    } finally {
      setCarregando(false);
    }
  }

  const temMais = itens.length < total;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, color: 'var(--ink)', margin: '8px 0 4px' }}>Contatos</h3>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>
        {total} contato(s) cadastrado(s) em {municipio?.nome}.
      </p>

      <input
        placeholder="Filtrar por nome…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%',
          border: '1px solid var(--line)',
          borderRadius: 9,
          padding: '10px 12px',
          fontSize: 13.5,
        }}
      />

      {erro && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {erro}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/contatos/${c.id}`)}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer' }}
          >
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{c.nome}</p>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
              {c.comunidade.nome} {c.telefone ? `· ${c.telefone}` : ''}
            </p>
          </button>
        ))}
      </div>

      {!carregando && itens.length === 0 && (
        <div className="alert alert-amber" style={{ marginTop: 14 }}>
          {q ? 'Nenhum contato encontrado com esse nome.' : 'Nenhum contato cadastrado ainda.'}
        </div>
      )}

      {temMais && (
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => carregar(pagina + 1)} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}

      <button
        onClick={() => navigate('/contatos/novo', { state: { nomeSugerido: q } })}
        className="btn btn-primary"
        style={{ marginTop: 18 }}
      >
        + Cadastrar novo contato
      </button>
    </div>
  );
}
