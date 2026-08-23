// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO OFICIAL DE SERVIÇOS — ALENTO STUDIO DE BELEZA
//
// preco  → vem da "Tabela de Valores Alento" (PDF oficial). É o preço praticado.
// custo  → custo de material por atendimento
// tempo  → horas de cadeira ocupada
//
// custo/tempo vêm da planilha "Precificacao_Studio_Unhas_2026.xlsx" quando o
// serviço tem equivalente direto lá. Onde a planilha não tinha equivalente
// (combos novos da tabela oficial), o valor é uma estimativa conservadora
// derivada da soma dos componentes — marcado com estimado: true.
// Tudo é editável dentro do app, em Precificação.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIAS_SERVICO = [
  { id: 'maos',        nome: 'Mãos',                        ordem: 1 },
  { id: 'pes',         nome: 'Pés',                         ordem: 2 },
  { id: 'combos',      nome: 'Combos — Mãos e Pés',         ordem: 3 },
  { id: 'blindagem',   nome: 'Blindagem e Banho de Gel',    ordem: 4 },
  { id: 'alongamento', nome: 'Alongamento em Gel Moldado',  ordem: 5 },
  { id: 'combo-along', nome: 'Combo de Alongamento',        ordem: 6 },
  { id: 'cabelos',     nome: 'Cabelos',                     ordem: 7 },
];

export const SERVICOS = [
  // ── MÃOS ───────────────────────────────────────────────────────────────────
  { id: 'manicure',              categoria: 'maos', nome: 'Manicure',                                     preco: 45,  custo: 9.5,  tempo: 1.0,  profissional: 'unhas' },
  { id: 'manicure-gel',          categoria: 'maos', nome: 'Manicure + esmaltação em gel',                 preco: 120, custo: 21,   tempo: 1.6,  profissional: 'unhas' },
  { id: 'gel-sem-manicure',      categoria: 'maos', nome: 'Esmaltação em gel sem manicure',               preco: 60,  custo: 11.5, tempo: 1.0,  profissional: 'unhas' },
  { id: 'esmaltacao-tradicional',categoria: 'maos', nome: 'Esmaltação tradicional',                       preco: 25,  custo: 4.5,  tempo: 0.5,  profissional: 'unhas' },
  { id: 'esmaltacao-infantil',   categoria: 'maos', nome: 'Esmaltação infantil',                          preco: 25,  custo: 4,    tempo: 0.35, profissional: 'unhas' },
  { id: 'remocao-gel-mecanica',  categoria: 'maos', nome: 'Remoção de esmaltação em gel — mecânica',      preco: 32,  custo: 8,    tempo: 0.6,  profissional: 'unhas' },
  { id: 'remocao-gel-quimica',   categoria: 'maos', nome: 'Remoção de esmaltação em gel — química',       preco: 48,  custo: 9,    tempo: 0.75, profissional: 'unhas', estimado: true },

  // ── PÉS ────────────────────────────────────────────────────────────────────
  { id: 'pedicure',              categoria: 'pes',  nome: 'Pedicure',                                     preco: 50,  custo: 12.5, tempo: 1.0,  profissional: 'unhas' },
  { id: 'pedicure-gel',          categoria: 'pes',  nome: 'Pedicure + esmaltação em gel',                 preco: 80,  custo: 24,   tempo: 1.7,  profissional: 'unhas' },
  { id: 'pedicure-spa',          categoria: 'pes',  nome: 'Pedicure + Spa dos pés',                       preco: 85,  custo: 22,   tempo: 1.4,  profissional: 'unhas' },
  { id: 'spa-pes',               categoria: 'pes',  nome: 'Spa dos pés',                                  preco: 55,  custo: 15,   tempo: 1.0,  profissional: 'unhas' },
  { id: 'plastica-pes',          categoria: 'pes',  nome: 'Plástica dos pés',                             preco: 90,  custo: 22,   tempo: 1.5,  profissional: 'unhas' },
  { id: 'plastica-pes-pedicure', categoria: 'pes',  nome: 'Plástica dos pés + pedicure',                  preco: 120, custo: 30,   tempo: 2.0,  profissional: 'unhas' },

  // ── COMBOS MÃOS E PÉS ──────────────────────────────────────────────────────
  { id: 'mani-pedi-tradicional', categoria: 'combos', nome: 'Manicure + Pedicure — esmaltação tradicional', preco: 90,  custo: 21,   tempo: 1.7,  profissional: 'unhas' },
  { id: 'mani-pedi-gel-maos',    categoria: 'combos', nome: 'Manicure + Pedicure — gel nas mãos',           preco: 170, custo: 30,   tempo: 2.4,  profissional: 'unhas', estimado: true },
  { id: 'mani-pedi-gel-pes',     categoria: 'combos', nome: 'Manicure + Pedicure — gel nos pés',            preco: 175, custo: 32,   tempo: 2.5,  profissional: 'unhas', estimado: true },
  { id: 'mani-pedi-gel-ambos',   categoria: 'combos', nome: 'Manicure + Pedicure — gel nas mãos e nos pés', preco: 200, custo: 42,   tempo: 3.2,  profissional: 'unhas', estimado: true },

  // ── BLINDAGEM E BANHO DE GEL ───────────────────────────────────────────────
  { id: 'blindagem',             categoria: 'blindagem', nome: 'Blindagem de cálcio',                              preco: 90,  custo: 14, tempo: 1.25, profissional: 'unhas' },
  { id: 'blindagem-manicure',    categoria: 'blindagem', nome: 'Blindagem + manicure',                             preco: 120, custo: 23, tempo: 1.7,  profissional: 'unhas' },
  { id: 'banho-gel',             categoria: 'blindagem', nome: 'Banho de gel',                                     preco: 130, custo: 20, tempo: 1.5,  profissional: 'unhas' },
  { id: 'banho-gel-manicure',    categoria: 'blindagem', nome: 'Banho de gel + manicure',                          preco: 155, custo: 30, tempo: 2.0,  profissional: 'unhas' },
  { id: 'banho-gel-mani-fran',   categoria: 'blindagem', nome: 'Banho de gel + manicure + francesinha em gel',     preco: 175, custo: 33, tempo: 2.2,  profissional: 'unhas', estimado: true },
  { id: 'manut-banho-gel',       categoria: 'blindagem', nome: 'Manutenção de banho de gel',                       preco: 120, custo: 18, tempo: 1.3,  profissional: 'unhas' },
  { id: 'manut-manicure',        categoria: 'blindagem', nome: 'Manutenção + manicure',                            preco: 165, custo: 28, tempo: 1.7,  profissional: 'unhas' },
  { id: 'manut-gel',             categoria: 'blindagem', nome: 'Manutenção + esmaltação em gel',                   preco: 195, custo: 30, tempo: 1.9,  profissional: 'unhas', estimado: true },
  { id: 'manut-mani-gel',        categoria: 'blindagem', nome: 'Manutenção + manicure + esmaltação em gel',        preco: 220, custo: 38, tempo: 2.4,  profissional: 'unhas', estimado: true },

  // ── ALONGAMENTO EM GEL MOLDADO ─────────────────────────────────────────────
  { id: 'along-aplicacao',       categoria: 'alongamento', nome: 'Alongamento em gel moldado — aplicação', preco: 250, custo: 35,  tempo: 2.5,  profissional: 'unhas' },
  { id: 'along-manutencao',      categoria: 'alongamento', nome: 'Manutenção — valor fixo',                preco: 235, custo: 32,  tempo: 2.0,  profissional: 'unhas' },
  { id: 'along-remocao',         categoria: 'alongamento', nome: 'Remoção de alongamento',                 preco: 80,  custo: 12,  tempo: 1.0,  profissional: 'unhas' },

  // ── COMBO DE ALONGAMENTO ───────────────────────────────────────────────────
  { id: 'combo-along-completo',  categoria: 'combo-along', nome: 'COMBO — alongamento + manicure + esmaltação em gel', preco: 320, custo: 50, tempo: 3.5, profissional: 'unhas', estimado: true,
    nota: 'Separado sairia R$ 370,00 (250 + 45 + 75). A cliente economiza R$ 50,00.' },
];

