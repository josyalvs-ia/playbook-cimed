/* =========================================================================
   insights.js — Insights estratégicos por regras sobre o recorte filtrado.
   Gera de 3 a 5 cards priorizados por impacto financeiro, com números reais.
   Cada insight carrega metadados para gerar um plano de ação.
   ========================================================================= */
(function (global) {
  'use strict';

  function gerar(store) {
    const F = global.Fmt;
    const db = store.db;
    const mesAtual = db.MES_ATUAL;
    const insights = [];
    const sols = store.solicitacoesFiltradas();
    const realizadas = sols.filter(s => store.isRealizado(s));

    // ---- 1) Categoria com maior % de consumo ----
    const cats = store.porCategoria().filter(c => c.orcado > 0);
    if (cats.length) {
      const top = cats.slice().sort((a, b) => b.pct - a.pct)[0];
      if (top && top.pct > 0) {
        insights.push({
          icone: '📊', origem_tipo: 'alerta_80',
          titulo: 'Categoria mais consumida',
          texto: `A categoria <b>${top.label}</b> lidera o consumo do recorte com <b>${F.pct(top.pct)}</b> do orçado — realizado de <b>${F.moeda(top.realizado)}</b> sobre <b>${F.moeda(top.orcado)}</b>.`,
          criticidade: top.pct >= 100 ? 'alta' : top.pct >= 80 ? 'media' : 'informativa',
          impacto: top.realizado, ref: { categoria: top.label, valor_impacto: Math.max(0, top.realizado - top.orcado) },
        });
      }
    }

    // ---- 2) Conta com maior estouro absoluto ----
    const contas = store.porConta().filter(c => c.orcado > 0);
    const estouros = contas.map(c => ({ c, excedido: c.realizado - c.orcado })).filter(x => x.excedido > 0).sort((a, b) => b.excedido - a.excedido);
    if (estouros.length) {
      const t = estouros[0].c;
      insights.push({
        icone: '🚩', origem_tipo: 'estouro_orcamento',
        titulo: 'Maior estouro de orçamento',
        texto: `A conta <b class="mono">${t.conta.codigo}</b> <b>${t.conta.detalhe}</b> estourou o orçado em <b>${F.moeda(estouros[0].excedido)}</b> (realizado ${F.moeda(t.realizado)} vs orçado ${F.moeda(t.orcado)}).`,
        criticidade: 'alta',
        impacto: estouros[0].excedido, ref: { conta: t.conta.id, categoria: t.conta.categoria_id, valor_impacto: estouros[0].excedido },
      });
    }

    // ---- 3) Projeção de estouro por CC ----
    const projs = [];
    store.porCentroCusto().forEach(cc => {
      if (cc.orcado <= 0 || cc.realizado <= 0) return;
      const mediaMes = cc.realizado / mesAtual;
      const projDez = mediaMes * 12;
      if (projDez > cc.orcado && cc.realizado < cc.orcado) {
        // mês em que ultrapassa
        const mesEstouro = Math.ceil(cc.orcado / mediaMes);
        projs.push({ cc, projDez, mesEstouro: Math.min(12, mesEstouro), excedProj: projDez - cc.orcado });
      }
    });
    projs.sort((a, b) => b.excedProj - a.excedProj);
    if (projs.length) {
      const p = projs[0];
      insights.push({
        icone: '📈', origem_tipo: 'projecao_estouro',
        titulo: 'Projeção de estouro até dezembro',
        texto: `Mantida a média mensal, o <b>${store.cc(p.cc.key).codigo} ${p.cc.label}</b> deve ultrapassar o orçado em <b>${F.meses[p.mesEstouro - 1]}/${String(db.ANO).slice(2)}</b>, projetando <b>${F.moeda(p.projDez)}</b> até dezembro (${F.moeda(p.excedProj)} acima do orçado).`,
        criticidade: p.mesEstouro <= mesAtual + 2 ? 'alta' : 'media',
        impacto: p.excedProj, ref: { cc: p.cc.key, valor_impacto: p.excedProj },
      });
    }

    // ---- 4) CC com maior variação % vs mês anterior ----
    if (mesAtual > 1) {
      const porCCmes = {};
      realizadas.forEach(s => {
        const k = s.centro_custo_id;
        porCCmes[k] = porCCmes[k] || { atual: 0, ant: 0 };
        if (s._mes === mesAtual) porCCmes[k].atual += s.valor;
        else if (s._mes === mesAtual - 1) porCCmes[k].ant += s.valor;
      });
      let melhor = null;
      Object.keys(porCCmes).forEach(k => {
        const o = porCCmes[k];
        if (o.ant > 3000 && o.atual > 0) { const varp = (o.atual - o.ant) / o.ant * 100; if (!melhor || Math.abs(varp) > Math.abs(melhor.varp)) melhor = { k: +k, varp, o }; }
      });
      if (melhor && Math.abs(melhor.varp) >= 25) {
        const cc = store.cc(melhor.k);
        const subiu = melhor.varp > 0;
        insights.push({
          icone: subiu ? '⚠️' : '🔻', origem_tipo: 'projecao_estouro',
          titulo: 'Variação mensal relevante',
          texto: `O <b>${cc.codigo} ${cc.nome}</b> ${subiu ? 'aumentou' : 'reduziu'} o realizado <b>${F.pct(Math.abs(melhor.varp))}</b> em ${F.mesLongo(mesAtual)} frente a ${F.mesLongo(mesAtual - 1)} (${F.moeda(melhor.o.ant)} → ${F.moeda(melhor.o.atual)}).`,
          criticidade: subiu && Math.abs(melhor.varp) >= 60 ? 'media' : 'informativa',
          impacto: Math.abs(melhor.o.atual - melhor.o.ant), ref: { cc: melhor.k, valor_impacto: Math.abs(melhor.o.atual - melhor.o.ant) },
        });
      }
    }

    // ---- 5) Contas com orçamento e realizado zerado ----
    const zeradas = contas.filter(c => c.orcado > 20000 && c.realizado === 0);
    if (zeradas.length) {
      const somaOrc = zeradas.reduce((a, c) => a + c.orcado, 0);
      const ex = zeradas.slice().sort((a, b) => b.orcado - a.orcado)[0];
      insights.push({
        icone: '💤', origem_tipo: 'criacao_manual',
        titulo: 'Orçamento previsto sem realização',
        texto: `<b>${zeradas.length}</b> conta(s) têm orçamento cadastrado e realizado zerado até ${F.mesLongo(mesAtual)}, somando <b>${F.moeda(somaOrc)}</b> — ex.: <b class="mono">${ex.conta.codigo}</b> ${ex.conta.detalhe} (${F.moeda(ex.orcado)}). Previsão que não se concretizou.`,
        criticidade: 'informativa',
        impacto: somaOrc * 0.2, ref: { conta: ex.conta.id, valor_impacto: 0 },
      });
    }

    // ---- 6) Volume parado na fila + tempo médio ----
    const pend = store.db.solicitacoes.filter(s => store.isComprometido(s));
    if (pend.length) {
      const valPend = pend.reduce((a, s) => a + s.valor, 0);
      const dias = pend.map(s => F.diasUteis(s.data_solicitacao, db.HOJE));
      const mediaDias = dias.reduce((a, b) => a + b, 0) / dias.length;
      const parados = pend.filter((s, i) => dias[i] > 3).length;
      insights.push({
        icone: '⏳', origem_tipo: 'solicitacao_parada',
        titulo: 'Fila de aprovação',
        texto: `Há <b>${pend.length}</b> solicitações pendentes somando <b>${F.moeda(valPend)}</b>, com espera média de <b>${mediaDias.toFixed(1)} dias úteis</b>${parados ? ` e <b>${parados}</b> parada(s) há mais de 3 dias úteis` : ''}.`,
        criticidade: parados >= 3 ? 'media' : 'informativa',
        impacto: valPend * 0.1, ref: { valor_impacto: valPend },
      });
    }

    // ---- 7) Concentração de fornecedor > 30% de uma conta ----
    const porConta = {};
    realizadas.forEach(s => {
      const k = s.conta_contabil_id;
      porConta[k] = porConta[k] || { total: 0, forn: {} };
      porConta[k].total += s.valor;
      porConta[k].forn[s.fornecedor] = (porConta[k].forn[s.fornecedor] || 0) + s.valor;
    });
    let conc = null;
    Object.keys(porConta).forEach(k => {
      const o = porConta[k];
      if (o.total < 50000) return;
      Object.keys(o.forn).forEach(f => {
        const pct = o.forn[f] / o.total * 100;
        if (pct > 30 && (!conc || o.forn[f] > conc.valor)) conc = { conta: store.conta(+k), fornecedor: f, pct, valor: o.forn[f] };
      });
    });
    if (conc) {
      insights.push({
        icone: '🏢', origem_tipo: 'concentracao_fornecedor',
        titulo: 'Concentração de fornecedor',
        texto: `<b>${conc.fornecedor}</b> concentra <b>${F.pct(conc.pct)}</b> do gasto da conta <b class="mono">${conc.conta.codigo}</b> ${conc.conta.detalhe} (${F.moeda(conc.valor)}). Risco de dependência de fornecedor único.`,
        criticidade: conc.pct >= 40 ? 'alta' : 'media',
        impacto: conc.valor, ref: { conta: conc.conta.id, categoria: conc.conta.categoria_id, valor_impacto: conc.valor },
      });
    }

    // priorizar por impacto, garantir 3 a 5
    insights.sort((a, b) => (crit(b.criticidade) - crit(a.criticidade)) || (b.impacto - a.impacto));
    return insights.slice(0, 5);
  }

  function crit(c) { return c === 'alta' ? 3 : c === 'media' ? 2 : 1; }

  global.Insights = { gerar };
})(window);
