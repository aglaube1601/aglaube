import { forwardRef, useMemo, useRef, useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface MateriaJornal {
  id: string;
  categoria: string;
  titulo: string;
  corpo: string;
  imagemDataUrl: string;
  imagemLegenda: string;
}

export interface DestaqueRapido {
  id: string;
  titulo: string;
  corpo: string;
}

const RODAPE_PADRAO =
  'Conteúdo informativo elaborado pela equipe de saúde — não substitui consulta médica. ' +
  'Em caso de sintomas, procure a unidade de saúde mais próxima.';

function criarId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function criarMateriaVazia(): MateriaJornal {
  return { id: criarId(), categoria: '', titulo: '', corpo: '', imagemDataUrl: '', imagemLegenda: '' };
}

export function criarDestaqueRapidoVazio(): DestaqueRapido {
  return { id: criarId(), titulo: '', corpo: '' };
}

// Redimensiona pra no máximo LARGURA_MAX_IMAGEM de largura antes de guardar
// como data URL — uma foto direto da câmera do celular facilmente passa de
// 4000px, o que deixaria o estado da página e o PDF final pesados demais à
// toa (a capa nunca é exibida maior que ~700px).
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

function formatarEdicao(): string {
  const { inicio, fim } = obterIntervaloSemanaAtual();
  return `BOLETIM SEMANAL • ${formatarDataBr(inicio)} A ${formatarDataBr(fim)}`;
}

// O nome do profissional é a "marca" recorrente do boletim (equivalente ao
// nome do jornal/revista no modelo de referência) — é o que deve ficar
// conhecido semana após semana. Nunca fica em branco pro envio de texto:
// cai no genérico "Boletim de Saúde" se o profissional não estiver
// identificado.
function montarCabecalhoPadrao(profissionalNome: string, municipioNome: string): string {
  const nome = profissionalNome.trim() || 'Boletim de Saúde';
  const local = municipioNome.trim() ? ` — ${municipioNome.toUpperCase()}` : '';
  return `🩺 *${nome.toUpperCase()}*${local}\n${formatarEdicao()}`;
}

// Versão em texto simples (pra campanha de WhatsApp, que só transporta
// texto neste MVP — ver comunicacao.service.ts). O PDF/imagem gerado pelo
// JornalVisual é o formato "de verdade"; isto é o resumo de apoio que ainda
// carrega o conteúdo principal quando só a mensagem de texto é enviada.
export function montarCorpoJornal(params: {
  profissionalNome: string;
  municipioNome: string;
  materias: MateriaJornal[];
  destaquesRapidos: DestaqueRapido[];
}): string {
  const partes: string[] = [montarCabecalhoPadrao(params.profissionalNome, params.municipioNome), ''];

  for (const materia of params.materias) {
    if (!materia.titulo.trim() && !materia.corpo.trim()) continue;
    if (materia.categoria.trim()) partes.push(materia.categoria.trim().toUpperCase());
    if (materia.titulo.trim()) partes.push(`*${materia.titulo.trim()}*`);
    if (materia.corpo.trim()) partes.push(materia.corpo.trim());
    if (materia.imagemDataUrl) partes.push('📎 (imagem anexada a esta notícia — ver boletim)');
    partes.push('');
  }

  const destaquesValidos = params.destaquesRapidos.filter((d) => d.titulo.trim() || d.corpo.trim());
  for (const destaque of destaquesValidos) {
    partes.push(`• *${destaque.titulo.trim()}* — ${destaque.corpo.trim()}`);
  }
  if (destaquesValidos.length > 0) partes.push('');

  partes.push('—');
  partes.push(RODAPE_PADRAO);

  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface JornalVisualProps {
  profissionalNome: string;
  municipioNome: string;
  fotoPerfilDataUrl: string;
  materias: MateriaJornal[];
  destaquesRapidos: DestaqueRapido[];
}

// Capa única do Jornal — layout inspirado no jornal impresso "Medicina" do
// CFM (masthead verde, manchetes curtas com foto, fileira de destaques
// rápidos), mas sem as remissões "Pág. X": como tudo cabe numa página só,
// o espaço que seria do "continua na pág. X" vira o próprio texto da
// notícia. É o próprio componente capturado como PNG/PDF pelo composer.
export const JornalVisual = forwardRef<HTMLDivElement, JornalVisualProps>(function JornalVisual(
  { profissionalNome, municipioNome, fotoPerfilDataUrl, materias, destaquesRapidos },
  ref,
) {
  const materiasPreenchidas = materias.filter((m) => m.titulo.trim() || m.corpo.trim());
  const destaquesPreenchidos = destaquesRapidos.filter((d) => d.titulo.trim() || d.corpo.trim());

  return (
    <div ref={ref} className="jornal-visual">
      <div className="jc-masthead">
        <p className="jc-edicao">{formatarEdicao()}</p>
        <div className="jc-marca">
          {fotoPerfilDataUrl ? (
            <img className="jc-logo jc-logo-foto" src={fotoPerfilDataUrl} alt={profissionalNome || 'Foto do profissional'} />
          ) : (
            <span className="jc-logo">🩺</span>
          )}
          <div>
            <h1>{profissionalNome.trim() || 'Nome do profissional'}</h1>
            <span className="jc-tagline">Boletim de Saúde{municipioNome.trim() ? ` — ${municipioNome}` : ''}</span>
          </div>
        </div>
      </div>
      <div className="jc-barra-verde" />

      <div className="jc-corpo">
        {materiasPreenchidas.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', paddingBottom: 16 }}>
            As notícias que você adicionar aparecem aqui.
          </p>
        )}
        {materiasPreenchidas.map((materia, indice) => (
          <div key={materia.id} className={`jc-materia ${indice > 0 ? 'jc-materia-divisor' : ''}`}>
            {materia.categoria.trim() && <p className="jc-categoria">{materia.categoria}</p>}
            {materia.titulo.trim() && <h2 className="jc-manchete">{materia.titulo}</h2>}
            <div className={`jc-materia-conteudo ${materia.imagemDataUrl ? 'com-imagem' : ''}`}>
              {materia.imagemDataUrl && (
                <figure className="jc-figura">
                  <img src={materia.imagemDataUrl} alt={materia.imagemLegenda || materia.titulo || 'Imagem da notícia'} />
                  {materia.imagemLegenda.trim() && <figcaption>{materia.imagemLegenda}</figcaption>}
                </figure>
              )}
              <p className="jc-texto">{materia.corpo}</p>
            </div>
          </div>
        ))}

        {destaquesPreenchidos.length > 0 && (
          <div className="jc-destaques-grid">
            {destaquesPreenchidos.map((destaque) => (
              <div key={destaque.id} className="jc-destaque-rapido">
                <div className="jc-destaque-header">{destaque.titulo || '—'}</div>
                <div className="jc-destaque-corpo">{destaque.corpo}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="jornal-rodape">{RODAPE_PADRAO}</div>
    </div>
  );
});

interface JornalComposerProps {
  profissionalNome: string;
  municipioNome: string;
  fotoPerfilDataUrl: string;
  materias: MateriaJornal[];
  destaquesRapidos: DestaqueRapido[];
  onProfissionalNomeChange: (valor: string) => void;
  onFotoPerfilChange: (dataUrl: string) => void;
  onMateriasChange: (materias: MateriaJornal[]) => void;
  onDestaquesRapidosChange: (destaques: DestaqueRapido[]) => void;
  onConcluir: (corpoMensagem: string) => void;
  onCancelar: () => void;
}

export function JornalComposer({
  profissionalNome,
  municipioNome,
  fotoPerfilDataUrl,
  materias,
  destaquesRapidos,
  onProfissionalNomeChange,
  onFotoPerfilChange,
  onMateriasChange,
  onDestaquesRapidosChange,
  onConcluir,
  onCancelar,
}: JornalComposerProps) {
  const [baixando, setBaixando] = useState<'png' | 'pdf' | null>(null);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);
  const [enviandoImagemId, setEnviandoImagemId] = useState<string | null>(null);
  const [enviandoFotoPerfil, setEnviandoFotoPerfil] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);

  const corpoTexto = useMemo(
    () => montarCorpoJornal({ profissionalNome, municipioNome, materias, destaquesRapidos }),
    [profissionalNome, municipioNome, materias, destaquesRapidos],
  );

  async function anexarFotoPerfil(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    setErroExportacao(null);
    setEnviandoFotoPerfil(true);
    try {
      onFotoPerfilChange(await lerImagemComoDataUrl(arquivo));
    } catch {
      setErroExportacao('Não foi possível anexar a foto. Tente novamente.');
    } finally {
      setEnviandoFotoPerfil(false);
    }
  }

  function atualizarMateria(id: string, campo: 'categoria' | 'titulo' | 'corpo' | 'imagemLegenda', valor: string) {
    onMateriasChange(materias.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)));
  }

  function removerMateria(id: string) {
    if (materias.length <= 1) return;
    onMateriasChange(materias.filter((m) => m.id !== id));
  }

  async function anexarImagemNaMateria(id: string, arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    setErroExportacao(null);
    setEnviandoImagemId(id);
    try {
      const dataUrl = await lerImagemComoDataUrl(arquivo);
      onMateriasChange(materias.map((m) => (m.id === id ? { ...m, imagemDataUrl: dataUrl } : m)));
    } catch {
      setErroExportacao('Não foi possível anexar a imagem. Tente novamente.');
    } finally {
      setEnviandoImagemId(null);
    }
  }

  function removerImagemDaMateria(id: string) {
    onMateriasChange(materias.map((m) => (m.id === id ? { ...m, imagemDataUrl: '', imagemLegenda: '' } : m)));
  }

  function atualizarDestaqueRapido(id: string, campo: 'titulo' | 'corpo', valor: string) {
    onDestaquesRapidosChange(destaquesRapidos.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function removerDestaqueRapido(id: string) {
    onDestaquesRapidosChange(destaquesRapidos.filter((d) => d.id !== id));
  }

  async function baixarPng() {
    if (!visualRef.current) return;
    setErroExportacao(null);
    setBaixando('png');
    try {
      const dataUrl = await toPng(visualRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `jornal-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setErroExportacao('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setBaixando(null);
    }
  }

  // O PDF é a mesma captura do cartaz (DOM -> imagem em alta resolução via
  // html-to-image), só que embutida como página única de PDF com a MESMA
  // proporção da imagem — sem margem branca sobrando, sem reflow de texto:
  // o PDF é literalmente uma foto nítida da capa, página única (conforme
  // decidido: "usaremos apenas uma página/capa"). JPEG em vez de PNG aqui
  // de propósito — numa capa com foto, PNG sem compressão facilmente passa
  // de 15-20MB nessa resolução, pesado demais pra mandar por WhatsApp; em
  // qualidade 0.92 o JPEG fica imperceptivelmente pior e um tanto menor.
  async function baixarPdf() {
    if (!visualRef.current) return;
    setErroExportacao(null);
    setBaixando('pdf');
    try {
      const dataUrl = await toJpeg(visualRef.current, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' });
      const dimensoes = await new Promise<{ largura: number; altura: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ largura: img.width, altura: img.height });
        img.onerror = () => reject(new Error('Falha ao medir a imagem gerada.'));
        img.src = dataUrl;
      });
      const pdf = new jsPDF({
        orientation: dimensoes.altura >= dimensoes.largura ? 'portrait' : 'landscape',
        unit: 'px',
        format: [dimensoes.largura, dimensoes.altura],
      });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, dimensoes.largura, dimensoes.altura);
      pdf.save(`jornal-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setErroExportacao('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setBaixando(null);
    }
  }

  const podeConcluir = materias.some((m) => m.titulo.trim().length > 0 || m.corpo.trim().length > 0);

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
        <label>Sua foto (aparece no círculo ao lado do seu nome — opcional)</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {fotoPerfilDataUrl && (
            <img
              src={fotoPerfilDataUrl}
              alt="Prévia da sua foto"
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }}
            />
          )}
          <label className="btn btn-outline" style={{ flex: 1, textAlign: 'center', cursor: 'pointer', fontSize: 12 }}>
            {enviandoFotoPerfil ? 'Carregando…' : fotoPerfilDataUrl ? 'Trocar foto' : '+ Anexar sua foto'}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                anexarFotoPerfil(e.target.files);
                e.target.value = '';
              }}
              disabled={enviandoFotoPerfil}
              style={{ display: 'none' }}
            />
          </label>
          {fotoPerfilDataUrl && (
            <button onClick={() => onFotoPerfilChange('')} className="link-remover">
              Remover
            </button>
          )}
        </div>
      </div>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Notícias
      </p>
      {materias.map((materia, indice) => (
        <div key={materia.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Notícia {indice + 1}</span>
            {materias.length > 1 && (
              <button onClick={() => removerMateria(materia.id)} className="link-remover">
                Remover
              </button>
            )}
          </div>
          <input
            value={materia.categoria}
            onChange={(e) => atualizarMateria(materia.id, 'categoria', e.target.value)}
            placeholder="Categoria (ex: PREVENÇÃO)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          <input
            value={materia.titulo}
            onChange={(e) => atualizarMateria(materia.id, 'titulo', e.target.value)}
            placeholder="Manchete (ex: Prevenção da dengue no verão)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          <textarea
            value={materia.corpo}
            onChange={(e) => atualizarMateria(materia.id, 'corpo', e.target.value)}
            placeholder="Texto da notícia..."
            rows={4}
            style={{ width: '100%', marginBottom: 8 }}
          />
          {materia.imagemDataUrl ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img
                src={materia.imagemDataUrl}
                alt="Prévia"
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
              />
              <input
                value={materia.imagemLegenda}
                onChange={(e) => atualizarMateria(materia.id, 'imagemLegenda', e.target.value)}
                placeholder="Legenda (opcional)"
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5 }}
              />
              <button onClick={() => removerImagemDaMateria(materia.id)} className="link-remover">
                Remover
              </button>
            </div>
          ) : (
            <label className="btn btn-outline" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', fontSize: 12 }}>
              {enviandoImagemId === materia.id ? 'Carregando…' : '+ Anexar imagem/gráfico (opcional)'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  anexarImagemNaMateria(materia.id, e.target.files);
                  e.target.value = '';
                }}
                disabled={enviandoImagemId === materia.id}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
      ))}
      <button className="btn btn-outline" onClick={() => onMateriasChange([...materias, criarMateriaVazia()])} style={{ marginBottom: 18 }}>
        + Adicionar notícia
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Destaques rápidos (fileira no rodapé da capa — opcional)
      </p>
      {destaquesRapidos.map((destaque, indice) => (
        <div key={destaque.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Destaque {indice + 1}</span>
            <button onClick={() => removerDestaqueRapido(destaque.id)} className="link-remover">
              Remover
            </button>
          </div>
          <input
            value={destaque.titulo}
            onChange={(e) => atualizarDestaqueRapido(destaque.id, 'titulo', e.target.value)}
            placeholder="Título curto (ex: DENGUE)"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, marginBottom: 8 }}
          />
          <textarea
            value={destaque.corpo}
            onChange={(e) => atualizarDestaqueRapido(destaque.id, 'corpo', e.target.value)}
            placeholder="Texto curto (ex: Elimine água parada semanalmente)"
            rows={2}
            style={{ width: '100%' }}
          />
        </div>
      ))}
      <button
        className="btn btn-outline"
        onClick={() => onDestaquesRapidosChange([...destaquesRapidos, criarDestaqueRapidoVazio()])}
        style={{ marginBottom: 18 }}
      >
        + Adicionar destaque rápido
      </button>

      <p className="section-title" style={{ margin: '0 0 6px' }}>
        Pré-visualização da capa
      </p>
      <div style={{ marginBottom: 12 }}>
        <JornalVisual
          ref={visualRef}
          profissionalNome={profissionalNome}
          municipioNome={municipioNome}
          fotoPerfilDataUrl={fotoPerfilDataUrl}
          materias={materias}
          destaquesRapidos={destaquesRapidos}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <button className="btn btn-primary" onClick={baixarPdf} disabled={baixando !== null} style={{ flex: 1 }}>
          {baixando === 'pdf' ? 'Gerando PDF…' : '⬇️ Baixar PDF'}
        </button>
        <button className="btn btn-outline" onClick={baixarPng} disabled={baixando !== null} style={{ flex: 1 }}>
          {baixando === 'png' ? 'Gerando…' : '⬇️ Baixar PNG'}
        </button>
      </div>
      {erroExportacao && (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          {erroExportacao}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 0, marginBottom: 18 }}>
        O PDF/imagem é o formato final do Jornal. O texto abaixo é só um resumo de apoio, porque o envio automático
        desta campanha ainda manda apenas texto (MVP).
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
