// ─── Ícones ────────────────────────────────────────────────────────────────
// Traço fino, cantos arredondados: o mesmo desenho dos ícones de destaque do
// manual da marca.
const TRACOS = {
  painel:   '<path d="M3 3h7v8H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 14h7v7H3z"/>',
  comanda:  '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4"/>',
  agenda:   '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  tabela:   '<path d="M4 3h16v18H4z"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  estoque:  '<path d="M21 8v10a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 18V8"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  caixa:    '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h3"/>',
  comissao: '<path d="M12 3v18M6 7h9a3 3 0 0 1 0 6H6M6 17h9"/>',
  grafico:  '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  ajustes:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  mais:     '<path d="M12 5v14M5 12h14"/>',
  fechar:   '<path d="M18 6 6 18M6 6l12 12"/>',
  check:    '<path d="m20 6-11 11-5-5"/>',
  lixo:     '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  editar:   '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  busca:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alerta:   '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  sair:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  baixar:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  subir:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-5.9A8.4 8.4 0 1 1 21 11.5z"/>',
  voltar:   '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  nuvem:    '<path d="M18 10h-1.3A7 7 0 1 0 4 15.3"/><path d="M12 12v9M8 17l4 4 4-4"/>',
  relogio:  '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  sino:     '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
  seta:     '<path d="m9 18 6-6-6-6"/>',
};

export function ico(nome, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRACOS[nome] || ''}</svg>`;
}

// ─── Destaques da marca ────────────────────────────────────────────────────
// Os cinco ícones em círculo do pack de redes sociais: tesoura, estrela,
// esmalte, calendário e coração. Mesmo traço fino e mesmo anel do manual.
// Aqui eles não são enfeite — são a navegação do studio.
const DESTAQUES = {
  cabelos:     '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M7.8 16.2 19.5 3.2M16.2 16.2 4.5 3.2"/>',
  tratamentos: '<path d="M12 2.6q1.4 7.6 8 9q-6.6 1.4-8 9q-1.4-7.6-8-9q6.6-1.4 8-9z"/>',
  unhas:       '<rect x="10" y="2.4" width="4" height="4" rx="1.1"/><path d="M11 6.4v1.5l-1.9 2.2a2 2 0 0 0-.5 1.3V20a1.4 1.4 0 0 0 1.4 1.4h4a1.4 1.4 0 0 0 1.4-1.4v-6.6a2 2 0 0 0-.5-1.3L13 9.9V6.4"/>',
  agenda:      '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2.4"/><path d="M8 3.2v4M16 3.2v4M3.2 10.4h17.6"/>',
  sobre:       '<path d="M12 20.6C12 20.6 3.6 15.2 3.6 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.4 2.5c0 5.7-8.4 11.1-8.4 11.1z"/>',
};

/** Qual destaque do manual representa cada categoria da tabela. */
export const FAMILIA_DA_CATEGORIA = {
  maos: 'unhas', pes: 'unhas', combos: 'unhas', blindagem: 'unhas',
  alongamento: 'unhas', 'combo-along': 'unhas',
  'cab-escova': 'cabelos', 'cab-corte': 'cabelos', 'cab-cor': 'cabelos',
  'cab-tratamento': 'tratamentos', 'cab-terapia': 'tratamentos',
};
export const familiaDe = (cat) => FAMILIA_DA_CATEGORIA[cat] || 'tratamentos';

/** O ícone do destaque, sem o anel — para títulos e listas. */
export function icoDestaque(nome, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"
    >${DESTAQUES[nome] || DESTAQUES.tratamentos}</svg>`;
}

/**
 * O destaque inteiro: anel, ícone e rótulo em caixa alta espaçada, como na
 * fileira do manual. `tag` vira <button> quando serve para clicar.
 */
export function destaque(nome, rotulo, { tag = 'button', attrs = '', nota = '' } = {}) {
  return `<${tag} class="destaque-marca" data-destaque="${esc(nome)}" ${attrs}>
    <span class="destaque-anel">${icoDestaque(nome, 'ico')}</span>
    <span class="destaque-rotulo">${esc(rotulo)}</span>
    ${nota ? `<span class="destaque-nota">${esc(nota)}</span>` : ''}
  </${tag}>`;
}

/** Estrela de 4 pontas — o motivo gráfico da marca. */
export function estrela(cls = '') {
  return `<span class="estrela ${cls}"><svg viewBox="-60 -60 120 120">
    <path d="M0-56Q7-7 56 0Q7 7 0 56Q-7 7-56 0Q-7-7 0-56Z" fill="currentColor"/></svg></span>`;
}

/**
 * Camada decorativa de estrelas que cintilam.
 * As posições são fixas (não sorteadas) para o desenho ficar sempre
 * equilibrado, e cada estrela tem ritmo próprio — cintilar em uníssono
 * pareceria um pisca-pisca, não um céu.
 */
