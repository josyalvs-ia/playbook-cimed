// ═══════════════════════════════════════════════════════════════════════════
// ALENTO — casca do aplicativo: autenticação, navegação e montagem das telas.
// ═══════════════════════════════════════════════════════════════════════════

import { VERSAO } from './versao.js';
import * as db from './db.js';
import * as nov from './novidades.js';
import { ico, estrela, esc, avisar, abrirModal, fecharModal, ceuEstrelado, retrato,
         destaque, icoDestaque } from './ui.js';

const raizApp = document.getElementById('app');

// ─── Mapa de telas ─────────────────────────────────────────────────────────
const TELAS = {
  painel:       { titulo: 'Painel',        icone: 'painel', marca: 'tratamentos',   mod: () => import('./views/painel.js'),       tab: true },
  agenda:       { titulo: 'Agenda',        icone: 'agenda', marca: 'agenda',   mod: () => import('./views/agenda.js'),       tab: true },
  comandas:     { titulo: 'Atendimentos',  icone: 'comanda', marca: 'unhas',  mod: () => import('./views/comandas.js'),     tab: true },
  clientes:     { titulo: 'Clientes',      icone: 'clientes', marca: 'sobre', mod: () => import('./views/clientes.js') },
  estoque:      { titulo: 'Estoque',       icone: 'estoque', marca: 'unhas',  mod: () => import('./views/estoque.js') },
  caixa:        { titulo: 'Caixa',         icone: 'caixa', marca: 'tratamentos',    mod: () => import('./views/caixa.js'),        tab: true },
  servicos:     { titulo: 'Tabela de preços', icone: 'tabela', marca: 'cabelos',   mod: () => import('./views/servicos.js') },
  precificacao: { titulo: 'Precificação',  icone: 'grafico', marca: 'tratamentos',  mod: () => import('./views/precificacao.js') },
  comissoes:    { titulo: 'Comissões',     icone: 'comissao', marca: 'sobre', mod: () => import('./views/comissoes.js') },
  relatorios:   { titulo: 'Relatórios',    icone: 'grafico', marca: 'tratamentos',  mod: () => import('./views/relatorios.js') },
  ajustes:      { titulo: 'Ajustes',       icone: 'ajustes', marca: 'agenda',  mod: () => import('./views/ajustes.js') },
};

const GRUPOS = [
  { rotulo: 'Dia a dia',  telas: ['painel', 'agenda', 'comandas', 'clientes'] },
  { rotulo: 'Operação',   telas: ['estoque', 'caixa'] },
  { rotulo: 'Negócio',    telas: ['servicos', 'precificacao', 'comissoes', 'relatorios'] },
  { rotulo: '',           telas: ['ajustes'] },
];

// ─── Roteador ──────────────────────────────────────────────────────────────
export function irPara(rota) {
  location.hash = '#/' + rota;
}

function rotaAtual() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  return TELAS[h] ? h : 'painel';
}

let telaMontada = null;

/**
 * O "+" do alto da tela faz o que a tela em que se está pede.
 *
 * Ele abria sempre um atendimento. Na agenda, quem toca no "+" está querendo
 * marcar um horário: caía numa tela diferente do que esperava, que ainda por
 * cima não salva sem serviço e forma de pagamento. No celular o rótulo não
 * cabe e sobra só o sinal, então o "+" precisa acertar sozinho.
 */
async function ajustarBotaoNovo(rota) {
  const b = document.getElementById('btn-novo');
  if (!b) return;
  const naAgenda = rota === 'agenda';
  const rotulo = naAgenda ? 'Marcar horário' : 'Novo atendimento';
  b.innerHTML = ico('mais') + `<span class="esconde-mobile">${rotulo}</span>`;
  b.title = rotulo;
  b.setAttribute('aria-label', rotulo);
  b.onclick = async () => {
    const m = await import(naAgenda ? './views/agenda.js' : './views/comandas.js');
    // Ela navegou até sexta e tocou no "+": é sexta que tem de vir preenchida.
    if (naAgenda) m.abrirAgendamento(null, m.diaVisivel?.());
    else m.abrirComanda();
  };
}

