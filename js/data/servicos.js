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

  // Cabelos — tabela da Laura
  { id: 'cab-escova',     nome: 'Lavagem, Escova e Finalização', ordem: 7 },
  { id: 'cab-corte',      nome: 'Cortes',                        ordem: 8 },
  { id: 'cab-tratamento', nome: 'Tratamentos',                   ordem: 9 },
  { id: 'cab-cor',        nome: 'Coloração e Mechas',            ordem: 10 },
  { id: 'cab-terapia',    nome: 'Terapia Capilar',               ordem: 11 },
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

  // ── CABELOS — LAVAGEM, ESCOVA E FINALIZAÇÃO ────────────────────────────────
  // Preços da tabela da Laura. Custo de material e tempo são estimativas
  // iniciais (não havia planilha de custo para cabelos) — todos marcados como
  // `estimado` para serem corrigidos com o consumo real.
  { id: 'cab-lavagem',        categoria: 'cab-escova', nome: 'Lavagem com secagem simples',                    preco: 45,  custo: 6,   tempo: 0.5,  profissional: 'cabelo', estimado: true },
  { id: 'cab-escova-curto',   categoria: 'cab-escova', nome: 'Escova curto',                                   preco: 65,  custo: 8,   tempo: 0.75, profissional: 'cabelo', estimado: true },
  { id: 'cab-escova-medio',   categoria: 'cab-escova', nome: 'Escova médio',                                   preco: 75,  custo: 10,  tempo: 0.9,  profissional: 'cabelo', estimado: true },
  { id: 'cab-escova-longo',   categoria: 'cab-escova', nome: 'Escova longo',                                   preco: 85,  custo: 12,  tempo: 1.1,  profissional: 'cabelo', estimado: true },
  { id: 'cab-cacheada',       categoria: 'cab-escova', nome: 'Finalização cacheada com secagem no difusor',    preco: 75,  custo: 10,  tempo: 0.9,  profissional: 'cabelo', estimado: true },
  { id: 'cab-penteado',       categoria: 'cab-escova', nome: 'Penteado simples com escova',                    preco: 140, custo: 12,  tempo: 1.25, profissional: 'cabelo', estimado: true },

  // ── CABELOS — CORTES ───────────────────────────────────────────────────────
  { id: 'cab-corte-final',    categoria: 'cab-corte', nome: 'Corte com finalização',                           preco: 175, custo: 12,  tempo: 1.5,  profissional: 'cabelo', estimado: true },
  { id: 'cab-corte-trat',     categoria: 'cab-corte', nome: 'Corte com tratamento e finalização',              preco: 245, custo: 35,  tempo: 2.0,  profissional: 'cabelo', estimado: true },
  { id: 'cab-corte-infantil', categoria: 'cab-corte', nome: 'Corte infantil',                                  preco: 90,  custo: 6,   tempo: 0.75, profissional: 'cabelo', estimado: true },
  { id: 'cab-corte-franja',   categoria: 'cab-corte', nome: 'Corte a seco de franja',                          preco: 30,  custo: 2,   tempo: 0.25, profissional: 'cabelo', estimado: true },
  { id: 'cab-corte-pixie',    categoria: 'cab-corte', nome: 'Corte masculino / feminino pixie',                preco: 80,  custo: 5,   tempo: 0.75, profissional: 'cabelo', estimado: true },

  // ── CABELOS — TRATAMENTOS ──────────────────────────────────────────────────
  { id: 'cab-trat-curto',     categoria: 'cab-tratamento', nome: 'Tratamento com escova curto',                preco: 135, custo: 30,  tempo: 1.5,  profissional: 'cabelo', estimado: true },
  { id: 'cab-trat-medio',     categoria: 'cab-tratamento', nome: 'Tratamento com escova médio',                preco: 145, custo: 35,  tempo: 1.7,  profissional: 'cabelo', estimado: true },
  { id: 'cab-trat-longo',     categoria: 'cab-tratamento', nome: 'Tratamento com escova longo',                preco: 155, custo: 42,  tempo: 1.9,  profissional: 'cabelo', estimado: true },

  // ── CABELOS — COLORAÇÃO E MECHAS ───────────────────────────────────────────
  { id: 'cab-raiz',           categoria: 'cab-cor', nome: 'Cobertura de brancos / retoque de coloração de raiz', preco: 240, custo: 55,  tempo: 2.0,  profissional: 'cabelo', estimado: true },
  { id: 'cab-raiz-trat',      categoria: 'cab-cor', nome: 'Cobertura de brancos / retoque de raiz com tratamento', preco: 310, custo: 80, tempo: 2.5, profissional: 'cabelo', estimado: true },
  { id: 'cab-cor-completa',   categoria: 'cab-cor', nome: 'Coloração completa',                                preco: 400, custo: 110, tempo: 3.0,  profissional: 'cabelo', estimado: true, preco_tipo: 'a_partir' },
  { id: 'cab-morena',         categoria: 'cab-cor', nome: 'Morena iluminada sem descoloração',                 preco: 500, custo: 130, tempo: 3.5,  profissional: 'cabelo', estimado: true, preco_tipo: 'a_partir', agenda_online: false,
    nota: 'Para cabelos naturais ou sem coloração.' },
  { id: 'cab-mechas',         categoria: 'cab-cor', nome: 'Mechas loiras ou iluminadas',                       preco: 600, custo: 180, tempo: 4.5,  profissional: 'cabelo', estimado: true, preco_tipo: 'a_partir', agenda_online: false,
    nota: 'Opção com descoloração, para cabelo já com coloração.' },
  { id: 'cab-fantasia',       categoria: 'cab-cor', nome: 'Cores fantasia',                                    preco: 600, custo: 190, tempo: 4.5,  profissional: 'cabelo', estimado: true, preco_tipo: 'a_partir', agenda_online: false },
  { id: 'cab-mecha-nuca',     categoria: 'cab-cor', nome: 'Mecha fantasia ou nuca',                            preco: 250, custo: 60,  tempo: 1.5,  profissional: 'cabelo', estimado: true, preco_tipo: 'a_partir' },
  { id: 'cab-correcao',       categoria: 'cab-cor', nome: 'Correção de cor',                                   preco: 0,   custo: 200, tempo: 4.0,  profissional: 'cabelo', estimado: true, preco_tipo: 'avaliacao', agenda_online: false },

  // ── CABELOS — TERAPIA CAPILAR ──────────────────────────────────────────────
  { id: 'cab-avaliacao-terapia', categoria: 'cab-terapia', nome: 'Avaliação de terapia capilar com lavagem terapêutica', preco: 220, custo: 40, tempo: 1.5, profissional: 'cabelo', estimado: true },
  { id: 'cab-sessao-terapia',    categoria: 'cab-terapia', nome: 'Sessão de terapia capilar',                  preco: 270, custo: 60,  tempo: 1.5,  profissional: 'cabelo', estimado: true,
    nota: 'Consulte valores especiais para pacotes.' },
];

