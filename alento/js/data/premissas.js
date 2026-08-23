// Premissas de precificação — aba "Premissas 2026" da planilha.
// Todos os valores são editáveis dentro do app (tela Precificação → Premissas).
export const PREMISSAS_PADRAO = {
  aluguel_total: 1900,
  aluguel_rateio: 0.5,          // sua parte do aluguel
  utilidades_total: 800,        // água + luz + internet
  utilidades_rateio: 0.5,
  contador: 180,
  outros_fixos: 0,

  atendimentos_mes: 120,        // atendimentos produtivos/mês
  remuneracao_hora: 25,         // remuneração desejada por hora

  imposto: 0.06,                // hipótese — confirmar regime/anexo com o contador

  taxa_pix: 0,
  taxa_debito: 0.0137,          // InfinitePay — 1 dia útil
  taxa_credito: 0.0315,         // InfinitePay crédito à vista — 1 dia útil

  mix_pix: 0.60,
  mix_debito: 0.10,
  mix_credito: 0.30,

  margem: 0.20,                 // margem de lucro desejada
};

export const OBSERVACOES_PREMISSAS = [
  'O imposto de 6% é apenas uma hipótese de cálculo. Confirme com seu contador o regime/anexo e a alíquota efetiva.',
  'As taxas InfinitePay usadas são para maquininha/InfiniteTap, faturamento até R$ 20 mil/mês e recebimento em 1 dia útil.',
  'Os custos de material e tempos são estimativas editáveis: a planilha original trazia preços de referência, não consumo real por atendimento.',
  'O preço técnico é um piso de sustentabilidade, não uma pesquisa de mercado. Serve para identificar o que está barato demais, não para derrubar o que já está saudável.',
];

// Etapas que devem entrar no custo de cada técnica — aba "Serviços" da planilha.
export const ETAPAS_TECNICA = [
  ['Manicure tradicional',        'Preparo + cutícula + lixamento + base + esmaltação + finalização'],
  ['Manicure sem esmaltação',     'Preparo + cutícula + lixamento + base/finalização'],
  ['Esmaltação em gel',           'Preparo + base + cor gel + top coat + finalização'],
  ['Banho de gel',                'Preparo + estrutura em gel + acabamento + cor/top'],
  ['Alongamento em gel',          'Preparo + molde/tip + gel + acabamento + esmaltação'],
  ['Alongamento fibra de vidro',  'Preparo + fibra + gel + acabamento + esmaltação'],
  ['Alongamento F1',              'Preparo + molde F1 + gel + acabamento + esmaltação'],
  ['Alongamento tips/full cover', 'Preparo + tip + gel/base conforme técnica + acabamento'],
  ['Manutenção de alongamento',   'Remoção de descolamentos + preparação + reposição de produto + acabamento'],
  ['Remoção de alongamento',      'Desbaste/remoção + higienização + acabamento'],
  ['Remoção de esmaltação em gel','Soak off + remoção + preparação'],
  ['Nail art simples',            'Itens da técnica + esmalte/gel + finalização'],
  ['Nail art elaborada',          'Materiais específicos + tempo adicional + finalização'],
];

// Orientações de uso dos custos — aba "Como usar" da planilha.
export const COMO_USAR = [
  ['Custo unitário',  'Para calcular o custo real por ml/g/unidade: preço pago ÷ quantidade total da embalagem.'],
  ['Descartáveis',    'Inclua o custo efetivamente consumido por atendimento, não apenas o preço da embalagem.'],
  ['Reutilizáveis',   'Não coloque o preço inteiro em um atendimento. Distribua pela vida útil estimada ou pelo número de atendimentos.'],
  ['Equipamentos',    'Inclua depreciação/manutenção na precificação, mesmo quando o equipamento já estiver pago.'],
  ['Esterilização',   'Considere embalagem para esterilização, indicador, água apropriada, energia, detergente e tempo de processamento.'],
  ['Esmaltes',        'Não é necessário comprar todas as cores de uma vez; o preço unitário deve ser o valor real da sua coleção.'],
  ['Atualização',     'Preços de cosméticos e descartáveis variam muito por marca, atacado e promoção. Atualize o preço real antes de fechar a tabela.'],
];