async function montarTela() {
  const rota = rotaAtual();
  const tela = TELAS[rota];
  const alvo = document.getElementById('conteudo');
  if (!alvo) return;

  const topo = document.getElementById('titulo-tela');
  topo.innerHTML = `<span class="titulo-marca">${icoDestaque(tela.marca || 'tratamentos')}</span>${esc(tela.titulo)}`;
  document.querySelectorAll('[data-rota]').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.rota === rota);
  });
  // No celular a barra de baixo só tem quatro telas; as outras vivem dentro do
  // "Mais", que precisa acender quando a aberta é uma delas.
  document.getElementById('btn-mais')
    ?.classList.toggle('ativo', !TELAS[rota].tab);

  alvo.innerHTML = `<div class="vazio">${estrela()}<p>Carregando…</p></div>`;
  const mod = await tela.mod();
  telaMontada = { rota, mod };
  alvo.innerHTML = '';
  mod.render(alvo);
  ajustarBotaoNovo(rota);
  window.scrollTo(0, 0);
}

function redesenhar() {
  const alvo = document.getElementById('conteudo');
  if (alvo && telaMontada && telaMontada.rota === rotaAtual()) {
    alvo.innerHTML = '';
    telaMontada.mod.render(alvo);
  }
  atualizarStatusSync();
  atualizarSino({ recemChegadas: nov.conferir() });
}

// ─── Casca ─────────────────────────────────────────────────────────────────
function marcaLateral() {
  return `
    <a href="#/painel" class="flex" style="gap:11px">
      <img src="assets/selo.svg" alt="" width="38" height="38" style="border-radius:50%">
      <span>
        <span class="display" style="font-size:20px;display:block;line-height:1">Alento</span>
        <span class="eyebrow" style="font-size:8.5px">Studio de Beleza</span>
      </span>
    </a>`;
}

function desenharCasca() {
  const tabs = Object.entries(TELAS).filter(([, t]) => t.tab);

  raizApp.innerHTML = `
    <div class="shell">
      <aside class="lateral">
        <div class="lateral-marca">${marcaLateral()}</div>
        <nav class="lateral-nav">
          ${GRUPOS.map((g) => `
            <div class="nav-grupo">
              ${g.rotulo ? `<div class="eyebrow">${g.rotulo}</div>` : ''}
              ${g.telas.map((r) => `
                <button class="nav-item" data-rota="${r}">
                  ${ico(TELAS[r].icone)}<span>${TELAS[r].titulo}</span>
                  ${r === 'estoque' ? '<span class="contador" id="badge-estoque" hidden></span>' : ''}
                </button>`).join('')}
            </div>`).join('')}
        </nav>
        <div class="lateral-rodape">
          <div class="flex" style="gap:9px">
            <span id="retrato-eu">${retrato(db.eu, { tam: 36 })}</span>
            <span class="crescer truncar">
              <span style="font-size:13.5px;font-weight:600" id="nome-eu">—</span>
              <span class="pequeno t3" id="status-sync" style="display:block"></span>
              <span class="pequeno t3" style="display:block;opacity:.5;font-size:10.5px"
                    title="Versão publicada">v${VERSAO}</span>
            </span>
            <button class="btn-icone" id="btn-sair" title="Sair">${ico('sair')}</button>
          </div>
        </div>
      </aside>

      <main class="principal">
        <header class="topo">
          <h1 id="titulo-tela">Painel</h1>
          <div class="topo-acoes">
            <button class="btn-icone sino" id="btn-sino" title="Novidades" aria-label="Novidades">
              ${ico('sino')}<span class="ponto" id="sino-ponto" hidden></span>
            </button>
            <button class="btn btn-primario btn-sm" id="btn-novo" aria-label="Novo atendimento">
              ${ico('mais')}<span class="esconde-mobile">Novo atendimento</span>
            </button>
          </div>
        </header>
        <div class="conteudo" id="conteudo"></div>
      </main>
    </div>

    <nav class="tabbar">
      ${tabs.map(([r, t]) => `
        <button data-rota="${r}">${ico(t.icone)}<span>${t.titulo === 'Atendimentos' ? 'Comandas' : t.titulo}</span></button>`).join('')}
      <button id="btn-mais">${ico('menu')}<span>Mais</span>
        <span class="contador" id="badge-mais" hidden></span></button>
    </nav>`;

  raizApp.querySelectorAll('[data-rota]').forEach((b) => {
    b.onclick = () => irPara(b.dataset.rota);
  });
  document.getElementById('btn-mais').onclick = abrirMais;
  document.getElementById('btn-sair').onclick = () => db.sair();
  document.getElementById('btn-sino').onclick = abrirNovidades;
  ajustarBotaoNovo(rotaAtual());

  const nome = db.eu?.nome || 'Equipe';
  document.getElementById('nome-eu').textContent = nome;
  const canto = document.getElementById('retrato-eu');
  if (canto) canto.innerHTML = retrato(db.eu, { tam: 36 });
}

