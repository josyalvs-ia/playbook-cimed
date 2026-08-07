/* =========================================================================
   plano-contas.js — Estrutura real do plano de contas + parser do formato
   texto "codigo:DESCRIÇÃO COMPLETA". Monta hierarquia, separa grupo/detalhe
   e aplica o mapeamento de categoria automaticamente.
   ========================================================================= */
(function (global) {
  'use strict';

  // Categorias gerenciais iniciais
  const CATEGORIAS = [
    'Viagens', 'Frota e Transportes', 'Tecnologia', 'Comunicação',
    'Treinamento e Desenvolvimento', 'Serviços de Terceiros e Jurídico',
    'Auditoria e Consultoria', 'Ocupação e Infraestrutura',
    'Eventos e Institucional', 'Seguros', 'Tributos e Taxas',
    'Depreciação e Amortização',
  ];

  // Mapeamento de grupo (5 níveis) -> categoria + natureza padrão + tipo
  const GRUPOS = {
    '7.1.4.1.02': { nome: 'REVERSÃO', categoria: null, natureza: 'Fixo', tipo: 'Despesa' },
    '7.2.2.2.03': { nome: 'CURSOS DIVERSOS', categoria: 'Treinamento e Desenvolvimento', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.04': { nome: 'CUSTOS INFORMÁTICA', categoria: 'Tecnologia', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.05': { nome: 'DESPESAS AUDITORIA', categoria: 'Auditoria e Consultoria', natureza: 'Fixo', tipo: 'Despesa' },
    '7.2.2.2.06': { nome: 'DESPESAS COMUNICAÇÃO', categoria: 'Comunicação', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.07': { nome: 'DESPESAS FILANTRÓPICAS', categoria: 'Eventos e Institucional', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.08': { nome: 'ALUGUÉIS E ARRENDAMENTOS', categoria: 'Ocupação e Infraestrutura', natureza: 'Fixo', tipo: 'Despesa' },
    '7.2.2.2.09': { nome: 'DESPESAS VIAGENS', categoria: 'Viagens', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.11': { nome: 'DESPESAS TRANSPORTES', categoria: 'Frota e Transportes', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.12': { nome: 'DEPRECIAÇÃO DO IMOBILIZADO', categoria: 'Depreciação e Amortização', natureza: 'Fixo', tipo: 'Despesa' },
    '7.2.2.2.14': { nome: 'DESPESAS PUBLICAÇÕES', categoria: 'Comunicação', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.15': { nome: 'SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES', categoria: 'Serviços de Terceiros e Jurídico', natureza: 'Variável', tipo: 'Despesa' },
    '7.2.2.2.17': { nome: 'DESPESAS SEGUROS', categoria: 'Seguros', natureza: 'Fixo', tipo: 'Despesa' },
    '7.2.2.2.18': { nome: 'DESPESAS ESTRUTURAS IMPOSTOS', categoria: 'Tributos e Taxas', natureza: 'Fixo', tipo: 'Despesa' },
  };

  // Nomes amigáveis dos níveis sintéticos superiores (para a árvore)
  const NOMES_SINTETICOS = {
    '7': 'CUSTOS E DESPESAS',
    '7.1': 'RECEITAS E DEDUÇÕES',
    '7.1.4': 'OUTRAS RECEITAS',
    '7.1.4.1': 'REVERSÕES DE PROVISÕES',
    '7.2': 'DESPESAS OPERACIONAIS',
    '7.2.2': 'DESPESAS ADMINISTRATIVAS',
    '7.2.2.2': 'DESPESAS GERAIS',
  };

  // Carga inicial (parcial) — formato texto usado pela empresa.
  // "codigo:DESCRIÇÃO COMPLETA" (uma conta por linha).
  const CARGA_INICIAL_TEXTO = [
    '7.1.4.1.02.05:REVERSÃO - PUBLICAÇÃO BALANÇO',
    '7.2.2.2.03.01:CURSOS DIVERSOS - MBA',
    '7.2.2.2.03.02:CURSOS DIVERSOS - DIVERSOS',
    '7.2.2.2.03.03:CURSOS DIVERSOS - SERVIÇOS PRESTADOS RECRUTAMENTO E SELEÇÃO',
    '7.2.2.2.03.04:CURSOS DIVERSOS - TREINAMENTO DIRETORIA',
    '7.2.2.2.04.02:CUSTOS INFORMÁTICA - CONSULTORIA ASSESSORIA DE INFORMÁTICA',
    '7.2.2.2.04.08:CUSTOS INFORMÁTICA - PROCESSAMENTO E ARMAZENAMENTO DE DADOS',
    '7.2.2.2.04.11:CUSTOS INFORMÁTICA - DESENVOLVIMENTO E MANUTENÇÃO DE SISTEMAS',
    '7.2.2.2.04.12:CUSTOS INFORMÁTICA - LICENÇAS DE USO',
    '7.2.2.2.05.02:DESPESAS AUDITORIA - PROVISÃO AUDITORIA EXTERNA',
    '7.2.2.2.06.01:DESPESAS COMUNICAÇÃO - POSTAIS',
    '7.2.2.2.06.02:DESPESAS COMUNICAÇÃO - TELEMARKETING',
    '7.2.2.2.07.01:DESPESAS FILANTRÓPICAS - CONFRATERNIZAÇÃO',
    '7.2.2.2.07.02:DESPESAS FILANTRÓPICAS - PROMOÇÕES E EVENTOS',
    '7.2.2.2.07.03:DESPESAS FILANTRÓPICAS - PRÊMIOS',
    '7.2.2.2.07.04:DESPESAS FILANTRÓPICAS - ASSINATURAS',
    '7.2.2.2.07.05:DESPESAS FILANTRÓPICAS - LIVROS TÉCNICOS',
    '7.2.2.2.07.06:DESPESAS FILANTRÓPICAS - DOAÇÕES',
    '7.2.2.2.07.07:DESPESAS FILANTRÓPICAS - PATROCÍNIOS',
    '7.2.2.2.07.08:DESPESAS FILANTRÓPICAS - AÇÕES SOCIAIS',
    '7.2.2.2.08.01:ALUGUÉIS E ARRENDAMENTOS - ALUGUÉIS DE IMÓVEIS',
    '7.2.2.2.08.02:ALUGUÉIS E ARRENDAMENTOS - ARRENDAMENTO DE EQUIPAMENTOS',
    '7.2.2.2.09.01:DESPESAS VIAGENS - HOSPEDAGEM',
    '7.2.2.2.09.02:DESPESAS VIAGENS - LOCOMOÇÃO',
    '7.2.2.2.09.03:DESPESAS VIAGENS - REFEIÇÃO',
    '7.2.2.2.09.04:DESPESAS VIAGENS - VIAGENS DE TERCEIROS',
    '7.2.2.2.09.05:DESPESAS VIAGENS - OUTRAS',
    '7.2.2.2.11.02:DESPESAS TRANSPORTES - CONDUÇÃO',
    '7.2.2.2.11.03:DESPESAS TRANSPORTES - ESTACIONAMENTO',
    '7.2.2.2.11.04:DESPESAS TRANSPORTES - FRETES',
    '7.2.2.2.11.05:DESPESAS TRANSPORTES - MANUTENÇÃO DE VEÍCULOS',
    '7.2.2.2.11.06:DESPESAS TRANSPORTES - LICENCIAMENTO',
    '7.2.2.2.11.07:DESPESAS TRANSPORTES - ACESSÓRIOS',
    '7.2.2.2.11.08:DESPESAS TRANSPORTES - PEDÁGIOS',
    '7.2.2.2.11.09:DESPESAS TRANSPORTES - COMBUSTÍVEIS',
    '7.2.2.2.12.01:DEPRECIAÇÃO DO IMOBILIZADO - DEPRECIAÇÃO',
    '7.2.2.2.12.02:DEPRECIAÇÃO DO IMOBILIZADO - AMORTIZAÇÃO',
    '7.2.2.2.12.03:DEPRECIAÇÃO DO IMOBILIZADO - EXAUSTÃO',
    '7.2.2.2.14.01:DESPESAS PUBLICAÇÕES - PUBLICAÇÕES LEGAIS',
    '7.2.2.2.15.01:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - XEROX',
    '7.2.2.2.15.02:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - MICROFILMAGEM',
    '7.2.2.2.15.03:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - PESSOA FÍSICA',
    '7.2.2.2.15.04:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - CONSULTORIA',
    '7.2.2.2.15.05:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - CARTÓRIO',
    '7.2.2.2.15.06:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - ARQUIVO',
    '7.2.2.2.15.07:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - CONSULTORIA TRIBUTÁRIA',
    '7.2.2.2.15.08:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - HONORÁRIOS CONTENCIOSO CÍVEL',
    '7.2.2.2.15.09:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - CONTENCIOSO TRABALHISTA',
    '7.2.2.2.15.10:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - HONORÁRIOS TRIBUTÁRIOS',
    '7.2.2.2.15.11:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - HONORÁRIOS CONSULTORIA CÍVEL',
    '7.2.2.2.15.12:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - TRADUÇÃO',
    '7.2.2.2.15.16:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - OUTROS',
    '7.2.2.2.15.17:SERVIÇOS TERCEIROS AUDITORIA PUBLICAÇÕES - PROVISÃO SERVIÇOS CONSULTORIA E PROJETOS',
    '7.2.2.2.17.02:DESPESAS SEGUROS - INCÊNDIO',
    '7.2.2.2.17.04:DESPESAS SEGUROS - AUTOMÓVEL',
    '7.2.2.2.18.01:DESPESAS ESTRUTURAS IMPOSTOS - ITR',
    '7.2.2.2.18.02:DESPESAS ESTRUTURAS IMPOSTOS - TAXAS FEDERAIS',
    '7.2.2.2.18.03:DESPESAS ESTRUTURAS IMPOSTOS - IPVA',
    '7.2.2.2.18.04:DESPESAS ESTRUTURAS IMPOSTOS - TAXAS ESTADUAIS',
    '7.2.2.2.18.05:DESPESAS ESTRUTURAS IMPOSTOS - ICMS',
    '7.2.2.2.18.06:DESPESAS ESTRUTURAS IMPOSTOS - IMPOSTO PREDIAL',
  ].join('\n');

  // Overrides de categoria conta a conta (detalhe não combina com o grupo)
  const OVERRIDE_CATEGORIA = {
    '7.2.2.2.03.03': 'Serviços de Terceiros e Jurídico', // Recrutamento e Seleção
  };

  // Contas marcadas como Investimento (CAPEX)
  const CONTAS_INVESTIMENTO = new Set([
    '7.2.2.2.04.11', // Desenvolvimento e Manutenção de Sistemas
    '7.2.2.2.04.12', // Licenças de Uso
  ]);

  function normaliza(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  function grupoPrefixo(codigo) {
    const p = codigo.split('.');
    return p.slice(0, 5).join('.');
  }

  function ehProvisao(desc) { return /PROVIS[ÃA]O/i.test(desc); }
  function ehReversao(desc) { return /REVERS[ÃA]O/i.test(desc); }

  /** Decide gera_pagamento a partir do código e da descrição */
  function geraPagamento(codigo, descCompleta) {
    if (codigo.startsWith('7.2.2.2.12')) return false;   // depreciação/amortização
    if (ehReversao(descCompleta)) return false;          // reversões
    if (codigo.startsWith('7.1.4')) return false;         // reversões de provisões
    return true;
  }

  /**
   * Interpreta uma lista de linhas "codigo:DESCRIÇÃO COMPLETA" e devolve
   * a lista completa de contas (analíticas + sintéticas de grupo/nível),
   * já com grupo/detalhe separados e categoria mapeada.
   */
  function parseTexto(texto) {
    const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const mapa = new Map(); // codigo -> conta
    let seq = 1;

    function garanteSintetica(codigo) {
      if (mapa.has(codigo)) return mapa.get(codigo);
      const partes = codigo.split('.');
      const nivel = partes.length;
      const pai = nivel > 1 ? partes.slice(0, -1).join('.') : null;
      if (pai) garanteSintetica(pai);
      const nome = (nivel === 5 && GRUPOS[codigo]) ? GRUPOS[codigo].nome
                 : (NOMES_SINTETICOS[codigo] || 'GRUPO ' + codigo);
      const g = GRUPOS[codigo];
      const conta = {
        id: seq++, codigo,
        descricao_completa: nome,
        grupo_codigo: codigo, grupo_nome: nome,
        detalhe: '', categoria_id: g ? g.categoria : null,
        conta_pai_id: pai, nivel,
        aceita_lancamento: false,
        gera_pagamento: false,
        tipo: g ? g.tipo : 'Despesa',
        natureza: g ? g.natureza : 'Fixo',
        ativa: true, provisao: false, id_externo: null,
        sintetica: true,
      };
      mapa.set(codigo, conta);
      return conta;
    }

    linhas.forEach(linha => {
      const idx = linha.indexOf(':');
      if (idx < 0) return;
      const codigo = linha.slice(0, idx).trim();
      const descCompleta = linha.slice(idx + 1).trim();
      const partes = codigo.split('.');
      const nivel = partes.length;

      // separa "GRUPO - DETALHE"
      let grupoNome = descCompleta, detalhe = '';
      const sep = descCompleta.indexOf(' - ');
      if (sep >= 0) {
        grupoNome = descCompleta.slice(0, sep).trim();
        detalhe = descCompleta.slice(sep + 3).trim();
      }
      const prefixoGrupo = grupoPrefixo(codigo);
      const grupoMeta = GRUPOS[prefixoGrupo];

      // garante toda a cadeia sintética até o grupo (5 níveis)
      if (nivel >= 5) garanteSintetica(prefixoGrupo);
      else if (nivel > 1) garanteSintetica(partes.slice(0, -1).join('.'));

      let categoria = grupoMeta ? grupoMeta.categoria : null;
      if (OVERRIDE_CATEGORIA[codigo]) categoria = OVERRIDE_CATEGORIA[codigo];

      const analitica = nivel === 6;
      const conta = {
        id: seq++, codigo,
        descricao_completa: descCompleta,
        grupo_codigo: prefixoGrupo,
        grupo_nome: grupoMeta ? grupoMeta.nome : grupoNome,
        detalhe: detalhe || grupoNome,
        categoria_id: analitica ? categoria : (grupoMeta ? grupoMeta.categoria : null),
        conta_pai_id: nivel > 1 ? partes.slice(0, -1).join('.') : null,
        nivel,
        aceita_lancamento: analitica,
        gera_pagamento: analitica ? geraPagamento(codigo, descCompleta) : false,
        tipo: CONTAS_INVESTIMENTO.has(codigo) ? 'Investimento' : (grupoMeta ? grupoMeta.tipo : 'Despesa'),
        natureza: grupoMeta ? grupoMeta.natureza : 'Fixo',
        ativa: true,
        provisao: ehProvisao(descCompleta),
        id_externo: null,
        sintetica: !analitica,
      };
      mapa.set(codigo, conta);
    });

    // reindexa conta_pai_id de código para id numérico e ordena
    const contas = Array.from(mapa.values());
    contas.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    contas.forEach((c, i) => { c.id = i + 1; });
    const porCodigo = new Map(contas.map(c => [c.codigo, c]));
    contas.forEach(c => {
      c.paiCodigo = c.conta_pai_id;
      c.conta_pai_id = c.paiCodigo ? (porCodigo.get(c.paiCodigo) || {}).id || null : null;
    });

    return { contas, porCodigo };
  }

  global.PlanoContas = {
    CATEGORIAS, GRUPOS, NOMES_SINTETICOS,
    CARGA_INICIAL_TEXTO, OVERRIDE_CATEGORIA, CONTAS_INVESTIMENTO,
    parseTexto, geraPagamento, ehProvisao, ehReversao,
    normaliza, grupoPrefixo,
  };
})(window);
