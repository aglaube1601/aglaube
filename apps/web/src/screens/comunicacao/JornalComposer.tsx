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
  amostra: string; // ex: "403" — exibido como selo "N = 403", estilo cartão de braço de estudo
}

export interface BarraIndicador {
  id: string;
  rotulo: string;
  valor: number; // 0-100
  subvalor: string; // ex: "IC95%, 0,70–0,91" — linha menor abaixo do valor principal
}

export interface GrupoIndicador {
  id: string;
  titulo: string;
  descricao: string;
  barras: BarraIndicador[];
}

export interface PontoLinha {
  id: string;
  x: number;
  y: number; // 0-100
}

export interface SerieLinha {
  id: string;
  nome: string;
  pontos: PontoLinha[];
}

export interface GrupoLinha {
  id: string;
  titulo: string;
  descricao: string;
  eixoXRotulo: string;
  linhaReferencia: string; // valor opcional (ex: "50") pra uma linha horizontal tracejada
  series: SerieLinha[];
}

export interface ImagemJornal {
  id: string;
  dataUrl: string;
  legenda: string;
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
  return { id: criarId(), icone: '📌', titulo: '', corpo: '', amostra: '' };
}

export function criarBarraVazia(): BarraIndicador {
  return { id: criarId(), rotulo: '', valor: 50, subvalor: '' };
}

export function criarGrupoIndicadorVazio(): GrupoIndicador {
  return { id: criarId(), titulo: '', descricao: '', barras: [criarBarraVazia(), criarBarraVazia()] };
}

export function criarPontoVazio(x: number): PontoLinha {
  return { id: criarId(), x, y: 0 };
}

export function criarSerieVazia(): SerieLinha {
  return { id: criarId(), nome: '', pontos: [criarPontoVazio(0), criarPontoVazio(6), criarPontoVazio(12)] };
}

export function criarGrupoLinhaVazio(): GrupoLinha {
  return {
    id: criarId(),
    titulo: '',
    descricao: '',
    eixoXRotulo: 'Meses',
    linhaReferencia: '',
    series: [criarSerieVazia(), criarSerieVazia()],
  };
}

// Redimensiona pra no máximo LARGURA_MAX_IMAGEM de largura antes de guardar
// como data URL — uma foto direto da câmera do celular facilmente passa de
// 4000px, o que deixaria o estado da página e o PNG final pesados demais à
// toa (o cartaz nunca é exibido maior que ~700px).
const LARGURA_MAX_IMAGEM = 700;

function lerImagemComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const escala = Math.min(1, LARGURA_MAX_IMAGEM / img.width);
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(leitor.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });
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

// O nome do profissional é a "marca" recorrente do boletim (equivalente ao
// nome da revista no modelo de referência) — é o que deve ficar conhecido
// semana após semana, então vem em destaque tanto aqui quanto no masthead
// visual (ver JornalVisual). Nunca fica em branco pro envio de texto: cai
// no genérico "Boletim de Saúde" se o profissional não estiver identificado.
export function montarCabecalhoPadrao(profissionalNome: string, municipioNome: string): string {
  const { inicio, fim } = obterIntervaloSemanaAtual();
  const nome = profissionalNome.trim() || 'Boletim de Saúde';
  const local = municipioNome.trim() ? ` — ${municipioNome.toUpperCase()}` : '';
  return `🩺 *${nome.toUpperCase()}*${local}\nBoletim de Saúde Semanal • ${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`;
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
  profissionalNome: string;
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
  indicadoresLinha: GrupoLinha[];
  imagens: ImagemJornal[];
}): string {
  const partes: string[] = [montarCabecalhoPadrao(params.profissionalNome, params.municipioNome), ''];

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
    const amostraTxt = destaque.amostra.trim() ? ` (N = ${destaque.amostra.trim()})` : '';
    partes.push(`${destaque.icone} *${destaque.titulo.trim()}*${amostraTxt}`);
    if (destaque.corpo.trim()) partes.push(destaque.corpo.trim());
    partes.push('');
  }

  for (const grupo of params.indicadores) {
    const barrasValidas = grupo.barras.filter((b) => b.rotulo.trim());
    if (!grupo.titulo.trim() && barrasValidas.length === 0) continue;
    if (grupo.titulo.trim()) partes.push(`*${grupo.titulo.trim()}*`);
    if (grupo.descricao.trim()) partes.push(grupo.descricao.trim());
    for (const barra of barrasValidas) {
      const subTxt = barra.subvalor.trim() ? ` (${barra.subvalor.trim()})` : '';
      partes.push(`• ${barra.rotulo.trim()}: ${barra.valor}%${subTxt}`);
    }
    partes.push('');
  }

  for (const grupo of params.indicadoresLinha) {
    const seriesValidas = grupo.series.filter((s) => s.nome.trim() && s.pontos.length > 0);
    if (!grupo.titulo.trim() && seriesValidas.length === 0) continue;
    if (grupo.titulo.trim()) partes.push(`*${grupo.titulo.trim()}*`);
    if (grupo.descricao.trim()) partes.push(grupo.descricao.trim());
    for (const serie of seriesValidas) {
      const ultimo = [...serie.pontos].sort((a, b) => a.x - b.x).slice(-1)[0];
      partes.push(`• ${serie.nome.trim()}: ${ultimo.y}% (${grupo.eixoXRotulo.trim() || 'x'} = ${ultimo.x})`);
    }
    partes.push('');
  }

  if (params.imagens.length > 0) {
    partes.push(`📎 ${params.imagens.length} imagem(ns) anexada(s) ao cartaz — ver imagem do boletim.`);
    partes.push('');
  }

  partes.push('—');
  partes.push(RODAPE_PADRAO);

  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface JornalVisualProps {
  profissionalNome: string;
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
  indicadoresLinha: GrupoLinha[];
  imagens: ImagemJornal[];
}

