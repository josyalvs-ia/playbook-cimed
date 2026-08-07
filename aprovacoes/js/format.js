/* =========================================================================
   format.js — Formatação em padrão brasileiro (R$, datas, números)
   ========================================================================= */
(function (global) {
  'use strict';

  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesesLongos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const nfMoeda = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const nfMoedaCompacta = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
  const nfNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const nfPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const Fmt = {
    meses, mesesLongos,

    /** R$ 1.234.567,89 */
    moeda(v) {
      if (v == null || isNaN(v)) return 'R$ 0,00';
      return nfMoeda.format(v);
    },

    /** R$ 1.234.568 (sem centavos, para big numbers) */
    moedaCurta(v) {
      if (v == null || isNaN(v)) return 'R$ 0';
      const abs = Math.abs(v);
      if (abs >= 1e6) return 'R$ ' + nfPct.format(v / 1e6) + ' mi';
      if (abs >= 1e3) return 'R$ ' + nfPct.format(v / 1e3) + ' mil';
      return nfMoedaCompacta.format(v);
    },

    /** R$ 1.234.567,89 sempre sem abreviação */
    moedaCheia(v) { return nfMoeda.format(v || 0); },

    numero(v) { return nfNum.format(v || 0); },

    /** 82,5% */
    pct(v) {
      if (v == null || isNaN(v)) return '0,0%';
      return nfPct.format(v) + '%';
    },

    /** DD/MM/AAAA a partir de 'YYYY-MM-DD' ou Date */
    data(d) {
      if (!d) return '—';
      const dt = (d instanceof Date) ? d : Fmt._parse(d);
      if (!dt) return '—';
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${dt.getFullYear()}`;
    },

    /** DD/MM/AAAA HH:MM */
    dataHora(d) {
      if (!d) return '—';
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt)) return '—';
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mi = String(dt.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${dt.getFullYear()} ${hh}:${mi}`;
    },

    mesAno(mes, ano) { return `${meses[mes - 1]}/${String(ano).slice(2)}`; },
    mesLongo(mes) { return mesesLongos[mes - 1]; },

    _parse(s) {
      if (typeof s !== 'string') return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      const d = new Date(s);
      return isNaN(d) ? null : d;
    },

    /** dias corridos entre hoje (data de referência) e uma data ISO */
    diasDesde(iso, ref) {
      const a = Fmt._parse(iso); const b = ref ? Fmt._parse(ref) : new Date();
      if (!a || !b) return 0;
      return Math.floor((b - a) / 86400000);
    },

    /** dias úteis entre duas datas ISO */
    diasUteis(isoIni, isoFim) {
      let a = Fmt._parse(isoIni), b = Fmt._parse(isoFim);
      if (!a || !b) return 0;
      if (a > b) { const t = a; a = b; b = t; }
      let d = 0; const cur = new Date(a);
      while (cur < b) {
        cur.setDate(cur.getDate() + 1);
        const wd = cur.getDay();
        if (wd !== 0 && wd !== 6) d++;
      }
      return d;
    },
  };

  global.Fmt = Fmt;
})(window);