/** Marca o sino quando há coisa nova, e avisa na tela se a aba estiver de fundo. */
function atualizarSino({ recemChegadas = 0 } = {}) {
  const ponto = document.getElementById('sino-ponto');
  if (!ponto) return;
  const n = nov.quantasNaoLidas();
  ponto.hidden = !n;
  ponto.textContent = n > 9 ? '9+' : n;
  if (recemChegadas) {
    const ultima = nov.novidades()[0];
    if (ultima) nov.avisarNaTela(ultima);
    // O sino balança uma vez: quem está com o app aberto na frente percebe
    // sem precisar de som nem de aviso do sistema.
    const sino = document.getElementById('btn-sino');
    if (sino) {
      sino.classList.remove('tocando');
      void sino.offsetWidth;               // reinicia a animação
      sino.classList.add('tocando');
      setTimeout(() => sino.classList.remove('tocando'), 900);
    }
  }
}

/**
 * Menu do celular. A barra lateral não cabe numa tela de telefone, e a barra
 * de baixo só comporta quatro telas — sem este menu, Clientes, Tabela de
 * preços, Precificação, Comissões e Relatórios ficariam inalcançáveis, e não
 * haveria como sair da conta.
 */
function abrirMais() {
  const naBarra = (r) => TELAS[r].tab;
  const nome = db.eu?.nome || 'Equipe';

  const fechar = abrirModal({
    titulo: 'Mais',
    corpo: `
      <div class="menu-mais">
        ${GRUPOS.map((g) => {
          const telas = g.telas.filter((r) => !naBarra(r));
          if (!telas.length) return '';
          return `
            ${g.rotulo ? `<div class="eyebrow" style="margin:2px 0 6px">${g.rotulo}</div>` : ''}
            ${telas.map((r) => `
              <button class="menu-item" data-ir="${r}">
                ${ico(TELAS[r].icone)}
                <span class="crescer">${esc(TELAS[r].titulo)}</span>
                ${r === 'estoque' ? '<span class="contador" id="badge-menu-estoque" hidden></span>' : ''}
                ${ico('seta')}
              </button>`).join('')}`;
        }).join('')}
        <div class="menu-rodape">
          ${retrato(db.eu, { tam: 42 })}
          <span class="crescer truncar">
            <span style="font-size:14px;font-weight:600;display:block">${esc(nome)}</span>
            <span class="pequeno t3" id="status-sync-mais"></span>
          </span>
          <button class="btn btn-sm" id="sair-mais">${ico('sair')} Sair</button>
        </div>
      </div>`,
    aoAbrir: (veu) => {
      veu.querySelectorAll('[data-ir]').forEach((b) => {
        b.onclick = () => { fecharModal(); irPara(b.dataset.ir); };
      });
      veu.querySelector('#sair-mais').onclick = () => db.sair();
      const s = document.getElementById('status-sync');
      if (s) veu.querySelector('#status-sync-mais').textContent = s.textContent;
      const b = document.getElementById('badge-estoque');
      const alvo = veu.querySelector('#badge-menu-estoque');
      if (b && alvo && !b.hidden) { alvo.textContent = b.textContent; alvo.hidden = false; }
    },
  });
}

