import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

interface CandidatoDuplicata {
  id: string;
  nome: string;
  telefone: string | null;
  comunidadeNome: string;
  criadoEm: string;
  similaridade: number;
}

export function BuscarContato() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [resultados, setResultados] = useState<CandidatoDuplicata[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 3) {
      setErro('Digite pelo menos 3 letras do nome.');
      return;
    }
    setErro(null);
    setBuscando(true);
    try {
      const dados = await api.get<CandidatoDuplicata[]>('/contatos/buscar-duplicatas', { nome });
      setResultados(dados);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao buscar contatos.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, color: 'var(--ink)', margin: '8px 0 4px' }}>Buscar contato</h3>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>
        Buscar antes de cadastrar evita duplicidade na base.
      </p>

      <form onSubmit={buscar} style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Nome do contato"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{
            flex: 1,
            border: '1px solid var(--line)',
            borderRadius: 9,
            padding: '10px 12px',
            fontSize: 13.5,
          }}
        />
        <button className="btn btn-primary" style={{ width: 'auto', padding: '0 18px' }} disabled={buscando}>
          {buscando ? '…' : 'Buscar'}
        </button>
      </form>

      {erro && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {erro}
        </div>
      )}

      {resultados && resultados.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resultados.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/contatos/${c.id}`)}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{c.nome}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                {c.comunidadeNome} {c.telefone ? `· ${c.telefone}` : ''} ·{' '}
                {Math.round(c.similaridade * 100)}% de similaridade
              </p>
            </button>
          ))}
        </div>
      )}

      {resultados && resultados.length === 0 && (
        <div className="alert alert-amber" style={{ marginTop: 14 }}>
          Nenhum contato parecido encontrado.
        </div>
      )}

      <button
        onClick={() => navigate('/contatos/novo', { state: { nomeSugerido: nome } })}
        className="btn btn-outline"
        style={{ marginTop: 18 }}
      >
        + Cadastrar novo contato
      </button>
    </div>
  );
}