export function ceuEstrelado() {
  const estrelas = [
    [8, 18, 13, 0.0, 4.2], [22, 68, 8, 1.4, 5.6], [15, 88, 6, 2.8, 4.8],
    [34, 12, 7, 0.7, 6.2], [48, 82, 11, 2.1, 5.0], [63, 24, 6, 3.4, 4.4],
    [72, 60, 15, 0.4, 6.8], [86, 14, 9, 2.6, 5.2], [91, 74, 7, 1.1, 4.6],
    [56, 46, 5, 3.9, 5.8], [78, 92, 6, 1.8, 4.0], [42, 34, 4, 3.1, 6.4],
  ];
  return `<div class="ceu" aria-hidden="true">${estrelas.map(
    ([x, y, tam, atraso, dur]) => `<span class="estrela" style="
      left:${x}%; top:${y}%; font-size:${tam}px;
      --atraso:${atraso}s; --dur:${dur}s">
      <svg viewBox="-60 -60 120 120"><path d="M0-56Q7-7 56 0Q7 7 0 56Q-7 7-56 0Q-7-7 0-56Z" fill="currentColor"/></svg>
    </span>`).join('')}</div>`;
}

/**
 * Reduz a foto escolhida a um quadrado de 256px e devolve uma data URL JPEG.
 *
 * O corte é central e a escala é a maior das duas — é o que enquadra o rosto
 * em vez de espremer a foto. Reduzir aqui, no aparelho, é o que permite
 * guardar a foto na própria linha da profissional: 256px em JPEG dá uns 20 KB,
 * e assim ninguém precisa configurar armazenamento de arquivos no Supabase.
 */
export function fotoReduzida(arquivo, { lado = 256, qualidade = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!arquivo || !arquivo.type.startsWith('image/')) {
      return reject(new Error('Escolha uma imagem (JPG ou PNG).'));
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir essa imagem.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const tela = document.createElement('canvas');
      tela.width = tela.height = lado;
      const ctx = tela.getContext('2d');
      const escala = Math.max(lado / img.width, lado / img.height);
      const l = img.width * escala;
      const a = img.height * escala;
      ctx.drawImage(img, (lado - l) / 2, (lado - a) / 2, l, a);
      resolve(tela.toDataURL('image/jpeg', qualidade));
    };
    img.src = url;
  });
}

/**
 * O rosto de quem atende, com a inicial como reserva. Serve tanto para a
 * equipe dentro do sistema quanto para a cliente escolhendo com quem marcar.
 */
export function retrato(prof, { tam = 40, cls = '' } = {}) {
  const nome = prof?.nome || '?';
  const estilo = `width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.4)}px`;
  return prof?.foto
    ? `<img class="retrato ${cls}" src="${esc(prof.foto)}" alt="${esc(nome)}" style="${estilo}">`
    : `<span class="retrato sem-foto ${cls}" style="${estilo}" aria-hidden="true"
        >${esc(nome[0].toUpperCase())}</span>`;
}

/**
 * Faz os números grandes subirem até o valor final em vez de simplesmente
 * aparecerem. Meio segundo, desacelerando no fim — o suficiente para o olho
 * acompanhar e entender que aquilo é dinheiro entrando, sem virar espetáculo.
 *
 * Quem pediu menos movimento no sistema recebe o número pronto.
 */
export function contarAte(el, valor, formatar, ms = 620) {
  const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (parado || !Number.isFinite(valor) || valor === 0) {
    el.textContent = formatar(valor);
    return;
  }
  const inicio = performance.now();
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / ms);
    const suave = 1 - Math.pow(1 - t, 3);
    el.textContent = formatar(valor * suave);
    if (t < 1) requestAnimationFrame(passo);
    else el.textContent = formatar(valor);
  };
  requestAnimationFrame(passo);
}

/**
 * Liga a contagem em todo elemento marcado com `data-conta`, dentro de um
 * pedaço de tela recém-desenhado. O valor cru vai no atributo; o texto que já
 * está lá é o formato de reserva se algo der errado.
 */
export function animarNumeros(raiz, formatar = fmt.brlCurto) {
  raiz.querySelectorAll('[data-conta]').forEach((el) => {
    contarAte(el, Number(el.dataset.conta), formatar);
  });
}

