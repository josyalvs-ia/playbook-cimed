// Carga inicial: leva a tabela oficial de valores e a planilha de insumos
// para dentro do banco. Só escreve o que ainda não existe.
import * as db from './db.js';
import { SERVICOS, ADICIONAIS, CATEGORIAS_SERVICO } from './data/servicos.js';
import { MATERIAIS } from './data/materiais.js';
import { PREMISSAS_PADRAO } from './data/premissas.js';
import { FICHAS_RASCUNHO } from './data/fichas.js';
import { avisar } from './ui.js';

export async function instalar({ forcar = false } = {}) {
  const jaTem = new Set(db.estado.servicos.map((s) => s.id));

  const servicos = [
    ...SERVICOS.map((s, i) => ({
      id: s.id, categoria: s.categoria, nome: s.nome, tipo: 'servico',
      preco: s.preco, custo: s.custo, tempo: s.tempo,
      preco_tipo: s.preco_tipo || 'fixo',
      profissional: s.profissional || 'unhas',
      estimado: !!s.estimado, nota: s.nota || null, ordem: i, ativo: true,
    })),
    ...ADICIONAIS.map((a, i) => ({
      id: a.id, categoria: 'adicionais', nome: a.nome, tipo: 'adicional',
      preco: a.preco, custo: a.custo, tempo: a.tempo, unidade: a.unidade,
      preco_tipo: 'fixo', profissional: a.profissional || 'unhas',
      estimado: false, ordem: 900 + i, ativo: true,
    })),
  ].filter((s) => forcar || !jaTem.has(s.id));

  const temMat = new Set(db.estado.materiais.map((m) => m.id));
  const materiais = MATERIAIS
    .filter((m) => forcar || !temMat.has(m.id))
    .map((m) => ({
      id: m.id, categoria: m.categoria, nome: m.nome, apresentacao: m.apresentacao,
      tipo: m.tipo, preco_ref: m.preco_ref, preco_pago: null,
      qtd_embalagem: m.qtd_embalagem, unidade: m.unidade,
      estoque: 0, estoque_minimo: 0, ativo: true,
    }));

  if (servicos.length) await db.salvarLote('servicos', servicos);
  if (materiais.length) await db.salvarLote('materiais', materiais);

  // Fichas de rascunho dos serviços mais feitos: melhor começar corrigindo
  // números do que inventando do zero. Só entram se ainda não houver ficha
  // nenhuma — nunca sobrescrevem o que a equipe já ajustou.
  let fichas = 0;
  if (!db.estado.ficha_tecnica.length) {
    const linhas = [];
    for (const [servicoId, itens] of Object.entries(FICHAS_RASCUNHO)) {
      if (!db.estado.servicos.some((x) => x.id === servicoId)
          && !servicos.some((x) => x.id === servicoId)) continue;
      for (const it of itens) linhas.push({ servico_id: servicoId, ...it });
    }
    if (linhas.length) { await db.salvarLote('ficha_tecnica', linhas); fichas = linhas.length; }
  }

  if (forcar || !db.cfg('premissas')) await db.setCfg('premissas', PREMISSAS_PADRAO);
  if (!db.cfg('categorias')) await db.setCfg('categorias', CATEGORIAS_SERVICO);
  if (!db.cfg('studio')) {
    await db.setCfg('studio', {
      nome: 'Alento Studio de Beleza',
      instagram: '@alentostudio',
      whatsapp: '',
      endereco: 'Rua dos Manacás, 464 — Sala 3, 2º andar (frente) · Jd. da Glória, Cotia/SP · CEP 06711-500',
      trinks: '',
    });
  }
  if (!db.cfg('categorias_caixa')) {
    await db.setCfg('categorias_caixa', {
      entrada: ['Atendimento', 'Venda de produto', 'Aporte', 'Outros'],
      saida: ['Materiais e insumos', 'Aluguel', 'Água/luz/internet', 'Contador',
              'Marketing', 'Equipamento', 'Curso/formação', 'Comissão/retirada',
              'Imposto', 'Manutenção', 'Outros'],
    });
  }

  await db.recarregar();
  avisar(`Instalado: ${servicos.length} serviços, ${materiais.length} insumos`
    + (fichas ? ` e ${Object.keys(FICHAS_RASCUNHO).length} fichas técnicas de rascunho` : ''));
  return { servicos: servicos.length, materiais: materiais.length, fichas };
}
