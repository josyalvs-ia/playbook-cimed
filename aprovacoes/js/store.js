/* =========================================================================
   store.js — Estado da aplicação, filtros globais e cálculos derivados.
   Conceitos (exatos):
     Orçado        = soma de valor_orcado no recorte
     Realizado     = solicitações Aprovada/Paga + lançamentos (contas não-pag.)
     Comprometido  = solicitações pendentes de aprovação
     Saldo         = Orçado - Realizado - Comprometido
     % consumo     = Realizado / Orçado * 100
   ========================================================================= */
(function (global) {
  'use strict';

  const STATUS = {
    RASCUNHO: 'Rascunho',
    P1: 'Pendente Nível 1', P2: 'Pendente Nível 2', P3: 'Pendente Nível 3',
    REVISAO: 'Em revisão', APROVADA: 'Aprovada', REPROVADA: 'Reprovada', PAGA: 'Paga',
  };
  const REALIZADO_STATUS = [STATUS.APROVADA, STATUS.PAGA];
  const PENDENTE_STATUS = [STATUS.P1, STATUS.P2, STATUS.P3];

  const Store = {
    db: null,
    perfil: 'Financeiro/Admin',
    listeners: [],
    filtros: null,

    init() {
      const plano = PlanoContas.parseTexto(PlanoContas.CARGA_INICIAL_TEXTO);
      this.db = Seed.gerar(plano);
      this._index();
      this._restaurar();
      this.filtros = this.filtrosPadrao();
      return this;
    },

    filtrosPadrao() {
      return {
        ano: this.db.ANO, mesIni: 1, mesFim: 12,
        departamento: 'todos', centro: 'todos', categoria: 'todas',
        contas: [], tipo: 'todos', status: 'todos',
      };
    },

    _index() {
      const d = this.db;
      d._cc = new Map(d.centros_custo.map(c => [c.id, c]));
      d._dep = new Map(d.departamentos.map(x => [x.id, x]));
      d._conta = new Map(d.contas_contabeis.map(c => [c.id, c]));
      d._contaCod = new Map(d.contas_contabeis.map(c => [c.codigo, c]));
      d._prov = new Map(d.provisoes.map(p => [p.id, p]));
    },

    // ---------------- persistência (mutações da demo) ----------------
    _key: 'aprovacoes_state_v1',
    _persistir() {
      try {
        const patch = {
          solicitacoes: this.db.solicitacoes.map(s => ({ id: s.id, status: s.status, nivel_atual: s.nivel_atual, conta_contabil_id: s.conta_contabil_id, _hist: s._hist })),
          aprovacoes: this.db.aprovacoes.filter(a => a._novo),
          planos: this.db.planos_acao.filter(p => p._novo || p._alterado),
          andamentos: this.db.planos_acao_andamentos.filter(a => a._novo),
        };
        localStorage.setItem(this._key, JSON.stringify(patch));
      } catch (e) { /* ignore */ }
    },
    _restaurar() { /* estado inicial sempre reconstruído; patches aplicados em memória */ },
    resetar() { try { localStorage.removeItem(this._key); } catch (e) {} location.reload(); },

    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(fn => fn()); },

    setPerfil(p) { this.perfil = p; this.emit(); },
    setFiltro(k, v) { this.filtros[k] = v; this.emit(); },
    setFiltros(obj) { Object.assign(this.filtros, obj); this.emit(); },
    limparFiltros() { this.filtros = this.filtrosPadrao(); this.emit(); },

    // ---------------- helpers de lookup ----------------
    cc(id) { return this.db._cc.get(id); },
    dep(id) { return this.db._dep.get(id); },
    conta(id) { return this.db._conta.get(id); },
    contaCod(cod) { return this.db._contaCod.get(cod); },
    depDoCC(ccId) { const c = this.cc(ccId); return c ? this.dep(c.departamento_id) : null; },
    categoriaNome(id) { const c = this.conta(id); return c ? c.categoria_id : null; },

    // ---------------- matchers de filtro ----------------
    _mesMatch(mes) { const f = this.filtros; return mes >= f.mesIni && mes <= f.mesFim; },
    _ccMatch(ccId) {
      const f = this.filtros, cc = this.cc(ccId);
      if (!cc) return false;
      if (f.departamento !== 'todos' && cc.departamento_id !== +f.departamento) return false;
      if (f.centro !== 'todos' && cc.id !== +f.centro) return false;
      return true;
    },
    _contaMatch(contaId) {
      const f = this.filtros, c = this.conta(contaId);
      if (!c) return false;
      if (f.categoria !== 'todas' && c.categoria_id !== f.categoria) return false;
      if (f.contas.length && !f.contas.includes(c.id)) return false;
      if (f.tipo !== 'todos') {
        const tp = c.tipo === 'Investimento' ? 'Investimento' : 'Custeio';
        if (tp !== f.tipo) return false;
      }
      return true;
    },
    _solStatusMatch(s) {
      const f = this.filtros;
      if (f.status === 'todos') return true;
      return s.status === f.status;
    },

    // ---------------- coleções filtradas ----------------
    orcamentoFiltrado() {
      const f = this.filtros;
      return this.db.orcamento.filter(o =>
        o.ano === f.ano && this._mesMatch(o.mes) && this._ccMatch(o.centro_custo_id) && this._contaMatch(o.conta_contabil_id));
    },
    solicitacoesFiltradas() {
      return this.db.solicitacoes.filter(s =>
        this._mesMatch(s._mes) && this._ccMatch(s.centro_custo_id) &&
        this._contaMatch(s.conta_contabil_id) && this._solStatusMatch(s));
    },
    lancamentosFiltrados() {
      const f = this.filtros;
      return this.db.lancamentos.filter(l =>
        l.ano === f.ano && this._mesMatch(l.mes) && this._ccMatch(l.centro_custo_id) && this._contaMatch(l.conta_contabil_id));
    },

    isRealizado(s) { return REALIZADO_STATUS.includes(s.status); },
    isComprometido(s) { return PENDENTE_STATUS.includes(s.status); },

    // ---------------- agregados do recorte atual ----------------
    agregados() {
      const orc = this.orcamentoFiltrado().reduce((a, o) => a + o.valor_orcado, 0);
      let real = 0, comp = 0, pendQtd = 0, pendVal = 0;
      this.solicitacoesFiltradas().forEach(s => {
        if (this.isRealizado(s)) real += s.valor;
        else if (this.isComprometido(s)) { comp += s.valor; pendQtd++; pendVal += s.valor; }
      });
      const lanc = this.lancamentosFiltrados().reduce((a, l) => a + l.valor, 0);
      real += lanc;
      const saldo = orc - real - comp;
      const pct = orc > 0 ? (real / orc) * 100 : 0;
      return { orcado: orc, realizado: real, comprometido: comp, saldo, pct, pendQtd, pendVal };
    },

    // agregado genérico por chave (função classificadora)
    _agrupar(keyFnOrc, keyFnSol) {
      const map = new Map();
      const get = (k, label) => { if (!map.has(k)) map.set(k, { key: k, label, orcado: 0, realizado: 0, comprometido: 0 }); return map.get(k); };
      this.orcamentoFiltrado().forEach(o => { const r = keyFnOrc(o); if (r) get(r.k, r.label).orcado += o.valor_orcado; });
      this.lancamentosFiltrados().forEach(l => { const r = keyFnOrc(l); if (r) get(r.k, r.label).realizado += l.valor; });
      this.solicitacoesFiltradas().forEach(s => {
        const r = keyFnSol(s); if (!r) return;
        const o = get(r.k, r.label);
        if (this.isRealizado(s)) o.realizado += s.valor;
        else if (this.isComprometido(s)) o.comprometido += s.valor;
      });
      map.forEach(o => { o.saldo = o.orcado - o.realizado - o.comprometido; o.pct = o.orcado > 0 ? o.realizado / o.orcado * 100 : 0; });
      return Array.from(map.values());
    },

    porCentroCusto() {
      return this._agrupar(
        o => { const cc = this.cc(o.centro_custo_id); return cc ? { k: cc.id, label: cc.nome } : null; },
        s => { const cc = this.cc(s.centro_custo_id); return cc ? { k: cc.id, label: cc.nome } : null; }
      ).sort((a, b) => b.realizado - a.realizado);
    },
    porCategoria() {
      const kf = (row) => { const c = this.conta(row.conta_contabil_id); return c && c.categoria_id ? { k: c.categoria_id, label: c.categoria_id } : { k: '(sem categoria)', label: '(sem categoria)' }; };
      return this._agrupar(kf, s => kf(s)).sort((a, b) => b.realizado - a.realizado);
    },
    porDepartamento() {
      const kf = (row) => { const cc = this.cc(row.centro_custo_id); const d = cc ? this.dep(cc.departamento_id) : null; return d ? { k: d.id, label: d.nome } : null; };
      return this._agrupar(kf, s => kf(s)).sort((a, b) => b.realizado - a.realizado);
    },
    porConta() {
      const kf = (row) => { const c = this.conta(row.conta_contabil_id); return c ? { k: c.id, label: c.codigo + ' ' + c.detalhe } : null; };
      const arr = this._agrupar(kf, s => kf(s));
      arr.forEach(o => { o.conta = this.conta(o.key); });
      return arr;
    },
    porMes() {
      // realizado mensal + orçado acumulado
      const orcMes = new Array(13).fill(0), realMes = new Array(13).fill(0), compMes = new Array(13).fill(0);
      this.orcamentoFiltrado().forEach(o => orcMes[o.mes] += o.valor_orcado);
      this.lancamentosFiltrados().forEach(l => realMes[l.mes] += l.valor);
      this.solicitacoesFiltradas().forEach(s => {
        if (this.isRealizado(s)) realMes[s._mes] += s.valor;
        else if (this.isComprometido(s)) compMes[s._mes] += s.valor;
      });
      const out = [];
      let acumOrc = 0, acumReal = 0;
      for (let m = 1; m <= 12; m++) { acumOrc += orcMes[m]; acumReal += realMes[m]; out.push({ mes: m, orcado: orcMes[m], realizado: realMes[m], comprometido: compMes[m], orcadoAcum: acumOrc, realizadoAcum: acumReal }); }
      return out;
    },
    topContas(n) {
      return this.porConta().filter(x => x.realizado > 0).sort((a, b) => b.realizado - a.realizado).slice(0, n || 10);
    },
    topFornecedores(n) {
      const map = new Map();
      this.solicitacoesFiltradas().forEach(s => {
        if (!this.isRealizado(s)) return;
        const k = s.fornecedor;
        if (!map.has(k)) map.set(k, { fornecedor: k, cnpj: s.cnpj, valor: 0, qtd: 0 });
        const o = map.get(k); o.valor += s.valor; o.qtd++;
      });
      return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, n || 10);
    },

    // ---------------- orçado/realizado por CC+conta (sem filtro de status) ----------------
    consumoContaCC(ccId, contaId, ano, mesFim) {
      ano = ano || this.db.ANO; mesFim = mesFim || 12;
      let orc = 0, real = 0, comp = 0;
      this.db.orcamento.forEach(o => { if (o.centro_custo_id === ccId && o.conta_contabil_id === contaId && o.ano === ano && o.mes <= mesFim) orc += o.valor_orcado; });
      this.db.lancamentos.forEach(l => { if (l.centro_custo_id === ccId && l.conta_contabil_id === contaId && l.ano === ano && l.mes <= mesFim) real += l.valor; });
      this.db.solicitacoes.forEach(s => {
        if (s.centro_custo_id === ccId && s.conta_contabil_id === contaId && s._mes <= mesFim) {
          if (this.isRealizado(s)) real += s.valor; else if (this.isComprometido(s)) comp += s.valor;
        }
      });
      const saldo = orc - real - comp; const pct = orc > 0 ? real / orc * 100 : 0;
      return { orcado: orc, realizado: real, comprometido: comp, saldo, pct };
    },

    // ---------------- fila / workflow ----------------
    niveisPorValor(v) { return Seed.niveisPorValor(v); },
    nomeNivel(n) { return ['', 'Gestor do Centro de Custo', 'Gerente da Diretoria', 'Diretor', 'CFO'][n] || ('Nível ' + n); },

    /** verifica se a aprovação estoura o orçado da conta (sobe alçada) */
    estouraOrcamento(s) {
      const c = this.consumoContaCC(s.centro_custo_id, s.conta_contabil_id);
      return (c.realizado + s.valor) > c.orcado && c.orcado > 0;
    },
    niveisNecessarios(s) {
      let n = this.niveisPorValor(s.valor).length;
      if (this.estouraOrcamento(s)) n = Math.min(4, n + 1);
      return n;
    },

    pendentesDoPerfil() {
      const perfil = this.perfil;
      const pend = this.db.solicitacoes.filter(s => PENDENTE_STATUS.includes(s.status));
      if (perfil === 'Financeiro/Admin') return pend;
      const nivelPerfil = { 'Gestor': 1, 'Diretor': 3 }[perfil];
      if (perfil === 'Solicitante') return [];
      return pend.filter(s => {
        const nv = +s.status.replace(/\D/g, '');
        if (perfil === 'Gestor') return nv === 1 || nv === 2;
        if (perfil === 'Diretor') return nv >= 3;
        return true;
      });
    },

    historico(solId) {
      return this.db.aprovacoes.filter(a => a.solicitacao_id === solId)
        .concat((this.db.solicitacoes.find(s => s.id === solId) || {})._hist || [])
        .sort((a, b) => (a.data_hora < b.data_hora ? -1 : 1));
    },

    // ---------------- mutações ----------------
    _now() { return new Date().toISOString(); },
    _registraAprov(s, decisao, comentario, canal, aprovadorNome) {
      const nivel = s.nivel_atual || 1;
      const a = { id: (this.db.aprovacoes.length + 1000), solicitacao_id: s.id, aprovador: aprovadorNome, nivel, decisao, comentario: comentario || '', canal: canal || 'Plataforma', data_hora: this._now(), _novo: true };
      this.db.aprovacoes.push(a);
      return a;
    },
    aprovar(s, opts) {
      opts = opts || {};
      const canal = opts.canal || 'Plataforma';
      const aprovador = opts.aprovador || this._aprovadorAtual(s);
      const necess = s.niveis_necessarios || this.niveisNecessarios(s);
      this._registraAprov(s, 'Aprovada', opts.comentario || 'Aprovado.', canal, aprovador);
      const atual = s.nivel_atual || 1;
      if (atual >= necess) {
        s.status = STATUS.APROVADA;
        this._marcarEmail(s, 'aprovado');
      } else {
        s.nivel_atual = atual + 1;
        s.status = 'Pendente Nível ' + s.nivel_atual;
        this._dispararProximoEmail(s);
      }
      this._persistir(); this.emit();
      return s;
    },
    reprovar(s, comentario, opts) {
      opts = opts || {};
      this._registraAprov(s, 'Reprovada', comentario, opts.canal || 'Plataforma', opts.aprovador || this._aprovadorAtual(s));
      s.status = STATUS.REPROVADA;
      this._marcarEmail(s, 'reprovado');
      this._persistir(); this.emit();
      return s;
    },
    devolver(s, comentario, opts) {
      opts = opts || {};
      this._registraAprov(s, 'Devolvida', comentario, opts.canal || 'Plataforma', opts.aprovador || this._aprovadorAtual(s));
      s.status = STATUS.REVISAO;
      this._persistir(); this.emit();
      return s;
    },
    aprovarLote(lista, opts) { lista.forEach(s => this.aprovar(s, opts)); },

    reclassificarConta(s, novaContaId, justificativa, autor) {
      const de = this.conta(s.conta_contabil_id), para = this.conta(novaContaId);
      s._hist = s._hist || [];
      s._hist.push({ tipo: 'reclassificacao', aprovador: autor || 'Financeiro', decisao: 'Reclassificação', canal: 'Plataforma', data_hora: this._now(), comentario: `Conta alterada de ${de.codigo} (${de.detalhe}) para ${para.codigo} (${para.detalhe}). Justificativa: ${justificativa}` });
      s.conta_contabil_id = novaContaId;
      s.categoria_id = para.categoria_id;
      s.capex = para.tipo === 'Investimento';
      this._persistir(); this.emit();
    },

    _aprovadorAtual(s) {
      const dep = this.depDoCC(s.centro_custo_id);
      const nv = s.nivel_atual || 1;
      if (nv === 1) return dep ? dep.gestor_nome : 'Gestor';
      if (nv === 2) return 'Gerência da Diretoria';
      if (nv === 3) return dep ? dep.diretoria : 'Diretor';
      return 'CFO — Eduardo Mendes';
    },
    _marcarEmail(s, status) {
      (this.db.emails || []).forEach(e => { if (e._sol === s || e.solicitacao_id === s.id) e.status = status; });
      (this.db.notificacoes || []).forEach(n => { if (n.solicitacao_id === s.id) n.status_acao = status; });
    },
    _dispararProximoEmail(s) {
      const dep = this.depDoCC(s.centro_custo_id);
      const email = {
        _sol: s, solicitacao_id: s.id,
        destinatario: (dep ? dep.gestor_email : 'aprovador@empresa.com.br'),
        destinatario_nome: this._aprovadorAtual(s),
        assunto: `Aprovação pendente: ${s.fornecedor} no valor de ${Fmt.moeda(s.valor)}`,
        token: 'tok_' + s.id + '_' + (s.nivel_atual), status: 'pendente', data: this._now().slice(0, 10),
      };
      this.db.emails.push(email);
      this.db.notificacoes.push({ id: this.db.notificacoes.length + 1, tipo: 'aprovacao', solicitacao_id: s.id, destinatario: email.destinatario, assunto: email.assunto, corpo: 'Próximo nível de alçada.', data: email.data, status_acao: 'pendente' });
    },

    criarSolicitacao(dados) {
      const s = Object.assign({
        id: Math.max(0, ...this.db.solicitacoes.map(x => x.id)) + 1,
        numero: 'SOL-' + this.db.ANO + '-' + String(90000 + this.db.solicitacoes.length).padStart(5, '0'),
        provisao_id: null, status: STATUS.P1, nivel_atual: 1,
        data_solicitacao: this.db.HOJE, _mes: this.db.MES_ATUAL, _novo: true,
      }, dados);
      s.categoria_id = this.categoriaNome(s.conta_contabil_id);
      s.capex = (this.conta(s.conta_contabil_id) || {}).tipo === 'Investimento';
      s.niveis_necessarios = this.niveisNecessarios(s);
      this.db.solicitacoes.push(s);
      this._persistir(); this.emit();
      return s;
    },

    // planos de ação
    criarPlano(dados) {
      const p = Object.assign({ id: Math.max(0, ...this.db.planos_acao.map(x => x.id)) + 1, status: 'aberto', data_criacao: this.db.HOJE, data_conclusao: null, _novo: true }, dados);
      this.db.planos_acao.push(p);
      this._persistir(); this.emit();
      return p;
    },
    addAndamento(planoId, autor, comentario) {
      const a = { id: Math.max(0, ...this.db.planos_acao_andamentos.map(x => x.id)) + 1, plano_id: planoId, autor, comentario, data_hora: this._now(), _novo: true };
      this.db.planos_acao_andamentos.push(a);
      this._persistir(); this.emit();
      return a;
    },
    concluirPlano(planoId, comentarioFinal, autor) {
      const p = this.db.planos_acao.find(x => x.id === planoId);
      if (!p) return;
      p.status = 'concluido'; p.data_conclusao = this.db.HOJE; p._alterado = true;
      this.addAndamento(planoId, autor || 'Responsável', 'Conclusão: ' + comentarioFinal);
      this._persistir(); this.emit();
    },
    atualizarPlanoStatus(planoId, status) {
      const p = this.db.planos_acao.find(x => x.id === planoId);
      if (p) { p.status = status; p._alterado = true; if (status === 'concluido') p.data_conclusao = this.db.HOJE; this._persistir(); this.emit(); }
    },
    andamentosDoPlano(planoId) { return this.db.planos_acao_andamentos.filter(a => a.plano_id === planoId).sort((a, b) => (a.data_hora < b.data_hora ? -1 : 1)); },
    planoAbertoPara(ccId, contaId) { return this.db.planos_acao.find(p => p.centro_custo_id === ccId && p.conta_contabil_id === contaId && (p.status === 'aberto' || p.status === 'em_andamento')); },
    planosAbertosDoCC(ccId) { return this.db.planos_acao.filter(p => p.centro_custo_id === ccId && (p.status === 'aberto' || p.status === 'em_andamento')); },

    // ---------------- importação ----------------
    _proxContaId() { return Math.max(0, ...this.db.contas_contabeis.map(c => c.id)) + 1; },
    importarContasTexto(texto) {
      const parsed = PlanoContas.parseTexto(texto);
      let novas = 0, existentes = 0;
      const listaFinal = [];
      // adiciona somente códigos ainda inexistentes, preservando ids atuais
      parsed.contas.forEach(nc => {
        const atual = this.db._contaCod.get(nc.codigo);
        if (atual) { existentes++; return; }
        const nova = Object.assign({}, nc, { id: this._proxContaId() });
        // reancorar pai por código depois
        this.db.contas_contabeis.push(nova);
        this.db._conta.set(nova.id, nova); this.db._contaCod.set(nova.codigo, nova);
        novas++; listaFinal.push(nova);
      });
      // recalcula conta_pai_id (numérico) de todos
      this.db.contas_contabeis.forEach(c => { c.conta_pai_id = c.paiCodigo ? (this.db._contaCod.get(c.paiCodigo) || {}).id || null : null; });
      this.db.contas_contabeis.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      this.emit();
      return { novas, existentes, preview: parsed.contas };
    },
    previewContasTexto(texto) {
      const parsed = PlanoContas.parseTexto(texto);
      parsed.contas.forEach(c => { c._novo = !this.db._contaCod.get(c.codigo); });
      return parsed.contas;
    },
    importarCentros(rows) {
      let n = 0;
      rows.forEach(r => {
        if (!r.codigo || this.db.centros_custo.some(c => c.codigo === r.codigo)) return;
        let depId = null;
        if (r.departamento_id) depId = +r.departamento_id;
        else if (r.departamento) { const d = this.db.departamentos.find(x => PlanoContas.normaliza(x.nome) === PlanoContas.normaliza(r.departamento)); depId = d ? d.id : null; }
        this.db.centros_custo.push({ id: Math.max(0, ...this.db.centros_custo.map(c => c.id)) + 1, codigo: r.codigo, nome: r.nome || r.codigo, departamento_id: depId || 1, id_externo: r.id_externo || null });
        n++;
      });
      this._index(); this.emit(); return { novas: n };
    },
    importarOrcamento(rows) {
      let n = 0;
      rows.forEach(r => {
        const cc = this.db.centros_custo.find(c => c.codigo === r.centro_custo); const conta = this.db._contaCod.get(r.conta);
        if (!cc || !conta) return;
        this.db.orcamento.push({ id: Math.max(0, ...this.db.orcamento.map(o => o.id)) + 1, ano: +r.ano || this.db.ANO, mes: +r.mes, centro_custo_id: cc.id, conta_contabil_id: conta.id, valor_orcado: parseFloat(String(r.valor).replace(',', '.')) || 0, id_externo: r.id_externo || null });
        n++;
      });
      this.emit(); return { novas: n };
    },
    importarSolicitacoes(rows) {
      let n = 0;
      rows.forEach(r => {
        const cc = this.db.centros_custo.find(c => c.codigo === r.centro_custo); const conta = this.db._contaCod.get(r.conta);
        if (!cc || !conta) return;
        this.criarSolicitacao({ fornecedor: r.fornecedor || 'Fornecedor importado', cnpj: r.cnpj || '—', descricao: r.descricao || conta.detalhe, valor: parseFloat(String(r.valor).replace(',', '.')) || 0, centro_custo_id: cc.id, conta_contabil_id: conta.id, solicitante: 'Importação', data_vencimento: r.data_vencimento || this.db.HOJE, urgencia: 'Normal', id_externo: r.id_externo || null });
        n++;
      });
      return { novas: n };
    },

    STATUS, REALIZADO_STATUS, PENDENTE_STATUS,
  };

  global.Store = Store;
})(window);
