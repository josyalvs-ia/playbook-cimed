/* =========================================================================
   email.js — Aprovação por um clique no email + Caixa de Entrada Simulada.
   Regras: token único por (solicitação, e-mail, nível), uso único, validade
   7 dias; proteção contra pré-carregamento (Safe Links) executando a decisão
   via "POST" ao carregar em navegador real, nunca no GET direto.
   ========================================================================= */
(function (global) {
  'use strict';
  const UI = global.UI, el = UI.el, F = () => global.Fmt;
  function store() { return global.Store; }

  // -------- layout do e-mail (HTML inline, como um e-mail real) --------
  function corpoEmailHTML(sol, s) {
    const cc = s.cc(sol.centro_custo_id), conta = s.conta(sol.conta_contabil_id), dep = s.depDoCC(sol.centro_custo_id);
    const ctx = s.consumoContaCC(sol.centro_custo_id, sol.conta_contabil_id);
    const pctAntes = ctx.orcado > 0 ? ctx.realizado / ctx.orcado * 100 : 0;
    const pctDepois = ctx.orcado > 0 ? (ctx.realizado + sol.valor) / ctx.orcado * 100 : 0;
    const estoura = s.estouraOrcamento(sol);
    const tok = tokenDe(sol, s);
    const base = '#/aprovar/' + (tok ? tok.token : 'x');
    const linha = (k, v) => `<tr><td style="padding:6px 0;color:#64748B;font-size:13px">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px">${v}</td></tr>`;
    return `
    <div style="max-width:600px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#0F172A">
      <div style="background:#0B2545;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
        <div style="font-size:12px;letter-spacing:.08em;opacity:.7;text-transform:uppercase">Aprova · Aprovação de Pagamentos</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px">Aprovação pendente</div>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:22px;border-radius:0 0 12px 12px;background:#fff">
        <p style="font-size:14px;margin-bottom:14px">Olá, <b>${dep.gestor_nome}</b>. Há um pagamento aguardando sua aprovação como <b>${s.nomeNivel(sol.nivel_atual || 1)}</b>.</p>
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #E2E8F0;margin-bottom:14px">
          ${linha('Fornecedor', sol.fornecedor)}
          ${linha('Descrição', sol.descricao)}
          ${linha('Valor', '<span style="font-size:16px;color:#0B2545">' + F().moeda(sol.valor) + '</span>')}
          ${linha('Conta contábil', '<span style="font-family:monospace">' + conta.codigo + '</span> ' + conta.detalhe)}
          ${linha('Centro de custo', cc.codigo + ' — ' + cc.nome)}
          ${linha('Solicitante', sol.solicitante)}
          ${linha('Vencimento', F().data(sol.data_vencimento))}
        </table>
        <div style="background:#F7F9FC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:8px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748B;margin-bottom:8px">Impacto orçamentário — ${conta.detalhe}</div>
          <table style="width:100%;border-collapse:collapse">
            ${linha('Orçado do exercício', F().moeda(ctx.orcado))}
            ${linha('Realizado', F().moeda(ctx.realizado))}
            ${linha('Comprometido', F().moeda(ctx.comprometido))}
            ${linha('Saldo disponível', F().moeda(ctx.saldo))}
            ${linha('% consumo (antes → depois)', `<span style="color:${cor(pctAntes)}">${F().pct(pctAntes)}</span> → <span style="color:${cor(pctDepois)}">${F().pct(pctDepois)}</span>`)}
          </table>
        </div>
        ${estoura ? `<div style="background:#FCECEC;color:#DC2626;border-radius:10px;padding:12px;font-size:13px;font-weight:600;margin-bottom:14px">🚩 Atenção: esta aprovação estoura o orçamento da conta em ${F().moeda((ctx.realizado + sol.valor) - ctx.orcado)}.</div>` : '<div style="height:6px"></div>'}
        <div style="text-align:center;margin:18px 0 8px">
          <a href="${base}" data-token="${tok ? tok.token : ''}" data-decisao="aprovar" style="display:inline-block;background:#16A34A;color:#fff;text-decoration:none;font-weight:700;padding:13px 30px;border-radius:10px;margin:0 6px;font-size:15px">✓ Aprovar</a>
          <a href="${base}?d=reprovar" data-token="${tok ? tok.token : ''}" data-decisao="reprovar" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;font-weight:700;padding:13px 30px;border-radius:10px;margin:0 6px;font-size:15px">✕ Reprovar</a>
        </div>
        <div style="text-align:center"><a href="#/fila" style="color:#64748B;font-size:12px">Ver detalhes no sistema</a></div>
        <p style="color:#94a3b8;font-size:11px;margin-top:18px;border-top:1px solid #E2E8F0;padding-top:12px">
          Link seguro de uso único, válido por 7 dias. O clique no botão é a sua aprovação — não é necessário acessar o sistema.
        </p>
      </div>
    </div>`;
  }

  function assuntoEmail(sol) { return `Aprovação pendente: ${sol.fornecedor} no valor de ${F().moeda(sol.valor)}`; }

  function tokenDe(sol, s) {
    return s.db.tokens_aprovacao.find(t => t.solicitacao_id === sol.id && !t.usado_em) ||
           s.db.tokens_aprovacao.find(t => t.solicitacao_id === sol.id);
  }

  // -------- Caixa de Entrada Simulada (tela) --------
  global.Views = global.Views || {};
  global.Views.inbox = {
    render(root, s) {
      const emails = (s.db.emails || []).filter(e => { const sol = s.db.solicitacoes.find(x => x.id === (e.solicitacao_id || (e._sol && e._sol.id))); return sol; });
      root.appendChild(el('div', { class: 'aviso info mb16', html: '📨 Caixa de entrada <b>simulada</b> — reproduz os e-mails disparados com o layout e os botões reais, para demonstrar a aprovação por um clique sem servidor de e-mail. Em produção, o disparo usa Supabase com edge function.' }));
      if (!emails.length) { root.appendChild(el('div', { class: 'empty', text: 'Nenhum e-mail na caixa.' })); return; }

      const listaEl = el('div', { class: 'inbox-list' });
      const renderEl = el('div', { class: 'email-render' });
      let sel = null;
      emails.slice().reverse().forEach((e, idx) => {
        const sol = solDoEmail(e, s);
        const item = el('div', { class: 'inbox-item' }, [
          el('div', { class: 'ii-top' }, [el('span', { text: e.destinatario }), el('span', { html: statusEmail(sol) })]),
          el('div', { class: 'ii-sub', text: assuntoEmail(sol) }),
          el('div', { class: 'muted', style: { fontSize: '11.5px', marginTop: '2px' }, text: F().data(e.data) + ' · ' + s.cc(sol.centro_custo_id).codigo }),
        ]);
        item.addEventListener('click', () => { UI.$$('.inbox-item', listaEl).forEach(x => x.classList.remove('sel')); item.classList.add('sel'); mostra(sol); sel = item; });
        listaEl.appendChild(item);
        if (idx === 0) setTimeout(() => item.click(), 0);
      });
      function mostra(sol) { renderEl.innerHTML = '<div style="padding:18px;background:#eef2f8">' + corpoEmailHTML(sol, s) + '</div>'; wireLinks(renderEl, s); }
      root.appendChild(el('div', { class: 'inbox' }, [listaEl, renderEl]));
    },
  };

  function solDoEmail(e, s) { return s.db.solicitacoes.find(x => x.id === (e.solicitacao_id || (e._sol && e._sol.id))); }
  function statusEmail(sol) {
    if (sol.status === 'Aprovada' || sol.status === 'Paga') return '<span class="chip verde">aprovado</span>';
    if (sol.status === 'Reprovada') return '<span class="chip vermelho">reprovado</span>';
    return '<span class="chip amarelo">pendente</span>';
  }

  // intercepta cliques nos botões do e-mail para navegar via hash (SPA)
  function wireLinks(container, s) {
    UI.$$('a[data-token]', container).forEach(a => {
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const tk = a.getAttribute('data-token'), d = a.getAttribute('data-decisao');
        location.hash = '#/aprovar/' + tk + (d === 'reprovar' ? '?d=reprovar' : '');
      });
    });
  }

  // -------- Página leve de aprovação (destino do link) --------
  function paginaAprovacao(hash) {
    const s = store();
    const m = hash.match(/aprovar\/([^?]+)(\?d=(\w+))?/);
    const tokenStr = m ? decodeURIComponent(m[1]) : '';
    const decisao = m && m[3] ? m[3] : 'aprovar';
    const tok = s.db.tokens_aprovacao.find(t => t.token === tokenStr);
    const sol = tok ? s.db.solicitacoes.find(x => x.id === tok.solicitacao_id) : null;

    document.body.innerHTML = '';
    const page = el('div', { style: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eef2f8', padding: '24px', fontFamily: 'Inter, sans-serif' } });
    const card = el('div', { class: 'card', style: { maxWidth: '520px', width: '100%', padding: '0', overflow: 'hidden' } });
    page.appendChild(card);
    document.body.appendChild(page);

    function voltar() { return el('div', { style: { textAlign: 'center', padding: '0 0 22px' } }, el('a', { href: '#/inbox', class: 'btn btn-sm', text: '← Voltar ao sistema', onclick: () => setTimeout(() => global.App.roteia(), 0) })); }
    function header(cor, titulo) { return el('div', { style: { background: cor, color: '#fff', padding: '22px' } }, [el('div', { style: { fontSize: '12px', opacity: '.8', letterSpacing: '.08em', textTransform: 'uppercase' }, text: 'Aprova · Aprovação de Pagamentos' }), el('div', { style: { fontSize: '20px', fontWeight: '700', marginTop: '4px' }, text: titulo })]); }

    if (!tok || !sol) { card.appendChild(header('#DC2626', 'Link inválido')); card.appendChild(el('div', { style: { padding: '22px' } }, el('p', { text: 'Token não encontrado ou inválido.' }))); card.appendChild(voltar()); return; }

    // token já usado
    if (tok.usado_em) {
      card.appendChild(header('#64748B', 'Solicitação já processada'));
      card.appendChild(el('div', { style: { padding: '22px' } }, [
        el('div', { class: 'aviso info', html: `Esta solicitação já foi <b>${(tok.decisao || sol.status).toLowerCase()}</b> por <b>${tok.aprovador_nome || nomeDoToken(tok, s)}</b> em <b>${F().dataHora(tok.usado_em)}</b>.` }),
        comprovanteResumo(sol, s),
      ]));
      card.appendChild(voltar());
      return;
    }
    // token expirado
    if (F().diasDesde(tok.expira_em, s.db.HOJE) > 0) {
      card.appendChild(header('#D97706', 'Link expirado'));
      card.appendChild(el('div', { style: { padding: '22px' } }, el('p', { text: 'Este link de aprovação expirou (validade de 7 dias). Solicite um novo envio.' })));
      card.appendChild(voltar()); return;
    }

    if (decisao === 'reprovar') { paginaReprovar(card, tok, sol, s, voltar, header); return; }

    // ---- APROVAR: proteção contra pré-carregamento (Safe Links) ----
    // O GET não executa a decisão. Exibimos "processando" e disparamos a
    // aprovação via "POST" apenas quando há navegador real com JS ativo,
    // descartando robôs/varredores por user agent.
    card.appendChild(header('#0B2545', 'Processando aprovação…'));
    const corpo = el('div', { style: { padding: '22px' } }, [
      el('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, [
        el('div', { class: 'spinner', style: { width: '20px', height: '20px', border: '3px solid #E2E8F0', borderTopColor: '#0B2545', borderRadius: '50%', animation: 'spin 1s linear infinite' } }),
        el('span', { text: 'Confirmando sua aprovação com segurança…' }),
      ]),
      el('div', { class: 'hint mt12', text: 'A decisão só é registrada por um navegador real (proteção contra varredores de e-mail).' }),
    ]);
    card.appendChild(corpo);
    if (!document.getElementById('spin-kf')) { const st = el('style', { id: 'spin-kf', html: '@keyframes spin{to{transform:rotate(360deg)}}' }); document.head.appendChild(st); }

    const ehBot = /bot|crawler|spider|preview|scan|slurp|monitor|safelinks/i.test(navigator.userAgent || '');
    if (ehBot) { corpo.innerHTML = '<div class="aviso warn">Acesso automatizado detectado. A aprovação não foi executada.</div>'; return; }

    // "POST" ao carregar (navegador real)
    setTimeout(() => {
      const nome = nomeDoToken(tok, s);
      tok.usado_em = s._now(); tok.canal = 'Email'; tok.ip_origem = ipFake(); tok.decisao = 'Aprovada'; tok.aprovador_nome = nome;
      s.aprovar(sol, { canal: 'Email', aprovador: nome });
      card.innerHTML = '';
      card.appendChild(header('#16A34A', '✓ Pagamento aprovado com sucesso'));
      card.appendChild(el('div', { style: { padding: '22px' } }, [
        el('div', { class: 'aviso ok mb12', html: 'Sua aprovação foi registrada. O status foi atualizado na plataforma neste instante.' }),
        comprovanteResumo(sol, s),
        el('div', { class: 'hint mt12', text: `Registrado em ${F().dataHora(tok.usado_em)} · canal Email · IP ${tok.ip_origem}` }),
        sol.status.startsWith('Pendente') ? el('div', { class: 'aviso info mt12', html: '➡️ Há um próximo nível de alçada. O e-mail do próximo aprovador foi disparado automaticamente.' }) : null,
      ]));
      card.appendChild(voltar());
    }, 900);
  }

  function paginaReprovar(card, tok, sol, s, voltar, header) {
    card.appendChild(header('#DC2626', 'Reprovar pagamento'));
    const ta = el('textarea', { placeholder: 'Comentário obrigatório…', style: { width: '100%', minHeight: '90px', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '10px', fontFamily: 'inherit' } });
    card.appendChild(el('div', { style: { padding: '22px' } }, [
      comprovanteResumo(sol, s),
      el('div', { class: 'form-field full mt12' }, [el('label', { text: 'Motivo da reprovação (obrigatório)' }), ta]),
      el('div', { style: { textAlign: 'right', marginTop: '12px' } }, el('button', { class: 'btn btn-vermelho', text: 'Confirmar reprovação', onclick: () => {
        if (!ta.value.trim()) { UI.toast('O comentário é obrigatório', 'err'); return; }
        const nome = nomeDoToken(tok, s);
        tok.usado_em = s._now(); tok.canal = 'Email'; tok.ip_origem = ipFake(); tok.decisao = 'Reprovada'; tok.aprovador_nome = nome;
        s.reprovar(sol, ta.value.trim(), { canal: 'Email', aprovador: nome });
        card.innerHTML = '';
        card.appendChild(header('#64748B', 'Pagamento reprovado'));
        card.appendChild(el('div', { style: { padding: '22px' } }, [el('div', { class: 'aviso err', html: 'A reprovação foi registrada na plataforma com o canal Email.' }), comprovanteResumo(sol, s)]));
        card.appendChild(voltar());
      } })),
    ]));
    card.appendChild(voltar());
  }

  function comprovanteResumo(sol, s) {
    const cc = s.cc(sol.centro_custo_id), conta = s.conta(sol.conta_contabil_id);
    const row = (k, v) => el('div', { class: 'ctx-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', html: v })]);
    return el('div', { class: 'card card-pad', style: { background: '#F7F9FC' } }, [
      row('Fornecedor', sol.fornecedor), row('Valor', F().moeda(sol.valor)),
      row('Conta contábil', `<span class="mono">${conta.codigo}</span> ${conta.detalhe}`),
      row('Centro de custo', cc.codigo + ' — ' + cc.nome),
      row('Status atual', UI.statusPill(sol.status)),
    ]);
  }

  function nomeDoToken(tok, s) { const dep = s.db.departamentos.find(d => d.gestor_email === tok.aprovador_email); return dep ? dep.gestor_nome : (tok.aprovador_email || 'Aprovador'); }
  function ipFake() { return '189.' + rnd(0, 254) + '.' + rnd(0, 254) + '.' + rnd(1, 254); }
  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function cor(pct) { return pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#16A34A'; }

  global.EmailFlow = { paginaAprovacao, corpoEmailHTML, assuntoEmail };
})(window);
