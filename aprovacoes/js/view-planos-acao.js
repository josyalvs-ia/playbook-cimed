/* =========================================================================
   view-planos-acao.js — Planos de Ação (seção 11): indicadores, Kanban/lista,
   detalhe com andamentos e conclusão, filtros, exportação, criação a partir
   de alertas (pré-preenchida) ou manual.
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;

  const ACAO_TIPO = {
    estouro_orcamento: 'Solicitar remanejamento entre centros de custo ou suplementação orçamentária',
    alerta_80: 'Revisar solicitações previstas até o fim do exercício e congelar gastos não essenciais',
    projecao_estouro: 'Reprojetar o consumo dos próximos meses e revisar contratos recorrentes',
    concentracao_fornecedor: 'Abrir cotação com fornecedores alternativos',
    solicitacao_parada: 'Definir aprovador substituto ou delegação de alçada',
    criacao_manual: '',
  };
  const CRIT_TIPO = { estouro_orcamento: 'alta', concentracao_fornecedor: 'alta', projecao_estouro: 'media', alerta_80: 'media', solicitacao_parada: 'baixa', criacao_manual: 'media' };
  const STATUS_COLS = [['aberto', 'Aberto'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluído'], ['cancelado', 'Cancelado']];
  let modo = 'kanban';
  const filtros = { departamento: 'todos', centro: 'todos', categoria: 'todas', responsavel: 'todos', criticidade: 'todas', status: 'todos' };

  global.Views = global.Views || {};
  global.Views.planos = {
    render(root, s) {
      const todos = s.db.planos_acao;
      // indicadores
      const abertos = todos.filter(p => p.status === 'aberto').length;
      const andamento = todos.filter(p => p.status === 'em_andamento').length;
      const concluidos = todos.filter(p => p.status === 'concluido').length;
      const atrasados = todos.filter(p => (p.status === 'aberto' || p.status === 'em_andamento') && F().diasDesde(p.prazo, s.db.HOJE) > 0).length;
      const impacto = todos.filter(p => p.status === 'aberto' || p.status === 'em_andamento').reduce((a, p) => a + (p.valor_impacto || 0), 0);
      root.appendChild(el('div', { class: 'bignums mb16' }, [
        big('Abertos', String(abertos)),
        big('Em andamento', String(andamento), 'v-amarelo'),
        big('Concluídos', String(concluidos), 'v-verde'),
        big('Atrasados', String(atrasados), atrasados ? 'v-vermelho' : ''),
        big('Impacto em risco', F().moedaCurta(impacto), 'v-vermelho'),
      ]));

      // controles
      const toggle = el('div', { class: 'pill-toggle' }, [
        el('button', { class: modo === 'kanban' ? 'on' : '', text: 'Kanban', onclick: () => { modo = 'kanban'; s.emit(); } }),
        el('button', { class: modo === 'lista' ? 'on' : '', text: 'Lista', onclick: () => { modo = 'lista'; s.emit(); } }),
      ]);
      root.appendChild(el('div', { class: 'between mb16 wrap gap12' }, [
        el('div', { class: 'row gap12 wrap' }, [toggle, filtrosUI(s)]),
        el('div', { class: 'row gap6' }, [
          el('button', { class: 'btn btn-sm', html: '⭳ CSV', onclick: () => exportCSV(s) }),
          el('button', { class: 'btn btn-sm', html: '⭳ PDF', onclick: () => exportPDF(s) }),
          el('button', { class: 'btn btn-primary btn-sm', html: '+ Novo plano', onclick: () => abrirFormulario({ origem_tipo: 'criacao_manual', criticidade: 'media' }, s) }),
        ]),
      ]));

      const lista = aplicaFiltros(todos, s);
      if (modo === 'kanban') root.appendChild(kanban(lista, s));
      else root.appendChild(tabela(lista, s));
    },
  };

  function aplicaFiltros(todos, s) {
    return todos.filter(p => {
      const cc = s.cc(p.centro_custo_id);
      if (filtros.status !== 'todos' && p.status !== filtros.status) return false;
      if (filtros.criticidade !== 'todas' && p.criticidade !== filtros.criticidade) return false;
      if (filtros.centro !== 'todos' && p.centro_custo_id !== +filtros.centro) return false;
      if (filtros.departamento !== 'todos' && cc && cc.departamento_id !== +filtros.departamento) return false;
      if (filtros.categoria !== 'todas' && p.categoria_id !== filtros.categoria) return false;
      if (filtros.responsavel !== 'todos' && p.responsavel_nome !== filtros.responsavel) return false;
      return true;
    });
  }

  function filtrosUI(s) {
    const opt = (v, t, on) => el('option', { value: v, selected: on ? 'selected' : null, text: t });
    const responsaveis = Array.from(new Set(s.db.planos_acao.map(p => p.responsavel_nome)));
    const mk = (label, val, opts, key) => el('select', { title: label, style: { padding: '6px 8px', border: '1px solid var(--borda)', borderRadius: '8px', fontSize: '12.5px' }, onchange: e => { filtros[key] = e.target.value; s.emit(); } }, opts);
    return el('div', { class: 'row gap6 wrap' }, [
      mk('Status', filtros.status, [opt('todos', 'Todos os status', filtros.status === 'todos'), ...STATUS_COLS.map(([v, l]) => opt(v, l, filtros.status === v))], 'status'),
      mk('Criticidade', filtros.criticidade, [opt('todas', 'Toda criticidade', filtros.criticidade === 'todas'), opt('alta', 'Alta', filtros.criticidade === 'alta'), opt('media', 'Média', filtros.criticidade === 'media'), opt('baixa', 'Baixa', filtros.criticidade === 'baixa')], 'criticidade'),
      mk('Departamento', filtros.departamento, [opt('todos', 'Todo depto', filtros.departamento === 'todos'), ...s.db.departamentos.map(d => opt(d.id, d.nome, +filtros.departamento === d.id))], 'departamento'),
      mk('Centro', filtros.centro, [opt('todos', 'Todo CC', filtros.centro === 'todos'), ...s.db.centros_custo.map(c => opt(c.id, c.codigo, +filtros.centro === c.id))], 'centro'),
      mk('Responsável', filtros.responsavel, [opt('todos', 'Todo responsável', filtros.responsavel === 'todos'), ...responsaveis.map(r => opt(r, r, filtros.responsavel === r))], 'responsavel'),
    ]);
  }

  function kanban(lista, s) {
    const k = el('div', { class: 'kanban' });
    STATUS_COLS.forEach(([st, lbl]) => {
      const doStatus = lista.filter(p => p.status === st);
      const col = el('div', { class: 'kcol' }, [el('h4', {}, [el('span', { text: lbl }), el('span', { class: 'badge-count', text: doStatus.length })])]);
      doStatus.forEach(p => col.appendChild(pcard(p, s)));
      if (!doStatus.length) col.appendChild(el('div', { class: 'muted', style: { fontSize: '12px', textAlign: 'center', padding: '10px' }, text: '—' }));
      k.appendChild(col);
    });
    return k;
  }

  function pcard(p, s) {
    const cc = s.cc(p.centro_custo_id), conta = p.conta_contabil_id ? s.conta(p.conta_contabil_id) : null;
    const dias = F().diasDesde(p.prazo, s.db.HOJE);
    const prazoCls = (p.status !== 'concluido' && p.status !== 'cancelado') ? (dias > 0 ? 'prazo-venc' : dias > -7 ? 'prazo-prox' : '') : '';
    return el('div', { class: 'pcard', onclick: () => abrirDetalhe(p, s) }, [
      el('div', { class: 'between' }, [el('div', { class: 'pt', text: p.titulo }), el('span', { html: UI.critChip(p.criticidade) })]),
      el('div', { class: 'pm' }, [
        el('span', {}, [document.createTextNode('📍 ' + (cc ? cc.codigo + ' ' + cc.nome : '—'))]),
        conta ? el('span', { class: 'mono', style: { fontSize: '11px' }, text: conta.codigo + ' ' + conta.detalhe }) : null,
        el('span', {}, [document.createTextNode('👤 ' + p.responsavel_nome)]),
        el('span', { class: prazoCls }, [document.createTextNode('📅 ' + F().data(p.prazo) + (prazoCls === 'prazo-venc' ? ' (vencido)' : prazoCls === 'prazo-prox' ? ' (próximo)' : ''))]),
        p.valor_impacto ? el('span', { html: '💰 <b>' + F().moeda(p.valor_impacto) + '</b>' }) : null,
      ]),
    ]);
  }

  function tabela(lista, s) {
    const tb = el('tbody');
    lista.forEach(p => {
      const cc = s.cc(p.centro_custo_id), conta = p.conta_contabil_id ? s.conta(p.conta_contabil_id) : null;
      const dias = F().diasDesde(p.prazo, s.db.HOJE);
      const venc = (p.status === 'aberto' || p.status === 'em_andamento') && dias > 0;
      tb.appendChild(el('tr', { style: { cursor: 'pointer' }, onclick: () => abrirDetalhe(p, s) }, [
        el('td', {}, [el('div', { style: { fontWeight: 600 }, text: p.titulo }), el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: LBLtipo(p.origem_tipo) })]),
        el('td', {}, [el('div', { class: 'mono', style: { fontSize: '12px' }, text: cc ? cc.codigo : '—' }), conta ? el('div', { class: 'muted', style: { fontSize: '11px' }, text: conta.codigo } ) : null]),
        el('td', { text: p.responsavel_nome }),
        el('td', { class: 'c', html: `<span style="${venc ? 'color:var(--vermelho);font-weight:600' : ''}">${F().data(p.prazo)}</span>` }),
        el('td', { class: 'c', html: UI.critChip(p.criticidade) }),
        el('td', { class: 'r mono', text: p.valor_impacto ? F().moeda(p.valor_impacto) : '—' }),
        el('td', { class: 'c' }, statusChip(p.status)),
      ]));
    });
    return el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
      el('thead', {}, el('tr', {}, ['Plano', 'Centro/Conta', 'Responsável', 'Prazo', 'Criticidade', 'Impacto', 'Status'].map((h, i) => el('th', { class: (i === 3 || i === 4 || i === 6) ? 'c' : (i === 5 ? 'r' : ''), text: h })))),
      tb,
    ]));
  }

  // ---------------- detalhe ----------------
  function abrirDetalhe(p, s) {
    const cc = s.cc(p.centro_custo_id), conta = p.conta_contabil_id ? s.conta(p.conta_contabil_id) : null;
    const andamentos = s.andamentosDoPlano(p.id);
    const novoAnd = el('textarea', { placeholder: 'Registrar novo andamento…' });
    const histBox = el('div', {});
    function drawHist() {
      histBox.innerHTML = '';
      const ands = s.andamentosDoPlano(p.id);
      if (!ands.length) histBox.appendChild(el('div', { class: 'muted', text: 'Sem andamentos.' }));
      ands.forEach(a => histBox.appendChild(el('div', { style: { borderLeft: '3px solid var(--borda)', padding: '2px 0 10px 12px', marginLeft: '4px' } }, [
        el('div', { style: { fontSize: '13px' }, text: a.comentario }),
        el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: a.autor + ' — ' + F().dataHora(a.data_hora) }),
      ])));
    }
    drawHist();

    const body = el('div', {}, [
      el('div', { class: 'row wrap gap6 mb12' }, [statusChip(p.status), el('span', { html: UI.critChip(p.criticidade) }), el('span', { class: 'chip cinza', text: LBLtipo(p.origem_tipo) })]),
      linha('Centro de custo', cc ? cc.codigo + ' — ' + cc.nome : '—'),
      conta ? linha('Conta contábil', '<span class="mono">' + conta.codigo + '</span> ' + conta.detalhe) : null,
      linha('Responsável', p.responsavel_nome + ' · ' + p.responsavel_email),
      linha('Prazo', F().data(p.prazo)),
      p.valor_impacto ? linha('Impacto financeiro', F().moeda(p.valor_impacto)) : null,
      el('div', { class: 'mt12' }, [el('div', { class: 'card-title', text: 'Problema' }), el('div', { style: { fontSize: '13px', lineHeight: '1.6' }, text: p.descricao_problema })]),
      el('div', { class: 'mt12' }, [el('div', { class: 'card-title', text: 'Ação proposta' }), el('div', { style: { fontSize: '13px', lineHeight: '1.6' }, text: p.acao_proposta })]),
      el('div', { class: 'mt16' }, [el('div', { class: 'card-title', text: 'Andamentos' }), histBox]),
      (p.status !== 'concluido' && p.status !== 'cancelado') ? el('div', { class: 'form-field full mt12' }, [el('label', { text: 'Novo andamento' }), novoAnd, el('button', { class: 'btn btn-sm mt8', text: 'Adicionar andamento', onclick: () => { if (!novoAnd.value.trim()) return; s.addAndamento(p.id, p.responsavel_nome, novoAnd.value.trim()); novoAnd.value = ''; drawHist(); UI.toast('Andamento registrado', 'ok'); } })]) : null,
    ]);

    const footer = [];
    if (p.status !== 'concluido' && p.status !== 'cancelado') {
      if (p.status === 'aberto') footer.push(el('button', { class: 'btn', text: 'Iniciar (em andamento)', onclick: () => { s.atualizarPlanoStatus(p.id, 'em_andamento'); UI.closeModal(); UI.toast('Plano em andamento', 'ok'); } }));
      footer.push(el('button', { class: 'btn', text: 'Cancelar plano', onclick: () => { s.atualizarPlanoStatus(p.id, 'cancelado'); UI.closeModal(); UI.toast('Plano cancelado', 'warn'); } }));
      footer.push(el('button', { class: 'btn btn-verde', text: 'Concluir', onclick: () => concluir() }));
    }
    footer.push(el('button', { class: 'btn btn-ghost', text: 'Fechar', onclick: UI.closeModal }));
    UI.modal({ title: p.titulo, size: 'lg', body, footer });

    function concluir() {
      const ta = el('textarea', { placeholder: 'Comentário final obrigatório…' });
      UI.modal({ title: 'Concluir plano de ação', body: el('div', {}, [el('div', { class: 'form-field full' }, [el('label', { text: 'Comentário final' }), ta])]),
        footer: [el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }), el('button', { class: 'btn btn-verde', text: 'Concluir plano', onclick: () => { if (!ta.value.trim()) { UI.toast('O comentário final é obrigatório', 'err'); return; } s.concluirPlano(p.id, ta.value.trim(), p.responsavel_nome); UI.closeModal(); UI.toast('Plano concluído', 'ok'); } })] });
    }
  }

  // ---------------- criação ----------------
  function abrirFormulario(prefill, s) {
    const p = prefill || {};
    const cc = p.centro_custo_id ? s.cc(p.centro_custo_id) : null;
    const dep = cc ? s.dep(cc.departamento_id) : null;
    const campos = {};
    campos.titulo = el('input', { value: p.titulo || '' });
    campos.cc = el('select', {}, s.db.centros_custo.map(c => el('option', { value: c.id, selected: p.centro_custo_id === c.id ? 'selected' : null, text: c.codigo + ' — ' + c.nome })));
    campos.tipo = el('select', {}, Object.keys(ACAO_TIPO).map(t => el('option', { value: t, selected: p.origem_tipo === t ? 'selected' : null, text: LBLtipo(t) })));
    campos.crit = el('select', {}, ['alta', 'media', 'baixa'].map(c => el('option', { value: c, selected: (p.criticidade || 'media') === c ? 'selected' : null, text: { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[c] })));
    campos.resp = el('input', { value: p.responsavel_nome || (dep ? dep.gestor_nome : '') });
    campos.respEmail = el('input', { value: p.responsavel_email || (dep ? dep.gestor_email : '') });
    campos.prazo = el('input', { type: 'date', value: p.prazo || proxData(s, 30) });
    campos.impacto = el('input', { type: 'number', value: p.valor_impacto || '', placeholder: '0,00' });
    campos.problema = el('textarea', { value: p.descricao_problema || '' });
    campos.acao = el('textarea', { value: p.acao_proposta || ACAO_TIPO[p.origem_tipo] || '' });
    campos.tipo.addEventListener('change', () => { campos.acao.value = ACAO_TIPO[campos.tipo.value] || campos.acao.value; campos.crit.value = CRIT_TIPO[campos.tipo.value] || campos.crit.value; });

    const form = el('div', {}, [
      p._info ? el('div', { class: 'aviso info mb12', html: p._info }) : null,
      el('div', { class: 'form-grid' }, [
        el('div', { class: 'form-field full' }, [el('label', { text: 'Título' }), campos.titulo]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Centro de custo' }), campos.cc]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Origem / tipo' }), campos.tipo]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Criticidade' }), campos.crit]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Prazo' }), campos.prazo]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Responsável' }), campos.resp]),
        el('div', { class: 'form-field' }, [el('label', { text: 'E-mail do responsável' }), campos.respEmail]),
        el('div', { class: 'form-field full' }, [el('label', { text: 'Impacto financeiro (R$)' }), campos.impacto]),
        el('div', { class: 'form-field full' }, [el('label', { text: 'Descrição do problema' }), campos.problema]),
        el('div', { class: 'form-field full' }, [el('label', { text: 'Ação proposta' }), campos.acao]),
      ]),
    ]);
    UI.modal({ title: 'Novo plano de ação', size: 'lg', icon: '🎯', body: form,
      footer: [el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }), el('button', { class: 'btn btn-primary', text: 'Criar plano', onclick: salvar })] });

    function salvar() {
      if (!campos.titulo.value.trim()) return UI.toast('Informe o título', 'err');
      const ccId = +campos.cc.value; const c = s.cc(ccId);
      const novo = s.criarPlano({
        origem_tipo: campos.tipo.value, origem_ref: p.origem_ref || (c.codigo),
        centro_custo_id: ccId, conta_contabil_id: p.conta_contabil_id || null, categoria_id: p.categoria_id || null,
        titulo: campos.titulo.value.trim(), descricao_problema: campos.problema.value.trim(), acao_proposta: campos.acao.value.trim(),
        responsavel_nome: campos.resp.value.trim(), responsavel_email: campos.respEmail.value.trim(),
        prazo: campos.prazo.value, criticidade: campos.crit.value, valor_impacto: parseFloat(campos.impacto.value) || 0,
      });
      UI.closeModal();
      UI.toast('Plano criado e e-mail enviado ao responsável', 'ok');
    }
  }

  // pré-preenchimento a partir de card de CC (dashboard)
  function novoDeCC(ccAgg, s) {
    const cc = s.cc(ccAgg.key); const dep = s.dep(cc.departamento_id);
    const estouro = ccAgg.pct >= 100;
    const tipo = estouro ? 'estouro_orcamento' : 'alerta_80';
    const excedido = ccAgg.realizado - ccAgg.orcado;
    abrirFormulario({
      origem_tipo: tipo, origem_ref: cc.codigo, centro_custo_id: cc.id,
      titulo: (estouro ? 'Estouro de orçamento — ' : 'Atenção 80% — ') + cc.nome,
      criticidade: CRIT_TIPO[tipo], responsavel_nome: dep.gestor_nome, responsavel_email: dep.gestor_email,
      descricao_problema: estouro
        ? `O centro de custo ${cc.codigo} (${cc.nome}) ultrapassou o orçado: realizado de ${F().moeda(ccAgg.realizado)} sobre orçado de ${F().moeda(ccAgg.orcado)} (${F().pct(ccAgg.pct)}), excedido em ${F().moeda(excedido)}.`
        : `O centro de custo ${cc.codigo} (${cc.nome}) atingiu ${F().pct(ccAgg.pct)} do orçado (realizado ${F().moeda(ccAgg.realizado)} / orçado ${F().moeda(ccAgg.orcado)}).`,
      acao_proposta: ACAO_TIPO[tipo], valor_impacto: Math.max(0, excedido),
      _info: '🎯 Formulário pré-preenchido a partir do card do centro de custo. Todos os campos são editáveis.',
    }, s);
  }

  // pré-preenchimento a partir de insight
  function novoDeInsight(ins, s) {
    const ref = ins.ref || {};
    const cc = ref.cc ? s.cc(ref.cc) : (ref.conta ? null : null);
    const dep = cc ? s.dep(cc.departamento_id) : null;
    abrirFormulario({
      origem_tipo: ins.origem_tipo, centro_custo_id: cc ? cc.id : (s.db.centros_custo[0].id),
      conta_contabil_id: ref.conta || null, categoria_id: ref.categoria || null,
      titulo: ins.titulo, criticidade: ins.criticidade === 'informativa' ? 'baixa' : ins.criticidade,
      responsavel_nome: dep ? dep.gestor_nome : '', responsavel_email: dep ? dep.gestor_email : '',
      descricao_problema: ins.texto.replace(/<[^>]+>/g, ''), acao_proposta: ACAO_TIPO[ins.origem_tipo] || '',
      valor_impacto: ref.valor_impacto || 0,
      _info: '🎯 Formulário pré-preenchido a partir de um insight estratégico. Todos os campos são editáveis.',
    }, s);
  }

  // helpers
  function big(l, v, cls) { return el('div', { class: 'bignum ' + (cls || '') }, [el('span', { class: 'stripe' }), el('div', { class: 'lbl', text: l }), el('div', { class: 'val', text: v })]); }
  function linha(k, v) { return el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', html: v })]); }
  function statusChip(st) { const m = { aberto: ['amarelo', 'Aberto'], em_andamento: ['cinza', 'Em andamento'], concluido: ['verde', 'Concluído'], cancelado: ['vermelho', 'Cancelado'] }; const x = m[st] || ['cinza', st]; return el('span', { class: 'chip ' + x[0], text: x[1] }); }
  function LBLtipo(t) { return { estouro_orcamento: 'Estouro de orçamento', alerta_80: 'Alerta 80%', projecao_estouro: 'Projeção de estouro', concentracao_fornecedor: 'Concentração de fornecedor', solicitacao_parada: 'Solicitação parada', criacao_manual: 'Criação manual' }[t] || t; }
  function proxData(s, dias) { const [y, m, d] = s.db.HOJE.split('-').map(Number); const dt = new Date(y, m - 1, d + dias); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }

  function exportCSV(s) {
    const rows = aplicaFiltros(s.db.planos_acao, s).map(p => { const cc = s.cc(p.centro_custo_id), conta = p.conta_contabil_id ? s.conta(p.conta_contabil_id) : null; return [p.titulo, LBLtipo(p.origem_tipo), cc ? cc.codigo : '', conta ? conta.codigo : '', p.responsavel_nome, F().data(p.prazo), p.criticidade, Math.round(p.valor_impacto || 0), p.status]; });
    UI.exportarCSV('planos-de-acao', ['Título', 'Origem', 'Centro', 'Conta', 'Responsável', 'Prazo', 'Criticidade', 'Impacto', 'Status'], rows);
  }
  function exportPDF(s) {
    const rows = aplicaFiltros(s.db.planos_acao, s).map(p => { const cc = s.cc(p.centro_custo_id); return `<tr><td>${UI.esc(p.titulo)}</td><td>${cc ? cc.codigo : ''}</td><td>${UI.esc(p.responsavel_nome)}</td><td>${F().data(p.prazo)}</td><td>${p.criticidade}</td><td class="r">${F().moeda(p.valor_impacto || 0)}</td><td>${p.status}</td></tr>`; }).join('');
    UI.exportarPDF('Planos de Ação', `<table><thead><tr><th>Título</th><th>Centro</th><th>Responsável</th><th>Prazo</th><th>Criticidade</th><th class="r">Impacto</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
  }

  global.PlanosAcao = { novoDeCC, novoDeInsight, abrirFormulario };
})(window);
