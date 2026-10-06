import { forwardRef, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

export interface SecaoJornal {
  id: string;
  titulo: string;
  corpo: string;
}

export interface DestaqueJornal {
  id: string;
  icone: string;
  titulo: string;
  corpo: string;
}

export interface BarraIndicador {
  id: string;
  rotulo: string;
  valor: number; // 0-100
}

export interface GrupoIndicador {
  id: string;
  titulo: string;
  descricao: string;
  barras: BarraIndicador[];
}

const RODAPE_PADRAO =
  'Conteúdo informativo elaborado pela equipe de saúde — não substitui consulta médica. ' +
  'Em caso de sintomas, procure a unidade de saúde mais próxima.';

const CORES_BARRA = ['var(--teal)', 'var(--amber)', 'var(--navy)', 'var(--muted)'];

function criarId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function criarSecaoVazia(): SecaoJornal {
  return { id: criarId(), titulo: '', corpo: '' };
}

export function criarDestaqueVazio(): DestaqueJornal {
  return { id: criarId(), icone: '📌', titulo: '', corpo: '' };
}

export function criarBarraVazia(): BarraIndicador {
  return { id: criarId(), rotulo: '', valor: 50 };
}

export function criarGrupoIndicadorVazio(): GrupoIndicador {
  return { id: criarId(), titulo: '', descricao: '', barras: [criarBarraVazia(), criarBarraVazia()] };
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

function formatarEdicao(): string {
  const { inicio, fim } = obterIntervaloSemanaAtual();
  return `Edição semanal informativa • ${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`;
}

// Versão em texto simples (pra campanha de WhatsApp, que só transporta
// texto neste MVP — ver comunicacao.service.ts). A imagem gerada pelo
// JornalVisual é o formato "de verdade"; isto é o retrocesso que ainda
// carrega os dados principais quando só a mensagem de texto é enviada.
export function montarCorpoJornal(params: {
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
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

  for (const destaque of params.destaques) {
    if (!destaque.titulo.trim() && !destaque.corpo.trim()) continue;
    partes.push(`${destaque.icone} *${destaque.titulo.trim()}*`);
    if (destaque.corpo.trim()) partes.push(destaque.corpo.trim());
    partes.push('');
  }

  for (const grupo of params.indicadores) {
    const barrasValidas = grupo.barras.filter((b) => b.rotulo.trim());
    if (!grupo.titulo.trim() && barrasValidas.length === 0) continue;
    if (grupo.titulo.trim()) partes.push(`*${grupo.titulo.trim()}*`);
    for (const barra of barrasValidas) {
      partes.push(`• ${barra.rotulo.trim()}: ${barra.valor}%`);
    }
    partes.push('');
  }

  partes.push('—');
  partes.push(RODAPE_PADRAO);

  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface JornalVisualProps {
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
}

// Cartaz visual do Jornal — layout inspirado no "Research Summary" do NEJM
// (banner com nome da publicação, título, colunas com cabeçalhos em
// vermelho e cartões de destaque/indicadores à direita). É o próprio
// componente capturado como PNG pelo botão "Baixar imagem".
export const JornalVisual = forwardRef<HTMLDivElement, JornalVisualProps>(function JornalVisual(
  { municipioNome, titulo, subtitulo, secoes, destaques, indicadores },
  ref,
) {
  const secoesPreenchidas = secoes.filter((s) => s.corpo.trim());
  const destaquesPreenchidos = destaques.filter((d) => d.titulo.trim() || d.corpo.trim());
  const indicadoresPreenchidos = indicadores.filter((g) => g.barras.some((b) => b.rotulo.trim()));

  return (
    <div ref={ref} className="jornal-visual">
      <div className="jornal-masthead">
        <p className="eyebrow">🩺 Boletim de Saúde{municipioNome.trim() ? ` — ${municipioNome}` : ''}</p>
        <h2>{titulo.trim() || 'Título do boletim'}</h2>
        <p className="byline">
          {subtitulo.trim() ? `${subtitulo.trim()} | ` : ''}
          {formatarEdicao()}
        </p>
      </div>

      <div className="jornal-corpo">
        <div>
          {secoesPreenchidas.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>O conteúdo das caixas de texto aparece aqui.</p>
          )}
          {secoesPreenchidas.map((secao) => (
            <div key={secao.id} className="jornal-secao">
              {secao.titulo.trim() && <p className="jornal-secao-titulo">{secao.titulo}</p>}
              <p>{secao.corpo}</p>
            </div>
          ))}
        </div>

        <div>
          {destaquesPreenchidos.length > 0 && (
            <div className="jornal-destaques-grid">
              {destaquesPreenchidos.map((destaque) => (
                <div key={destaque.id} className="jornal-destaque-card">
                  <span className="icone">{destaque.icone || '📌'}</span>
                  <p className="titulo">{destaque.titulo}</p>
                  {destaque.corpo
                    .split('\n')
                    .filter((linha) => linha.trim())
                    .map((linha, i) => (
                      <p key={i} className="linha">
                        {linha}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}

          {indicadoresPreenchidos.map((grupo) => {
            const barrasValidas = grupo.barras.filter((b) => b.rotulo.trim());
            const maior = Math.max(...barrasValidas.map((b) => b.valor), 1);
            return (
              <div key={grupo.id} className="jornal-indicador">
                {grupo.titulo.trim() && <p className="titulo">{grupo.titulo}</p>}
                {grupo.descricao.trim() && <p className="descricao">{grupo.descricao}</p>}
                <div className="jornal-barra-grupo">
                  {barrasValidas.map((barra, i) => (
                    <div key={barra.id} className="jornal-barra">
                      <span className="valor">{barra.valor}%</span>
                      <div
                        className="haste"
                        style={{ height: `${Math.max((barra.valor / maior) * 100, 4)}%`, background: CORES_BARRA[i % CORES_BARRA.length] }}
                      />
                      <span className="rotulo">{barra.rotulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="jornal-rodape">{RODAPE_PADRAO}</div>
    </div>
  );
});

interface JornalComposerProps {
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
  onTituloChange: (valor: string) => void;
  onSubtituloChange: (valor: string) => void;
  onSecoesChange: (secoes: SecaoJornal[]) => void;
  onDestaquesChange: (destaques: DestaqueJornal[]) => void;
  onIndicadoresChange: (indicadores: GrupoIndicador[]) => void;
  onConcluir: (corpoMensagem: string) => void;
  onCancelar: () => void;
}

export function JornalComposer({
  municipioNome,
  titulo,
  subtitulo,
  secoes,
  destaques,
  indicadores,
  onTituloChange,
  onSubtituloChange,
  onSecoesChange,
  onDestaquesChange,
  onIndicadoresChange,
  onConcluir,
  onCancelar,
}: JornalComposerProps) {
  const [baixando, setBaixando] = useState(false);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  const corpoTexto = useMemo(
    () => montarCorpoJornal({ municipioNome, titulo, subtitulo, secoes, destaques, indicadores }),
    [municipioNome, titulo, subtitulo, secoes, destaques, indicadores],
  );

  function atualizarSecao(id: string, campo: 'titulo' | 'corpo', valor: string) {
    onSecoesChange(secoes.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function removerSecao(id: string) {
    if (secoes.length <= 1) return;
    onSecoesChange(secoes.filter((s) => s.id !== id));
  }

  function atualizarDestaque(id: string, campo: 'icone' | 'titulo' | 'corpo', valor: string) {
    onDestaquesChange(destaques.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function removerDestaque(id: string) {
    onDestaquesChange(destaques.filter((d) => d.id !== id));
  }

  function atualizarGrupoIndicador(id: string, campo: 'titulo' | 'descricao', valor: string) {
    onIndicadoresChange(indicadores.map((g) => (g.id === id ? { ...g, [campo]: valor } : g)));
  }

  function atualizarBarra(grupoId: string, barraId: string, campo: 'rotulo' | 'valor', valor: string) {
    onIndicadoresChange(
      indicadores.map((g) =>
        g.id === grupoId
          ? {
              ...g,
              barras: g.barras.map((b) =>
                b.id === barraId ? { ...b, [campo]: campo === 'valor' ? Math.min(100, Math.max(0, Number(valor) || 0)) : valor } : b,
              ),
            }
          : g,
      ),
    );
  }

  function removerGrupoIndicador(id: string) {
    onIndicadoresChange(indicadores.filter((g) => g.id !== id));
  }

  async function baixarImagem() {
    if (!visualRef.current) return;
    setErroImagem(null);
    setBaixando(true);
    try {
      const dataUrl = await toPng(visualRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `jornal-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setErroImagem('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setBaixando(false);
    }
  }

  const podeConcluir = titulo.trim().length > 0 && secoes.some((s) => s.corpo.trim().length > 0);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '4px 0 14px' }}>Montar Jornal Médico</h3>

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
              <button onClick={() => removerSecao(secao.id)} className="link-remover">
                Remover
              </button>
            )}
          </div>
          <input
            value={secao.titulo}
            onChange={(e) => atualizarSecao(secao.id, 'titulo', e.target.value)}
            placeholder="Subtítulo da seção (ex: SINAIS DE ALERTA)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
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
      <button className="btn btn-outline" onClick={() => onSecoesChange([...secoes, criarSecaoVazia()])} style={{ marginBottom: 18 }}>
        + Adicionar caixa de texto
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Destaques (cartões à direita no cartaz — opcional)
      </p>
      {destaques.map((destaque, indice) => (
        <div key={destaque.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Destaque {indice + 1}</span>
            <button onClick={() => removerDestaque(destaque.id)} className="link-remover">
              Remover
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={destaque.icone}
              onChange={(e) => atualizarDestaque(destaque.id, 'icone', e.target.value)}
              placeholder="🩺"
              maxLength={2}
              style={{ width: 48, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 16, textAlign: 'center' }}
            />
            <input
              value={destaque.titulo}
              onChange={(e) => atualizarDestaque(destaque.id, 'titulo', e.target.value)}
              placeholder="Ex: Onde se vacinar"
              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
            />
          </div>
          <textarea
            value={destaque.corpo}
            onChange={(e) => atualizarDestaque(destaque.id, 'corpo', e.target.value)}
            placeholder={'Uma linha por item, ex:\nUBS Centro — seg a sex, 8h-16h\nUBS Vila Nova — ter e qui, 8h-12h'}
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
      ))}
      <button className="btn btn-outline" onClick={() => onDestaquesChange([...destaques, criarDestaqueVazio()])} style={{ marginBottom: 18 }}>
        + Adicionar destaque
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Indicadores em gráfico de barras (opcional)
      </p>
      {indicadores.map((grupo, indiceGrupo) => (
        <div key={grupo.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Gráfico {indiceGrupo + 1}</span>
            <button onClick={() => removerGrupoIndicador(grupo.id)} className="link-remover">
              Remover
            </button>
          </div>
          <input
            value={grupo.titulo}
            onChange={(e) => atualizarGrupoIndicador(grupo.id, 'titulo', e.target.value)}
            placeholder="Título do gráfico (ex: Cobertura vacinal)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          {grupo.barras.map((barra) => (
            <div key={barra.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={barra.rotulo}
                onChange={(e) => atualizarBarra(grupo.id, barra.id, 'rotulo', e.target.value)}
                placeholder="Rótulo (ex: Crianças)"
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={barra.valor}
                onChange={(e) => atualizarBarra(grupo.id, barra.id, 'valor', e.target.value)}
                style={{ width: 70, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
              />
              <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>%</span>
            </div>
          ))}
          <button
            className="btn btn-outline"
            style={{ marginTop: 4 }}
            onClick={() =>
              onIndicadoresChange(
                indicadores.map((g) => (g.id === grupo.id ? { ...g, barras: [...g.barras, criarBarraVazia()] } : g)),
              )
            }
          >
            + Adicionar barra
          </button>
        </div>
      ))}
      <button
        className="btn btn-outline"
        onClick={() => onIndicadoresChange([...indicadores, criarGrupoIndicadorVazio()])}
        style={{ marginBottom: 18 }}
      >
        + Adicionar gráfico
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Pré-visualização do cartaz
      </p>
      <div style={{ marginBottom: 12 }}>
        <JornalVisual
          ref={visualRef}
          municipioNome={municipioNome}
          titulo={titulo}
          subtitulo={subtitulo}
          secoes={secoes}
          destaques={destaques}
          indicadores={indicadores}
        />
      </div>

      <button className="btn btn-outline" onClick={baixarImagem} disabled={baixando} style={{ marginBottom: 6 }}>
        {baixando ? 'Gerando imagem…' : '⬇️ Baixar imagem do Jornal (PNG)'}
      </button>
      {erroImagem && (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          {erroImagem}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 0, marginBottom: 18 }}>
        A imagem é o formato final do Jornal — baixe e anexe no envio pelo WhatsApp. O texto abaixo é só um resumo de
        apoio, porque o envio automático desta campanha ainda manda apenas texto (MVP).
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" onClick={onCancelar} style={{ flex: 1 }}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={() => onConcluir(corpoTexto)} disabled={!podeConcluir} style={{ flex: 2 }}>
          Usar este conteúdo
        </button>
      </div>
    </div>
  );
}
