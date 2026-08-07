/* =========================================================================
   charts.js — Gráficos em SVG puro (sem dependências externas).
   Barras agrupadas, barras horizontais, linha (burn), rosca.
   ========================================================================= */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const F = () => global.Fmt;

  const PALETA = ['#0B2545', '#1B4A7A', '#2E7DA1', '#4FA3C4', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0E7490', '#B45309', '#059669', '#64748B'];

  function corCategoria(nome, i) { return PALETA[i % PALETA.length]; }

  let tip;
  function tipEl() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(evt, html) { const t = tipEl(); t.innerHTML = html; t.style.opacity = '1'; moveTip(evt); }
  function moveTip(evt) { const t = tipEl(); let x = evt.clientX + 14, y = evt.clientY + 14; if (x + t.offsetWidth > window.innerWidth) x = evt.clientX - t.offsetWidth - 14; t.style.left = x + 'px'; t.style.top = y + 'px'; }
  function hideTip() { if (tip) tip.style.opacity = '0'; }

  function svg(w, h) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('class', 'chart-svg');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return s;
  }
  function e(tag, attrs) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function txt(x, y, s, attrs) { const t = e('text', Object.assign({ x, y }, attrs || {})); t.textContent = s; return t; }

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  // ---------- barras agrupadas verticais (Orçado x Realizado) ----------
  function barrasAgrupadas(data, opts) {
    opts = opts || {};
    const W = 760, H = 320, mL = 62, mR = 12, mT = 12, mB = 64;
    const s = svg(W, H);
    const max = niceMax(Math.max(1, ...data.map(d => Math.max(d.orcado, d.realizado))));
    const plotW = W - mL - mR, plotH = H - mT - mB;
    // grid + eixo Y
    for (let i = 0; i <= 4; i++) {
      const y = mT + plotH - (plotH * i / 4);
      s.appendChild(e('line', { x1: mL, y1: y, x2: W - mR, y2: y, stroke: '#E2E8F0', 'stroke-width': 1 }));
      s.appendChild(txt(mL - 8, y + 4, F().moedaCurta(max * i / 4), { 'text-anchor': 'end', 'font-size': 10, fill: '#64748B' }));
    }
    const n = data.length;
    const grupoW = plotW / n;
    const barW = Math.min(26, grupoW * 0.32);
    data.forEach((d, i) => {
      const cx = mL + grupoW * i + grupoW / 2;
      [['orcado', '#1B4A7A', -barW - 2], ['realizado', d.realizado > d.orcado ? '#DC2626' : '#16A34A', 2]].forEach(([key, cor, off]) => {
        const val = d[key];
        const bh = plotH * (val / max);
        const x = cx + off;
        const y = mT + plotH - bh;
        const r = e('rect', { x, y, width: barW, height: Math.max(0, bh), rx: 3, fill: cor, opacity: .92 });
        r.addEventListener('mousemove', ev => showTip(ev, `<b>${d.label}</b><br>${key === 'orcado' ? 'Orçado' : 'Realizado'}: ${F().moeda(val)}`));
        r.addEventListener('mouseleave', hideTip);
        s.appendChild(r);
      });
      const lbl = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
      const tl = txt(cx, H - mB + 16, lbl, { 'text-anchor': 'end', 'font-size': 10.5, fill: '#0F172A', transform: `rotate(-32 ${cx} ${H - mB + 16})` });
      s.appendChild(tl);
    });
    return withLegend(s, [['#1B4A7A', 'Orçado'], ['#16A34A', 'Realizado'], ['#DC2626', 'Realizado > Orçado']]);
  }

  // ---------- barras horizontais ----------
  function barrasHorizontais(data, opts) {
    opts = opts || {};
    const rowH = 30, mL = opts.mL || 190, mR = 60, mT = 8, mB = 8;
    const W = 760, H = mT + mB + data.length * rowH;
    const s = svg(W, H);
    const max = niceMax(Math.max(1, ...data.map(d => d.value)));
    const plotW = W - mL - mR;
    data.forEach((d, i) => {
      const y = mT + i * rowH;
      const bw = plotW * (d.value / max);
      s.appendChild(txt(mL - 8, y + rowH / 2 + 4, d.label.length > 30 ? d.label.slice(0, 29) + '…' : d.label, { 'text-anchor': 'end', 'font-size': 11, fill: '#0F172A', 'font-family': opts.mono ? 'JetBrains Mono, monospace' : 'inherit' }));
      const r = e('rect', { x: mL, y: y + 5, width: Math.max(2, bw), height: rowH - 12, rx: 4, fill: d.cor || '#1B4A7A' });
      r.addEventListener('mousemove', ev => showTip(ev, `<b>${d.label}</b><br>${F().moeda(d.value)}${d.sub ? '<br>' + d.sub : ''}`));
      r.addEventListener('mouseleave', hideTip);
      s.appendChild(r);
      s.appendChild(txt(mL + bw + 6, y + rowH / 2 + 4, F().moedaCurta(d.value), { 'font-size': 10.5, fill: '#64748B' }));
    });
    return s;
  }

  // ---------- linha (burn: realizado mensal + acumulados) ----------
  function linhaBurn(meses, opts) {
    const W = 760, H = 320, mL = 62, mR = 14, mT = 14, mB = 40;
    const s = svg(W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const max = niceMax(Math.max(1, ...meses.map(m => Math.max(m.orcadoAcum, m.realizadoAcum))));
    for (let i = 0; i <= 4; i++) {
      const y = mT + plotH - (plotH * i / 4);
      s.appendChild(e('line', { x1: mL, y1: y, x2: W - mR, y2: y, stroke: '#E2E8F0', 'stroke-width': 1 }));
      s.appendChild(txt(mL - 8, y + 4, F().moedaCurta(max * i / 4), { 'text-anchor': 'end', 'font-size': 10, fill: '#64748B' }));
    }
    const n = meses.length;
    const X = i => mL + (plotW * i / (n - 1));
    const Y = v => mT + plotH - plotH * (v / max);
    // barras realizado mensal
    const bw = plotW / n * 0.4;
    meses.forEach((m, i) => {
      const bh = plotH * (m.realizado / max);
      const r = e('rect', { x: X(i) - bw / 2, y: mT + plotH - bh, width: bw, height: Math.max(0, bh), rx: 2, fill: '#E8F0F8' });
      r.addEventListener('mousemove', ev => showTip(ev, `<b>${F().meses[i]}</b><br>Realizado no mês: ${F().moeda(m.realizado)}`));
      r.addEventListener('mouseleave', hideTip);
      s.appendChild(r);
    });
    // linhas acumuladas
    function linha(key, cor, dash) {
      let d = '';
      meses.forEach((m, i) => { d += (i ? 'L' : 'M') + X(i) + ' ' + Y(m[key]); });
      s.appendChild(e('path', { d, fill: 'none', stroke: cor, 'stroke-width': 2.4, 'stroke-dasharray': dash || '' }));
      meses.forEach((m, i) => {
        const c = e('circle', { cx: X(i), cy: Y(m[key]), r: 3.2, fill: cor });
        c.addEventListener('mousemove', ev => showTip(ev, `<b>${F().meses[i]}</b><br>${key === 'orcadoAcum' ? 'Orçado acum.' : 'Realizado acum.'}: ${F().moeda(m[key])}`));
        c.addEventListener('mouseleave', hideTip);
        s.appendChild(c);
      });
    }
    linha('orcadoAcum', '#1B4A7A', '5 4');
    linha('realizadoAcum', '#16A34A');
    meses.forEach((m, i) => { if (i % 1 === 0) s.appendChild(txt(X(i), H - mB + 18, F().meses[i], { 'text-anchor': 'middle', 'font-size': 10, fill: '#64748B' })); });
    return withLegend(s, [['#1B4A7A', 'Orçado acumulado', true], ['#16A34A', 'Realizado acumulado'], ['#E8F0F8', 'Realizado no mês']]);
  }

  // ---------- rosca ----------
  function rosca(data, opts) {
    opts = opts || {};
    const size = 260, cx = 130, cy = 130, rOut = 108, rIn = 62;
    const W = 560, H = 280;
    const s = svg(W, H);
    const total = data.reduce((a, d) => a + d.value, 0) || 1;
    let ang = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = d.value / total;
      const a2 = ang + frac * Math.PI * 2;
      const cor = d.cor || corCategoria(d.label, i);
      const path = arco(cx, cy, rOut, rIn, ang, a2);
      const p = e('path', { d: path, fill: cor });
      p.addEventListener('mousemove', ev => showTip(ev, `<b>${d.label}</b><br>${F().moeda(d.value)} · ${(frac * 100).toFixed(1)}%`));
      p.addEventListener('mouseleave', hideTip);
      s.appendChild(p);
      ang = a2;
    });
    s.appendChild(txt(cx, cy - 4, 'Realizado', { 'text-anchor': 'middle', 'font-size': 11, fill: '#64748B' }));
    s.appendChild(txt(cx, cy + 16, F().moedaCurta(total), { 'text-anchor': 'middle', 'font-size': 16, fill: '#0F172A', 'font-weight': 700 }));
    // legenda lateral
    const leg = e('g', {});
    data.slice(0, 12).forEach((d, i) => {
      const y = 26 + i * 20;
      leg.appendChild(e('rect', { x: 286, y: y - 9, width: 11, height: 11, rx: 3, fill: d.cor || corCategoria(d.label, i) }));
      leg.appendChild(txt(304, y, `${d.label}`, { 'font-size': 11, fill: '#0F172A' }));
      leg.appendChild(txt(W - 6, y, (d.value / total * 100).toFixed(1) + '%', { 'font-size': 11, fill: '#64748B', 'text-anchor': 'end' }));
    });
    s.appendChild(leg);
    return s;
  }

  function arco(cx, cy, rOut, rIn, a1, a2) {
    const x1 = cx + rOut * Math.cos(a1), y1 = cy + rOut * Math.sin(a1);
    const x2 = cx + rOut * Math.cos(a2), y2 = cy + rOut * Math.sin(a2);
    const x3 = cx + rIn * Math.cos(a2), y3 = cy + rIn * Math.sin(a2);
    const x4 = cx + rIn * Math.cos(a1), y4 = cy + rIn * Math.sin(a1);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    return `M${x1} ${y1} A${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  function withLegend(s, items) {
    const wrap = document.createElement('div');
    wrap.appendChild(s);
    const leg = document.createElement('div');
    leg.className = 'chart-legend';
    items.forEach(([cor, label, dash]) => {
      const sp = document.createElement('span');
      sp.innerHTML = `<i style="background:${cor}"></i>${label}`;
      leg.appendChild(sp);
    });
    wrap.appendChild(leg);
    return wrap;
  }

  global.Charts = { barrasAgrupadas, barrasHorizontais, linhaBurn, rosca, corCategoria, PALETA };
})(window);
