/* view-notificacoes.js — Central de Notificações (5.5) + alertas automáticos (7.3) */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;

  // gera alertas automáticos a partir do estado atual (registrados na central)
  function alertasAutomaticos(s) {
    const out = [];
    const fin = 'financeiro@empresa.com.br';
    s.porCentroCusto().forEach(cc => {
      if (cc.orcado <= 0) return;
      const dep = s.dep(s.cc(cc.key).departamento_id);
      if (cc.pct >= 100) out.push({ tipo: 'estouro', destinatario: dep.gestor_email + ', ' + fin, assunto: 'Estouro de orçamento — ' + s.cc(cc.key).codigo, corpo: `O centro de custo ${s.cc(cc.key).nome} atingiu ${F().pct(cc.pct)} do orçado (realizado ${F().moeda(cc.realizado)} / orçado ${F().moeda(cc.orcado)}).`, data: s.db.HOJE, status_acao: 'enviado' });
      else if (cc.pct >= 80) out.push({ tipo: 'alerta80', destinatario: dep.gestor_email + ', ' + fin, assunto: 'Atenção: 80% do orçamento — ' + s.cc(cc.key).codigo, corpo: `O centro de custo ${s.cc(cc.key).nome} atingiu ${F().pct(cc.pct)} do orçado.`, data: s.db.HOJE, status_acao: 'enviado' });
    });
    // solicitações paradas > 3 dias úteis
    s.db.solicitacoes.filter(x => s.isComprometido(x)).forEach(x => {
      if (F().diasUteis(x.data_solicitacao, s.db.HOJE) > 3) {
        const dep = s.depDoCC(x.centro_custo_id);
        out.push({ tipo: 'parada', destinatario: dep.gestor_email + ', ' + fin, assunto: 'Solicitação parada na fila — ' + x.numero, corpo: `A solicitação ${x.numero} (${x.fornecedor}, ${F().moeda(x.valor)}) está parada há mais de 3 dias úteis na fila de aprovação.`, data: x.data_solicitacao, status_acao: 'pendente' });
      }
    });
    // planos de ação atrasados
    s.db.planos_acao.filter(p => (p.status === 'aberto' || p.status === 'em_andamento') && F().diasDesde(p.prazo, s.db.HOJE) > 0).forEach(p => {
      out.push({ tipo: 'plano', destinatario: p.responsavel_email + ', ' + fin, assunto: 'Plano de ação vencido — ' + p.titulo, corpo: `O plano de ação "${p.titulo}" passou do prazo (${F().data(p.prazo)}) sem conclusão.`, data: p.prazo, status_acao: 'pendente' });
    });
    return out;
  }

  const ICO = { aprovacao: '✉️', estouro: '🚩', alerta80: '⚠️', parada: '⏳', plano: '📌' };
  const LBL = { aprovacao: 'Aprovação', estouro: 'Estouro', alerta80: 'Alerta 80%', parada: 'Parada na fila', plano: 'Plano de ação' };

  global.Views = global.Views || {};
  global.Views.notificacoes = {
    render(root, s) {
      let filtro = 'todos';
      const todas = () => {
        const aprov = (s.db.notificacoes || []).map(n => { const sol = s.db.solicitacoes.find(x => x.id === n.solicitacao_id); return Object.assign({}, n, { status_acao: sol ? (sol.status === 'Aprovada' || sol.status === 'Paga' ? 'aprovado' : sol.status === 'Reprovada' ? 'reprovado' : 'pendente') : n.status_acao }); });
        return aprov.concat(alertasAutomaticos(s)).sort((a, b) => (a.data < b.data ? 1 : -1));
      };

      const cont = el('div', {});
      function draw() {
        cont.innerHTML = '';
        const lista = todas().filter(n => filtro === 'todos' || n.tipo === filtro);
        const tb = el('tbody');
        lista.forEach(n => {
          tb.appendChild(el('tr', { style: { cursor: 'pointer' }, onclick: () => abrir(n) }, [
            el('td', { class: 'c', html: '<span style="font-size:18px">' + (ICO[n.tipo] || '✉️') + '</span>' }),
            el('td', {}, el('span', { class: 'chip cinza', text: LBL[n.tipo] || n.tipo })),
            el('td', { style: { fontSize: '12.5px' }, text: n.destinatario }),
            el('td', {}, [el('div', { style: { fontWeight: 600 }, text: n.assunto }), el('div', { class: 'muted', style: { fontSize: '11.5px', maxWidth: '460px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: n.corpo })]),
            el('td', { class: 'c', text: F().data(n.data) }),
            el('td', { class: 'c' }, statusChip(n.status_acao)),
          ]));
        });
        cont.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
          el('thead', {}, el('tr', {}, ['', 'Tipo', 'Destinatário', 'Assunto / Corpo', 'Data', 'Ação'].map((h, i) => el('th', { class: (i === 0 || i >= 4) ? 'c' : '', text: h })))),
          tb,
        ])));
      }

      const chips = ['todos', 'aprovacao', 'estouro', 'alerta80', 'parada', 'plano'];
      root.appendChild(el('div', { class: 'row gap6 wrap mb16' }, chips.map(c => el('button', { class: 'btn btn-sm', text: c === 'todos' ? 'Todos' : (LBL[c] || c), onclick: e => { filtro = c; UI.$$('.filtro-on').forEach(x => x.classList.remove('filtro-on', 'btn-primary')); e.target.classList.add('btn-primary'); draw(); } }))));
      root.appendChild(el('div', { class: 'aviso info mb16', html: '📇 Registro de todos os e-mails disparados pela plataforma (aprovações e alertas automáticos de 80%, estouro, solicitação parada e plano vencido).' }));
      root.appendChild(cont);
      draw();

      function abrir(n) {
        UI.modal({ title: n.assunto, icon: ICO[n.tipo] || '✉️', body: el('div', {}, [
          el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: 'Destinatário' }), el('span', { class: 'v', text: n.destinatario })]),
          el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: 'Data' }), el('span', { class: 'v', text: F().data(n.data) })]),
          el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: 'Ação' }), el('span', { class: 'v' }, statusChip(n.status_acao))]),
          el('div', { class: 'mt12', style: { whiteSpace: 'pre-wrap', lineHeight: '1.6' }, text: n.corpo }),
        ]), footer: [el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: UI.closeModal })] });
      }
    },
  };

  function statusChip(st) {
    const m = { pendente: ['amarelo', 'Pendente'], aprovado: ['verde', 'Aprovado'], reprovado: ['vermelho', 'Reprovado'], enviado: ['cinza', 'Enviado'] };
    const x = m[st] || ['cinza', st];
    return el('span', { class: 'chip ' + x[0], text: x[1] });
  }
})(window);
