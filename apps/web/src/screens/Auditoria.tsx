import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface LogAuditoria {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  timestamp: string;
  usuario: { id: string; nome: string; perfil: string };
}

interface ListagemAuditoria {
  registros: LogAuditoria[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
}

const ACOES = ['', 'leitura', 'criacao', 'edicao', 'exclusao', 'exportacao'];

const COR_ACAO: Record<string, string> = {
  leitura: 'var(--muted)',
  criacao: 'var(--veryhigh)',
  edicao: 'var(--amber)',
  exclusao: 'var(--danger)',
  exportacao: 'var(--teal)',
};

export function Auditoria() {
  const [registros, setRegistros] = useState<LogAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [acao, setAcao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acao]);

  async function carregar(paginaAlvo: number) {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get<ListagemAuditoria>('/auditoria', {
        acao: acao || undefined,
        pagina: String(paginaAlvo),
        tamanhoPagina: '25',
      });
      setRegistros(paginaAlvo === 1 ? resposta.registros : [...registros, ...resposta.registros]);
      setTotal(resposta.total);
      setPagina(paginaAlvo);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.status === 403
            ? 'Log de auditoria é visível só para Administrador.'
            : e.message
          : 'Falha ao carregar auditoria.',
      );
    } finally {
      setCarregando(false);
    }
  }

  const temMais = registros.length < total;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '4px 0 4px' }}>Log de auditoria</h3>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 14px' }}>
        {total} registro(s) — quem acessou ou alterou dado sensível, e quando.
      </p>

      <div className="field">
        <label>Filtrar por ação</label>
        <select value={acao} onChange={(e) => setAcao(e.target.value)}>
          {ACOES.map((a) => (
            <option key={a} value={a}>
              {a || 'todas'}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {registros.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                {r.entidade} · {r.entidadeId.slice(0, 8)}…
              </span>
              <span className="badge" style={{ background: `${COR_ACAO[r.acao] ?? 'var(--muted)'}1A`, color: COR_ACAO[r.acao] ?? 'var(--muted)' }}>
                {r.acao}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              {r.usuario.nome} ({r.usuario.perfil}) · {new Date(r.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      {!carregando && registros.length === 0 && (
        <div className="alert alert-amber" style={{ marginTop: 14 }}>
          Nenhum registro de auditoria ainda.
        </div>
      )}

      {temMais && (
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => carregar(pagina + 1)} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
