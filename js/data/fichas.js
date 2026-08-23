// ─────────────────────────────────────────────────────────────────────────────
// FICHAS TÉCNICAS — RASCUNHO
//
// A planilha original trazia o preço dos insumos, mas não o consumo por
// atendimento. Estas quantidades são um ponto de partida de mercado, para você
// corrigir com o que realmente gasta — é muito mais fácil ajustar um número do
// que inventar um do zero.
//
// As quantidades estão na unidade de uso do insumo: ml, g, unidades.
// Reutilizáveis (lixa, broca, molde) entram como fração da vida útil: uma lixa
// que dura 4 atendimentos entra como 0,25.
//
// Confira principalmente: gel construtor, esmalte em gel e vida útil das lixas.
// São os três que mais mexem no custo final.
// ─────────────────────────────────────────────────────────────────────────────

export const FICHAS_RASCUNHO = {
  // custo estimado com os preços de referência: R$ 9.00
  'manicure': [
    { material_id: 'bios-alcool-70-spray', qtd: 10 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 2 },
    { material_id: 'mani-algodao', qtd: 5 },
    { material_id: 'mani-palito-de-laranjeira', qtd: 1 },
    { material_id: 'mani-emoliente-amolecedor-de-cuticulas', qtd: 3 },
    { material_id: 'mani-acetona-removedor', qtd: 10 },
    { material_id: 'mani-oleo-de-cuticulas', qtd: 0.5 },
    { material_id: 'mani-lixa-100-180', qtd: 0.25 },
    { material_id: 'mani-lixa-polidora-bloco', qtd: 0.1 },
    { material_id: 'mani-base-incolor', qtd: 1 },
    { material_id: 'mani-esmaltes-coloridos-colecao-inicial', qtd: 1.5 },
    { material_id: 'mani-extra-brilho-top-coat-tradicional', qtd: 1 },
    { material_id: 'mani-creme-para-maos', qtd: 3 },
  ],
  // custo estimado com os preços de referência: R$ 10.70
  'pedicure': [
    { material_id: 'bios-alcool-70-spray', qtd: 12 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 3 },
    { material_id: 'mani-algodao', qtd: 8 },
    { material_id: 'mani-palito-de-laranjeira', qtd: 1 },
    { material_id: 'mani-emoliente-amolecedor-de-cuticulas', qtd: 4 },
    { material_id: 'mani-acetona-removedor', qtd: 12 },
    { material_id: 'mani-oleo-de-cuticulas', qtd: 0.5 },
    { material_id: 'mani-lixa-para-pes', qtd: 0.15 },
    { material_id: 'mani-separador-de-dedos', qtd: 0.2 },
    { material_id: 'mani-esfoliante-para-maos', qtd: 5 },
    { material_id: 'mani-base-incolor', qtd: 1.2 },
    { material_id: 'mani-esmaltes-coloridos-colecao-inicial', qtd: 1.8 },
    { material_id: 'mani-extra-brilho-top-coat-tradicional', qtd: 1.2 },
    { material_id: 'mani-creme-para-maos', qtd: 5 },
  ],
  // custo estimado com os preços de referência: R$ 12.25
  'gel-sem-manicure': [
    { material_id: 'bios-alcool-70-spray', qtd: 10 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 2 },
    { material_id: 'mani-lixa-100-180', qtd: 0.2 },
    { material_id: 'esma-prep-higienizador', qtd: 2 },
    { material_id: 'esma-desidratador-nail-prep', qtd: 0.5 },
    { material_id: 'esma-primer-sem-acido', qtd: 0.3 },
    { material_id: 'esma-base-gel', qtd: 0.6 },
    { material_id: 'esma-esmaltes-em-gel-coloridos', qtd: 1.2 },
    { material_id: 'esma-top-coat-gel', qtd: 0.8 },
    { material_id: 'esma-wipes-sem-fiapo', qtd: 3 },
    { material_id: 'bios-alcool-isopropilico', qtd: 8 },
  ],
  // custo estimado com os preços de referência: R$ 14.36
  'manicure-gel': [
    { material_id: 'bios-alcool-70-spray', qtd: 12 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 3 },
    { material_id: 'mani-algodao', qtd: 5 },
    { material_id: 'mani-palito-de-laranjeira', qtd: 1 },
    { material_id: 'mani-emoliente-amolecedor-de-cuticulas', qtd: 3 },
    { material_id: 'mani-oleo-de-cuticulas', qtd: 0.5 },
    { material_id: 'mani-lixa-100-180', qtd: 0.25 },
    { material_id: 'esma-prep-higienizador', qtd: 2 },
    { material_id: 'esma-desidratador-nail-prep', qtd: 0.5 },
    { material_id: 'esma-primer-sem-acido', qtd: 0.3 },
    { material_id: 'esma-base-gel', qtd: 0.6 },
    { material_id: 'esma-esmaltes-em-gel-coloridos', qtd: 1.2 },
    { material_id: 'esma-top-coat-gel', qtd: 0.8 },
    { material_id: 'esma-wipes-sem-fiapo', qtd: 4 },
    { material_id: 'bios-alcool-isopropilico', qtd: 8 },
    { material_id: 'mani-creme-para-maos', qtd: 3 },
  ],
  // custo estimado com os preços de referência: R$ 26.95
  'along-aplicacao': [
    { material_id: 'bios-alcool-70-spray', qtd: 14 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 3 },
    { material_id: 'esma-prep-higienizador', qtd: 3 },
    { material_id: 'esma-desidratador-nail-prep', qtd: 0.7 },
    { material_id: 'esma-primer-sem-acido', qtd: 0.5 },
    { material_id: 'alon-gel-base-clear', qtd: 0.6 },
    { material_id: 'alon-gel-construtor-clear', qtd: 3.5 },
    { material_id: 'alon-moldes-adesivos', qtd: 0.02 },
    { material_id: 'mani-lixa-100-180', qtd: 0.4 },
    { material_id: 'moto-lixa-mandril', qtd: 0.5 },
    { material_id: 'moto-broca-diamantada-chama', qtd: 0.02 },
    { material_id: 'esma-esmaltes-em-gel-coloridos', qtd: 1.4 },
    { material_id: 'esma-top-coat-gel', qtd: 1 },
    { material_id: 'esma-wipes-sem-fiapo', qtd: 5 },
    { material_id: 'bios-alcool-isopropilico', qtd: 12 },
    { material_id: 'mani-oleo-de-cuticulas', qtd: 0.5 },
  ],
  // custo estimado com os preços de referência: R$ 23.14
  'along-manutencao': [
    { material_id: 'bios-alcool-70-spray', qtd: 14 },
    { material_id: 'bios-luvas-nitrilicas', qtd: 1 },
    { material_id: 'bios-papel-toalha-em-rolo-para-atendimento', qtd: 3 },
    { material_id: 'esma-prep-higienizador', qtd: 2 },
    { material_id: 'esma-desidratador-nail-prep', qtd: 0.5 },
    { material_id: 'esma-primer-sem-acido', qtd: 0.4 },
    { material_id: 'alon-gel-construtor-clear', qtd: 2.5 },
    { material_id: 'mani-lixa-100-180', qtd: 0.4 },
    { material_id: 'moto-lixa-mandril', qtd: 0.6 },
    { material_id: 'moto-broca-diamantada-chama', qtd: 0.03 },
    { material_id: 'esma-esmaltes-em-gel-coloridos', qtd: 1.4 },
    { material_id: 'esma-top-coat-gel', qtd: 1 },
    { material_id: 'esma-wipes-sem-fiapo', qtd: 5 },
    { material_id: 'bios-alcool-isopropilico', qtd: 12 },
    { material_id: 'mani-oleo-de-cuticulas', qtd: 0.5 },
  ],
};