// ─── Formatação ────────────────────────────────────────────────────────────
const _brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const _num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const fmt = {
  brl: (n) => _brl.format(Number(n) || 0),
  /** Sem centavos — para KPIs grandes. */
  brlCurto: (n) => {
    n = Number(n) || 0;
    return n >= 1000 ? 'R$ ' + _num.format(Math.round(n)) : _brl.format(n);
  },
  num: (n) => _num.format(Number(n) || 0),
  pct: (n, casas = 1) => (Number(n) * 100).toFixed(casas).replace('.', ',') + '%',
  horas: (h) => {
    h = Number(h) || 0;
    const m = Math.round(h * 60);
    return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  },
  data: (d) => {
    if (!d) return '—';
    const x = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d;
    return x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  dataCurta: (d) => {
    if (!d) return '—';
    const x = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d;
    return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  },
  diaSemana: (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }),
  telefone: (t) => {
    const d = String(t || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return t || '—';
  },
};

/**
 * Como o preço de um serviço aparece para a cliente.
 * Nem todo serviço tem valor fechado: coloração parte de um mínimo e
 * correção de cor só sai depois de ver o cabelo.
 */
/**
 * O recado padrão de quem não se marca sozinha pelo site.
 *
 * Cor exige ver o cabelo antes: o mesmo "mechas" leva quatro horas num cabelo
 * e sete noutro. Cada serviço pode ter o seu recado; sem recado próprio, vale
 * este. Mora aqui porque a tela da equipe e a página das clientes leem os dois
 * o mesmo texto.
 */
export const RECADO_AGENDA =
  'Este serviço é marcado pelo WhatsApp, depois de uma avaliação rápida. Chama a gente!';

export function precoTexto(s, { curto = false } = {}) {
  if (s.preco_tipo === 'avaliacao') return 'sob avaliação';
  const v = curto ? fmt.brlCurto(s.preco) : fmt.brl(s.preco);
  return s.preco_tipo === 'a_partir' ? 'a partir de ' + v : v;
}

/** Link de mapa a partir do endereço escrito — serve no celular e no PC. */
export function linkMapa(endereco) {
  if (!endereco) return null;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco);
}

export const hoje = () => new Date().toISOString().slice(0, 10);
export const mesAtual = () => new Date().toISOString().slice(0, 7);

export function diasEntre(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

/** Escapa texto vindo do banco antes de injetar no HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Normaliza para busca: sem acento, minúsculo. */
export function chave(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

// ─── Toast ─────────────────────────────────────────────────────────────────
export function avisar(msg, tipo = '') {
  const caixa = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  caixa.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 2600);
  setTimeout(() => t.remove(), 2900);
}

// ─── Modal ─────────────────────────────────────────────────────────────────
let _fecharAtual = null;

/**
 * abrirModal({ titulo, corpo, acoes, largo, aoAbrir })
 * `acoes` = [{ texto, classe, onClick(fechar) }]. Retorna a função de fechar.
 */
export function abrirModal({ titulo, corpo, acoes = [], largo = false, aoAbrir }) {
  fecharModal();
  const veu = document.createElement('div');
  veu.className = 'veu';
  veu.innerHTML = `
    <div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-cabeca">
        <h2>${esc(titulo)}</h2>
        <button class="btn-icone" data-fechar aria-label="Fechar">${ico('fechar')}</button>
      </div>
      <div class="modal-corpo">${corpo}</div>
      ${acoes.length ? '<div class="modal-pe"></div>' : ''}
    </div>`;

  const fechar = () => { veu.remove(); document.removeEventListener('keydown', esc_); _fecharAtual = null; };
  const esc_ = (e) => { if (e.key === 'Escape') fechar(); };

  veu.querySelector('[data-fechar]').onclick = fechar;
  veu.onclick = (e) => { if (e.target === veu) fechar(); };
  document.addEventListener('keydown', esc_);

  const pe = veu.querySelector('.modal-pe');
  acoes.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.classe || '');
    b.innerHTML = a.texto;
    b.onclick = () => a.onClick(fechar, veu);
    pe.appendChild(b);
  });

  document.body.appendChild(veu);
  _fecharAtual = fechar;
  aoAbrir?.(veu, fechar);
  veu.querySelector('input,select,textarea')?.focus();
  return fechar;
}

export function fecharModal() { _fecharAtual?.(); }

/** Confirmação. Resolve para true/false. */
export function confirmar(titulo, texto, textoOk = 'Confirmar', perigo = true) {
  return new Promise((resolve) => {
    abrirModal({
      titulo,
      // `pre-line`: uma pergunta com dois parágrafos se lê melhor que um bloco
      // só — e quem escreve a pergunta decide onde quebra.
      corpo: `<p class="t2" style="white-space:pre-line">${esc(texto)}</p>`,
      acoes: [
        { texto: 'Cancelar', classe: 'btn-fantasma', onClick: (f) => { f(); resolve(false); } },
        { texto: textoOk, classe: perigo ? 'btn-perigo' : 'btn-primario', onClick: (f) => { f(); resolve(true); } },
      ],
    });
  });
}

/** Lê todos os [name] de um container e devolve um objeto. */
export function lerForm(raiz) {
  const dados = {};
  raiz.querySelectorAll('[name]').forEach((c) => {
    if (c.type === 'checkbox') dados[c.name] = c.checked;
    else if (c.type === 'number') dados[c.name] = c.value === '' ? null : Number(c.value);
    // Data em branco é AUSÊNCIA de data, não texto vazio. Mandar "" para uma
    // coluna `date` o servidor recusa inteiro — era o que impedia de salvar
    // uma cliente sem aniversário: "invalid input syntax for type date".
    else if (c.type === 'date' || c.type === 'time') dados[c.name] = c.value || null;
    else dados[c.name] = c.value.trim?.() ?? c.value;
  });
  return dados;
}

export function vazio(texto, acao = '') {
  return `<div class="vazio">${estrela()}<p>${esc(texto)}</p>${acao}</div>`;
}
