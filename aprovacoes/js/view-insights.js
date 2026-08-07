/* view-insights.js — Painel de Insights Estratégicos (recorte filtrado) */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el;
  global.Views = global.Views || {};
  global.Views.insights = {
    render(root, s) {
      const ins = global.Insights.gerar(s);
      root.appendChild(el('div', { class: 'aviso info mb16', html: '💡 Insights gerados por regras sobre os dados filtrados, priorizados por impacto financeiro. Ajuste os filtros acima para recalcular.' }));
      if (!ins.length) { root.appendChild(el('div', { class: 'empty', text: 'Sem insights para o recorte atual.' })); return; }
      const grid = el('div', { class: 'insights-grid' });
      ins.forEach(i => grid.appendChild(global.Dashboard.insightCard(i, s)));
      root.appendChild(grid);
    },
  };
})(window);
