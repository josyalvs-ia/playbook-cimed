/* =========================================================================
   view-fila.js — Fila de Aprovação: workflow por alçada, painel de contexto
   orçamentário, histórico, aprovação em lote, nova solicitação e
   reclassificação contábil (Financeiro).
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;

  global.Views = global.Views || {};
  global.Views.fila = {
    render(root, s) {
      const selecionadas = new Set();
      const pend = s.pendentesDoPerfil().slice().sort((a, b) => F().diasUteis(b.data_solicitacao, s.db.HOJE) - F().diasUteis(a.data_solicitacao, s.db.HOJE));

      // header
      const header = el('div', { class: 'between mb16 wrap' }, [
        el('div', {}, [
          el('div', { style: { fontWeight: 700, fontSize: '15px' }, text: `${pend.length} solicitação(ões) na sua fila` }),
          el('div', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Perfil: ' + s.perfil }),
        ]),
        el('div', { class: 'row gap12' }, [
          el('button', { class: 'btn', id: 'btnLote', disabled: 'disabled', html: '✓ Aprovar em lote', onclick: () => aprovarLote() }),
          el('button', { class: 'btn btn-primary', html: '+ Nova solicitação', onclick: () => novaSolicitacao(s) }),
        ]),
      ]);
      root.appendChild(header);
      const btnLote = header.querySelector('#btnLote');

      if (s.perfil === 'Solicitante') {
        root.appendChild(el('div', { class: 'aviso info mb16', html: 'Como <b>Solicitante</b> você cria e acompanha pagamentos. As solicitações devolvidas para revisão aparecem abaixo.' }));
        const rev = s.db.solicitacoes.filter(x => x.status === 'Em revisão');
        root.appendChild(tabela(rev, s, selecionadas, btnLote, false));
        return;
      }

      if (!pend.length) { root.appendChild(el('div', { class: 'empty', html: '✓ Nenhuma solicitação pendente para o seu perfil.' })); return; }
      root.appendChild(tabela(pend, s, selecionadas, btnLote, true));

      function aprovarLote() {
        const lista = Array.from(selecionadas).map(id => s.db.solicitacoes.find(x => x.id === id)).filter(Boolean);
        if (!lista.length) return;
        UI.modal({
          title: 'Aprovar em lote', icon: '✓',
          body: el('div', {}, [
            el('p', { html: `Você está aprovando <b>${lista.length}</b> solicitação(ões), somando <b>${F().moeda(lista.reduce((a, x) => a + x.valor, 0))}</b>.` }),
            el('div', { class: 'aviso warn mt12', html: 'A ação será registrada no histórico de cada solicitação com o canal "Plataforma".' }),
          ]),
          footer: [
            el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }),
            el('button', { class: 'btn btn-verde', text: 'Confirmar aprovação', onclick: () => { s.aprovarLote(lista, { aprovador: s.perfil }); UI.closeModal(); UI.toast(lista.length + ' solicitação(ões) aprovada(s)', 'ok'); } }),
          ],
        });
      }
    },
  };

  function tabela(lista, s, selecionadas, btnLote, comCheck) {
    if (!lista.length) return el('div', { class: 'empty', text: 'Nenhuma solicitação.' });
    const tb = el('tbody');
    lista.forEach(sol => {
      const cc = s.cc(sol.centro_custo_id), conta = s.conta(sol.conta_contabil_id);
      const dias = F().diasUteis(sol.data_solicitacao, s.db.HOJE);
      const estoura = s.estouraOrcamento(sol);
      const tr = el('tr', {}, [
        comCheck ? el('td', { class: 'c' }, el('input', { type: 'checkbox', onchange: e => { e.target.checked ? selecionadas.add(sol.id) : selecionadas.delete(sol.id); btnLote.disabled = selecionadas.size === 0; } })) : null,
        el('td', {}, [
          el('div', { style: { fontWeight: 600 }, text: sol.fornecedor }),
          el('div', { class: 'muted', style: { fontSize: '11.5px' } }, [document.createTextNode(sol.numero + ' · '), el('span', { html: UI.statusPill(sol.status) })]),
        ]),
        el('td', { class: 'r mono', style: { fontWeight: 600 }, text: F().moeda(sol.valor) }),
        el('td', {}, [
          el('div', { class: 'mono', style: { fontSize: '12px' }, text: conta.codigo }),
          el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: conta.detalhe + (sol.capex ? '' : '') }),
        ]),
        el('td', {}, [el('div', { class: 'mono', style: { fontSize: '12px' }, text: cc.codigo }), el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: cc.nome })]),
        el('td', { class: 'c', text: F().data(sol.data_vencimento) }),
        el('td', { class: 'c' }, el('span', { class: 'chip ' + (dias > 3 ? 'vermelho' : 'cinza'), text: dias + 'd' })),
        el('td', {}, el('div', { class: 'row gap6 wrap' }, [
          sol.capex ? el('span', { class: 'chip capex', text: 'CAPEX' }) : null,
          estoura ? el('span', { class: 'tag-estouro', text: 'Estouro de orçamento' }) : null,
          sol.provisao_id ? el('span', { class: 'chip prov', text: 'Provisão' }) : null,
        ])),
        el('td', { class: 'c' }, el('button', { class: 'btn btn-sm btn-primary', text: 'Abrir', onclick: () => abrirSolicitacao(sol, s) })),
      ]);
      tb.appendChild(tr);
    });
    return el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, [
      el('thead', {}, el('tr', {}, [
        comCheck ? el('th', { class: 'c', style: { width: '36px' } }) : null,
        el('th', { text: 'Fornecedor' }), el('th', { class: 'r', text: 'Valor' }),
        el('th', { text: 'Conta contábil' }), el('th', { text: 'Centro de custo' }),
        el('th', { class: 'c', text: 'Vencimento' }), el('th', { class: 'c', text: 'Parado' }),
        el('th', { text: 'Marcações' }), el('th', { class: 'c', text: '' }),
      ])),
      tb,
    ]));
  }

  // ---------------- detalhe + painel de contexto ----------------
  function abrirSolicitacao(sol, s) {
    const cc = s.cc(sol.centro_custo_id), conta = s.conta(sol.conta_contabil_id), dep = s.depDoCC(sol.centro_custo_id);
    const ctx = s.consumoContaCC(sol.centro_custo_id, sol.conta_contabil_id);
    const pctAntes = ctx.orcado > 0 ? ctx.realizado / ctx.orcado * 100 : 0;
    const pctDepois = ctx.orcado > 0 ? (ctx.realizado + sol.valor) / ctx.orcado * 100 : 0;
    const estoura = s.estouraOrcamento(sol);
    const prov = sol.provisao_id ? s.db._prov.get(sol.provisao_id) : null;
    const necess = s.niveisNecessarios(sol);

    const detalhe = el('div', {}, [
      el('div', { class: 'row wrap gap6 mb12' }, [
        el('span', { html: UI.statusPill(sol.status) }),
        sol.capex ? el('span', { class: 'chip capex', text: 'CAPEX — Investimento' }) : el('span', { class: 'chip cinza', text: 'Custeio' }),
        estoura ? el('span', { class: 'tag-estouro', text: 'Estouro de orçamento' }) : null,
      ]),
      linha('Número', sol.numero), linha('Fornecedor', sol.fornecedor + '  ·  ' + sol.cnpj),
      linha('Descrição', sol.descricao),
      linha('Valor', F().moeda(sol.valor)),
      linha('Conta contábil', `<span class="mono">${conta.codigo}</span> ${conta.detalhe}`),
      linha('Grupo / Categoria', `${conta.grupo_nome} · ${conta.categoria_id || '—'}`),
      linha('Centro de custo', `${cc.codigo} — ${cc.nome} (${dep.nome})`),
      linha('Solicitante', sol.solicitante),
      linha('Solicitado em', F().data(sol.data_solicitacao)), linha('Vencimento', F().data(sol.data_vencimento)),
      linha('Urgência', sol.urgencia),
      linha('Alçada necessária', `${necess} nível(is)` + (estoura ? ' <span class="muted">(+1 por estouro)</span>' : '')),
      prov ? linha('Provisão vinculada', `${prov.descricao} — saldo ${F().moeda(prov.valor_provisionado - prov.valor_consumido)}`) : null,
    ]);

    // histórico
    const hist = s.historico(sol.id);
    const histBox = el('div', { class: 'mt16' }, [el('div', { class: 'card-title', text: 'Histórico' })]);
    if (!hist.length) histBox.appendChild(el('div', { class: 'muted', text: 'Sem registros ainda.' }));
    hist.forEach(h => histBox.appendChild(el('div', { style: { borderLeft: '3px solid var(--borda)', padding: '4px 0 10px 12px', marginLeft: '4px' } }, [
      el('div', { style: { fontWeight: 600, fontSize: '13px' } }, [document.createTextNode((h.decisao || h.tipo) + ' · '), el('span', { class: 'chip cinza', text: h.canal })]),
      el('div', { class: 'muted', style: { fontSize: '12px' } , text: `${h.aprovador} — ${F().dataHora(h.data_hora)}` }),
      h.comentario ? el('div', { style: { fontSize: '12.5px', marginTop: '3px' }, text: h.comentario }) : null,
    ])));

    // painel de contexto
    const painel = el('div', { class: 'card card-pad painel-ctx' }, [
      el('div', { class: 'card-title', html: '📅 Contexto orçamentário — conta no exercício' }),
      ctxRow('Orçado da conta (CC)', F().moeda(ctx.orcado)),
      ctxRow('Realizado', F().moeda(ctx.realizado)),
      ctxRow('Comprometido', F().moeda(ctx.comprometido)),
      ctxRow('Saldo disponível', F().moeda(ctx.saldo), ctx.saldo < 0 ? 'var(--vermelho)' : null),
      el('div', { class: 'ctx-antes-depois' }, [
        el('div', { class: 'ctx-ad' }, [el('div', { class: 't', text: '% consumo ANTES' }), el('div', { class: 'p', style: { color: cor(pctAntes) }, text: F().pct(pctAntes) })]),
        el('div', { class: 'ctx-ad' }, [el('div', { class: 't', text: '% consumo DEPOIS' }), el('div', { class: 'p', style: { color: cor(pctDepois) }, text: F().pct(pctDepois) })]),
      ]),
      estoura ? el('div', { class: 'aviso err mt12', html: `🚩 Esta aprovação estoura o orçado da conta. Excedente de <b>${F().moeda((ctx.realizado + sol.valor) - ctx.orcado)}</b>. A solicitação subiu um nível de alçada.` })
              : el('div', { class: 'aviso ok mt12', html: '✓ Dentro do orçamento previsto para a conta.' }),
      prov ? el('div', { class: 'aviso info mt12', html: `🔗 Provisão vinculada: <b>${F().moeda(prov.valor_provisionado)}</b> provisionado, <b>${F().moeda(prov.valor_consumido)}</b> consumido.` }) : null,
    ]);

    const podeAgir = s.perfil !== 'Solicitante' && sol.status.startsWith('Pendente');
    const footer = [];
    if (podeAgir) {
      footer.push(el('button', { class: 'btn', text: 'Devolver para revisão', onclick: () => acao('devolver') }));
      footer.push(el('button', { class: 'btn btn-vermelho', text: 'Reprovar', onclick: () => acao('reprovar') }));
      footer.push(el('button', { class: 'btn btn-verde', text: 'Aprovar', onclick: () => acao('aprovar') }));
    }
    if (s.perfil === 'Financeiro/Admin' && (sol.status === 'Aprovada' || sol.status === 'Paga')) {
      footer.push(el('button', { class: 'btn', text: '↔ Reclassificar conta', onclick: () => reclassificar(sol, s) }));
    }
    footer.push(el('button', { class: 'btn btn-ghost', text: 'Fechar', onclick: UI.closeModal }));

    UI.modal({
      title: 'Solicitação ' + sol.numero, size: 'lg',
      body: el('div', { class: 'split' }, [el('div', {}, [detalhe, histBox]), painel]),
      footer,
    });

    function acao(tipo) {
      if (tipo === 'aprovar') {
        s.aprovar(sol, { aprovador: s.perfil === 'Financeiro/Admin' ? 'Financeiro' : s._aprovadorAtual(sol) });
        UI.closeModal(); UI.toast('Solicitação aprovada' + (sol.status.startsWith('Pendente') ? ' — enviada ao próximo nível' : ''), 'ok');
      } else {
        const obrig = tipo === 'reprovar';
        const ta = el('textarea', { placeholder: obrig ? 'Comentário obrigatório…' : 'Comentário (opcional)…' });
        UI.modal({
          title: tipo === 'reprovar' ? 'Reprovar solicitação' : 'Devolver para revisão',
          body: el('div', {}, [el('div', { class: 'form-field full' }, [el('label', { text: 'Comentário' }), ta])]),
          footer: [
            el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }),
            el('button', { class: 'btn ' + (tipo === 'reprovar' ? 'btn-vermelho' : 'btn-primary'), text: 'Confirmar', onclick: () => {
              if (obrig && !ta.value.trim()) { UI.toast('O comentário é obrigatório para reprovar', 'err'); return; }
              if (tipo === 'reprovar') s.reprovar(sol, ta.value.trim(), { aprovador: s.perfil });
              else s.devolver(sol, ta.value.trim(), { aprovador: s.perfil });
              UI.closeModal(); UI.toast(tipo === 'reprovar' ? 'Solicitação reprovada' : 'Devolvida para revisão', tipo === 'reprovar' ? 'err' : 'warn');
            } }),
          ],
        });
      }
    }
  }

  function reclassificar(sol, s) {
    let nova = null;
    const busca = UI.contaSearch({ contas: s.db.contas_contabeis, soAnaliticasPag: true, onSelect: c => nova = c, placeholder: 'Nova conta contábil…' });
    const just = el('textarea', { placeholder: 'Justificativa da reclassificação…' });
    UI.modal({
      title: 'Reclassificar conta contábil',
      body: el('div', {}, [
        el('div', { class: 'aviso info mb12', html: `Conta atual: <b class="mono">${s.conta(sol.conta_contabil_id).codigo}</b> ${s.conta(sol.conta_contabil_id).detalhe}` }),
        el('div', { class: 'form-field full mb12' }, [el('label', { text: 'Nova conta' }), busca]),
        el('div', { class: 'form-field full' }, [el('label', { text: 'Justificativa' }), just]),
      ]),
      footer: [
        el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }),
        el('button', { class: 'btn btn-primary', text: 'Reclassificar', onclick: () => {
          if (!nova) { UI.toast('Selecione a nova conta', 'err'); return; }
          if (!just.value.trim()) { UI.toast('A justificativa é obrigatória', 'err'); return; }
          s.reclassificarConta(sol, nova.id, just.value.trim(), 'Financeiro');
          UI.closeModal(); UI.toast('Conta reclassificada e registrada no histórico', 'ok');
        } }),
      ],
    });
  }

  // ---------------- nova solicitação ----------------
  function novaSolicitacao(s) {
    let conta = null;
    const campos = {};
    const infoConta = el('div', { class: 'hint mt8' });
    const avisoOrc = el('div', {});

    const busca = UI.contaSearch({
      contas: s.db.contas_contabeis, soAnaliticasPag: true, placeholder: 'Buscar conta por código ou descrição…',
      onSelect: c => { conta = c; atualizaConta(); },
    });
    function atualizaConta() {
      if (!conta) { infoConta.innerHTML = ''; avisoOrc.innerHTML = ''; return; }
      infoConta.innerHTML = `Grupo <b>${conta.grupo_nome}</b> · Categoria <b>${conta.categoria_id || '—'}</b> · ${conta.tipo === 'Investimento' ? '<span class="chip capex">CAPEX / Investimento</span>' : 'Custeio'}${conta.provisao ? ' · <span class="chip prov">Conta de provisão</span>' : ''}`;
      validarOrcamento();
    }
    function validarOrcamento() {
      avisoOrc.innerHTML = '';
      const ccId = +campos.cc.value;
      if (!conta || !ccId) return;
      const mes = s.db.MES_ATUAL;
      const existe = s.db.orcamento.some(o => o.centro_custo_id === ccId && o.conta_contabil_id === conta.id && o.ano === s.db.ANO && o.mes === mes);
      if (!existe) avisoOrc.appendChild(el('div', { class: 'aviso err mt12', html: '⛔ Não há orçamento previsto para esta conta neste centro de custo.' }));
      else {
        const ctx = s.consumoContaCC(ccId, conta.id);
        avisoOrc.appendChild(el('div', { class: 'aviso ok mt12', html: `✓ Orçamento previsto. Saldo atual da conta no CC: <b>${F().moeda(ctx.saldo)}</b> (${F().pct(ctx.pct)} consumido).` }));
        if (conta.provisao) {
          const prov = s.db.provisoes.find(p => p.centro_custo_id === ccId && p.conta_contabil_id === conta.id && (p.status === 'aberta' || p.status === 'parcial'));
          if (prov) avisoOrc.appendChild(el('div', { class: 'aviso info mt8', html: `🔗 Provisão aberta sugerida: <b>${prov.descricao}</b> — saldo ${F().moeda(prov.valor_provisionado - prov.valor_consumido)}. Será vinculada automaticamente.` }));
        }
      }
    }

    campos.cc = el('select', { onchange: validarOrcamento }, s.db.centros_custo.map(c => el('option', { value: c.id, text: c.codigo + ' — ' + c.nome })));
    campos.forn = el('input', { placeholder: 'Razão social do fornecedor' });
    campos.cnpj = el('input', { placeholder: '00.000.000/0000-00' });
    campos.desc = el('input', { placeholder: 'Descrição do pagamento' });
    campos.valor = el('input', { type: 'number', placeholder: '0,00', min: '0', step: '0.01' });
    campos.venc = el('input', { type: 'date', value: F().data(s.db.HOJE).split('/').reverse().join('-') });
    campos.urg = el('select', {}, ['Normal', 'Alta', 'Baixa'].map(u => el('option', { value: u, text: u })));

    const form = el('div', {}, [
      el('div', { class: 'form-field full mb12' }, [el('label', { text: 'Conta contábil (só analíticas ativas que geram pagamento)' }), busca, infoConta]),
      el('div', { class: 'form-grid' }, [
        el('div', { class: 'form-field' }, [el('label', { text: 'Centro de custo' }), campos.cc]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Valor (R$)' }), campos.valor]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Fornecedor' }), campos.forn]),
        el('div', { class: 'form-field' }, [el('label', { text: 'CNPJ' }), campos.cnpj]),
        el('div', { class: 'form-field full' }, [el('label', { text: 'Descrição' }), campos.desc]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Vencimento' }), campos.venc]),
        el('div', { class: 'form-field' }, [el('label', { text: 'Urgência' }), campos.urg]),
      ]),
      avisoOrc,
    ]);

    UI.modal({
      title: 'Nova solicitação de pagamento', size: 'lg', icon: '📝', body: form,
      footer: [
        el('button', { class: 'btn', text: 'Cancelar', onclick: UI.closeModal }),
        el('button', { class: 'btn btn-primary', text: 'Enviar para aprovação', onclick: enviar }),
      ],
    });

    function enviar() {
      const ccId = +campos.cc.value, valor = parseFloat(campos.valor.value);
      if (!conta) return UI.toast('Selecione a conta contábil', 'err');
      if (!valor || valor <= 0) return UI.toast('Informe um valor válido', 'err');
      if (!campos.forn.value.trim()) return UI.toast('Informe o fornecedor', 'err');
      const existe = s.db.orcamento.some(o => o.centro_custo_id === ccId && o.conta_contabil_id === conta.id && o.ano === s.db.ANO && o.mes === s.db.MES_ATUAL);
      if (!existe) return UI.toast('Não há orçamento previsto para esta conta neste centro de custo', 'err');
      const prov = conta.provisao ? s.db.provisoes.find(p => p.centro_custo_id === ccId && p.conta_contabil_id === conta.id && (p.status === 'aberta' || p.status === 'parcial')) : null;
      const sol = s.criarSolicitacao({
        fornecedor: campos.forn.value.trim(), cnpj: campos.cnpj.value.trim() || '—',
        descricao: campos.desc.value.trim() || conta.detalhe, valor,
        centro_custo_id: ccId, conta_contabil_id: conta.id, provisao_id: prov ? prov.id : null,
        solicitante: 'Você (' + s.perfil + ')', data_vencimento: campos.venc.value, urgencia: campos.urg.value,
      });
      UI.closeModal();
      UI.toast(`Solicitação ${sol.numero} criada — aguardando ${s.nomeNivel(1)}` + (s.estouraOrcamento(sol) ? ' · marcada como estouro' : ''), 'ok');
    }
  }

  // helpers
  function linha(k, v) { return el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', html: v })]); }
  function ctxRow(k, v, corV) { return el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', style: corV ? { color: corV } : {}, text: v })]); }
  function cor(pct) { return pct >= 100 ? 'var(--vermelho)' : pct >= 80 ? 'var(--amarelo)' : 'var(--verde)'; }
  global.Fila = { abrirSolicitacao, novaSolicitacao };
})(window);
