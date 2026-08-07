/* =========================================================================
   seed.js — Geração de dados fictícios coerentes (padrão brasileiro).
   O plano de contas usa a estrutura REAL (PlanoContas). Demais dados são
   fictícios porém plausíveis, com cenários plantados para a demonstração.
   Reference "hoje" = 2026-08-07.
   ========================================================================= */
(function (global) {
  'use strict';

  const HOJE = '2026-08-07';
  const ANO = 2026;
  const MES_ATUAL = 8;

  // PRNG determinístico (mulberry32) para dados reprodutíveis
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = mulberry32(20260807);
  const R = {
    f: () => rnd(),
    int: (a, b) => Math.floor(rnd() * (b - a + 1)) + a,
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    money: (a, b) => Math.round((rnd() * (b - a) + a) / 10) * 10,
    chance: (p) => rnd() < p,
  };

  function iso(ano, mes, dia) {
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  function isoHora(ano, mes, dia, h, mi) {
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00`;
  }

  // ---- Departamentos (8) ----
  const DEPARTAMENTOS = [
    { id: 1, nome: 'Tecnologia da Informação', diretoria: 'Diretoria de Operações', gestor_nome: 'Ricardo Almeida', gestor_email: 'ricardo.almeida@empresa.com.br' },
    { id: 2, nome: 'Financeiro', diretoria: 'Diretoria Financeira', gestor_nome: 'Fernanda Costa', gestor_email: 'fernanda.costa@empresa.com.br' },
    { id: 3, nome: 'Recursos Humanos', diretoria: 'Diretoria de Gente e Gestão', gestor_nome: 'Patrícia Ramos', gestor_email: 'patricia.ramos@empresa.com.br' },
    { id: 4, nome: 'Jurídico', diretoria: 'Diretoria Jurídica', gestor_nome: 'Marcelo Tavares', gestor_email: 'marcelo.tavares@empresa.com.br' },
    { id: 5, nome: 'Comercial', diretoria: 'Diretoria Comercial', gestor_nome: 'André Siqueira', gestor_email: 'andre.siqueira@empresa.com.br' },
    { id: 6, nome: 'Marketing', diretoria: 'Diretoria Comercial', gestor_nome: 'Juliana Prado', gestor_email: 'juliana.prado@empresa.com.br' },
    { id: 7, nome: 'Operações e Logística', diretoria: 'Diretoria de Operações', gestor_nome: 'Roberto Nunes', gestor_email: 'roberto.nunes@empresa.com.br' },
    { id: 8, nome: 'Controladoria', diretoria: 'Diretoria Financeira', gestor_nome: 'Camila Duarte', gestor_email: 'camila.duarte@empresa.com.br' },
  ];

  // ---- Centros de custo (14; TI/RH/Jurídico/Comercial/Operações com >1) ----
  const CENTROS = [
    { id: 1,  codigo: 'CC-1010', nome: 'TI - Infraestrutura', departamento_id: 1 },
    { id: 2,  codigo: 'CC-1011', nome: 'TI - Sistemas', departamento_id: 1 },
    { id: 3,  codigo: 'CC-2020', nome: 'Financeiro Corporativo', departamento_id: 2 },
    { id: 4,  codigo: 'CC-3030', nome: 'RH Corporativo', departamento_id: 3 },
    { id: 5,  codigo: 'CC-3031', nome: 'Recrutamento e Seleção', departamento_id: 3 },
    { id: 6,  codigo: 'CC-4040', nome: 'Jurídico Contencioso', departamento_id: 4 },
    { id: 7,  codigo: 'CC-4041', nome: 'Jurídico Consultivo', departamento_id: 4 },
    { id: 8,  codigo: 'CC-5050', nome: 'Comercial SP', departamento_id: 5 },
    { id: 9,  codigo: 'CC-5051', nome: 'Comercial RJ', departamento_id: 5 },
    { id: 10, codigo: 'CC-5052', nome: 'Comercial Sul', departamento_id: 5 },
    { id: 11, codigo: 'CC-6060', nome: 'Marketing', departamento_id: 6 },
    { id: 12, codigo: 'CC-7070', nome: 'Logística', departamento_id: 7 },
    { id: 13, codigo: 'CC-7071', nome: 'Facilities', departamento_id: 7 },
    { id: 14, codigo: 'CC-8080', nome: 'Controladoria', departamento_id: 8 },
  ];
  CENTROS.forEach(c => { c.id_externo = null; });

  // Perfil de grupos usados por cada CC (grupos de 5 níveis)
  const PERFIL_CC = {
    1:  ['7.2.2.2.04', '7.2.2.2.09', '7.2.2.2.03', '7.2.2.2.15', '7.2.2.2.12'], // TI Infra
    2:  ['7.2.2.2.04', '7.2.2.2.09', '7.2.2.2.03', '7.2.2.2.15'],               // TI Sistemas
    3:  ['7.2.2.2.05', '7.2.2.2.15', '7.2.2.2.18', '7.2.2.2.09'],               // Financeiro
    4:  ['7.2.2.2.03', '7.2.2.2.07', '7.2.2.2.06', '7.2.2.2.09'],               // RH
    5:  ['7.2.2.2.03', '7.2.2.2.09', '7.2.2.2.15'],                              // R&S
    6:  ['7.2.2.2.15', '7.2.2.2.09', '7.2.2.2.14'],                              // Jur Contencioso
    7:  ['7.2.2.2.15', '7.2.2.2.09', '7.2.2.2.14', '7.2.2.2.03'],               // Jur Consultivo
    8:  ['7.2.2.2.09', '7.2.2.2.11', '7.2.2.2.07', '7.2.2.2.06'],               // Comercial SP
    9:  ['7.2.2.2.09', '7.2.2.2.11', '7.2.2.2.07'],                              // Comercial RJ
    10: ['7.2.2.2.09', '7.2.2.2.11', '7.2.2.2.07'],                              // Comercial Sul
    11: ['7.2.2.2.07', '7.2.2.2.06', '7.2.2.2.14', '7.2.2.2.09'],               // Marketing
    12: ['7.2.2.2.11', '7.2.2.2.08', '7.2.2.2.04', '7.2.2.2.09'],               // Logística
    13: ['7.2.2.2.08', '7.2.2.2.17', '7.2.2.2.11', '7.2.2.2.12'],               // Facilities
    14: ['7.2.2.2.05', '7.2.2.2.15', '7.2.2.2.18', '7.2.2.2.12'],               // Controladoria
  };

  // Escala anual de orçamento por categoria (mín, máx por conta analítica)
  const ESCALA = {
    'Viagens':                       [24000, 140000],
    'Frota e Transportes':           [18000, 90000],
    'Tecnologia':                    [120000, 900000],
    'Comunicação':                   [12000, 70000],
    'Treinamento e Desenvolvimento': [30000, 220000],
    'Serviços de Terceiros e Jurídico': [80000, 1200000],
    'Auditoria e Consultoria':       [150000, 420000],
    'Ocupação e Infraestrutura':     [180000, 720000],
    'Eventos e Institucional':       [20000, 160000],
    'Seguros':                       [40000, 120000],
    'Tributos e Taxas':              [30000, 200000],
    'Depreciação e Amortização':     [120000, 480000],
  };

  // Sazonalidade mensal (peso relativo) — viagens concentra Q1
  const SAZON_PADRAO = [1, 1, 1.1, 1, 1, 1.05, 1, 1, 1.1, 1, 1.05, 1.2];
  const SAZON_VIAGENS = [1.7, 1.8, 1.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.9, 0.9, 1.0, 1.1];

  // Fornecedores por categoria
  const FORN = {
    'Viagens': [
      ['Hotel Faria Lima Plaza', '01.234.567/0001-10'],
      ['Latam Linhas Aéreas', '02.012.862/0001-60'],
      ['Azul Viagens Corporativo', '09.296.295/0001-60'],
      ['99 Táxi Empresas', '18.727.053/0001-74'],
      ['Restaurante Executivo Paulista', '03.456.789/0001-22'],
      ['Ibis Hotéis', '04.567.890/0001-33'],
    ],
    'Frota e Transportes': [
      ['Localiza Frotas', '16.670.085/0001-55'],
      ['Posto Ipiranga Rede', '05.678.901/0001-44'],
      ['Auto Center Bosch', '06.789.012/0001-55'],
      ['Estapar Estacionamentos', '07.890.123/0001-66'],
      ['Transportadora Rodoexpress', '08.901.234/0001-77'],
    ],
    'Tecnologia': [
      ['TOTVS S.A.', '53.113.791/0001-22'],
      ['Microsoft do Brasil', '43.447.044/0001-10'],
      ['Accenture Consultoria', '10.123.456/0001-88'],
      ['AWS Serviços de Nuvem', '23.412.247/0001-40'],
      ['SAP Brasil', '11.234.567/0001-99'],
      ['Softtek Sistemas', '12.345.678/0001-00'],
      ['DataCenter Ativa TI', '13.456.789/0001-11'],
    ],
    'Comunicação': [
      ['Correios ECT', '34.028.316/0001-03'],
      ['Contact Center Vox', '14.567.890/0001-22'],
      ['Imprensa Oficial SP', '48.066.047/0001-84'],
    ],
    'Treinamento e Desenvolvimento': [
      ['FGV Educação Executiva', '15.678.901/0001-33'],
      ['Insper Instituto de Ensino', '61.658.387/0001-00'],
      ['Alura Cursos de Tecnologia', '16.789.012/0001-44'],
      ['Gupy Recrutamento', '17.890.123/0001-55'],
      ['Catho Recrutamento', '18.901.234/0001-66'],
    ],
    'Serviços de Terceiros e Jurídico': [
      ['Marques & Associados Advocacia', '19.012.345/0001-77'],
      ['Pinheiro Neto Advogados', '20.123.456/0001-88'],
      ['Cartório 5º Ofício', '21.234.567/0001-99'],
      ['Tradutec Traduções', '22.345.678/0001-00'],
      ['Deloitte Consultoria Tributária', '49.928.567/0001-11'],
      ['Consultoria Prime Projetos', '23.456.789/0001-11'],
    ],
    'Auditoria e Consultoria': [
      ['KPMG Auditores Independentes', '57.755.217/0001-29'],
      ['EY Auditoria', '61.366.936/0001-25'],
      ['PwC Brasil', '61.562.112/0001-20'],
    ],
    'Ocupação e Infraestrutura': [
      ['Iguatemi Administração', '51.218.147/0001-93'],
      ['WeWork Escritórios', '24.567.890/0001-22'],
      ['Predial Faria Lima Ltda', '25.678.901/0001-33'],
    ],
    'Eventos e Institucional': [
      ['Eventos Premium Produções', '26.789.012/0001-44'],
      ['Gráfica Brindes & Cia', '27.890.123/0001-55'],
      ['Instituto Ação Social', '28.901.234/0001-66'],
      ['Editora Saraiva', '29.012.345/0001-77'],
    ],
    'Seguros': [
      ['Porto Seguro Cia de Seguros', '61.198.164/0001-60'],
      ['Bradesco Seguros', '92.682.038/0001-00'],
      ['Allianz Seguros', '61.573.796/0001-66'],
    ],
    'Tributos e Taxas': [
      ['Prefeitura Municipal de São Paulo', '46.395.000/0001-39'],
      ['Secretaria da Fazenda Estadual', '46.377.222/0001-29'],
      ['Receita Federal do Brasil', '00.394.460/0001-41'],
    ],
    'Depreciação e Amortização': [
      ['Lançamento Contábil', '—'],
    ],
  };

  function fornPara(cat) { return FORN[cat] || FORN['Serviços de Terceiros e Jurídico']; }

  function descPara(cat, detalhe) {
    const t = {
      'Viagens': ['Hospedagem equipe', 'Passagens aéreas', 'Deslocamento executivo', 'Refeições em viagem', 'Diárias de viagem'],
      'Frota e Transportes': ['Locação de veículos', 'Abastecimento da frota', 'Manutenção preventiva', 'Estacionamento mensal', 'Frete de materiais'],
      'Tecnologia': ['Licenciamento de software', 'Serviços de nuvem', 'Consultoria de sistemas', 'Sustentação de aplicação', 'Processamento de dados'],
      'Comunicação': ['Envio postal', 'Serviço de telemarketing', 'Publicação institucional'],
      'Treinamento e Desenvolvimento': ['Programa de capacitação', 'MBA executivo', 'Processo seletivo', 'Treinamento de liderança'],
      'Serviços de Terceiros e Jurídico': ['Honorários advocatícios', 'Consultoria de projetos', 'Serviços cartorários', 'Tradução juramentada', 'Assessoria tributária'],
      'Auditoria e Consultoria': ['Auditoria externa das demonstrações', 'Revisão de controles internos'],
      'Ocupação e Infraestrutura': ['Aluguel mensal do escritório', 'Arrendamento de equipamentos'],
      'Eventos e Institucional': ['Convenção anual', 'Confraternização de equipe', 'Brindes institucionais', 'Patrocínio a evento'],
      'Seguros': ['Apólice de seguro predial', 'Seguro de frota'],
      'Tributos e Taxas': ['Recolhimento de tributos', 'Taxa de licenciamento', 'Imposto predial'],
      'Depreciação e Amortização': ['Depreciação mensal', 'Amortização de intangível'],
    };
    const arr = t[cat] || ['Prestação de serviços'];
    return R.pick(arr) + (detalhe ? ' — ' + detalhe.toLowerCase() : '');
  }

  // Solicitantes fictícios por departamento
  const SOLICITANTES = ['Bruno Lima', 'Carla Souza', 'Diego Martins', 'Elaine Rocha', 'Felipe Cardoso', 'Gabriela Dias', 'Henrique Melo', 'Isabela Freitas'];

  // Cenários plantados: ratio de consumo alvo (realizado/orçado anual) por CC
  const RATIO_CC = {
    2:  1.18, // TI Sistemas — ESTOURO (projeto informática não previsto)
    6:  1.09, // Jurídico Contencioso — ESTOURO (honorários/escritório de advocacia)
    1:  0.88, // TI Infra — atenção 80-99%
    8:  0.92, // Comercial SP — atenção (pico viagens Q1)
    4:  0.84, // RH — atenção
    3:  0.58, 5: 0.62, 7: 0.55, 9: 0.66, 10: 0.49,
    11: 0.71, 12: 0.63, 13: 0.68, 14: 0.6,
  };
  // Contas onde o estouro se concentra (não espalhado)
  const CONTA_CONCENTRA = {
    2: '7.2.2.2.04.11', // Desenvolvimento e Manutenção de Sistemas
    6: '7.2.2.2.15.08', // Honorários Contencioso Cível (escritório Marques & Associados)
    8: '7.2.2.2.09.01', // Hospedagem (viagens Q1)
  };

  let build = null;

  function gerar(planoContas) {
    rnd = mulberry32(20260807);
    const { contas, porCodigo } = planoContas;
    const analiticasPag = contas.filter(c => c.aceita_lancamento && c.gera_pagamento && c.ativa);
    const analiticasNaoPag = contas.filter(c => c.aceita_lancamento && !c.gera_pagamento);

    const orcamento = [];
    const solicitacoes = [];
    const aprovacoes = [];
    const tokens = [];
    const notificacoes = [];
    const lancamentos = []; // realizado de contas que não geram pagamento
    let orcSeq = 1, solSeq = 1, aprSeq = 1, tokSeq = 1, notSeq = 1, lanSeq = 1;
    let numeroSol = 1000;

    // ---------- Orçamento + Realizado (solicitações aprovadas/pagas) ----------
    // Abordagem por "pool": define-se o orçamento anual por conta e, para o
    // centro de custo, um pool de realizado = ratio * orçamento total. O pool é
    // distribuído entre as contas ATIVAS (com gasto), concentrando o estouro na
    // conta marcada. Assim o % de consumo do CC bate exatamente com o cenário.
    CENTROS.forEach(cc => {
      const grupos = PERFIL_CC[cc.id] || [];
      const contasCC = analiticasPag.filter(c => grupos.includes(c.grupo_codigo));
      if (!contasCC.length) return;
      const ratio = RATIO_CC[cc.id] != null ? RATIO_CC[cc.id] : 0.6;
      const contaConc = CONTA_CONCENTRA[cc.id];

      // 1) orçamento anual + mensal por conta
      const info = contasCC.map(conta => {
        const escala = ESCALA[conta.categoria_id] || [30000, 150000];
        const anual = R.money(escala[0], escala[1]);
        const sazon = conta.categoria_id === 'Viagens' ? SAZON_VIAGENS : SAZON_PADRAO;
        const somaSazon = sazon.reduce((a, b) => a + b, 0);
        for (let m = 1; m <= 12; m++) {
          const v = Math.round((anual * sazon[m - 1] / somaSazon) / 10) * 10;
          orcamento.push({ id: orcSeq++, ano: ANO, mes: m, centro_custo_id: cc.id, conta_contabil_id: conta.id, valor_orcado: v, id_externo: null });
        }
        return { conta, anual, sazon, estavel: conta.categoria_id === 'Seguros' || conta.categoria_id === 'Ocupação e Infraestrutura' };
      });
      const totalBudget = info.reduce((a, x) => a + x.anual, 0);

      // 2) contas ativas (com gasto). Concentrada e estáveis sempre ativas.
      //    As inativas ficam com orçado > 0 e realizado 0 (insight de previsão
      //    que não se concretizou).
      const ativos = info.filter(x => {
        if (contaConc && x.conta.codigo === contaConc) return true;
        if (x.estavel) return true;
        return R.chance(0.44);
      });

      // 3) pool = ratio * orçamento total, distribuído integralmente entre as
      //    contas ativas (o % de consumo do CC bate exatamente com o cenário).
      const pool = ratio * totalBudget;
      const pesos = ativos.map(x => {
        const base = x.anual / totalBudget;
        if (contaConc && x.conta.codigo === contaConc) return base * 4.5; // concentra estouro
        if (x.estavel) return base;                                       // estável/previsível
        return base * (0.5 + R.f());
      });
      const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1;

      ativos.forEach((x, i) => {
        const realAcct = Math.round(pool * pesos[i] / somaPesos);
        if (realAcct < 500) return;
        gerarFaturas(x.conta, cc, realAcct, x.sazon, contaConc);
      });
    });

    // divide um valor realizado de uma conta em faturas plausíveis
    function gerarFaturas(conta, cc, total, sazon, contaConc) {
      const esc = faturaEscala(conta.categoria_id);
      const alvoTicket = (esc[0] + esc[1]) / 2;
      const cap = capFaturas(conta.categoria_id);
      let n = Math.max(1, Math.min(cap, Math.round(total / alvoTicket)));
      const forns = fornPara(conta.categoria_id);
      // concentração de fornecedor: apenas na conta marcada do CC (escritório de advocacia)
      const fornFixo = (contaConc && conta.codigo === contaConc && cc.id === 6) ? forns[0] : null;
      const q1 = cc.id === 8 && conta.categoria_id === 'Viagens';
      let restante = total;
      for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        let val = last ? restante : Math.round(total / n * (0.6 + R.f() * 0.8) / 10) * 10;
        if (val > restante || val < 100) val = restante;
        restante -= val;
        const mes = mesPorSazon(sazon, q1);
        const forn = fornFixo && R.chance(0.85) ? fornFixo : R.pick(forns);
        const pago = R.chance(0.72);
        const s = mkSol(conta, cc, val, mes, R.int(2, 27), forn, pago ? 'Paga' : 'Aprovada');
        solicitacoes.push(s);
        registrarAprovacoesHistoricas(s, cc, aprovacoes, () => aprSeq++);
        if (restante <= 0) break;
      }
    }

    // ---------- Realizado de contas que não geram pagamento (lançamento) ----------
    CENTROS.forEach(cc => {
      const grupos = PERFIL_CC[cc.id] || [];
      analiticasNaoPag.filter(c => grupos.includes(c.grupo_codigo)).forEach(conta => {
        const anual = R.money(120000, 360000);
        for (let m = 1; m <= 12; m++) {
          const v = Math.round(anual / 12 / 10) * 10;
          orcamento.push({ id: orcSeq++, ano: ANO, mes: m, centro_custo_id: cc.id, conta_contabil_id: conta.id, valor_orcado: v, id_externo: null });
          if (m <= MES_ATUAL) {
            lancamentos.push({ id: lanSeq++, ano: ANO, mes: m, centro_custo_id: cc.id, conta_contabil_id: conta.id, valor: Math.round(v * (0.95 + R.f() * 0.1)), origem: 'ERP - lançamento contábil' });
          }
        }
      });
    });

    // ---------- Solicitações PENDENTES (comprometido) — 25 em vários níveis ----------
    const pendentesAlvo = [
      // valor-alvo por faixa de alçada e flags
      { faixa: [1500, 4800], n: 6 },     // nível 1 (gestor)
      { faixa: [6000, 48000], n: 9 },    // nível 2
      { faixa: [55000, 190000], n: 6 },  // nível 3
      { faixa: [210000, 480000], n: 4 }, // nível 4 (CFO)
    ];
    const pendentes = [];
    pendentesAlvo.forEach(grp => {
      for (let i = 0; i < grp.n; i++) {
        const cc = R.pick(CENTROS);
        const grupos = PERFIL_CC[cc.id] || [];
        const contasCC = analiticasPag.filter(c => grupos.includes(c.grupo_codigo));
        if (!contasCC.length) { i--; continue; }
        const conta = R.pick(contasCC);
        const val = R.money(grp.faixa[0], grp.faixa[1]);
        // datas recentes; alguns parados > 3 dias úteis
        const parado = R.chance(0.4);
        const diasAtras = parado ? R.int(4, 12) : R.int(0, 2);
        const dsol = subtraiDias(HOJE, diasAtras);
        const s = mkSol(conta, cc, val, dsol.mes, dsol.dia, R.pick(fornPara(conta.categoria_id)), 'PENDENTE');
        s.data_solicitacao = iso(dsol.ano, dsol.mes, dsol.dia);
        s.data_vencimento = addDiasIso(s.data_solicitacao, R.int(10, 40));
        pendentes.push(s);
        solicitacoes.push(s);
      }
    });
    // define nível/status de cada pendente conforme alçada + estouro
    pendentes.forEach(s => definirStatusPendente(s, porCodigo, orcamento, solicitacoes));

    // algumas reprovadas e em revisão para histórico
    for (let i = 0; i < 6; i++) {
      const cc = R.pick(CENTROS);
      const grupos = PERFIL_CC[cc.id] || [];
      const contasCC = analiticasPag.filter(c => grupos.includes(c.grupo_codigo));
      if (!contasCC.length) continue;
      const conta = R.pick(contasCC);
      const val = R.money(3000, 60000);
      const mes = R.int(3, MES_ATUAL);
      const s = mkSol(conta, cc, val, mes, R.int(2, 26), R.pick(fornPara(conta.categoria_id)), R.chance(0.5) ? 'Reprovada' : 'Em revisão');
      solicitacoes.push(s);
    }

    // ---------- Provisões (30; 4 vencendo em 30 dias) ----------
    const provisoes = gerarProvisoes(contas, porCodigo, () => numeroSol);
    // vincular algumas solicitações pendentes a provisões abertas do mesmo CC
    pendentes.forEach(s => {
      const conta = contasPorId(contas, s.conta_contabil_id);
      if (conta && conta.provisao) {
        const prov = provisoes.find(p => p.centro_custo_id === s.centro_custo_id && p.status !== 'consumida' && p.status !== 'cancelada');
        if (prov) s.provisao_id = prov.id;
      }
    });

    // ---------- Numeração sequencial das solicitações ----------
    solicitacoes.sort((a, b) => (a.data_solicitacao < b.data_solicitacao ? -1 : 1));
    solicitacoes.forEach(s => { s.id = solSeq++; s.numero = 'SOL-' + ANO + '-' + String(numeroSol++).padStart(5, '0'); });
    // backfill de solicitacao_id nas entidades que referenciam o objeto
    aprovacoes.forEach(a => { if (a._sol) a.solicitacao_id = a._sol.id; });
    tokens.forEach(t => { if (t._sol) t.solicitacao_id = t._sol.id; });
    notificacoes.forEach(n => { if (n._sol) n.solicitacao_id = n._sol.id; });

    // ---------- Central de notificações + Caixa de entrada simulada ----------
    const emails = gerarEmails(solicitacoes, pendentes, CENTROS, DEPARTAMENTOS, porCodigo, tokens, notificacoes, () => tokSeq++, () => notSeq++);

    // ---------- Planos de ação (12) ----------
    const planos = gerarPlanos(contas, porCodigo);

    return {
      HOJE, ANO, MES_ATUAL,
      departamentos: DEPARTAMENTOS,
      centros_custo: CENTROS,
      categorias: PlanoContas.CATEGORIAS.map((n, i) => ({ id: i + 1, nome: n })),
      contas_contabeis: contas,
      orcamento, solicitacoes, aprovacoes, tokens_aprovacao: tokens,
      provisoes, lancamentos,
      notificacoes, emails,
      planos_acao: planos.planos, planos_acao_andamentos: planos.andamentos,
    };

    // ---------- helpers internos ----------
    function mkSol(conta, cc, valor, mes, dia, forn, statusHint) {
      const s = {
        id: 0, numero: '',
        fornecedor: forn[0], cnpj: forn[1],
        descricao: descPara(conta.categoria_id, conta.detalhe),
        valor,
        centro_custo_id: cc.id, conta_contabil_id: conta.id,
        provisao_id: null,
        solicitante: R.pick(SOLICITANTES),
        data_solicitacao: iso(ANO, mes, Math.min(dia, 28)),
        data_vencimento: addDiasIso(iso(ANO, mes, Math.min(dia, 28)), R.int(15, 45)),
        urgencia: R.pick(['Normal', 'Normal', 'Normal', 'Alta', 'Baixa']),
        status: statusHint === 'PENDENTE' ? 'Pendente Nível 1' : statusHint,
        capex: conta.tipo === 'Investimento',
        categoria_id: conta.categoria_id,
        _mes: mes,
      };
      return s;
    }
  }

  function faturaEscala(cat) {
    switch (cat) {
      case 'Viagens': return [200, 3200];
      case 'Frota e Transportes': return [300, 4500];
      case 'Comunicação': return [400, 6000];
      case 'Tecnologia': return [4000, 90000];
      case 'Serviços de Terceiros e Jurídico': return [6000, 140000];
      case 'Auditoria e Consultoria': return [30000, 120000];
      case 'Treinamento e Desenvolvimento': return [1500, 35000];
      case 'Ocupação e Infraestrutura': return [15000, 55000];
      case 'Eventos e Institucional': return [2000, 45000];
      case 'Seguros': return [8000, 40000];
      case 'Tributos e Taxas': return [2000, 30000];
      default: return [1500, 30000];
    }
  }

  function capFaturas(cat) {
    switch (cat) {
      case 'Viagens': return 4;
      case 'Frota e Transportes': return 3;
      case 'Comunicação': return 2;
      case 'Eventos e Institucional': return 2;
      case 'Tecnologia': return 3;
      case 'Serviços de Terceiros e Jurídico': return 3;
      case 'Auditoria e Consultoria': return 1;
      case 'Treinamento e Desenvolvimento': return 2;
      default: return 2;
    }
  }

  function mesPorSazon(sazon, forcaQ1) {
    if (forcaQ1 && Math.random === undefined) {}
    // sorteia mês 1..MES_ATUAL ponderado pela sazonalidade
    const pesos = [];
    let tot = 0;
    for (let m = 1; m <= MES_ATUAL; m++) { const w = sazon[m - 1]; pesos.push(w); tot += w; }
    let r = rnd() * tot;
    for (let m = 1; m <= MES_ATUAL; m++) { r -= pesos[m - 1]; if (r <= 0) return m; }
    return MES_ATUAL;
  }

  function subtraiDias(isoStr, dias) {
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - dias);
    return { ano: dt.getFullYear(), mes: dt.getMonth() + 1, dia: dt.getDate() };
  }
  function addDiasIso(isoStr, dias) {
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  function contasPorId(contas, id) { return contas.find(c => c.id === id); }

  function registrarAprovacoesHistoricas(s, cc, aprovacoes, next) {
    // registra 1-3 aprovações conforme o valor
    const niveis = niveisPorValor(s.valor);
    const dep = DEPARTAMENTOS.find(d => d.id === cc.departamento_id);
    niveis.forEach((nv, i) => {
      aprovacoes.push({
        id: next(), _sol: s, solicitacao_id: 0,
        aprovador: nv.aprovador(dep), nivel: i + 1,
        decisao: 'Aprovada', comentario: i === 0 ? 'Aprovado conforme orçamento.' : 'De acordo.',
        canal: R.chance(0.55) ? 'Email' : 'Plataforma',
        data_hora: isoHora(ANO, s._mes, Math.min(R.int(2, 27), 28), R.int(8, 18), R.int(0, 59)),
      });
    });
  }

  function niveisPorValor(v) {
    const g = { aprovador: (dep) => dep.gestor_nome };
    const ger = { aprovador: () => 'Gerência da Diretoria' };
    const dir = { aprovador: (dep) => dep.diretoria };
    const cfo = { aprovador: () => 'CFO — Eduardo Mendes' };
    if (v <= 5000) return [g];
    if (v <= 50000) return [g, ger];
    if (v <= 200000) return [g, ger, dir];
    return [g, ger, dir, cfo];
  }

  function definirStatusPendente(s, porCodigo, orcamento, solicitacoes) {
    // nível pendente = 1 (aguarda primeira alçada). Marca estouro se aplicável.
    s.status = 'Pendente Nível 1';
    s.nivel_atual = 1;
    // niveis_necessarios é calculado sob demanda pelo Store (inclui bump de estouro)
  }

  global.Seed = { gerar, HOJE, ANO, MES_ATUAL, niveisPorValor };

  // ------------------------------------------------------------------ provisões
  function gerarProvisoes(contas, porCodigo, numFn) {
    const provAccounts = contas.filter(c => c.aceita_lancamento && c.provisao);
    const outrasServicos = contas.filter(c => c.aceita_lancamento && c.gera_pagamento &&
      (c.categoria_id === 'Auditoria e Consultoria' || c.categoria_id === 'Serviços de Terceiros e Jurídico'));
    const provisoes = [];
    let id = 1;
    const statusPool = ['aberta', 'aberta', 'parcial', 'parcial', 'consumida', 'cancelada'];
    for (let i = 0; i < 30; i++) {
      const usarProv = provAccounts.length && R.chance(0.5);
      const conta = usarProv ? R.pick(provAccounts) : R.pick(outrasServicos);
      const cc = R.pick(CENTROS.filter(c => (PERFIL_CC[c.id] || []).includes(conta.grupo_codigo)));
      const centro = cc || R.pick(CENTROS);
      const valor = R.money(30000, 350000);
      let status = R.pick(statusPool);
      let consumido = 0;
      if (status === 'consumida') consumido = valor;
      else if (status === 'parcial') consumido = Math.round(valor * (0.2 + R.f() * 0.5));
      else if (status === 'cancelada') consumido = 0;
      // 4 vencendo em 30 dias (ago/set 2026)
      let mesRef;
      if (i < 4) { mesRef = R.chance(0.5) ? '2026-08' : '2026-09'; status = 'aberta'; consumido = Math.round(valor * R.f() * 0.3); }
      else mesRef = `2026-${String(R.int(1, 12)).padStart(2, '0')}`;
      provisoes.push({
        id: id++, centro_custo_id: centro.id, conta_contabil_id: conta.id,
        mes_referencia: mesRef,
        descricao: 'Provisão ' + (conta.detalhe || conta.grupo_nome).toLowerCase() + ' — ' + centro.nome,
        valor_provisionado: valor, valor_consumido: consumido, status,
      });
    }
    return provisoes;
  }

  // ------------------------------------------------------------------ emails
  function gerarEmails(solicitacoes, pendentes, centros, deps, porCodigo, tokens, notificacoes, tokFn, notFn) {
    const emails = [];
    pendentes.forEach(s => {
      const cc = centros.find(c => c.id === s.centro_custo_id);
      const dep = deps.find(d => d.id === cc.departamento_id);
      const token = 'tok_' + Math.abs(hashStr(s.numero + s.valor + 'aprv')).toString(36) + s.id;
      tokens.push({
        id: tokFn(), _sol: s, solicitacao_id: s.id,
        aprovador_email: dep.gestor_email, nivel: 1, token,
        expira_em: addDiasIso(HOJE, 7), usado_em: null, canal: 'Email', ip_origem: null,
        decisao: null,
      });
      emails.push({
        _sol: s,
        destinatario: dep.gestor_email, destinatario_nome: dep.gestor_nome,
        assunto: `Aprovação pendente: ${s.fornecedor} no valor de ${Fmt ? Fmt.moeda(s.valor) : s.valor}`,
        token, status: 'pendente',
        data: s.data_solicitacao,
      });
      notificacoes.push({
        id: notFn(), tipo: 'aprovacao', destinatario: dep.gestor_email, solicitacao_id: s.id,
        assunto: `Aprovação pendente: ${s.fornecedor}`, corpo: 'Solicitação aguardando sua aprovação.',
        data: s.data_solicitacao, status_acao: 'pendente', _sol: s,
      });
    });
    return emails;
  }

  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

  // ------------------------------------------------------------------ planos de ação
  function gerarPlanos(contas, porCodigo) {
    const planos = [];
    const andamentos = [];
    let id = 1, andId = 1;
    const acaoPorTipo = {
      estouro_orcamento: 'Solicitar remanejamento entre centros de custo ou suplementação orçamentária',
      alerta_80: 'Revisar solicitações previstas até o fim do exercício e congelar gastos não essenciais',
      projecao_estouro: 'Reprojetar o consumo dos próximos meses e revisar contratos recorrentes',
      concentracao_fornecedor: 'Abrir cotação com fornecedores alternativos',
      solicitacao_parada: 'Definir aprovador substituto ou delegação de alçada',
      criacao_manual: 'Ação a definir pelo responsável',
    };
    // dist: 5 abertos, 4 em andamento, 2 concluídos, 1 atrasado
    const defs = [
      { cc: 2,  cod: '7.2.2.2.04.11', tipo: 'estouro_orcamento', crit: 'alta', status: 'aberto', impacto: 210000 },
      { cc: 6,  cod: '7.2.2.2.15.08', tipo: 'concentracao_fornecedor', crit: 'alta', status: 'aberto', impacto: 180000 },
      { cc: 8,  cod: '7.2.2.2.09.01', tipo: 'projecao_estouro', crit: 'media', status: 'aberto', impacto: 46000 },
      { cc: 1,  cod: '7.2.2.2.04.02', tipo: 'alerta_80', crit: 'media', status: 'aberto', impacto: 38000 },
      { cc: 4,  cod: '7.2.2.2.03.01', tipo: 'alerta_80', crit: 'baixa', status: 'aberto', impacto: 22000 },
      { cc: 2,  cod: '7.2.2.2.04.12', tipo: 'estouro_orcamento', crit: 'alta', status: 'em_andamento', impacto: 95000 },
      { cc: 6,  cod: '7.2.2.2.15.10', tipo: 'concentracao_fornecedor', crit: 'media', status: 'em_andamento', impacto: 60000 },
      { cc: 8,  cod: '7.2.2.2.09.02', tipo: 'projecao_estouro', crit: 'media', status: 'em_andamento', impacto: 30000 },
      { cc: 1,  cod: '7.2.2.2.09.01', tipo: 'solicitacao_parada', crit: 'baixa', status: 'em_andamento', impacto: 12000 },
      { cc: 3,  cod: '7.2.2.2.05.02', tipo: 'criacao_manual', crit: 'baixa', status: 'concluido', impacto: 0 },
      { cc: 5,  cod: '7.2.2.2.03.03', tipo: 'alerta_80', crit: 'media', status: 'concluido', impacto: 18000 },
      { cc: 6,  cod: '7.2.2.2.15.09', tipo: 'estouro_orcamento', crit: 'alta', status: 'aberto', impacto: 140000, atrasado: true },
    ];
    defs.forEach(def => {
      const conta = porCodigo.get(def.cod);
      const cc = CENTROS.find(c => c.id === def.cc);
      const dep = DEPARTAMENTOS.find(d => d.id === cc.departamento_id);
      const prazoBase = def.atrasado ? subtraiDias(HOJE, R.int(3, 12)) : { ano: 2026, mes: R.int(9, 11), dia: R.int(1, 28) };
      const prazo = iso(prazoBase.ano, prazoBase.mes, Math.min(prazoBase.dia, 28));
      const criadoBase = subtraiDias(HOJE, R.int(10, 60));
      const dataCriacao = iso(criadoBase.ano, criadoBase.mes, Math.min(criadoBase.dia, 28));
      const p = {
        id: id++,
        origem_tipo: def.tipo, origem_ref: cc.codigo + '/' + def.cod,
        centro_custo_id: cc.id, conta_contabil_id: conta ? conta.id : null,
        categoria_id: conta ? conta.categoria_id : null,
        titulo: tituloPlano(def.tipo, cc, conta),
        descricao_problema: descProblema(def.tipo, cc, conta, def.impacto),
        acao_proposta: acaoPorTipo[def.tipo],
        responsavel_nome: dep.gestor_nome, responsavel_email: dep.gestor_email,
        prazo, criticidade: def.crit, valor_impacto: def.impacto,
        status: def.atrasado ? 'aberto' : def.status,
        data_criacao: dataCriacao,
        data_conclusao: def.status === 'concluido' ? addDiasIso(dataCriacao, R.int(5, 20)) : null,
      };
      planos.push(p);
      // andamentos
      const nAnd = def.status === 'aberto' ? R.int(0, 1) : R.int(1, 3);
      for (let k = 0; k < nAnd; k++) {
        andamentos.push({
          id: andId++, plano_id: p.id, autor: dep.gestor_nome,
          comentario: R.pick(['Iniciada tratativa com a área.', 'Cotação solicitada a fornecedores alternativos.', 'Reunião com controladoria agendada.', 'Aguardando retorno do diretor.', 'Remanejamento em análise pelo financeiro.']),
          data_hora: isoHora(criadoBase.ano, criadoBase.mes, Math.min(criadoBase.dia + k + 1, 28), R.int(9, 17), R.int(0, 59)),
        });
      }
      if (def.status === 'concluido') {
        andamentos.push({ id: andId++, plano_id: p.id, autor: dep.gestor_nome, comentario: 'Plano concluído: gasto ajustado e monitorado.', data_hora: isoHora(2026, 7, 20, 15, 0) });
      }
    });
    return { planos, andamentos };
  }

  function tituloPlano(tipo, cc, conta) {
    const m = {
      estouro_orcamento: `Estouro de orçamento em ${cc.nome}`,
      alerta_80: `Atenção 80% do orçamento — ${cc.nome}`,
      projecao_estouro: `Projeção de estouro — ${cc.nome}`,
      concentracao_fornecedor: `Concentração de fornecedor — ${cc.nome}`,
      solicitacao_parada: `Solicitação parada na fila — ${cc.nome}`,
      criacao_manual: `Plano de ação — ${cc.nome}`,
    };
    return m[tipo] || `Plano — ${cc.nome}`;
  }
  function descProblema(tipo, cc, conta, impacto) {
    const c = conta ? `${conta.codigo} ${conta.detalhe}` : '';
    const v = Fmt ? Fmt.moeda(impacto) : impacto;
    switch (tipo) {
      case 'estouro_orcamento': return `O centro de custo ${cc.codigo} (${cc.nome}) ultrapassou o orçado na conta ${c}, com valor excedido de ${v}.`;
      case 'concentracao_fornecedor': return `Concentração de fornecedor acima de 40% do gasto da conta ${c} no ${cc.nome}.`;
      case 'projecao_estouro': return `Pela média mensal de realizado, ${cc.nome} deve ultrapassar o orçado na conta ${c} antes de dezembro.`;
      case 'alerta_80': return `O consumo da conta ${c} no ${cc.nome} atingiu a faixa de atenção (80% a 99%).`;
      case 'solicitacao_parada': return `Existe solicitação parada há mais de 3 dias úteis na fila do ${cc.nome}.`;
      default: return `Acompanhamento do ${cc.nome} na conta ${c}.`;
    }
  }

})(window);
