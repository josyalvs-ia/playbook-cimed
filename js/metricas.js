// Indicadores do negócio — as contas que os relatórios, o painel e o
// fechamento por profissional compartilham.
import { estado, cfg } from './db.js';
import { PREMISSAS_PADRAO } from './data/premissas.js';
import { custoFixoPorAtendimento, taxaMediaCartao, custoUnitario, FORMAS_PAGAMENTO } from './pricing.js';
import { hoje, diasEntre } from './ui.js';

export const premissas = () => ({ ...PREMISSAS_PADRAO, ...(cfg('premissas') || {}) });

export const noMes = (data, mes) => (data || '').startsWith(mes);

/** Comandas fechadas dentro de um período (datas ISO, inclusive). */
export function comandasFechadas({ de, ate, profissional } = {}) {
  return estado.comandas.filter((c) =>
    c.status === 'fechada'
    && (!de || c.data >= de)
    && (!ate || c.data <= ate)
    && (!profissional || c.profissional_id === profissional));
}

export function itensDe(comandaId) {
  return estado.comanda_itens.filter((i) => i.comanda_id === comandaId);
}

/** Taxa efetiva de recebimento por forma de pagamento. */
export function taxaDe(forma, p = premissas()) {
  return { pix: p.taxa_pix, dinheiro: 0, debito: p.taxa_debito, credito: p.taxa_credito }[forma] ?? 0;
}

/**
 * Resumo financeiro de um conjunto de comandas: quanto entrou, quanto ficou
 * com a maquininha, o que sobra depois de material, custo fixo e imposto.
 */
export function resumo(comandas, p = premissas()) {
  const fixoUnit = custoFixoPorAtendimento(p);
  let bruto = 0, taxas = 0, material = 0, tempo = 0;

  for (const c of comandas) {
    const v = Number(c.total) || 0;
    bruto += v;
    taxas += v * taxaDe(c.forma_pagamento, p);
    material += Number(c.custo_total) || 0;
    tempo += Number(c.tempo_total) || 0;
  }

  const imposto = bruto * Number(p.imposto || 0);
  const fixo = fixoUnit * comandas.length;
  const liquido = bruto - taxas - imposto;

  return {
    atendimentos: comandas.length,
    bruto, taxas, imposto, material, tempo,
    custoFixo: fixo,
    liquido,
    resultado: liquido - material - fixo,
    ticket: comandas.length ? bruto / comandas.length : 0,
    porHora: tempo ? (liquido - material) / tempo : 0,
  };
}

/** Faturamento por forma de pagamento. */
export function porPagamento(comandas) {
  const m = new Map(FORMAS_PAGAMENTO.map((f) => [f.id, { ...f, valor: 0, qtd: 0 }]));
  for (const c of comandas) {
    const r = m.get(c.forma_pagamento);
    if (r) { r.valor += Number(c.total) || 0; r.qtd++; }
  }
  return [...m.values()];
}

/** Ranking de serviços por receita no período. */
export function rankingServicos(comandas, limite = 10) {
  const ids = new Set(comandas.map((c) => c.id));
  const m = new Map();
  for (const i of estado.comanda_itens) {
    if (!ids.has(i.comanda_id)) continue;
    const r = m.get(i.nome) || { nome: i.nome, qtd: 0, valor: 0, tempo: 0 };
    r.qtd += Number(i.qtd) || 1;
    r.valor += (Number(i.valor) || 0) * (Number(i.qtd) || 1);
    r.tempo += (Number(i.tempo) || 0) * (Number(i.qtd) || 1);
    m.set(i.nome, r);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, limite);
}

/** Movimento do caixa (inclui o que não passou por comanda). */
export function caixaPeriodo({ de, ate } = {}) {
  const linhas = estado.caixa.filter((c) => (!de || c.data >= de) && (!ate || c.data <= ate));
  const entradas = linhas.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  const saidas = linhas.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0);
  return { linhas, entradas, saidas, saldo: entradas - saidas };
}