// Adicionais: cobrados junto de um serviço principal. Não carregam o custo fixo
// inteiro do atendimento, por isso são calculados à parte na precificação.
export const ADICIONAIS = [
  { id: 'ad-reparo-unha',    nome: 'Reparo de unha quebrada',            preco: 10, unidade: 'por unha', custo: 2.5, tempo: 0.35 },
  { id: 'ad-francesinha-gel',nome: 'Francesinha em gel no alongamento',  preco: 20, unidade: 'por atendimento', custo: 3, tempo: 0.3 },
  { id: 'ad-francesinha-combo', nome: 'Francesinha em gel no combo',     preco: 20, unidade: 'por atendimento', custo: 3, tempo: 0.3 },
  { id: 'ad-babyliss',       nome: 'Babyliss ou chapinha',               preco: 10, unidade: 'na escova', custo: 1, tempo: 0.25, profissional: 'cabelo' },
];

// Regras que aparecem na vitrine pública e no app, direto da tabela oficial.
/**
 * Os avisos do fim da página das clientes.
 *
 * Estes são só o ponto de partida: o studio edita em Ajustes → Boas de saber, e
 * o que estiver salvo lá manda. Procedimento entra e sai da tabela, e elas não
 * podem depender de mim para mudar um aviso.
 */
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
  { titulo: 'Cabelos',
    itens: [
      'Babyliss ou chapinha na escova: + R$ 10,00.',
      'Correção de cor é orçada sob avaliação, presencialmente.',
      'Serviços de coloração e mechas partem do valor indicado e variam conforme comprimento, volume e histórico do cabelo.',
      'Terapia capilar: consulte valores especiais para pacotes.',
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
