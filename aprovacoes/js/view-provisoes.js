/* view-provisoes.js — Provisões (5.4) */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;

  function ultimoDia(mesRef) { const [y, m] = mesRef.split('-').map(Number); return new Date(y, m, 0); }
  function venceEm30(p, hoje) {
    if (p.status !== 'aberta' && p.status !== 'parcial') return false;
    const d = ultimoDia(p.mes_referencia); const h = new Date(hoje);
    const dias = Math.floor((d - h) / 86400000);
    return dias >= 0 && dias <= 30;
  }

  global.Views = global.Views || {};
  global.Views.provisoes = {
    render(root, s) {
      const provs = s.db.provisoes.slice();
      const vencendo = provs.filter(p => venceEm30(p, s.db.HOJE));
      if (vencendo.length) {
        root.appendChild(el('div', { class: 'aviso warn mb16', html: `⏰ <b>${vencendo.length}</b> provisão(ões) aberta(s) vencem nos próximos 30 dias, somando <b>${F().moeda(vencendo.reduce((a, p) => a + (p.valor_provisionado - p.valor_consumido), 0))}</b> em saldo a consumir.` }));
      }
      const totProv = provs.reduce((a, p) => a + p.valor_provisionado, 0);
      const totCons = provs.reduce((a, p) => a + p.valor_consumido, 0);
      root.appendChild(el('div', { class: 'bignums mb16' }, [
        big('Provisionado total', F().moedaCurta(totProv)),
        big('Consumido', F().moedaCurta(totCons)),
        big('Saldo a consumir', F().moedaCurta(totProv - totCons)),
        big('Vencendo em 30 dias', String(vencendo.length), 'v-amarelo'),
      ]));

      const tb = el('tbody');
      provs.sort((a, b) => a.mes_referencia < b.mes_referencia ? -1 : 1).forEach(p => {
        const cc = s.cc(p.centro_custo_id), conta = s.conta(p.conta_contabil_id);
        const saldo = p.valor_provisionado - p.valor_consumido;
        const pctC = p.valor_provisionado > 0 ? p.valor_consumido / p.valor_provisionado * 100 : 0;
        const venc = venceEm30(p, s.db.HOJE);
        tb.appendChild(el('tr', {}, [
          el('td', {}, [el('div', { style: { fontWeight: 600 }, text: p.descricao }), el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: cc.codigo + ' — ' + cc.nome })]),
          el('td', {}, [el('div', { class: 'mono', style: { fontSize: '12px' }, text: conta.codigo }), el('div', { class: 'muted', style: { fontSize: '11.5px' } }, [document.createTextNode(conta.detalhe + ' '), conta.provisao ? el('span', { class: 'chip prov', text: 'Provisão' }) : null])]),
          el('td', { class: 'r mono', text: F().moeda(p.valor_provisionado) }),
          el('td', { class: 'r mono', text: F().moeda(p.valor_consumido) }),
          el('td', { class: 'r mono', text: F().moeda(saldo) }),
          el('td', { style: { minWidth: '120px' } }, [el('div', { class: 'bar', style: { margin: '0 0 3px' }, html: `<span style="width:${pctC}%"></span>` }), el('span', { class: 'muted', style: { fontSize: '11px' }, text: F().pct(pctC) + ' consumido' })]),
          el('td', { class: 'c', html: `<span style="font-weight:600;color:${venc ? 'var(--amarelo)' : 'inherit'}">${F().mesLongo(+p.mes_referencia.split('-')[1])}/${p.mes_referencia.split('-')[0]}</span>` }),
          el('td', { class: 'c' }, statusProv(p.status)),
        ]));
      });
      root.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
        el('thead', {}, el('tr', {}, ['Provisão / Centro de Custo', 'Conta contábil', 'Provisionado', 'Consumido', 'Saldo', 'Consumo', 'Referência', 'Status'].map((h, i) => el('th', { class: i >= 2 && i <= 4 ? 'r' : (i >= 6 ? 'c' : ''), text: h })))),
        tb,
      ])));
    },
  };

  function big(l, v, cls) { return el('div', { class: 'bignum ' + (cls || '') }, [el('span', { class: 'stripe' }), el('div', { class: 'lbl', text: l }), el('div', { class: 'val', text: v })]); }
  function statusProv(st) {
    const m = { aberta: ['amarelo', 'Aberta'], parcial: ['cinza', 'Parcial'], consumida: ['verde', 'Consumida'], cancelada: ['vermelho', 'Cancelada'] };
    const x = m[st] || ['cinza', st];
    return el('span', { class: 'chip ' + x[0], text: x[1] });
  }
})(window);
