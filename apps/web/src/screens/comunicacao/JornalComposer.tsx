import { useMemo } from 'react';

export interface SecaoJornal {
  id: string;
  titulo: string;
  corpo: string;
}

const RODAPE_PADRAO =
  'Conteúdo informativo elaborado pela equipe de saúde — não substitui consulta médica. ' +
  'Em caso de sintomas, procure a unidade de saúde mais próxima.';

export function criarSecaoVazia(): SecaoJornal {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return { id, titulo: '', corpo: '' };
}

function formatarDataBr(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Semana corrida de domingo a sábado contendo a data atual — só serve pra
// identificar a edição do boletim no cabeçalho, não tem significado
// epidemiológico.
function obterIntervaloSemanaAtual(): { inicio: Date; fim: Date } {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay());
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  return { inicio, fim };
}

export function montarCabecalhoPadrao(municipioNome: string): string {
  const { inicio, fim } = obterIntervaloSemanaAtual();
  const nomeMunicipio = municipioNome.trim() ? ` — ${municipioNome.toUpperCase()}` : '';
  return `🩺 *BOLETIM DE SAÚDE${nomeMunicipio}*\nEdição semanal informativa • ${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`;
}

export function montarCorpoJornal(params: {
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
}): string {
  const partes: string[] = [montarCabecalhoPadrao(params.municipioNome), ''];

  if (params.titulo.trim()) partes.push(`*${params.titulo.trim()}*`);
  if (params.subtitulo.trim()) partes.push(`_${params.subtitulo.trim()}_`);
  if (params.titulo.trim() || params.subtitulo.trim()) partes.push('');

  for (const secao of params.secoes) {
    if (!secao.corpo.trim()) continue;
    if (secao.titulo.trim()) partes.push(`*${secao.titulo.trim()}*`);
    partes.push(secao.corpo.trim());
    partes.push('');
  }

  partes.push('—');
  partes.push(RODAPE_PADRAO);

  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface JornalComposerProps {
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  onTituloChange: (valor: string) => void;
  onSubtituloChange: (valor: string) => void;
  onSecoesChange: (secoes: SecaoJornal[]) => void;
  onConcluir: (corpoMensagem: string) => void;
  onCancelar: () => void;
}

export function JornalComposer({
  municipioNome,
  titulo,
  subtitulo,
  secoes,
  onTituloChange,
  onSubtituloChange,
  onSecoesChange,
  onConcluir,
  onCancelar,
}: JornalComposerProps) {
  const cabecalho = useMemo(() => montarCabecalhoPadrao(municipioNome), [municipioNome]);
  const preview = useMemo(
    () => montarCorpoJornal({ municipioNome, titulo, subtitulo, secoes }),
    [municipioNome, titulo, subtitulo, secoes],
  );

  function adicionarSecao() {
    onSecoesChange([...secoes, criarSecaoVazia()]);
  }

  function removerSecao(id: string) {
    if (secoes.length <= 1) return;
    onSecoesChange(secoes.filter((s) => s.id !== id));
  }

  function atualizarSecao(id: string, campo: 'titulo' | 'corpo', valor: string) {
    onSecoesChange(secoes.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  const podeConcluir = titulo.trim().length > 0 && secoes.some((s) => s.corpo.trim().length > 0);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '4px 0 14px' }}>Montar Jornal Médico</h3>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Cabeçalho padrão
      </p>
      <div className="card" style={{ marginBottom: 16, background: 'var(--teal-light)', border: 'none' }}>
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{cabecalho}</pre>
      </div>

      <div className="field">
        <label>Título</label>
        <input
          value={titulo}
          onChange={(e) => onTituloChange(e.target.value)}
          placeholder="Ex: Prevenção da dengue no verão"
        />
      </div>

      <div className="field">
        <label>Subtítulo</label>
        <input
          value={subtitulo}
          onChange={(e) => onSubtituloChange(e.target.value)}
          placeholder="Ex: Dicas da equipe de saúde para esta semana"
        />
      </div>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Conteúdo
      </p>
      {secoes.map((secao, indice) => (
        <div key={secao.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Seção {indice + 1}</span>
            {secoes.length > 1 && (
              <button
                onClick={() => removerSecao(secao.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                Remover
              </button>
            )}
          </div>
          <input
            value={secao.titulo}
            onChange={(e) => atualizarSecao(secao.id, 'titulo', e.target.value)}
            placeholder="Subtítulo da seção (opcional)"
            style={{
              width: '100%',
              border: '1px solid var(--line)',
              borderRadius: 9,
              padding: '8px 10px',
              fontSize: 12.5,
              marginBottom: 8,
            }}
          />
          <textarea
            value={secao.corpo}
            onChange={(e) => atualizarSecao(secao.id, 'corpo', e.target.value)}
            placeholder="Texto desta caixa..."
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
      ))}

      <button className="btn btn-outline" onClick={adicionarSecao} style={{ marginBottom: 18 }}>
        + Adicionar caixa de texto
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Pré-visualização
      </p>
      <div className="card" style={{ marginBottom: 18 }}>
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{preview}</pre>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" onClick={onCancelar} style={{ flex: 1 }}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onConcluir(preview)}
          disabled={!podeConcluir}
          style={{ flex: 2 }}
        >
          Usar este conteúdo
        </button>
      </div>
    </div>
  );
}