function abrirNovidades() {
  const lista = nov.novidades();
  const perm = nov.permissao();

  abrirModal({
    titulo: 'Novidades',
    corpo: (lista.length ? `
      <div class="novidades">
        ${lista.map((n) => `
          <button class="novidade ${n.lida ? '' : 'nao-lida'}" data-ir-agenda="${esc(n.quando)}">
            <span class="marca-tipo ${n.tipo}"></span>
            <span class="crescer">
              <strong>${esc(n.texto)}</strong>
              <span class="pequeno t3">${esc(quandoTexto(n.quando))}${
                n.antes ? ` &middot; era ${esc(quandoTexto(n.antes))}` : ''}</span>
            </span>
            ${n.lida ? '' : '<span class="selo">nova</span>'}
          </button>`).join('')}
      </div>`
      : `<div class="vazio">${estrela()}
          <p>Nada novo por aqui.</p>
          <p class="pequeno t3">Quando uma cliente marcar, remarcar ou desmarcar
            pelo site, aparece nesta lista.</p></div>`)
      // O convite para ativar os avisos aparece SEMPRE que ainda não foram
      // ativados. Deixá-lo só junto das novidades criava um nó: só dava para
      // ativar depois de já ter perdido a primeira.
      + (perm === 'granted' ? `
        <div class="aviso ok mt">${ico('check')}<div>
          Avisos ativados neste aparelho. Com o app aberto em outra aba, você recebe
          o aviso na tela quando uma cliente marcar, remarcar ou desmarcar.</div></div>`
        : perm === 'denied' ? `
        <div class="aviso alerta mt">${ico('sino')}<div>
          Os avisos estão <strong>bloqueados</strong> para este site no navegador.
          Para liberar: clique no cadeado ao lado do endereço &rarr;
          <strong>Notificações</strong> &rarr; Permitir.</div></div>`
        : perm === 'indisponivel' ? ''
        : `<div class="aviso mt">${ico('sino')}<div>
            <strong>Quer ser avisada na hora?</strong> Com o app aberto numa aba de
            fundo, o computador te avisa quando uma cliente marcar, remarcar ou
            desmarcar.
            <button class="btn btn-primario btn-sm mt" id="pedir-aviso">Ativar avisos</button>
          </div></div>`),
    acoes: lista.length ? [
      { texto: 'Limpar', classe: 'btn-fantasma', onClick: (f) => { nov.limpar(); f(); atualizarSino(); } },
      { texto: 'Marcar como lidas', classe: 'btn-primario', onClick: (f) => {
          nov.marcarTodasLidas(); f(); atualizarSino();
        } },
    ] : [],
    aoAbrir: (veu) => {
      veu.querySelectorAll('[data-ir-agenda]').forEach((b) => b.onclick = () => {
        const d = new Date(b.dataset.irAgenda);
        const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        nov.marcarTodasLidas();
        document.querySelector('.veu')?.remove();
        location.hash = '#/agenda';
        setTimeout(async () => {
          const m = await import('./views/agenda.js');
          m.irParaDia?.(dia);
        }, 120);
        atualizarSino();
      });
      veu.querySelector('#pedir-aviso')?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        const r = await nov.pedirPermissao();
        if (r === 'granted') {
          e.target.textContent = 'Pronto! Avisos ativados';
          new Notification('Alento', {
            body: 'É assim que você vai ser avisada de um novo horário. ✨',
            icon: 'assets/icone-192.png',
          });
        } else {
          e.target.textContent = 'O navegador bloqueou os avisos';
        }
      });
    },
  });
}

