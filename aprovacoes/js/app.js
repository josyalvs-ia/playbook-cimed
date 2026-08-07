/* =========================================================================
   app.js — Shell da aplicação: menu lateral, topo com seletor de perfil,
   barra de filtros globais e roteamento por hash.
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, F = () => global.Fmt;
  const el = UI.el;

  const PERFIS = ['Solicitante', 'Gestor', 'Diretor', 'Financeiro/Admin'];

  function ico(name) {
    const P = {
      dashboard: '<path d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z"/>',
      fila: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
      orcado: '<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="12" y="6" width="3" height="12"/><rect x="17" y="13" width="3" height="5"/>',
      prov: '<path d="M20 7L9 18l-5-5"/><circle cx="12" cy="12" r="9"/>',
      notif: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
      import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      plano: '<path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z"/>',
      insight: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-12z"/>',
      acao: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
      inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    };
    return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  }

  const NAV = [
    { sec: 'Visão Geral' },
    { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
    { id: 'fila', label: 'Fila de Aprovação', ic: 'fila', badge: () => store().pendentesDoPerfil().length },
    { id: 'insights', label: 'Insights Estratégicos', ic: 'insight' },
    { sec: 'Orçamentário' },
    { id: 'orcado', label: 'Orçado x Realizado', ic: 'orcado' },
    { id: 'provisoes', label: 'Provisões', ic: 'prov' },
    { id: 'planos', label: 'Planos de Ação', ic: 'acao', badge: () => store().db.planos_acao.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length },
    { sec: 'Comunicação' },
    { id: 'notificacoes', label: 'Central de Notificações', ic: 'notif' },
    { id: 'inbox', label: 'Caixa de Entrada Simulada', ic: 'inbox' },
    { sec: 'Cadastros' },
    { id: 'plano-contas', label: 'Plano de Contas', ic: 'plano' },
    { id: 'importacao', label: 'Importação de Dados', ic: 'import' },
  ];

  const COM_FILTROS = new Set(['dashboard', 'orcado', 'insights']);
  const TITULOS = {
    dashboard: 'Dashboard', fila: 'Fila de Aprovação', insights: 'Insights Estratégicos',
    orcado: 'Orçado x Realizado', provisoes: 'Provisões', planos: 'Planos de Ação',
    notificacoes: 'Central de Notificações', inbox: 'Caixa de Entrada Simulada',
    'plano-contas': 'Plano de Contas', importacao: 'Importação de Dados',
  };

  function store() { return global.Store; }

  const App = {
    rota: 'dashboard',
    montar() {
      const s = store();
      document.body.innerHTML = '';
      this.appEl = el('div', { class: 'app' });
      this.sidebar = this._sidebar();
      this.mainEl = el('div', { class: 'main' });
      this.topbarEl = el('div', { class: 'topbar' });
      this.filtrosEl = el('div', {});
      this.contentEl = el('div', {});
      const scroll = el('div', { class: 'content' }, [this.filtrosEl, this.contentEl]);
      this.mainEl.appendChild(this.topbarEl);
      this.mainEl.appendChild(scroll);
      this.appEl.appendChild(this.sidebar);
      this.appEl.appendChild(this.mainEl);
      document.body.appendChild(this.appEl);

      s.on(() => this.refresh());
      window.addEventListener('hashchange', () => this.roteia());
      this.roteia();
    },

    _sidebar() {
      const nav = el('div', { class: 'nav' });
      this.navItems = {};
      NAV.forEach(n => {
        if (n.sec) { nav.appendChild(el('div', { class: 'nav-sec', text: n.sec })); return; }
        const item = el('div', { class: 'nav-item', onclick: () => { location.hash = '#/' + n.id; } }, [
          el('span', { html: ico(n.ic) }),
          el('span', { text: n.label }),
        ]);
        item._def = n;
        this.navItems[n.id] = item;
        nav.appendChild(item);
      });
      return el('div', { class: 'sidebar' }, [
        el('div', { class: 'sidebar-brand' }, [
          el('div', { class: 'logo' }, [el('span', { class: 'mark', text: '₽' }), el('span', { text: 'Aprova' })]),
          el('div', { class: 'sub', text: 'Aprovação de Pagamentos' }),
        ]),
        nav,
        el('div', { class: 'sidebar-foot' }, [
          el('div', { text: 'Orçamento ' + store().db.ANO }),
          el('a', { href: 'javascript:void 0', style: { color: 'rgba(255,255,255,.6)' }, text: 'Reiniciar dados da demo', onclick: () => store().resetar() }),
        ]),
      ]);
    },

    _topbar() {
      this.topbarEl.innerHTML = '';
      const s = store();
      this.topbarEl.appendChild(el('div', {}, [
        el('h1', { text: TITULOS[this.rota] || '' }),
        el('div', { class: 'crumb', text: 'Exercício ' + s.db.ANO + ' · dados fictícios para demonstração' }),
      ]));
      const perfilSel = el('select', { onchange: e => s.setPerfil(e.target.value) },
        PERFIS.map(p => el('option', { value: p, selected: p === s.perfil ? 'selected' : null, text: p })));
      this.topbarEl.appendChild(el('div', { class: 'topbar-right' }, [
        el('div', { class: 'perfil-sel' }, [el('label', { text: 'Perfil' }), perfilSel]),
        el('div', { class: 'avatar', text: iniciais(s.perfil) }),
      ]));
    },

    _filtros() {
      const s = store();
      this.filtrosEl.innerHTML = '';
      if (!COM_FILTROS.has(this.rota)) return;
      const f = s.filtros;
      const opt = (v, t, sel) => el('option', { value: v, selected: sel ? 'selected' : null, text: t });

      // conta list depende de categoria
      const contasDisp = s.db.contas_contabeis.filter(c => c.aceita_lancamento && (f.categoria === 'todas' || c.categoria_id === f.categoria));

      const selDep = el('select', { onchange: e => s.setFiltros({ departamento: e.target.value, centro: 'todos' }) }, [opt('todos', 'Todos', f.departamento === 'todos'), ...s.db.departamentos.map(d => opt(d.id, d.nome, +f.departamento === d.id))]);
      const centrosDoDep = s.db.centros_custo.filter(c => f.departamento === 'todos' || c.departamento_id === +f.departamento);
      const selCC = el('select', { onchange: e => s.setFiltro('centro', e.target.value) }, [opt('todos', 'Todos', f.centro === 'todos'), ...centrosDoDep.map(c => opt(c.id, c.codigo + ' — ' + c.nome, +f.centro === c.id))]);
      const selCat = el('select', { onchange: e => s.setFiltros({ categoria: e.target.value, contas: [] }) }, [opt('todas', 'Todas', f.categoria === 'todas'), ...PlanoContas.CATEGORIAS.map(c => opt(c, c, f.categoria === c))]);
      const selTipo = el('select', { onchange: e => s.setFiltro('tipo', e.target.value) }, [opt('todos', 'Todos', f.tipo === 'todos'), opt('Custeio', 'Custeio', f.tipo === 'Custeio'), opt('Investimento', 'Investimento (CAPEX)', f.tipo === 'Investimento')]);
      const statuses = ['todos', 'Rascunho', 'Pendente Nível 1', 'Pendente Nível 2', 'Pendente Nível 3', 'Em revisão', 'Aprovada', 'Reprovada', 'Paga'];
      const selStatus = el('select', { onchange: e => s.setFiltro('status', e.target.value) }, statuses.map(st => opt(st, st === 'todos' ? 'Todos' : st, f.status === st)));

      const mesOpts = (val, on) => el('select', { onchange: on }, F().meses.map((m, i) => el('option', { value: i + 1, selected: (i + 1) === val ? 'selected' : null, text: m + '/' + String(s.db.ANO).slice(2) })));
      const mesIni = mesOpts(f.mesIni, e => s.setFiltro('mesIni', +e.target.value));
      const mesFim = mesOpts(f.mesFim, e => s.setFiltro('mesFim', +e.target.value));

      // conta multi-select (busca)
      const contaBtn = el('button', { class: 'btn', style: { width: '100%', justifyContent: 'space-between' }, onclick: () => this._modalContas(contasDisp) }, [
        el('span', { text: f.contas.length ? f.contas.length + ' conta(s) selecionada(s)' : 'Todas as contas' }),
        el('span', { html: '&#9662;' }),
      ]);

      const grid = el('div', { class: 'filtros-grid' }, [
        field('Ano', el('select', {}, [opt(s.db.ANO, s.db.ANO, true)])),
        field('Departamento', selDep),
        field('Centro de Custo', selCC),
        field('Categoria', selCat),
        field('Conta Contábil', contaBtn),
        field('Tipo', selTipo),
        field('Status', selStatus),
        field('Mês inicial', mesIni),
        field('Mês final', mesFim),
      ]);
      const foot = el('div', { class: 'filtros-foot' }, [
        el('button', { class: 'btn btn-sm', onclick: () => s.limparFiltros(), html: '↺ Limpar filtros' }),
        el('span', { class: 'hint', text: 'Os filtros recalculam todos os indicadores, gráficos e insights.' }),
      ]);
      this.filtrosEl.appendChild(el('div', { class: 'filtros' }, [grid, foot]));

      function field(label, control) { return el('div', { class: 'f-field' }, [el('label', { text: label }), control]); }
    },

    _modalContas(contasDisp) {
      const s = store();
      const sel = new Set(s.filtros.contas);
      const lista = el('div', { style: { maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--borda)', borderRadius: '10px' } });
      const busca = el('input', { class: '', placeholder: 'Filtrar por código ou descrição…', style: { width: '100%', padding: '9px 10px', border: '1px solid var(--borda)', borderRadius: '9px', marginBottom: '10px' } });
      function render(termo) {
        lista.innerHTML = '';
        const t = (termo || '').toLowerCase(); const n = PlanoContas.normaliza(termo || '');
        contasDisp.filter(c => c.codigo.includes(t) || PlanoContas.normaliza(c.detalhe).includes(n)).slice(0, 200).forEach(c => {
          const cb = el('input', { type: 'checkbox', checked: sel.has(c.id) ? 'checked' : null, onchange: e => { e.target.checked ? sel.add(c.id) : sel.delete(c.id); } });
          lista.appendChild(el('label', { class: 'conta-opt', style: { flexDirection: 'row', alignItems: 'center', gap: '10px' } }, [
            cb, el('span', { class: 'co-cod', text: c.codigo }), el('span', { class: 'co-desc', text: c.detalhe }), el('span', { class: 'co-meta', text: c.categoria_id || '' }),
          ]));
        });
      }
      busca.addEventListener('input', () => render(busca.value));
      render('');
      UI.modal({
        title: 'Selecionar contas contábeis', size: 'lg',
        body: [busca, lista],
        footer: [
          el('button', { class: 'btn', text: 'Limpar seleção', onclick: () => { sel.clear(); render(busca.value); } }),
          el('button', { class: 'btn btn-primary', text: 'Aplicar', onclick: () => { s.setFiltro('contas', Array.from(sel)); UI.closeModal(); } }),
        ],
      });
    },

    roteia() {
      let h = (location.hash || '#/dashboard').replace(/^#\//, '');
      if (h.startsWith('aprovar')) { this._external = true; global.EmailFlow.paginaAprovacao(h); return; }
      this._external = false;
      if (!TITULOS[h]) h = 'dashboard';
      this.rota = h;
      this.refresh();
    },

    refresh() {
      // enquanto a página leve de aprovação está ativa, o app não se redesenha
      // (mutações do Store não devem sobrepor o comprovante)
      if (this._external) return;
      // restaura shell caso a página de aprovação tenha tomado o body
      if (!document.body.contains(this.appEl)) { document.body.innerHTML = ''; document.body.appendChild(this.appEl); }
      this._topbar();
      Object.keys(this.navItems).forEach(id => {
        const it = this.navItems[id];
        it.classList.toggle('active', id === this.rota);
        const b = it.querySelector('.badge'); if (b) b.remove();
        if (it._def.badge) { const n = it._def.badge(); if (n > 0) it.appendChild(el('span', { class: 'badge', text: n })); }
      });
      this._filtros();
      this.contentEl.innerHTML = '';
      const view = global.Views[this.rota];
      if (view) view.render(this.contentEl, store());
      else this.contentEl.appendChild(el('div', { class: 'empty', text: 'Tela em construção.' }));
      window.scrollTo(0, 0);
    },

    ir(rota) { location.hash = '#/' + rota; },
  };

  function iniciais(nome) { return nome.split(/[\s/]/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }

  global.Views = global.Views || {};
  global.App = App;

  function boot() { global.Store.init(); App.montar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