/** Saídas agrupadas por categoria — a base do "para onde foi o dinheiro". */
export function saidasPorCategoria(linhas) {
  const m = new Map();
  for (const l of linhas) {
    if (l.tipo !== 'saida') continue;
    m.set(l.categoria, (m.get(l.categoria) || 0) + Number(l.valor));
  }
  return [...m.entries()].map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

// ─── Clientes ──────────────────────────────────────────────────────────────
export function historicoCliente(clienteId) {
  return estado.comandas
    .filter((c) => c.cliente_id === clienteId && c.status === 'fechada')
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

export function fichaCliente(c) {
  const h = historicoCliente(c.id);
  const total = h.reduce((s, x) => s + Number(x.total || 0), 0);
  const ultima = h[0]?.data || null;
  return {
    visitas: h.length,
    total,
    ticket: h.length ? total / h.length : 0,
    ultima,
    diasSemVir: ultima ? diasEntre(ultima, hoje()) : null,
    intervaloMedio: intervaloMedio(h),
  };
}

function intervaloMedio(historico) {
  if (historico.length < 2) return null;
  const datas = historico.map((h) => h.data).sort();
  let soma = 0;
  for (let i = 1; i < datas.length; i++) soma += diasEntre(datas[i - 1], datas[i]);
  return Math.round(soma / (datas.length - 1));
}

/** Quem passou do próprio ritmo de retorno e merece uma mensagem. */
export function clientesParaResgatar(margem = 1.4) {
  return estado.clientes
    .filter((c) => c.ativo !== false)
    .map((c) => ({ cliente: c, ...fichaCliente(c) }))
    .filter((f) => f.visitas >= 2 && f.intervaloMedio && f.diasSemVir > f.intervaloMedio * margem)
    .sort((a, b) => b.diasSemVir - a.diasSemVir);
}

/**
 * Quem faz aniversário hoje, e quem faz nos próximos dias.
 *
 * Compara só dia e mês: o ano do cadastro é o ano de nascimento, não o da
 * festa. Quem nasceu em 1990 continua fazendo aniversário todo 23 de agosto.
 *
 * O 29 de fevereiro é comemorado em 1º de março nos anos que não têm o dia 29
 * — melhor lembrar um dia depois do que esquecer três anos seguidos.
 */
export function aniversariantesDoDia({ diasAFrente = 7, hoje = new Date() } = {}) {
  const diaMes = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const bissexto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

  const quando = (c) => {
    const mm = c.nascimento.slice(5, 7);
    const dd = c.nascimento.slice(8, 10);
    // 29/02 em ano comum passa a valer no dia 01/03.
    if (mm === '02' && dd === '29' && !bissexto(hoje.getFullYear())) return '03-01';
    return `${mm}-${dd}`;
  };

  const comData = estado.clientes.filter((c) => c.ativo !== false && c.nascimento);
  const hojeDM = diaMes(hoje);

  const proximos = [];
  for (let i = 1; i <= diasAFrente; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const dm = diaMes(d);
    for (const c of comData) {
      if (quando(c) === dm) proximos.push({ cliente: c, data: new Date(d), emDias: i });
    }
  }

  return {
    hoje: comData.filter((c) => quando(c) === hojeDM)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    proximos,
  };
}

/** Quantos anos a cliente faz (ou fez) neste ano. */
export function idadeQueFaz(nascimento, hoje = new Date()) {
  const ano = Number(String(nascimento).slice(0, 4));
  return ano > 1900 && ano <= hoje.getFullYear() ? hoje.getFullYear() - ano : null;
}

export function aniversariantes(mes = new Date().getMonth() + 1) {
  return estado.clientes
    .filter((c) => c.nascimento && Number(c.nascimento.slice(5, 7)) === mes)
    .sort((a, b) => a.nascimento.slice(8) .localeCompare(b.nascimento.slice(8)));
}

/**
 * Taxa de retorno: das clientes atendidas no período, quantas já tinham vindo
 * antes. É o indicador que separa salão que fideliza de salão que só gira.
 */
export function taxaRetorno({ de, ate }) {
  const noPeriodo = comandasFechadas({ de, ate }).filter((c) => c.cliente_id);
  const unicas = [...new Set(noPeriodo.map((c) => c.cliente_id))];
  if (!unicas.length) return { taxa: 0, recorrentes: 0, novas: 0, total: 0 };
  let recorrentes = 0;
  for (const id of unicas) {
    const anterior = estado.comandas.some((c) =>
      c.cliente_id === id && c.status === 'fechada' && c.data < de);
    if (anterior) recorrentes++;
  }
  return { taxa: recorrentes / unicas.length, recorrentes, novas: unicas.length - recorrentes, total: unicas.length };
}

// ─── Estoque ───────────────────────────────────────────────────────────────
export function materiaisEmFalta() {
  return estado.materiais
    .filter((m) => m.ativo !== false && Number(m.estoque_minimo) > 0
                   && Number(m.estoque) <= Number(m.estoque_minimo))
    .sort((a, b) => (a.estoque / (a.estoque_minimo || 1)) - (b.estoque / (b.estoque_minimo || 1)));
}

/** O saldo é contado na unidade de uso, então o valor usa o custo unitário. */
export function valorEstoque() {
  return estado.materiais.reduce((s, m) => s + Number(m.estoque || 0) * custoUnitario(m), 0);
}

// ─── Comissão ──────────────────────────────────────────────────────────────
/** Fechamento de uma profissional no período. */
export function fechamentoProfissional(prof, { de, ate }, p = premissas()) {
  const comandas = comandasFechadas({ de, ate, profissional: prof.id });
  const r = resumo(comandas, p);
  const pct = Number(prof.comissao_pct ?? 0);

  // A comissão pode ser definida item a item; quando não for, vale a da profissional.
  let base = 0;
  for (const c of comandas) {
    for (const i of itensDe(c.id)) {
      const v = (Number(i.valor) || 0) * (Number(i.qtd) || 1);
      base += v * (i.comissao_pct != null ? Number(i.comissao_pct) : pct);
    }
  }
  // Desconto dado na comanda reduz a base proporcionalmente.
  const descontos = comandas.reduce((s, c) => s + Number(c.desconto || 0), 0);
  const comissao = Math.max(0, base - descontos * pct);

  const pagos = estado.caixa
    .filter((l) => l.tipo === 'saida' && l.categoria === 'Comissão/retirada'
                   && l.profissional_id === prof.id && l.data >= de && l.data <= ate)
    .reduce((s, l) => s + Number(l.valor), 0);

  return { profissional: prof, ...r, comissao, pagos, aReceber: comissao - pagos, comandas };
}

export const taxaMedia = taxaMediaCartao;