function quandoTexto(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
       + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function atualizarStatusSync() {
  const el = document.getElementById('status-sync');
  if (!el) return;
  const p = db.pendentes();
  const travado = p && db.ultimoErro;

  if (!navigator.onLine) { el.textContent = 'Offline — salvando no aparelho'; el.className = 'pequeno alerta-c'; }
  else if (travado) { el.textContent = `${p} não subiram — ver motivo`; el.className = 'pequeno erro-c sync-travado'; }
  else if (p) { el.textContent = `${p} para sincronizar`; el.className = 'pequeno alerta-c'; }
  else { el.textContent = 'Sincronizado'; el.className = 'pequeno t3'; }

  // Nada travado é invisível. Se o servidor está recusando, dá para tocar e
  // descobrir o quê — antes ficava só um número que nunca baixava.
  el.style.cursor = travado ? 'pointer' : '';
  el.onclick = travado ? abrirPendencias : null;

  const badge = document.getElementById('badge-estoque');
  if (badge) {
    const baixos = db.estado.materiais.filter((m) => m.ativo !== false && m.estoque_minimo > 0 && Number(m.estoque) <= Number(m.estoque_minimo)).length;
    badge.hidden = !baixos;
    badge.textContent = baixos;
  }
}

/** O que está preso na fila, por que, e o que fazer a respeito. */
function abrirPendencias() {
  const e = db.ultimoErro;
  abrirModal({
    titulo: 'Não consegui salvar no servidor',
    corpo: `
      <div class="aviso erro">${ico('alerta')}<div>
        <strong>${esc(e?.curto || 'O servidor recusou a gravação.')}</strong>
        <div class="pequeno mt">${esc(e?.comoResolver || '')}</div>
      </div>
      <p class="t2 pequeno mt">
        São <strong>${db.pendentes()}</strong> alteração(ões) guardadas neste aparelho.
        Elas não se perderam — mas também não estão no servidor, então
        <strong>somem quando você entrar de outro lugar</strong>. Resolvido o motivo
        acima, toque em "Tentar de novo" e elas sobem.</p>
      <p class="pequeno t3 mt">Última recusa: ${esc(e?.tabela || '—')},
        ${e?.quando ? new Date(e.quando).toLocaleString('pt-BR') : '—'}.</p>`,
    acoes: [
      { texto: 'Tentar de novo', classe: 'btn-primario sync-tentar', onClick: async (fechar) => {
        await db.drenarFila();
        atualizarStatusSync();
        if (!db.pendentes()) { fechar(); avisar('Tudo sincronizado'); }
        else avisar('Ainda não subiu. O motivo continua o mesmo.', 'erro');
      } },
    ],
  });
}

// ─── Telas de entrada ──────────────────────────────────────────────────────
function molduraCentral(conteudo) {
  raizApp.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:22px;position:relative">
      ${ceuEstrelado()}
      <div style="width:100%;max-width:420px;position:relative;z-index:1">
        <div class="centro assenta" style="margin-bottom:26px">
          <img src="assets/marca.webp" alt="Alento — Studio de Beleza" style="width:min(230px,64%);margin:0 auto 4px">
        </div>
        <div class="cartao assenta-2" style="padding:24px">${conteudo}</div>
      </div>
    </div>`;
}

function telaConfig() {
  molduraCentral(`
    <div class="regua mb">${estrela()}</div>
    <h2 class="centro mb">Primeira configuração</h2>
    <p class="t2 pequeno mb">Cole aqui os dois dados do seu projeto no Supabase.
      É só uma vez, neste aparelho.</p>
    <label class="campo"><span>URL do projeto</span>
      <input id="cfg-url" type="url" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off">
      <span class="dica t3">No Supabase: <strong>Settings → Data API</strong>, campo <em>Project URL</em>.</span></label>
    <label class="campo"><span>Chave pública do projeto</span>
      <input id="cfg-key" type="text" placeholder="sb_publishable_… ou eyJhbGciOi…" autocomplete="off">
      <span class="dica t3">No Supabase: <strong>Settings → API Keys</strong>.
        Serve tanto a <em>Publishable key</em> (<code>sb_publishable_…</code>) quanto a
        <em>anon public</em> legada (<code>eyJ…</code>).</span></label>
    <button class="btn btn-primario btn-bloco" id="cfg-salvar">Conectar</button>
    <p class="t3 pequeno mt centro">Não sabe o que é isso? O passo a passo está no
      arquivo <strong>README.md</strong> da pasta do app.</p>`);

  document.getElementById('cfg-salvar').onclick = () => {
    const url = document.getElementById('cfg-url').value.trim().replace(/\/+$/, '');
    const anonKey = document.getElementById('cfg-key').value.trim();
    if (!/^https:\/\/.+\.supabase\.co$/.test(url)) {
      return avisar('URL do projeto inválida — deve terminar em .supabase.co', 'erro');
    }
    // A chave secreta é checada primeiro: colar ela por engano é o erro caro,
    // e merece uma mensagem que diga exatamente o que aconteceu.
    if (/^sb_secret_/.test(anonKey) || /service_role/.test(anonKey)) {
      return avisar('Essa é a chave secreta — use a pública (Publishable / anon)', 'erro');
    }
    // Dois formatos convivem hoje: a chave publicável nova e o JWT antigo.
    const chaveNova = /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(anonKey);
    const chaveLegada = /^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey);
    if (!chaveNova && !chaveLegada) {
      return avisar('Chave inválida — cole a Publishable key (sb_publishable_…) ou a anon public (eyJ…)', 'erro');
    }
    db.gravarConfig({ url, anonKey });
    location.reload();
  };
}

function telaLogin() {
  molduraCentral(`
    <div class="regua mb">${estrela()}</div>
    <h2 class="centro" style="margin-bottom:4px">Entrar</h2>
    <p class="t3 pequeno centro mb">Acesso restrito à equipe do studio</p>
    <form id="form-login">
      <label class="campo"><span>E-mail</span>
        <input name="email" type="email" required autocomplete="username"></label>
      <label class="campo"><span>Senha</span>
        <input name="senha" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-primario btn-bloco" type="submit" id="btn-entrar">Entrar</button>
      <p class="t3 pequeno mt centro"><strong>Esqueceu a senha?</strong> Escreva seu e-mail
        no campo acima e toque em
        <button type="button" class="btn-fantasma" id="btn-reset"
          style="text-decoration:underline;padding:0">receber link por e-mail</button>.</p>
    </form>
    <p class="pequeno t3 mt centro"><a href="vitrine.html">Ver a tabela de preços pública</a></p>`);

  document.getElementById('form-login').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await db.entrar(e.target.email.value.trim(), e.target.senha.value);
      location.reload();
    } catch (err) {
      avisar(err.message?.includes('Invalid') ? 'E-mail ou senha incorretos' : (err.message || 'Não foi possível entrar'), 'erro');
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  };

  document.getElementById('btn-reset').onclick = async (ev) => {
    const email = document.querySelector('[name=email]').value.trim();
    if (!email) return avisar('Escreva seu e-mail primeiro', 'erro');
    const b = ev.currentTarget;
    b.disabled = true;

    // O erro daqui era jogado fora: quando o servidor recusava — endereço de
    // volta não liberado, ou limite de e-mails do plano gratuito estourado —
    // a tela dizia "link enviado" e nada chegava.
    const { error } = await db.cliente.auth.resetPasswordForEmail(
      email, { redirectTo: location.origin + location.pathname });
    b.disabled = false;

    if (error) {
      console.error('resetPasswordForEmail:', error);
      const msg = /rate|limit|too many|segundos|seconds/i.test(error.message)
        ? 'O servidor limitou os envios por agora. Tente daqui a uns minutos.'
        : /redirect|not allowed/i.test(error.message)
        ? 'O endereço de retorno não está liberado no Supabase (Authentication → URL Configuration).'
        : error.message;
      return avisar(msg, 'erro');
    }
    avisar('Link enviado para ' + email + '. Confira também a caixa de spam.');
  };
}

/** O link do e-mail chega com `type=recovery` no pedaço depois do #. */
function veioDoLinkDeSenha() {
  const h = location.hash || '';
  return /type=recovery/.test(h) || /[?&]type=recovery/.test(location.search);
}

function telaNovaSenha() {
  molduraCentral(`
    <div class="regua mb">${estrela()}</div>
    <h2 class="centro" style="margin-bottom:4px">Escolha sua nova senha</h2>
    <p class="t3 pequeno centro mb">É esta que você vai usar daqui em diante.</p>
    <form id="form-senha">
      <label class="campo"><span>Nova senha</span>
        <input name="s1" type="password" autocomplete="new-password" required>
        <span class="dica t3">Pelo menos 8 caracteres.</span></label>
      <label class="campo"><span>Repita a nova senha</span>
        <input name="s2" type="password" autocomplete="new-password" required></label>
      <button class="btn btn-primario btn-bloco" type="submit" id="btn-nova-senha">Salvar e entrar</button>
    </form>`);

  document.getElementById('form-senha').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-nova-senha');
    if (e.target.s1.value !== e.target.s2.value) return avisar('As duas senhas não são iguais', 'erro');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      await db.trocarSenha(e.target.s1.value);
      // Limpa o código do endereço antes de recarregar, senão volta para cá.
      history.replaceState(null, '', location.pathname);
      location.reload();
    } catch (err) {
      avisar(err.message, 'erro');
      btn.disabled = false; btn.textContent = 'Salvar e entrar';
    }
  };
}

function telaSemAcesso({ email, inativa }) {
  molduraCentral(`
    <div class="regua mb">${estrela()}</div>
    <h2 class="centro" style="margin-bottom:6px">Acesso não liberado</h2>
    <p class="t2 pequeno centro mb">
      A conta <strong>${esc(email)}</strong> entrou, mas ainda não faz parte da
      equipe do studio${inativa ? ' — o cadastro existe, porém está inativo' : ''}.</p>
    <div class="aviso mb">${ico('info')}<div>
      Se este acesso deveria funcionar, quem administra o studio precisa liberar em
      <strong>Ajustes → Equipe</strong>, ou convidar este e-mail pelo painel do Supabase
      em <strong>Authentication → Users → Invite user</strong>.</div></div>
    <button class="btn btn-bloco" id="btn-sair-sem-acesso">Sair desta conta</button>
    <p class="pequeno t3 mt centro"><a href="vitrine.html">Ver a tabela de preços pública</a></p>`);
  document.getElementById('btn-sair-sem-acesso').onclick = () => db.sair();
}

function telaErro(msg) {
  molduraCentral(`
    <div class="aviso erro mb">${ico('alerta')}<div>${esc(msg)}</div></div>
    <button class="btn btn-bloco" onclick="location.reload()">Tentar de novo</button>
    <button class="btn btn-fantasma btn-bloco mt" id="btn-limpar">Trocar a configuração do servidor</button>`);
  document.getElementById('btn-limpar').onclick = () => {
    localStorage.removeItem('alento.supabase');
    location.reload();
  };
}

// ─── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  let r;
  try {
    r = await db.iniciar();
  } catch (e) {
    return telaErro('Não foi possível falar com o servidor: ' + (e.message || e));
  }

  // Quem chegou pelo link de "esqueci a senha" cai aqui já logada, com um
  // endereço cheio de código. Sem esta tela ela ficava dentro do sistema sem
  // entender que faltava escolher a senha nova — e no dia seguinte estaria
  // trancada de novo.
  if (veioDoLinkDeSenha()) return telaNovaSenha();

  if (r.estado === 'sem-config') return telaConfig();
  if (r.estado === 'sem-sessao') return telaLogin();
  if (r.estado === 'sem-acesso') return telaSemAcesso(r);

  desenharCasca();
  db.aoMudar(redesenhar);
  window.addEventListener('hashchange', montarTela);
  window.addEventListener('online', atualizarStatusSync);
  window.addEventListener('offline', atualizarStatusSync);
  await montarTela();
  atualizarStatusSync();
  nov.conferir();
  atualizarSino();

  if (db.estaVazio()) {
    abrirModal({
      titulo: 'Bem-vinda ao Alento',
      corpo: `<p class="t2">O banco está vazio. Posso instalar agora o catálogo oficial de
        serviços da tabela de valores, os 176 insumos da planilha e as premissas de
        precificação. Depois é só ajustar o que quiser.</p>`,
      acoes: [
        { texto: 'Agora não', classe: 'btn-fantasma', onClick: (f) => f() },
        { texto: 'Instalar dados iniciais', classe: 'btn-primario', onClick: async (f) => {
          f();
          const s = await import('./seed.js');
          await s.instalar();
        } },
      ],
    });
  }
}

boot();

// Service worker: deixa o app abrir mesmo sem sinal.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
