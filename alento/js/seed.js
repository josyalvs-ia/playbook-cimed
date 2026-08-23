// Carga inicial: leva a tabela oficial de valores e a planilha de insumos
// para dentro do banco. Só escreve o que ainda não existe.
import * as db from './db.js';
import { SERVICOS, ADICIONAIS, CATEGORIAS_SERVICO } from './data/servicos.js';
import { MATERIAIS } from './data/materiais.js';
import { PREMISSAS_PADRAO } from './data/premissas.js';
import { avisar } from './ui.js';

export async function instalar({ forcar = false } = {}) {
  const jaTem = new Set(db.estado.servicos.map((s) => s.id));

  const servicos = [
    ...SERVICOS.map((s, i) => ({
      id: s.id, categoria: s.categoria, nome: s.nome, tipo: 'servico',
      preco: s.preco, custo: s.custo, tempo: s.tempo,
      profissional: s.profissional || 'unhas',
      estimado: !!s.estimado, nota: s.nota || null, ordem: i, ativo: true,
    })),
    ...ADICIONAIS.map((a, i) => ({
      id: a.id, categoria: 'adicionais', nome: a.nome, tipo: 'adicional',
      preco: a.preco, custo: a.custo, tempo: a.tempo, unidade: a.unidade,
      profissional: 'unhas', estimado: false, ordem: 900 + i, ativo: true,
    })),
  ].filter((s) => forcar || !jaTem.has(s.id));

  const temMat = new Set(db.estado.materiais.map((m) => m.id));
  const materiais = MATERIAIS
    .filter((m) => forcar || !temMat.has(m.id))
    .map((m) => ({
      id: m.id, categoria: m.categoria, nome: m.nome, apresentacao: m.apresentacao,
      tipo: m.tipo, preco_ref: m.preco_ref, preco_pago: null,
      estoque: 0, estoque_minimo: 0, ativo: true,
    }));

  if (servicos.length) await db.salvarLote('servicos', servicos);
  if (materiais.length) await db.salvarLote('materiais', materiais);

  if (forcar || !db.cfg('premissas')) await db.setCfg('premissas', PREMISSAS_PADRAO);
  if (!db.cfg('categorias')) await db.setCfg('categorias', CATEGORIAS_SERVICO);
  if (!db.cfg('studio')) {
    await db.setCfg('studio', {
      nome: 'Alento Studio de Beleza',
      instagram: '@alentostudio',
      whatsapp: '',
      endereco: '',
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
  avisar(`Instalado: ${servicos.length} serviços e ${materiais.length} insumos`);
  return { servicos: servicos.length, materiais: materiais.length };
}
