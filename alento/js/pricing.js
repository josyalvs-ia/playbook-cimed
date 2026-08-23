// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE PRECIFICAÇÃO
// Reproduz a lógica da planilha "Precificacao_Studio_Unhas_2026.xlsx".
// ─────────────────────────────────────────────────────────────────────────────

/** Custos fixos mensais rateados. */
export function custoFixoMensal(p) {
  return p.aluguel_total * p.aluguel_rateio
       + p.utilidades_total * p.utilidades_rateio
       + Number(p.contador || 0)
       + Number(p.outros_fixos || 0);
}

/** Quanto de custo fixo cada atendimento precisa carregar. */
export function custoFixoPorAtendimento(p) {
  const n = Number(p.atendimentos_mes) || 1;
  return custoFixoMensal(p) / n;
}

/** Taxa de cartão média ponderada pelo mix de recebimento. */
export function taxaMediaCartao(p) {
  return p.taxa_pix * p.mix_pix
       + p.taxa_debito * p.mix_debito
       + p.taxa_credito * p.mix_credito;
}

/**
 * Preço técnico de um serviço — o piso abaixo do qual o atendimento
 * deixa de se pagar.
 *
 *   custo direto = material + custo fixo rateado + (tempo × remuneração/hora)
 *   preço        = custo direto ÷ (1 − taxa − imposto − margem)
 *
 * A divisão é o que garante que imposto, taxa e margem incidam sobre o preço
 * final, e não sobre o custo — que é o erro clássico de quem multiplica.
 *
 * `opts.adicional` = true para itens vendidos junto de outro serviço: eles não
 * carregam o custo fixo inteiro, porque a cadeira já foi paga pelo principal.
 */
export function precoTecnico(servico, p, opts = {}) {
  const material = Number(servico.custo) || 0;
  const tempo = Number(servico.tempo) || 0;
  const fixo = opts.adicional ? 0 : custoFixoPorAtendimento(p);
  const mao = tempo * Number(p.remuneracao_hora || 0);
  const custoDireto = material + fixo + mao;

  const taxa = taxaMediaCartao(p);
  const divisor = 1 - taxa - Number(p.imposto || 0) - Number(p.margem || 0);

  if (divisor <= 0) {
    return { erro: 'Imposto + taxa + margem somam 100% ou mais. Reduza a margem.', custoDireto };
  }

  const tecnico = custoDireto / divisor;
  const preco = Number(servico.preco) || 0;

  return {
    material, fixo, mao, custoDireto,
    taxaCartao: tecnico * taxa,
    imposto: tecnico * Number(p.imposto || 0),
    lucro: tecnico * Number(p.margem || 0),
    tecnico,
    minimo: Math.ceil(tecnico / 5) * 5,       // arredondado para cima, múltiplo de 5
    precoAtual: preco,
    diferenca: preco - tecnico,
    abaixoDoPiso: preco < tecnico,
    margemReal: preco > 0 ? (preco - custoDireto - preco * taxa - preco * p.imposto) / preco : 0,
  };
}

/** Lucro real de um atendimento já fechado, com a forma de pagamento efetiva. */
export function resultadoAtendimento({ valor, custoMaterial, tempo, formaPagamento }, p) {
  const taxaMap = { pix: p.taxa_pix, dinheiro: 0, debito: p.taxa_debito, credito: p.taxa_credito };
  const taxa = taxaMap[formaPagamento] ?? taxaMediaCartao(p);
  const liquido = valor * (1 - taxa);
  const imposto = valor * Number(p.imposto || 0);
  const fixo = custoFixoPorAtendimento(p);
  const mao = (Number(tempo) || 0) * Number(p.remuneracao_hora || 0);
  return {
    bruto: valor,
    taxa: valor * taxa,
    imposto,
    liquido,
    custoMaterial: Number(custoMaterial) || 0,
    custoFixo: fixo,
    maoDeObra: mao,
    lucro: liquido - imposto - (Number(custoMaterial) || 0) - fixo - mao,
  };
}

export const FORMAS_PAGAMENTO = [
  { id: 'pix',      nome: 'Pix' },
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'debito',   nome: 'Débito' },
  { id: 'credito',  nome: 'Crédito à vista' },
];
