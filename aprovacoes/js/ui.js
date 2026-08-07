/* =========================================================================
   ui.js — Helpers de interface: DOM, modais, toasts, componentes reutilizáveis,
   exportação CSV/PDF, busca de conta contábil, barra de filtros.
   ========================================================================= */
(function (global) {
  'use strict';
  const F = () => global.Fmt;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(e.style, attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---- semáforo ----
  function semaforo(pct) { return pct >= 100 ? 'vermelho' : pct >= 80 ? 'amarelo' : 'verde'; }

  // ---- status pill ----
  function statusPill(status) {
    const map = {
      'Rascunho': 'st-rascunho', 'Em revisão': 'st-revisao', 'Aprovada': 'st-aprovada',
      'Reprovada': 'st-reprovada', 'Paga': 'st-paga',
    };
    let cls = map[status] || (status && status.startsWith('Pendente') ? 'st-pendente' : 'st-rascunho');
    return `<span class="st ${cls}">${esc(status)}</span>`;
  }

  // ---- toast ----
  let toastWrap;
  function toast(msg, tipo) {
    if (!toastWrap) { toastWrap = el('div', { class: 'toast-wrap' }); document.body.appendChild(toastWrap); }
    const t = el('div', { class: 'toast ' + (tipo || ''), html: msg });
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 250); }, 3200);
  }

  // ---- modal ----
  let modalBg;
  function modal(opts) {
    if (!modalBg) { modalBg = el('div', { class: 'modal-bg' }); document.body.appendChild(modalBg); modalBg.addEventListener('click', e => { if (e.target === modalBg) closeModal(); }); }
    modalBg.innerHTML = '';
    const foot = opts.footer ? el('div', { class: 'modal-foot' }, opts.footer) : null;
    const m = el('div', { class: 'modal ' + (opts.size || '') }, [
      el('div', { class: 'modal-head' }, [
        opts.icon ? el('span', { html: opts.icon }) : null,
        el('h3', { text: opts.title || '' }),
        el('button', { class: 'x', html: '&times;', onclick: closeModal }),
      ]),
      el('div', { class: 'modal-body' }, opts.body),
      foot,
    ]);
    modalBg.appendChild(m);
    modalBg.classList.add('open');
    return { close: closeModal, el: m };
  }
  function closeModal() { if (modalBg) modalBg.classList.remove('open'); }

  // ---- barra de progresso ----
  function progresso(pct, cls) {
    return `<div class="bar"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>`;
  }

  // ---- exportação CSV ----
  function exportarCSV(nome, colunas, linhas) {
    const sep = ';';
    const cab = colunas.join(sep);
    const corpo = linhas.map(l => l.map(c => {
      let v = c == null ? '' : String(c);
      if (typeof c === 'number') v = String(c).replace('.', ',');
      if (/[";\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(sep)).join('\n');
    const csv = '﻿' + cab + '\n' + corpo;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    baixar(blob, nome + '.csv');
    toast('Arquivo <b>' + nome + '.csv</b> exportado', 'ok');
  }

  // ---- exportação PDF (via janela de impressão) ----
  function exportarPDF(titulo, htmlConteudo) {
    const w = window.open('', '_blank');
    if (!w) { toast('Permita pop-ups para exportar em PDF', 'warn'); return; }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif; color:#0F172A; padding:26px; font-size:12px;}
        h1{font-size:18px; color:#0B2545; margin-bottom:4px;}
        .sub{color:#64748B; font-size:12px; margin-bottom:16px;}
        table{width:100%; border-collapse:collapse; font-size:11px;}
        th{background:#F7F9FC; text-align:left; padding:6px 8px; border:1px solid #E2E8F0; font-size:10px; text-transform:uppercase; color:#64748B;}
        td{padding:5px 8px; border:1px solid #E2E8F0;}
        .r{text-align:right;} td.mono,th.mono{font-family:'JetBrains Mono',monospace;}
        tr.v{background:#FCECEC;} tr.a{background:#FDF3E7;} tr.grp{background:#eef2f8; font-weight:700;}
        .foot{margin-top:16px; color:#94a3b8; font-size:10px;}
      </style></head><body>
      <h1>${esc(titulo)}</h1>
      <div class="sub">Sistema de Aprovação de Pagamentos — gerado em ${F().dataHora(new Date())}</div>
      ${htmlConteudo}
      <div class="foot">Documento gerado automaticamente para demonstração.</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
  }

  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: nome });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- componente de busca de conta contábil ----
  // opts: { contas:[], value:id, onSelect:fn, soAnaliticasPag:bool, placeholder }
  function contaSearch(opts) {
    const contas = opts.contas.filter(c => opts.soAnaliticasPag ? (c.aceita_lancamento && c.gera_pagamento && c.ativa) : c.aceita_lancamento);
    const wrap = el('div', { class: 'conta-search' });
    const input = el('input', { type: 'text', placeholder: opts.placeholder || 'Buscar por código ou descrição…', autocomplete: 'off' });
    const drop = el('div', { class: 'conta-drop' });
    let selecionada = opts.value ? contas.find(c => c.id === opts.value) : null;
    if (selecionada) input.value = selecionada.codigo + ' — ' + selecionada.detalhe;

    function render(termo) {
      const t = (termo || '').toLowerCase();
      const norm = PlanoContas.normaliza(termo || '');
      const res = contas.filter(c =>
        c.codigo.includes(t) || PlanoContas.normaliza(c.detalhe).includes(norm) || PlanoContas.normaliza(c.grupo_nome).includes(norm)
      ).slice(0, 40);
      drop.innerHTML = '';
      if (!res.length) { drop.appendChild(el('div', { class: 'conta-opt', text: 'Nenhuma conta encontrada' })); }
      res.forEach(c => {
        const opt = el('div', { class: 'conta-opt', onclick: () => { selecionada = c; input.value = c.codigo + ' — ' + c.detalhe; drop.classList.remove('open'); opts.onSelect && opts.onSelect(c); } }, [
          el('div', { class: 'co-top' }, [
            el('span', { class: 'co-cod', text: c.codigo }),
            el('span', { class: 'co-desc', text: c.detalhe }),
            c.tipo === 'Investimento' ? el('span', { class: 'chip capex', text: 'CAPEX' }) : null,
            c.provisao ? el('span', { class: 'chip prov', text: 'Provisão' }) : null,
          ]),
          el('div', { class: 'co-meta', text: `${c.grupo_nome} · ${c.categoria_id || 'sem categoria'}` }),
        ]);
        drop.appendChild(opt);
      });
      drop.classList.add('open');
    }
    input.addEventListener('focus', () => render(''));
    input.addEventListener('input', () => { selecionada = null; render(input.value); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) drop.classList.remove('open'); });
    wrap.appendChild(input); wrap.appendChild(drop);
    wrap.getSelecionada = () => selecionada;
    return wrap;
  }

  // ---- criticidade chip ----
  function critChip(c) {
    const m = { alta: 'vermelho', media: 'amarelo', baixa: 'cinza' };
    const l = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
    return `<span class="chip ${m[c] || 'cinza'}">${l[c] || c}</span>`;
  }

  const UI = { el, $, $$, esc, semaforo, statusPill, toast, modal, closeModal, progresso, exportarCSV, exportarPDF, baixar, contaSearch, critChip };
  global.UI = UI;
})(window);
