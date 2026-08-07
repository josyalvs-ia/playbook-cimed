/* =========================================================================
   view-orcado.js — Orçado x Realizado. Tabela agrupada por Departamento e
   Centro de Custo, expansão Categoria → Conta. Visões Gerencial/Contábil,
   blocos Custeio/Investimento, semáforo por linha, exportação CSV/PDF.
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;
  let visao = 'gerencial'; // ou 'contabil'
  const colapsados = new Set();

  global.Views = global.Views || {};
  global.Views.orcado = {
    render(root, s) {
      const dadosCusteio = construir(s, 'Custeio');
      const dadosInvest = construir(s, 'Investimento');

      const toggle = el('div', { class: 'pill-toggle' }, [
        el('button', { class: visao === 'gerencial' ? 'on' : '', text: 'Gerencial (por categoria)', onclick: () => { visao = 'gerencial'; s.emit(); } }),
        el('button', { class: visao === 'contabil' ? 'on' : '', text: 'Contábil (por conta)', onclick: () => { visao = 'contabil'; s.emit(); } }),
      ]);
      root.appendChild(el('div', { class: 'between mb16 wrap' }, [
        el('div', { class: 'row gap12 wrap' }, [toggle, el('span', { class: 'hint', text: visao === 'gerencial' ? 'O gestor lê por categoria.' : 'A Controladoria lê por conta contábil.' })]),
        el('div', { class: 'row gap6' }, [
          el('button', { class: 'btn btn-sm', html: '⭳ CSV', onclick: () => exportCSV(s) }),
          el('button', { class: 'btn btn-sm', html: '⭳ PDF', onclick: () => exportPDF(s) }),
          el('button', { class: 'btn btn-sm', html: '⊕ Expandir tudo', onclick: () => { colapsados.clear(); s.emit(); } }),
        ]),
      ]));

      root.appendChild(bloco('Custeio (Despesa)', dadosCusteio, s));
      root.appendChild(bloco('Investimento (CAPEX)', dadosInvest, s));
    },
  };

  function bloco(titulo, dados, s) {
    const wrap = el('div', { class: 'mb20' });
    wrap.appendChild(el('div', { class: 'section-title' }, [el('span', { text: titulo }), el('span', { class: 'badge-count', text: F().moeda(dados.total.realizado) + ' / ' + F().moeda(dados.total.orcado) })]));
    if (!dados.deps.length) { wrap.appendChild(el('div', { class: 'empty', text: 'Sem dados no recorte.' })); return wrap; }

    const tb = el('tbody');
    const linhas = [];
    dados.deps.forEach(dep => {
      linhas.push({ node: dep, depth: 0, kind: 'dep' });
      dep.filhos.forEach(cc => {
        linhas.push({ node: cc, depth: 1, kind: 'cc', pai: dep });
        cc.filhos.forEach(cat => {
          linhas.push({ node: cat, depth: 2, kind: 'cat', pai: cc });
          if (visao === 'contabil') cat.filhos.forEach(ct => linhas.push({ node: ct, depth: 3, kind: 'conta', pai: cat }));
        });
      });
    });

    linhas.forEach(l => {
      const n = l.node;
      const visivel = ehVisivel(l, linhas);
      const temFilhos = (l.kind === 'dep' || l.kind === 'cc' || (l.kind === 'cat' && visao === 'contabil'));
      const clsSem = n.pct >= 100 ? 'linha-vermelho' : n.pct >= 80 ? 'linha-amarelo' : '';
      const clsGrp = l.kind === 'dep' ? 'grp' : l.kind === 'cc' ? 'grp2' : '';
      const idAttr = 'lid-' + n._id;
      const tr = el('tr', { class: (clsSem || clsGrp), 'data-id': n._id, style: visivel ? {} : { display: 'none' } });

      const primeira = el('td', { class: 'indent' + l.depth });
      const label = rotulo(l, n);
      if (temFilhos) {
        const exp = el('span', { class: 'expander' + (colapsados.has(n._id) ? '' : ' open') }, [el('span', { class: 'tw', html: '▶' }), el('span', { html: label })]);
        exp.addEventListener('click', () => { colapsados.has(n._id) ? colapsados.delete(n._id) : colapsados.add(n._id); global.Store.emit(); });
        primeira.appendChild(exp);
      } else primeira.innerHTML = '<span style="padding-left:20px">' + label + '</span>';
      tr.appendChild(primeira);

      const varRs = n.realizado - n.orcado;
      const varPc = n.orcado > 0 ? (n.realizado / n.orcado - 1) * 100 : 0;
      [
        cell(F().moeda(n.orcado), 'r mono'),
        cell(F().moeda(n.realizado), 'r mono'),
        cell(F().moeda(n.comprometido), 'r mono'),
        cell(F().moeda(n.saldo), 'r mono', n.saldo < 0 ? 'var(--vermelho)' : null),
        cell(F().pct(n.pct), 'r', n.pct >= 100 ? 'var(--vermelho)' : n.pct >= 80 ? 'var(--amarelo)' : null),
        cell((varRs >= 0 ? '+' : '') + F().moeda(varRs), 'r mono', varRs > 0 ? 'var(--vermelho)' : 'var(--verde)'),
        cell((varPc >= 0 ? '+' : '') + F().pct(varPc), 'r', varPc > 0 ? 'var(--vermelho)' : 'var(--verde)'),
      ].forEach(c => tr.appendChild(c));
      tb.appendChild(tr);
    });

    // total do bloco
    const t = dados.total;
    const trT = el('tr', { class: 'grp' }, [
      el('td', { html: '<b>TOTAL ' + (t.tipo || '') + '</b>' }),
      cell(F().moeda(t.orcado), 'r mono'), cell(F().moeda(t.realizado), 'r mono'), cell(F().moeda(t.comprometido), 'r mono'),
      cell(F().moeda(t.saldo), 'r mono'), cell(F().pct(t.pct), 'r'),
      cell((t.realizado - t.orcado >= 0 ? '+' : '') + F().moeda(t.realizado - t.orcado), 'r mono'),
      cell('', 'r'),
    ]);
    tb.appendChild(trT);

    wrap.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
      el('thead', {}, el('tr', {}, [
        th('Departamento / Centro / Categoria / Conta', ''), th('Orçado', 'r'), th('Realizado', 'r'), th('Comprometido', 'r'),
        th('Saldo', 'r'), th('% Consumo', 'r'), th('Variação R$', 'r'), th('Variação %', 'r'),
      ])),
      tb,
    ])));
    return wrap;
  }

  function rotulo(l, n) {
    if (l.kind === 'dep') return '<b>' + UI.esc(n.label) + '</b>';
    if (l.kind === 'cc') return '<b>' + UI.esc(n.cod) + '</b> ' + UI.esc(n.label);
    if (l.kind === 'cat') return UI.esc(n.label);
    return '<span class="mono">' + UI.esc(n.cod) + '</span> ' + UI.esc(n.label);
  }
  function ehVisivel(l, linhas) {
    // visível se nenhum ancestral está colapsado
    let pai = l.pai;
    while (pai) { if (colapsados.has(pai._id)) return false; pai = pai._paiRef; }
    return true;
  }
  function cell(v, cls, cor) { const td = el('td', { class: cls || '', html: v }); if (cor) td.style.color = cor; return td; }
  function th(v, cls) { return el('th', { class: cls || '', text: v }); }

  // ---------- construção da árvore ----------
  let SEQ = 1;
  function construir(s, tipoBloco) {
    SEQ = SEQ; // mantém ids estáveis por render
    const leaves = new Map(); // key cc|conta
    const f = s.filtros;
    const add = (ccId, contaId, campo, val) => {
      const conta = s.conta(contaId); if (!conta) return;
      const tp = conta.tipo === 'Investimento' ? 'Investimento' : 'Custeio';
      if (tp !== tipoBloco) return;
      const k = ccId + '|' + contaId;
      if (!leaves.has(k)) leaves.set(k, { ccId, contaId, orcado: 0, realizado: 0, comprometido: 0 });
      leaves.get(k)[campo] += val;
    };
    s.orcamentoFiltrado().forEach(o => add(o.centro_custo_id, o.conta_contabil_id, 'orcado', o.valor_orcado));
    s.lancamentosFiltrados().forEach(l => add(l.centro_custo_id, l.conta_contabil_id, 'realizado', l.valor));
    s.solicitacoesFiltradas().forEach(so => { if (s.isRealizado(so)) add(so.centro_custo_id, so.conta_contabil_id, 'realizado', so.valor); else if (s.isComprometido(so)) add(so.centro_custo_id, so.conta_contabil_id, 'comprometido', so.valor); });

    // árvore dep -> cc -> cat -> conta
    const depsMap = new Map();
    let idc = 1;
    const novo = (extra) => Object.assign({ _id: tipoBloco[0] + (idc++), orcado: 0, realizado: 0, comprometido: 0, filhos: [] }, extra);
    leaves.forEach(lf => {
      const conta = s.conta(lf.contaId), cc = s.cc(lf.ccId), dep = s.dep(cc.departamento_id);
      const cat = conta.categoria_id || '(sem categoria)';
      if (!depsMap.has(dep.id)) depsMap.set(dep.id, novo({ label: dep.nome, kind: 'dep', _ccs: new Map() }));
      const dnode = depsMap.get(dep.id);
      if (!dnode._ccs.has(cc.id)) { const c = novo({ label: cc.nome, cod: cc.codigo, kind: 'cc', _cats: new Map(), _paiRef: dnode }); dnode._ccs.set(cc.id, c); dnode.filhos.push(c); }
      const cnode = dnode._ccs.get(cc.id);
      if (!cnode._cats.has(cat)) { const ca = novo({ label: cat, kind: 'cat', _paiRef: cnode }); cnode._cats.set(cat, ca); cnode.filhos.push(ca); }
      const canode = cnode._cats.get(cat);
      const ct = novo({ label: conta.detalhe, cod: conta.codigo, kind: 'conta', _paiRef: canode, orcado: lf.orcado, realizado: lf.realizado, comprometido: lf.comprometido });
      canode.filhos.push(ct);
      [canode, cnode, dnode].forEach(nn => { nn.orcado += lf.orcado; nn.realizado += lf.realizado; nn.comprometido += lf.comprometido; });
    });

    const deps = Array.from(depsMap.values()).sort((a, b) => b.realizado - a.realizado);
    const total = { orcado: 0, realizado: 0, comprometido: 0, tipo: tipoBloco };
    const finaliza = n => { n.saldo = n.orcado - n.realizado - n.comprometido; n.pct = n.orcado > 0 ? n.realizado / n.orcado * 100 : 0; (n.filhos || []).forEach(finaliza); };
    deps.forEach(d => { finaliza(d); d.filhos.sort((a, b) => b.realizado - a.realizado); d.filhos.forEach(cc => cc.filhos.sort((a, b) => b.realizado - a.realizado)); total.orcado += d.orcado; total.realizado += d.realizado; total.comprometido += d.comprometido; });
    total.saldo = total.orcado - total.realizado - total.comprometido; total.pct = total.orcado > 0 ? total.realizado / total.orcado * 100 : 0;
    return { deps, total };
  }

  // ---------- exportação ----------
  function linhasExport(s) {
    const out = [];
    ['Custeio', 'Investimento'].forEach(tp => {
      const d = construir(s, tp);
      d.deps.forEach(dep => dep.filhos.forEach(cc => cc.filhos.forEach(cat => cat.filhos.forEach(ct => {
        out.push([dep.label, cc.cod + ' ' + cc.label, cat.label, ct.cod, ct.label, tp, round(ct.orcado), round(ct.realizado), round(ct.comprometido), round(ct.saldo), ct.pct.toFixed(1), round(ct.realizado - ct.orcado)]);
      }))));
    });
    return out;
  }
  function round(v) { return Math.round(v); }
  function exportCSV(s) {
    UI.exportarCSV('orcado-x-realizado', ['Departamento', 'Centro de Custo', 'Categoria', 'Código Conta', 'Descrição Conta', 'Tipo', 'Orçado', 'Realizado', 'Comprometido', 'Saldo', '% Consumo', 'Variação R$'], linhasExport(s));
  }
  function exportPDF(s) {
    const rows = linhasExport(s).map(r => {
      const pct = parseFloat(r[10]); const cls = pct >= 100 ? 'v' : pct >= 80 ? 'a' : '';
      return `<tr class="${cls}"><td>${UI.esc(r[0])}</td><td>${UI.esc(r[1])}</td><td>${UI.esc(r[2])}</td><td class="mono">${r[3]}</td><td>${UI.esc(r[4])}</td><td class="r">${F().moeda(r[6])}</td><td class="r">${F().moeda(r[7])}</td><td class="r">${F().moeda(r[9])}</td><td class="r">${r[10]}%</td></tr>`;
    }).join('');
    UI.exportarPDF('Orçado x Realizado', `<table><thead><tr><th>Depto</th><th>Centro</th><th>Categoria</th><th>Conta</th><th>Descrição</th><th class="r">Orçado</th><th class="r">Realizado</th><th class="r">Saldo</th><th class="r">%</th></tr></thead><tbody>${rows}</tbody></table>`);
  }
})(window);