// Adicionais: cobrados junto de um serviço principal. Não carregam o custo fixo
// inteiro do atendimento, por isso são calculados à parte na precificação.
export const ADICIONAIS = [
  { id: 'ad-reparo-unha',    nome: 'Reparo de unha quebrada',            preco: 10, unidade: 'por unha', custo: 2.5, tempo: 0.35 },
  { id: 'ad-francesinha-gel',nome: 'Francesinha em gel no alongamento',  preco: 20, unidade: 'por atendimento', custo: 3, tempo: 0.3 },
  { id: 'ad-francesinha-combo', nome: 'Francesinha em gel no combo',     preco: 20, unidade: 'por atendimento', custo: 3, tempo: 0.3 },
];

// Regras que aparecem na vitrine pública e no app, direto da tabela oficial.
export const REGRAS = [
  { titulo: 'Manutenção do alongamento',
    itens: [
      'A manutenção possui valor fixo de R$ 235,00, sem cobrança diferente por quantidade de semanas.',
      'Unhas quebradas que precisem de reconstrução têm acréscimo de R$ 10,00 por unha.',
      'Se a estrutura das demais unhas estiver comprometida e não for possível uma manutenção segura, o procedimento é considerado nova aplicação, no valor de R$ 250,00.',
      'Francesinha em gel no alongamento: + R$ 20,00.',
    ] },
  { titulo: 'Francesinha',
    itens: [
      'A francesinha tradicional é cortesia nos serviços de esmaltação tradicional.',
      'Francesinha em gel tem adicional de R$ 20,00 por exigir maior tempo e técnica.',
      'No alongamento em gel, a francesinha também é adicional de R$ 20,00.',
    ] },
  { titulo: 'Fora da tabela',
    itens: [
      'Serviços de fibra de vidro, acrílico e troca de formato não fazem parte desta tabela.',
    ] },
];

// Composição do combo, usada na vitrine para mostrar a economia.
export const COMBO_ALONGAMENTO = {
  componentes: [
    { nome: 'Alongamento em gel moldado', valor: 250 },
    { nome: 'Manicure',                   valor: 45 },
    { nome: 'Esmaltação em gel',          valor: 75 },
  ],
  separado: 370,
  combo: 320,
  economia: 50,
};
