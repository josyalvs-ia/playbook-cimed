/* =========================================================================
   view-dashboard.js — Dashboard: big numbers, cards de semáforo por CC,
   gráficos e insights resumidos. Recalcula com os filtros globais.
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt, C = () => global.Charts;

  global.Views = global.Views || {};
  global.Views.dashboard = {
    render(root, s) {
      const ag = s.agregados();

      // ---- big numbers ----
      const sem = UI.semaforo(ag.pct);
      const bn = (lbl, val, foot, cls) => el('div', { class: 'bignum ' + (cls || '') }, [
        el('span', { class: 'stripe' }),
        el('div', { class: 'lbl', text: lbl }),
        el('div', { class: 'val', text: val }),
        foot ? el('div', { class: 'foot', html: foot }) : null,
      ]);
      root.appendChild(el('div', { class: 'bignums' }, [
        bn('Orçado Anual', F().moedaCurta(ag.orcado), F().moeda(ag.orcado)),
        bn('Realizado', F().moedaCurta(ag.realizado), F().moeda(ag.realizado)),
        bn('Comprometido', F().moedaCurta(ag.comprometido), ag.pendQtd + ' pendentes de aprovação'),
        bn('Saldo Disponível', F().moedaCurta(ag.saldo), F().moeda(ag.saldo), ag.saldo < 0 ? 'v-vermelho' : ''),
        bn('% de Consumo', F().pct(ag.pct), 'Realizado / Orçado', 'v-' + sem),
        bn('Pendentes de Aprovação', String(ag.pendQtd), F().moeda(ag.pendVal), 'v-amarelo'),
      ]));

      // ---- cards por centro de custo (semáforo) ----
      const ccs = s.porCentroCusto().filter(c => c.orcado > 0);
      root.appendChild(el('div', { class: 'section-title' }, [el('span', { text: 'Centros de Custo' }), el('span', { class: 'badge-count', text: ccs.length })]));
      const grid = el('div', { class: 'cc-grid' });
      ccs.forEach(cc => grid.appendChild(this._ccCard(cc, s)));
      root.appendChild(grid);

      // ---- insights resumidos ----
      const ins = global.Insights.gerar(s);
      if (ins.length) {
        root.appendChild(el('div', { class: 'section-title' }, [el('span', { text: 'Insights do recorte' }), el('a', { href: '#/insights', class: 'btn btn-sm btn-ghost', text: 'Ver todos →' })]));
        const ig = el('div', { class: 'insights-grid' });
        ins.slice(0, 3).forEach(i => ig.appendChild(insightCard(i, s)));
        root.appendChild(ig);
      }

      // ---- gráficos ----
      root.appendChild(el('div', { class: 'section-title' }, [el('span', { text: 'Gráficos' })]));
      const cats = s.porCategoria().filter(c => c.orcado > 0 || c.realizado > 0).sort((a, b) => b.realizado - a.realizado);
      const deps = s.porDepartamento().filter(c => c.orcado > 0);
      const topC = s.topContas(10).map(x => ({ label: x.conta.codigo + ' ' + x.conta.detalhe, value: x.realizado, cor: x.realizado > x.orcado ? '#DC2626' : '#1B4A7A', mono: true }));
      const meses = s.porMes();
      const roscaData = cats.filter(c => c.realizado > 0).map((c, i) => ({ label: c.label, value: c.realizado, cor: C().corCategoria(c.label, i) }));
      const forns = s.topFornecedores(10);

      const charts = el('div', { class: 'charts' });
      charts.appendChild(chartBox('Orçado × Realizado por categoria', C().barrasAgrupadas(cats.slice(0, 12))));
      charts.appendChild(chartBox('Orçado × Realizado por departamento', C().barrasAgrupadas(deps)));
      charts.appendChild(chartBox('10 contas de maior consumo no período', C().barrasHorizontais(topC, { mono: true }), true));
      charts.appendChild(chartBox('Evolução mensal — realizado x orçado acumulado', C().linhaBurn(meses)));
      charts.appendChild(chartBox('Distribuição do realizado por categoria', C().rosca(roscaData)));
      charts.appendChild(chartBox('Top 10 fornecedores no período', rankingForn(forns)));
      root.appendChild(charts);
    },

    _ccCard(cc, s) {
      const sem = UI.semaforo(cc.pct);
      const ccObj = s.cc(cc.key);
      const dep = s.dep(ccObj.departamento_id);
      const excedido = cc.realizado - cc.orcado;
      const planos = s.planosAbertosDoCC(cc.key);
      const card = el('div', { class: 'cc-card ' + sem }, [
        el('div', { class: 'cc-top' }, [
          el('div', {}, [
            el('div', { class: 'cc-cod', text: ccObj.codigo }),
            el('div', { class: 'cc-nome', text: ccObj.nome }),
            el('div', { class: 'cc-dep', text: dep.nome }),
          ]),
          el('div', { class: 'pct', text: F().pct(cc.pct) }),
        ]),
        el('div', { class: 'bar', html: `<span style="width:${Math.min(100, cc.pct)}%"></span>` }),
        el('div', { class: 'cc-vals' }, [
          el('span', { html: `Realizado <b>${F().moedaCurta(cc.realizado)}</b>` }),
          el('span', { html: `Orçado <b>${F().moedaCurta(cc.orcado)}</b>` }),
        ]),
        el('div', { class: 'cc-vals', style: { marginTop: '3px' } }, [
          el('span', { html: `Comprometido <b>${F().moedaCurta(cc.comprometido)}</b>` }),
          el('span', { html: `Saldo <b style="color:${cc.saldo < 0 ? 'var(--vermelho)' : 'inherit'}">${F().moedaCurta(cc.saldo)}</b>` }),
        ]),
      ]);
      if (sem === 'amarelo') card.appendChild(el('div', { class: 'cc-alert amarelo', html: '⚠️ Atenção: 80% do orçamento consumido' }));
      if (sem === 'vermelho') card.appendChild(el('div', { class: 'cc-alert vermelho', html: `🚩 Orçamento estourado — excedido em <b>${F().moeda(excedido)}</b>` }));

      const links = el('div', { class: 'cc-links' });
      if (planos.length) links.appendChild(el('a', { href: '#/planos', text: `${planos.length} plano(s) de ação aberto(s) →` }));
      if (sem !== 'verde') {
        links.appendChild(el('a', {
          href: 'javascript:void 0', style: { fontWeight: '600' },
          text: planos.length ? 'Ver plano de ação existente' : 'Criar plano de ação',
          onclick: () => {
            if (planos.length) { location.hash = '#/planos'; return; }
            global.PlanosAcao.novoDeCC(cc, s);
          },
        }));
      }
      if (links.children.length) card.appendChild(links);
      return card;
    },
  };

  function chartBox(titulo, node, wide) {
    return el('div', { class: 'chart-box' + (wide ? ' wide' : '') }, [
      el('div', { class: 'card-title', text: titulo }),
      node,
    ]);
  }

  function rankingForn(forns) {
    if (!forns.length) return el('div', { class: 'empty', text: 'Sem realizado no período.' });
    const max = forns[0].valor || 1;
    const wrap = el('div', {});
    forns.forEach((f, i) => {
      wrap.appendChild(el('div', { style: { marginBottom: '9px' } }, [
        el('div', { class: 'between', style: { fontSize: '13px', marginBottom: '3px' } }, [
          el('span', {}, [el('b', { text: (i + 1) + '. ' }), document.createTextNode(f.fornecedor)]),
          el('span', { class: 'mono', text: F().moeda(f.valor) }),
        ]),
        el('div', { class: 'bar', style: { margin: '0' } , html: `<span style="width:${(f.valor / max * 100)}%; background:${global.Charts.corCategoria(f.fornecedor, i)}"></span>` }),
      ]));
    });
    return wrap;
  }

  function insightCard(i, s) {
    const card = el('div', { class: 'insight ' + i.criticidade }, [
      el('div', { class: 'ihead' }, [
        el('div', { class: 'ico-c', html: i.icone }),
        el('div', {}, [el('div', { class: 'it', text: i.titulo }), critLabel(i.criticidade)]),
      ]),
      el('div', { class: 'txt', html: i.texto }),
    ]);
    if (i.criticidade === 'alta') {
      card.appendChild(el('div', { class: 'mt8' }, [
        el('button', { class: 'btn btn-sm', text: 'Criar plano de ação', onclick: () => global.PlanosAcao.novoDeInsight(i, s) }),
      ]));
    }
    return card;
  }
  function critLabel(c) {
    const m = { alta: 'vermelho', media: 'amarelo', informativa: 'cinza' };
    const l = { alta: 'Alta', media: 'Média', informativa: 'Informativa' };
    return el('span', { class: 'chip ' + m[c], text: l[c], style: { marginTop: '4px' } });
  }

  global.Dashboard = { insightCard, critLabel };
})(window);
