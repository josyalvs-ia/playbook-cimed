/* view-importacao.js — Importação de Dados (5.6): texto do plano de contas +
   CSV/XLSX com mapeamento de colunas e prévia antes de confirmar. */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;

  const TIPOS = {
    'plano-contas': { label: 'Plano de Contas', campos: ['codigo', 'descricao_completa'], obrig: ['codigo', 'descricao_completa'] },
    'centros-custo': { label: 'Centros de Custo', campos: ['codigo', 'nome', 'departamento', 'id_externo'], obrig: ['codigo', 'nome'] },
    'orcamento': { label: 'Orçamento', campos: ['centro_custo', 'conta', 'ano', 'mes', 'valor', 'id_externo'], obrig: ['centro_custo', 'conta', 'mes', 'valor'] },
    'solicitacoes': { label: 'Solicitações', campos: ['fornecedor', 'cnpj', 'valor', 'centro_custo', 'conta', 'descricao', 'data_vencimento', 'id_externo'], obrig: ['fornecedor', 'valor', 'centro_custo', 'conta'] },
  };

  global.Views = global.Views || {};
  global.Views.importacao = {
    render(root, s) {
      root.appendChild(el('div', { class: 'aviso info mb16', html: 'Importe dados por <b>CSV</b> ou pelo <b>formato de texto</b> do plano de contas. A integração com o ERP não é executada agora — a estrutura (campo <span class="mono">id_externo</span>) já está pronta para carga futura.' }));

      // ---- bloco 1: plano de contas em texto ----
      const cardTexto = el('div', { class: 'card card-pad mb20' });
      cardTexto.appendChild(el('div', { class: 'card-title', html: '📝 Plano de Contas — formato de texto da empresa' }));
      cardTexto.appendChild(el('div', { class: 'hint mb12', html: 'Uma conta por linha no padrão <span class="mono">codigo:DESCRIÇÃO COMPLETA</span>. O sistema interpreta o código, monta a hierarquia, separa grupo e detalhe e aplica o mapeamento de categoria automaticamente.' }));
      const ta = el('textarea', { style: { width: '100%', minHeight: '120px', fontFamily: 'var(--mono)', fontSize: '12.5px', border: '1px solid var(--borda)', borderRadius: '9px', padding: '10px' }, placeholder: '7.2.2.2.09.01:DESPESAS VIAGENS - HOSPEDAGEM\n7.2.2.2.10.01:DESPESAS ALIMENTAÇÃO - RESTAURANTE' });
      cardTexto.appendChild(ta);
      const previewTexto = el('div', { class: 'mt12' });
      cardTexto.appendChild(el('div', { class: 'row gap6 mt12' }, [
        el('button', { class: 'btn', html: '🔎 Interpretar e pré-visualizar', onclick: () => interpretarTexto() }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Carregar exemplo', onclick: () => { ta.value = '7.2.2.2.10.01:DESPESAS ALIMENTAÇÃO - RESTAURANTE INTERNO\n7.2.2.2.10.02:DESPESAS ALIMENTAÇÃO - VALE REFEIÇÃO\n7.2.2.2.16.01:MANUTENÇÃO PREDIAL - REFORMAS'; } }),
      ]));
      cardTexto.appendChild(previewTexto);
      root.appendChild(cardTexto);

      function interpretarTexto() {
        if (!ta.value.trim()) { UI.toast('Cole ao menos uma linha', 'warn'); return; }
        const preview = s.previewContasTexto(ta.value);
        const analiticas = preview.filter(c => c.aceita_lancamento);
        previewTexto.innerHTML = '';
        const tb = el('tbody');
        preview.forEach(c => tb.appendChild(el('tr', { class: c._novo ? '' : '' }, [
          el('td', { class: 'mono', text: c.codigo }),
          el('td', { text: c.sintetica ? c.grupo_nome + ' (sintética)' : c.detalhe }),
          el('td', { class: 'muted', text: c.grupo_nome }),
          el('td', { text: c.categoria_id || '—' }),
          el('td', { class: 'c', text: c.nivel }),
          el('td', { class: 'c' }, el('span', { class: 'chip ' + (c.aceita_lancamento ? 'verde' : 'cinza'), text: c.aceita_lancamento ? 'Analítica' : 'Sintética' })),
          el('td', { class: 'c' }, el('span', { class: 'chip ' + (c._novo ? 'amarelo' : 'cinza'), text: c._novo ? 'Nova' : 'Existente' })),
        ])));
        previewTexto.appendChild(el('div', { class: 'aviso ok mb8', html: `Prévia: <b>${preview.length}</b> conta(s) interpretada(s) (${analiticas.length} analítica(s), ${preview.filter(c => c._novo).length} nova(s)).` }));
        previewTexto.appendChild(el('div', { class: 'tbl-wrap', style: { maxHeight: '320px', overflowY: 'auto' } }, el('table', { class: 'tbl' }, [
          el('thead', {}, el('tr', {}, ['Código', 'Descrição', 'Grupo', 'Categoria', 'Nível', 'Tipo', 'Situação'].map((h, i) => el('th', { class: i >= 4 ? 'c' : '', text: h })))),
          tb,
        ])));
        previewTexto.appendChild(el('button', { class: 'btn btn-primary mt12', text: 'Confirmar carga', onclick: () => { const r = s.importarContasTexto(ta.value); UI.toast(`${r.novas} conta(s) adicionada(s), ${r.existentes} já existiam`, 'ok'); previewTexto.innerHTML = ''; ta.value = ''; } }));
      }

      // ---- bloco 2: CSV com mapeamento ----
      const cardCsv = el('div', { class: 'card card-pad' });
      cardCsv.appendChild(el('div', { class: 'card-title', html: '📄 Importar por CSV / XLSX' }));
      const selTipo = el('select', {}, Object.keys(TIPOS).map(k => el('option', { value: k, text: TIPOS[k].label })));
      const file = el('input', { type: 'file', accept: '.csv,.txt,.xlsx' });
      cardCsv.appendChild(el('div', { class: 'form-grid mb12' }, [
        el('div', { class: 'form-field' }, [el('label', { text: 'Destino da carga' }), selTipo]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Arquivo (CSV)' }), file]),
      ]));
      cardCsv.appendChild(el('div', { class: 'hint mb12', html: 'Para XLSX, exporte a planilha como CSV (separador <span class="mono">;</span> ou <span class="mono">,</span>). O mapeamento de colunas é o mesmo.' }));
      const areaMap = el('div', {});
      cardCsv.appendChild(areaMap);
      root.appendChild(cardCsv);

      file.addEventListener('change', () => {
        const f = file.files[0]; if (!f) return;
        if (/\.xlsx$/i.test(f.name)) { areaMap.innerHTML = ''; areaMap.appendChild(el('div', { class: 'aviso warn', html: 'Arquivo XLSX detectado. Nesta demonstração, exporte-o como <b>CSV</b> para concluir o mapeamento (a estrutura de importação é idêntica).' })); return; }
        const reader = new FileReader();
        reader.onload = () => montarMapeamento(reader.result, selTipo.value);
        reader.readAsText(f, 'utf-8');
      });

      function montarMapeamento(texto, tipo) {
        const { headers, rows } = parseCSV(texto);
        if (!headers.length) { areaMap.innerHTML = '<div class="aviso err">Não foi possível ler o arquivo.</div>'; return; }
        const def = TIPOS[tipo];
        areaMap.innerHTML = '';
        const mapa = {};
        const grid = el('div', { class: 'form-grid mb12' });
        def.campos.forEach(campo => {
          const auto = headers.find(h => PlanoContas.normaliza(h) === PlanoContas.normaliza(campo) || PlanoContas.normaliza(h).includes(PlanoContas.normaliza(campo)));
          mapa[campo] = auto || '';
          const sel = el('select', { onchange: e => { mapa[campo] = e.target.value; } }, [el('option', { value: '', text: '— ignorar —' })].concat(headers.map(h => el('option', { value: h, selected: h === auto ? 'selected' : null, text: h }))));
          grid.appendChild(el('div', { class: 'form-field' }, [el('label', { html: campo + (def.obrig.includes(campo) ? ' <span style="color:var(--vermelho)">*</span>' : '') }), sel]));
        });
        areaMap.appendChild(el('div', { class: 'hint mb8', text: `Mapeie as colunas do arquivo (${rows.length} linha(s)) para os campos de ${def.label}.` }));
        areaMap.appendChild(grid);

        // preview
        const prev = el('div', {});
        areaMap.appendChild(el('button', { class: 'btn btn-sm', text: 'Pré-visualizar', onclick: () => {
          const faltando = def.obrig.filter(c => !mapa[c]);
          if (faltando.length) { UI.toast('Mapeie os campos obrigatórios: ' + faltando.join(', '), 'err'); return; }
          const conv = rows.slice(0, 8).map(r => def.campos.reduce((o, c) => { o[c] = mapa[c] ? r[headers.indexOf(mapa[c])] : ''; return o; }, {}));
          prev.innerHTML = '';
          const tb = el('tbody');
          conv.forEach(o => tb.appendChild(el('tr', {}, def.campos.map(c => el('td', { text: o[c] || '' })))));
          prev.appendChild(el('div', { class: 'tbl-wrap mt8' }, el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, def.campos.map(c => el('th', { text: c })))), tb])));
          prev.appendChild(el('button', { class: 'btn btn-primary mt12', text: 'Confirmar carga (' + rows.length + ' linhas)', onclick: () => confirmar(tipo, headers, rows, mapa, def) }));
        } }));
        areaMap.appendChild(prev);
      }

      function confirmar(tipo, headers, rows, mapa, def) {
        const conv = rows.map(r => def.campos.reduce((o, c) => { o[c] = mapa[c] ? r[headers.indexOf(mapa[c])] : ''; return o; }, {}));
        let res;
        if (tipo === 'plano-contas') { const txt = conv.filter(o => o.codigo).map(o => o.codigo + ':' + o.descricao_completa).join('\n'); res = s.importarContasTexto(txt); UI.toast(`${res.novas} conta(s) adicionada(s)`, 'ok'); }
        else if (tipo === 'centros-custo') { res = s.importarCentros(conv); UI.toast(`${res.novas} centro(s) de custo importado(s)`, 'ok'); }
        else if (tipo === 'orcamento') { res = s.importarOrcamento(conv); UI.toast(`${res.novas} linha(s) de orçamento importada(s)`, 'ok'); }
        else if (tipo === 'solicitacoes') { res = s.importarSolicitacoes(conv); UI.toast(`${res.novas} solicitação(ões) importada(s)`, 'ok'); }
        areaMap.innerHTML = '';
        file.value = '';
      }
    },
  };

  function parseCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    const linhas = texto.split(/\r?\n/).filter(l => l.trim().length);
    if (!linhas.length) return { headers: [], rows: [] };
    const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
    const parseLinha = (l) => {
      const out = []; let cur = '', dentro = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') { if (dentro && l[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
        else if (ch === sep && !dentro) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur); return out.map(x => x.trim());
    };
    const headers = parseLinha(linhas[0]);
    const rows = linhas.slice(1).map(parseLinha);
    return { headers, rows };
  }
})(window);