// Cartaz visual do Jornal — layout inspirado no "Research Summary" do NEJM
// (banner com nome da publicação, título, colunas com cabeçalhos em
// vermelho e cartões de destaque/indicadores à direita). É o próprio
// componente capturado como PNG pelo botão "Baixar imagem".
//
// O NOME DO PROFISSIONAL é quem ocupa o lugar de maior destaque no
// masthead (equivalente a "The New England Journal of Medicine" no
// modelo) — é a marca recorrente que deve ficar conhecida a cada edição.
// O título digitado pra semana vira o "tópico" abaixo do nome, papel
// equivalente ao título do artigo no modelo original.
export const JornalVisual = forwardRef<HTMLDivElement, JornalVisualProps>(function JornalVisual(
  { profissionalNome, municipioNome, titulo, subtitulo, secoes, destaques, indicadores, indicadoresLinha, imagens },
  ref,
) {
  const secoesPreenchidas = secoes.filter((s) => s.corpo.trim());
  const destaquesPreenchidos = destaques.filter((d) => d.titulo.trim() || d.corpo.trim());
  const indicadoresPreenchidos = indicadores.filter((g) => g.barras.some((b) => b.rotulo.trim()));
  const indicadoresLinhaPreenchidos = indicadoresLinha.filter((g) =>
    g.series.some((s) => s.nome.trim() && s.pontos.length > 0),
  );

  return (
    <div ref={ref} className="jornal-visual">
      <div className="jornal-masthead">
        <p className="eyebrow">🩺 Boletim de Saúde Semanal{municipioNome.trim() ? ` — ${municipioNome}` : ''}</p>
        <h1>{profissionalNome.trim() || 'Nome do profissional'}</h1>
        <p className="jornal-topico-semana">{titulo.trim() || 'Título do boletim'}</p>
        <p className="byline">
          {subtitulo.trim() ? `${subtitulo.trim()} | ` : ''}
          {formatarEdicao()}
        </p>
      </div>

      <div className="jornal-corpo">
        <div className="jornal-coluna-esquerda">
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

        <div className="jornal-coluna-direita">
          {imagens.length > 0 && (
            <div className="jornal-imagens-bloco">
              {imagens.map((imagem) => (
                <figure key={imagem.id} className="jornal-imagem-item">
                  <img src={imagem.dataUrl} alt={imagem.legenda || 'Imagem anexada'} />
                  {imagem.legenda.trim() && <figcaption>{imagem.legenda}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          {destaquesPreenchidos.length > 0 && (
            <div className="jornal-destaques-grid">
              {destaquesPreenchidos.map((destaque, i) => (
                <div key={destaque.id} className="jornal-destaque-card">
                  {destaque.amostra.trim() ? (
                    <div className="jornal-destaque-badge-wrap">
                      <div className="jornal-destaque-crowd" aria-hidden>
                        {Array.from({ length: 24 }).map((_, j) => (
                          <span key={j}>🧍</span>
                        ))}
                      </div>
                      <div className="jornal-destaque-badge" style={{ background: CORES_BARRA[i % CORES_BARRA.length] }}>
                        {destaque.icone || '💊'}
                      </div>
                      <span className="amostra">N = {destaque.amostra.trim()}</span>
                    </div>
                  ) : (
                    <span className="icone">{destaque.icone || '📌'}</span>
                  )}
                  <p className="titulo">{destaque.titulo}</p>
                  {destaque.corpo
                    .split('\n')
                    .filter((linha) => linha.trim())
                    .map((linha, j) => (
                      <p key={j} className="linha">
                        {linha}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}

          {indicadoresPreenchidos.length > 0 && (
            <div className="jornal-indicadores-grid">
              {indicadoresPreenchidos.map((grupo) => {
                const barrasValidas = grupo.barras.filter((b) => b.rotulo.trim());
                return (
                  <div key={grupo.id} className="jornal-indicador">
                    {grupo.titulo.trim() && <p className="titulo">{grupo.titulo}</p>}
                    {grupo.descricao.trim() && <p className="descricao">{grupo.descricao}</p>}
                    <div className="jornal-grafico-painel">
                      <div className="jornal-grafico-eixo" aria-hidden>
                        {[100, 75, 50, 25, 0].map((v) => (
                          <span key={v}>{v}</span>
                        ))}
                      </div>
                      <div className="jornal-barra-grupo">
                        {barrasValidas.map((barra, i) => (
                          <div key={barra.id} className="jornal-barra">
                            <span className="valor">{barra.valor}%</span>
                            {barra.subvalor.trim() && <span className="subvalor">{barra.subvalor}</span>}
                            <div
                              className="haste"
                              style={{ height: `${Math.max(barra.valor, 3)}%`, background: CORES_BARRA[i % CORES_BARRA.length] }}
                            />
                            <span className="rotulo">{barra.rotulo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {indicadoresLinhaPreenchidos.map((grupo) => (
            <GraficoLinha key={grupo.id} grupo={grupo} />
          ))}
        </div>
      </div>

      <div className="jornal-rodape">{RODAPE_PADRAO}</div>
    </div>
  );
});

// Gráfico de linha em degraus (estilo curva de sobrevida/Kaplan-Meier do
// modelo de referência) — cada série desenha um "step-after": segura o
// valor até o próximo ponto, depois degrau. Eixo Y fixo 0-100 (mesma
// escala dos gráficos de barra, pra manter os indicadores comparáveis).
function GraficoLinha({ grupo }: { grupo: GrupoLinha }) {
  const seriesValidas = grupo.series.filter((s) => s.nome.trim() && s.pontos.length >= 2);
  if (seriesValidas.length === 0) return null;

  const LARGURA = 260;
  const ALTURA = 90;
  const todosX = seriesValidas.flatMap((s) => s.pontos.map((p) => p.x));
  const minX = Math.min(...todosX);
  const maxX = Math.max(...todosX, minX + 1);

  function px(x: number) {
    return ((x - minX) / (maxX - minX)) * LARGURA;
  }
  function py(y: number) {
    return ALTURA - (Math.min(Math.max(y, 0), 100) / 100) * ALTURA;
  }

  const refY = Number(grupo.linhaReferencia);
  const temReferencia = grupo.linhaReferencia.trim() !== '' && !Number.isNaN(refY);
  const xTicks = Array.from(new Set(todosX)).sort((a, b) => a - b);

  return (
    <div className="jornal-indicador">
      {grupo.titulo.trim() && <p className="titulo">{grupo.titulo}</p>}
      {grupo.descricao.trim() && <p className="descricao">{grupo.descricao}</p>}
      <div className="jornal-grafico-painel">
        <div className="jornal-grafico-eixo linha" aria-hidden>
          {[100, 75, 50, 25, 0].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="jornal-grafico-linha-area">
          <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} width="100%" height={ALTURA} preserveAspectRatio="none">
            {[0, 25, 50, 75, 100].map((v) => (
              <line key={v} x1={0} x2={LARGURA} y1={py(v)} y2={py(v)} style={{ stroke: 'var(--line)' }} strokeWidth={1} />
            ))}
            {temReferencia && (
              <line
                x1={0}
                x2={LARGURA}
                y1={py(refY)}
                y2={py(refY)}
                style={{ stroke: 'var(--muted)' }}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )}
            {seriesValidas.map((serie, i) => {
              const pontosOrdenados = [...serie.pontos].sort((a, b) => a.x - b.x);
              let d = '';
              pontosOrdenados.forEach((p, idx) => {
                if (idx === 0) {
                  d += `M ${px(p.x)} ${py(p.y)} `;
                } else {
                  const anterior = pontosOrdenados[idx - 1];
                  d += `L ${px(p.x)} ${py(anterior.y)} L ${px(p.x)} ${py(p.y)} `;
                }
              });
              return (
                <path
                  key={serie.id}
                  d={d.trim()}
                  fill="none"
                  style={{ stroke: CORES_BARRA[i % CORES_BARRA.length] }}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
          <div className="jornal-grafico-linha-eixox">
            {xTicks.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
      {grupo.eixoXRotulo.trim() && <p className="jornal-grafico-linha-rotulo-x">{grupo.eixoXRotulo}</p>}
      <div className="jornal-legenda">
        {seriesValidas.map((serie, i) => {
          const ultimo = [...serie.pontos].sort((a, b) => a.x - b.x).slice(-1)[0];
          return (
            <div key={serie.id} className="jornal-legenda-item">
              <span className="ponto" style={{ background: CORES_BARRA[i % CORES_BARRA.length] }} />
              <span>
                <strong>{ultimo.y}%</strong> {serie.nome}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface JornalComposerProps {
  profissionalNome: string;
  municipioNome: string;
  titulo: string;
  subtitulo: string;
  secoes: SecaoJornal[];
  destaques: DestaqueJornal[];
  indicadores: GrupoIndicador[];
  indicadoresLinha: GrupoLinha[];
  imagens: ImagemJornal[];
  onProfissionalNomeChange: (valor: string) => void;
  onTituloChange: (valor: string) => void;
  onSubtituloChange: (valor: string) => void;
  onSecoesChange: (secoes: SecaoJornal[]) => void;
  onDestaquesChange: (destaques: DestaqueJornal[]) => void;
  onIndicadoresChange: (indicadores: GrupoIndicador[]) => void;
  onIndicadoresLinhaChange: (indicadoresLinha: GrupoLinha[]) => void;
  onImagensChange: (imagens: ImagemJornal[]) => void;
  onConcluir: (corpoMensagem: string) => void;
  onCancelar: () => void;
}

export function JornalComposer({
  profissionalNome,
  municipioNome,
  titulo,
  subtitulo,
  secoes,
  destaques,
  indicadores,
  indicadoresLinha,
  imagens,
  onProfissionalNomeChange,
  onTituloChange,
  onSubtituloChange,
  onSecoesChange,
  onDestaquesChange,
  onIndicadoresChange,
  onIndicadoresLinhaChange,
  onImagensChange,
  onConcluir,
  onCancelar,
}: JornalComposerProps) {
  const [baixando, setBaixando] = useState(false);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);

  const corpoTexto = useMemo(
    () =>
      montarCorpoJornal({
        profissionalNome,
        municipioNome,
        titulo,
        subtitulo,
        secoes,
        destaques,
        indicadores,
        indicadoresLinha,
        imagens,
      }),
    [profissionalNome, municipioNome, titulo, subtitulo, secoes, destaques, indicadores, indicadoresLinha, imagens],
  );

  function atualizarSecao(id: string, campo: 'titulo' | 'corpo', valor: string) {
    onSecoesChange(secoes.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function removerSecao(id: string) {
    if (secoes.length <= 1) return;
    onSecoesChange(secoes.filter((s) => s.id !== id));
  }

  function atualizarDestaque(id: string, campo: 'icone' | 'titulo' | 'corpo' | 'amostra', valor: string) {
    onDestaquesChange(destaques.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function removerDestaque(id: string) {
    onDestaquesChange(destaques.filter((d) => d.id !== id));
  }

  function atualizarGrupoIndicador(id: string, campo: 'titulo' | 'descricao', valor: string) {
    onIndicadoresChange(indicadores.map((g) => (g.id === id ? { ...g, [campo]: valor } : g)));
  }

  function atualizarBarra(grupoId: string, barraId: string, campo: 'rotulo' | 'valor' | 'subvalor', valor: string) {
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

  function atualizarGrupoLinha(id: string, campo: 'titulo' | 'descricao' | 'eixoXRotulo' | 'linhaReferencia', valor: string) {
    onIndicadoresLinhaChange(indicadoresLinha.map((g) => (g.id === id ? { ...g, [campo]: valor } : g)));
  }

  function atualizarSerie(grupoId: string, serieId: string, nome: string) {
    onIndicadoresLinhaChange(
      indicadoresLinha.map((g) =>
        g.id === grupoId ? { ...g, series: g.series.map((s) => (s.id === serieId ? { ...s, nome } : s)) } : g,
      ),
    );
  }

  function atualizarPonto(grupoId: string, serieId: string, pontoId: string, campo: 'x' | 'y', valor: string) {
    const numero = Math.max(campo === 'y' ? 0 : -Infinity, campo === 'y' ? Math.min(100, Number(valor) || 0) : Number(valor) || 0);
    onIndicadoresLinhaChange(
      indicadoresLinha.map((g) =>
        g.id === grupoId
          ? {
              ...g,
              series: g.series.map((s) =>
                s.id === serieId
                  ? { ...s, pontos: s.pontos.map((p) => (p.id === pontoId ? { ...p, [campo]: numero } : p)) }
                  : s,
              ),
            }
          : g,
      ),
    );
  }

  function adicionarPonto(grupoId: string, serieId: string) {
    onIndicadoresLinhaChange(
      indicadoresLinha.map((g) =>
        g.id === grupoId
          ? {
              ...g,
              series: g.series.map((s) => {
                if (s.id !== serieId) return s;
                const ultimoX = s.pontos.length > 0 ? Math.max(...s.pontos.map((p) => p.x)) : 0;
                return { ...s, pontos: [...s.pontos, criarPontoVazio(ultimoX + 3)] };
              }),
            }
          : g,
      ),
    );
  }

  function removerPonto(grupoId: string, serieId: string, pontoId: string) {
    onIndicadoresLinhaChange(
      indicadoresLinha.map((g) =>
        g.id === grupoId
          ? {
              ...g,
              series: g.series.map((s) =>
                s.id === serieId && s.pontos.length > 2 ? { ...s, pontos: s.pontos.filter((p) => p.id !== pontoId) } : s,
              ),
            }
          : g,
      ),
    );
  }

  function removerGrupoLinha(id: string) {
    onIndicadoresLinhaChange(indicadoresLinha.filter((g) => g.id !== id));
  }

  async function adicionarImagens(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErroImagem(null);
    setEnviandoImagem(true);
    try {
      const novas = await Promise.all(
        Array.from(arquivos).map(async (arquivo) => ({
          id: criarId(),
          dataUrl: await lerImagemComoDataUrl(arquivo),
          legenda: '',
        })),
      );
      onImagensChange([...imagens, ...novas]);
    } catch {
      setErroImagem('Não foi possível anexar uma das imagens. Tente novamente.');
    } finally {
      setEnviandoImagem(false);
    }
  }

  function atualizarLegendaImagem(id: string, legenda: string) {
    onImagensChange(imagens.map((img) => (img.id === id ? { ...img, legenda } : img)));
  }

  function removerImagem(id: string) {
    onImagensChange(imagens.filter((img) => img.id !== id));
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
        <label>Assinatura do boletim (seu nome — é a marca que fica em destaque)</label>
        <input
          value={profissionalNome}
          onChange={(e) => onProfissionalNomeChange(e.target.value)}
          placeholder="Ex: Dr. Fulano de Tal"
        />
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
        Imagens e gráficos (coluna direita — anexe o que já tiver pronto)
      </p>
      {imagens.map((imagem, indice) => (
        <div key={imagem.id} className="card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <img
            src={imagem.dataUrl}
            alt={`Anexo ${indice + 1}`}
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
          />
          <input
            value={imagem.legenda}
            onChange={(e) => atualizarLegendaImagem(imagem.id, e.target.value)}
            placeholder="Legenda (opcional)"
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
          />
          <button onClick={() => removerImagem(imagem.id)} className="link-remover">
            Remover
          </button>
        </div>
      ))}
      <label className="btn btn-outline" style={{ marginBottom: 18, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
        {enviandoImagem ? 'Carregando…' : '+ Anexar imagem (gráfico, foto, print)'}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            adicionarImagens(e.target.files);
            e.target.value = '';
          }}
          disabled={enviandoImagem}
          style={{ display: 'none' }}
        />
      </label>

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
            <input
              value={destaque.amostra}
              onChange={(e) => atualizarDestaque(destaque.id, 'amostra', e.target.value)}
              placeholder="N (opcional)"
              style={{ width: 90, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
            />
          </div>
          <textarea
            value={destaque.corpo}
            onChange={(e) => atualizarDestaque(destaque.id, 'corpo', e.target.value)}
            placeholder={'Uma linha por item, ex:\nUBS Centro — seg a sex, 8h-16h\nUBS Vila Nova — ter e qui, 8h-12h'}
            rows={3}
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: 10, color: 'var(--muted)', margin: '6px 0 0' }}>
            Preenchendo "N", o cartão ganha o selo circular com ícone e a textura de pessoas, como nos cartões de
            braço de estudo do NEJM. Deixe em branco pra um cartão simples (tipo "Patients").
          </p>
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
          <input
            value={grupo.descricao}
            onChange={(e) => atualizarGrupoIndicador(grupo.id, 'descricao', e.target.value)}
            placeholder="Linha de apoio (ex: Diferença ajustada, 31 pontos percentuais; P<0,001)"
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
                style={{ width: 60, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
              />
              <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>%</span>
              <input
                value={barra.subvalor}
                onChange={(e) => atualizarBarra(grupo.id, barra.id, 'subvalor', e.target.value)}
                placeholder="IC95% (opcional)"
                style={{ width: 110, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 11.5 }}
              />
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
        Gráfico de linha / evolução no tempo (opcional)
      </p>
      {indicadoresLinha.map((grupo, indiceGrupo) => (
        <div key={grupo.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Linha {indiceGrupo + 1}</span>
            <button onClick={() => removerGrupoLinha(grupo.id)} className="link-remover">
              Remover
            </button>
          </div>
          <input
            value={grupo.titulo}
            onChange={(e) => atualizarGrupoLinha(grupo.id, 'titulo', e.target.value)}
            placeholder="Título (ex: Casos notificados ao longo do ano)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          <input
            value={grupo.descricao}
            onChange={(e) => atualizarGrupoLinha(grupo.id, 'descricao', e.target.value)}
            placeholder="Linha de apoio (opcional)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={grupo.eixoXRotulo}
              onChange={(e) => atualizarGrupoLinha(grupo.id, 'eixoXRotulo', e.target.value)}
              placeholder="Rótulo do eixo X (ex: Semanas)"
              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
            />
            <input
              value={grupo.linhaReferencia}
              onChange={(e) => atualizarGrupoLinha(grupo.id, 'linhaReferencia', e.target.value)}
              placeholder="Linha de ref. % (opcional)"
              style={{ width: 150, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
            />
          </div>

          {grupo.series.map((serie, indiceSerie) => (
            <div key={serie.id} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 8, marginBottom: 8 }}>
              <input
                value={serie.nome}
                onChange={(e) => atualizarSerie(grupo.id, serie.id, e.target.value)}
                placeholder={`Nome da série ${indiceSerie + 1} (ex: Com tratamento)`}
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', fontSize: 12, marginBottom: 6 }}
              />
              {serie.pontos.map((ponto) => (
                <div key={ponto.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', width: 14 }}>x</span>
                  <input
                    type="number"
                    value={ponto.x}
                    onChange={(e) => atualizarPonto(grupo.id, serie.id, ponto.id, 'x', e.target.value)}
                    style={{ width: 60, border: '1px solid var(--line)', borderRadius: 9, padding: '6px 8px', fontSize: 12 }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted)', width: 14 }}>y%</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ponto.y}
                    onChange={(e) => atualizarPonto(grupo.id, serie.id, ponto.id, 'y', e.target.value)}
                    style={{ width: 60, border: '1px solid var(--line)', borderRadius: 9, padding: '6px 8px', fontSize: 12 }}
                  />
                  {serie.pontos.length > 2 && (
                    <button onClick={() => removerPonto(grupo.id, serie.id, ponto.id)} className="link-remover" style={{ fontSize: 10 }}>
                      Remover
                    </button>
                  )}
                </div>
              ))}
              <button
                className="btn btn-outline"
                style={{ fontSize: 11, padding: '6px 0' }}
                onClick={() => adicionarPonto(grupo.id, serie.id)}
              >
                + Adicionar ponto
              </button>
            </div>
          ))}
        </div>
      ))}
      <button
        className="btn btn-outline"
        onClick={() => onIndicadoresLinhaChange([...indicadoresLinha, criarGrupoLinhaVazio()])}
        style={{ marginBottom: 18 }}
      >
        + Adicionar gráfico de linha
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Pré-visualização do cartaz
      </p>
      <div style={{ marginBottom: 12 }}>
        <JornalVisual
          ref={visualRef}
          profissionalNome={profissionalNome}
          municipioNome={municipioNome}
          titulo={titulo}
          subtitulo={subtitulo}
          secoes={secoes}
          destaques={destaques}
          indicadores={indicadores}
          indicadoresLinha={indicadoresLinha}
          imagens={imagens}
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
