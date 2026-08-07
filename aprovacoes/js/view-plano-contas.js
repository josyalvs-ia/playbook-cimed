/* view-plano-contas.js — Plano de Contas em árvore hierárquica (5.7) */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;
  const colaps = new Set();
  let inicializado = false;

  global.Views = global.Views || {};
  global.Views['plano-contas'] = {
    render(root, s) {
      const contas = s.db.contas_contabeis;
      if (!inicializado) { contas.forEach(c => { if (c.nivel >= 5 && c.sintetica) colaps.add(c.codigo); }); inicializado = true; }

      const semCat = contas.filter(c => c.aceita_lancamento && !c.categoria_id);
      root.appendChild(el('div', { class: 'aviso info mb12', html: '📚 Carga <b>parcial</b> do plano de contas (estrutura real). As demais contas entram pela <a href="#/importacao">Importação de Dados</a>. Apenas contas de 6º nível recebem lançamento; sintéticas existem para totalização.' }));
      if (semCat.length) root.appendChild(el('div', { class: 'aviso warn mb12', html: `⚠️ <b>${semCat.length}</b> conta(s) analítica(s) sem categoria vinculada ficam fora dos gráficos gerenciais: ${semCat.map(c => '<span class="mono">' + c.codigo + '</span>').join(', ')}. Vincule uma categoria abaixo.` }));

      const busca = el('input', { placeholder: 'Buscar por código ou descrição…', style: { maxWidth: '360px' } });
      root.appendChild(el('div', { class: 'between mb12 wrap' }, [
        el('div', { class: 'f-field', style: { maxWidth: '360px', flex: '1' } }, [el('label', { text: 'Buscar conta' }), busca]),
        el('div', { class: 'row gap6' }, [
          el('button', { class: 'btn btn-sm', html: '⊕ Expandir', onclick: () => { colaps.clear(); s.emit(); } }),
          el('button', { class: 'btn btn-sm', html: '⊖ Recolher', onclick: () => { contas.forEach(c => { if (c.nivel >= 5 && c.sintetica) colaps.add(c.codigo); }); s.emit(); } }),
        ]),
      ]));

      const cont = el('div', {});
      root.appendChild(cont);

      function draw(termo) {
        cont.innerHTML = '';
        const tb = el('tbody');
        if (termo && termo.trim()) {
          const t = termo.toLowerCase(), n = PlanoContas.normaliza(termo);
          contas.filter(c => c.aceita_lancamento && (c.codigo.includes(t) || PlanoContas.normaliza(c.detalhe).includes(n) || PlanoContas.normaliza(c.grupo_nome).includes(n)))
            .forEach(c => tb.appendChild(linhaConta(c, 1, s, false)));
        } else {
          const filhosDe = new Map();
          contas.forEach(c => { const p = c.paiCodigo || '_'; if (!filhosDe.has(p)) filhosDe.set(p, []); filhosDe.get(p).push(c); });
          const raizes = contas.filter(c => !c.paiCodigo).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
          const walk = (c, depth) => {
            tb.appendChild(linhaConta(c, depth, s, true));
            if (!colaps.has(c.codigo)) (filhosDe.get(c.codigo) || []).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })).forEach(f => walk(f, depth + 1));
          };
          raizes.forEach(r => walk(r, 0));
        }
        cont.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
          el('thead', {}, el('tr', {}, ['Código / Descrição', 'Grupo', 'Categoria', 'Tipo', 'Natureza', 'Gera pgto', 'Situação'].map((h, i) => el('th', { class: i >= 5 ? 'c' : '', text: h })))),
          tb,
        ])));
      }
      busca.addEventListener('input', () => draw(busca.value));
      draw('');

      function linhaConta(c, depth, s, comArvore) {
        const analitica = c.aceita_lancamento;
        const temFilhos = comArvore && s.db.contas_contabeis.some(x => x.paiCodigo === c.codigo);
        const primeira = el('td', {});
        const wrap = el('span', { class: 'indent-wrap', style: { paddingLeft: (depth * 18) + 'px', display: 'inline-flex', alignItems: 'center', gap: '6px' } });
        if (temFilhos) {
          const exp = el('span', { class: 'expander' + (colaps.has(c.codigo) ? '' : ' open'), style: { cursor: 'pointer' } }, el('span', { class: 'tw', html: '▶' }));
          exp.addEventListener('click', () => { colaps.has(c.codigo) ? colaps.delete(c.codigo) : colaps.add(c.codigo); draw(busca.value); });
          wrap.appendChild(exp);
        } else wrap.appendChild(el('span', { style: { width: '14px', display: 'inline-block' } }));
        wrap.appendChild(el('span', { class: 'mono', style: { fontWeight: analitica ? '500' : '700', color: analitica ? 'var(--texto)' : 'var(--azul)' }, text: c.codigo }));
        wrap.appendChild(el('span', { style: { fontWeight: analitica ? '400' : '600', color: analitica ? 'var(--texto)' : 'var(--azul)' }, text: analitica ? c.detalhe : c.grupo_nome }));
        if (c.provisao) wrap.appendChild(el('span', { class: 'chip prov', text: 'Provisão' }));
        primeira.appendChild(wrap);

        if (!analitica) {
          return el('tr', { class: 'grp2', style: { background: c.nivel <= 4 ? '#eef2f8' : '#f4f7fb' } }, [primeira, el('td', { colspan: '6', class: 'muted', text: 'Conta sintética (totalização)' })]);
        }

        // categoria editável
        const selCat = el('select', { style: { border: '1px solid var(--borda)', borderRadius: '7px', padding: '4px 6px', fontSize: '12px', maxWidth: '180px' }, onchange: e => { c.categoria_id = e.target.value || null; s.emit(); UI.toast('Categoria atualizada', 'ok'); } },
          [el('option', { value: '', text: '— sem categoria —', selected: !c.categoria_id ? 'selected' : null })].concat(PlanoContas.CATEGORIAS.map(cat => el('option', { value: cat, selected: c.categoria_id === cat ? 'selected' : null, text: cat }))));
        const catCell = el('td', {}, selCat);
        if (!c.categoria_id) catCell.style.background = 'var(--amarelo-bg)';

        // gera pagamento toggle
        const cbPag = el('input', { type: 'checkbox', checked: c.gera_pagamento ? 'checked' : null, onchange: e => { c.gera_pagamento = e.target.checked; s.emit(); } });
        // ativa toggle
        const cbAtiva = el('input', { type: 'checkbox', checked: c.ativa ? 'checked' : null, onchange: e => { c.ativa = e.target.checked; s.emit(); } });

        return el('tr', {}, [
          primeira,
          el('td', { class: 'muted', style: { fontSize: '11.5px' }, text: c.grupo_nome }),
          catCell,
          el('td', {}, el('span', { class: 'chip ' + (c.tipo === 'Investimento' ? 'capex' : 'cinza'), text: c.tipo })),
          el('td', { class: 'muted', text: c.natureza }),
          el('td', { class: 'c' }, cbPag),
          el('td', { class: 'c' }, el('label', { class: 'row gap6', style: { justifyContent: 'center' } }, [cbAtiva, el('span', { class: 'muted', style: { fontSize: '11px' }, text: c.ativa ? 'Ativa' : 'Inativa' })])),
        ]);
      }
    },
  };
})(window);
