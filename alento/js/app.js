// ═══════════════════════════════════════════════════════════════════════════
// ALENTO — casca do aplicativo: autenticação, navegação e montagem das telas.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from './db.js';
import { ico, estrela, esc, avisar, abrirModal } from './ui.js';

const raizApp = document.getElementById('app');

// ─── Mapa de telas ─────────────────────────────────────────────────────────
const TELAS = {
  painel:       { titulo: 'Painel',        icone: 'painel',   mod: () => import('./views/painel.js'),       tab: true },
  comandas:     { titulo: 'Atendimentos',  icone: 'comanda',  mod: () => import('./views/comandas.js'),     tab: true },
  clientes:     { titulo: 'Clientes',      icone: 'clientes', mod: () => import('./views/clientes.js'),     tab: true },
  estoque:      { titulo: 'Estoque',       icone: 'estoque',  mod: () => import('./views/estoque.js'),      tab: true },
  caixa:        { titulo: 'Caixa',         icone: 'caixa',    mod: () => import('./views/caixa.js'),        tab: true },
  servicos:     { titulo: 'Tabela de preços', icone: 'tabela',   mod: () => import('./views/servicos.js') },
  precificacao: { titulo: 'Precificação',  icone: 'grafico',  mod: () => import('./views/precificacao.js') },
  comissoes:    { titulo: 'Comissões',     icone: 'comissao', mod: () => import('./views/comissoes.js') },
  relatorios:   { titulo: 'Relatórios',    icone: 'grafico',  mod: () => import('./views/relatorios.js') },
  ajustes:      { titulo: 'Ajustes',       icone: 'ajustes',  mod: () => import('./views/ajustes.js') },
};

const GRUPOS = [
  { rotulo: 'Dia a dia',  telas: ['painel', 'comandas', 'clientes'] },
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

async function montarTela() {
  const rota = rotaAtual();
  const tela = TELAS[rota];
  const alvo = document.getElementById('conteudo');
  if (!alvo) return;

  document.getElementById('titulo-tela').textContent = tela.titulo;
  document.querySelectorAll('[data-rota]').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.rota === rota);
  });

  alvo.innerHTML = `<div class="vazio">${estrela()}<p>Carregando…</p></div>`;
  const mod = await tela.mod();
  telaMontada = { rota, mod };
  alvo.innerHTML = '';
  mod.render(alvo);
  window.scrollTo(0, 0);
}

function redesenhar() {
  const alvo = document.getElementById('conteudo');
  if (alvo && telaMontada && telaMontada.rota === rotaAtual()) {
    alvo.innerHTML = '';
    telaMontada.mod.render(alvo);
  }
  atualizarStatusSync();
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
            <span class="avatar" id="avatar-eu">A</span>
            <span class="crescer truncar">
              <span style="font-size:13.5px;font-weight:600" id="nome-eu">—</span>
              <span class="pequeno t3" id="status-sync" style="display:block"></span>
            </span>
            <button class="btn-icone" id="btn-sair" title="Sair">${ico('sair')}</button>
          </div>
        </div>
      </aside>

      <main class="principal">
        <header class="topo">
          <h1 id="titulo-tela">Painel</h1>
          <div class="topo-acoes">
            <button class="btn btn-primario btn-sm" id="btn-nova-comanda">
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
      <button data-rota="ajustes">${ico('ajustes')}<span>Mais</span></button>
    </nav>`;

  raizApp.querySelectorAll('[data-rota]').forEach((b) => {
    b.onclick = () => irPara(b.dataset.rota);
  });
  document.getElementById('btn-sair').onclick = () => db.sair();
  document.getElementById('btn-nova-comanda').onclick = async () => {
    const m = await import('./views/comandas.js');
    m.abrirComanda();
  };

  const nome = db.eu?.nome || 'Equipe';
  document.getElementById('nome-eu').textContent = nome;
  document.getElementById('avatar-eu').textContent = nome[0].toUpperCase();
}

function atualizarStatusSync() {
  const el = document.getElementById('status-sync');
  if (!el) return;
  const p = db.pendentes();
  if (!navigator.onLine) { el.textContent = 'Offline — salvando no aparelho'; el.className = 'pequeno alerta-c'; }
  else if (p) { el.textContent = `${p} para sincronizar`; el.className = 'pequeno alerta-c'; }
  else { el.textContent = 'Sincronizado'; el.className = 'pequeno t3'; }

  const badge = document.getElementById('badge-estoque');
  if (badge) {
    const baixos = db.estado.materiais.filter((m) => m.ativo !== false && m.estoque_minimo > 0 && Number(m.estoque) <= Number(m.estoque_minimo)).length;
    badge.hidden = !baixos;
    badge.textContent = baixos;
  }
}

// ─── Telas de entrada ──────────────────────────────────────────────────────
function molduraCentral(conteudo) {
  raizApp.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:22px">
      <div style="width:100%;max-width:420px">
        <div class="centro" style="margin-bottom:26px">
          <img src="assets/marca.svg" alt="Alento — Studio de Beleza" style="width:min(300px,80%);margin:0 auto 4px">
        </div>
        <div class="cartao" style="padding:24px">${conteudo}</div>
      </div>
    </div>`;
}

function telaConfig() {
  molduraCentral(`
    <div class="regua mb">${estrela()}</div>
    <h2 class="centro mb">Primeira configuração</h2>
    <p class="t2 pequeno mb">Cole aqui as duas chaves do seu projeto no Supabase.
      Elas ficam em <strong>Project Settings → API</strong>. É só uma vez, neste aparelho.</p>
    <label class="campo"><span>URL do projeto</span>
      <input id="cfg-url" type="url" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off"></label>
    <label class="campo"><span>Chave anon / public</span>
      <input id="cfg-key" type="text" placeholder="eyJhbGciOi…" autocomplete="off"></label>
    <button class="btn btn-primario btn-bloco" id="cfg-salvar">Conectar</button>
    <p class="t3 pequeno mt centro">Não sabe o que é isso? O passo a passo está no
      arquivo <strong>README.md</strong> da pasta do app.</p>`);

  document.getElementById('cfg-salvar').onclick = () => {
    const url = document.getElementById('cfg-url').value.trim().replace(/\/+$/, '');
    const anonKey = document.getElementById('cfg-key').value.trim();
    if (!/^https:\/\/.+\.supabase\.co$/.test(url)) return avisar('URL do projeto inválida', 'erro');
    if (anonKey.length < 40) return avisar('Chave anon inválida', 'erro');
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
      <p class="t3 pequeno mt centro">Esqueceu a senha?
        <button type="button" class="btn-fantasma" id="btn-reset" style="text-decoration:underline;padding:0">Receber link por e-mail</button></p>
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

  document.getElementById('btn-reset').onclick = async () => {
    const email = document.querySelector('[name=email]').value.trim();
    if (!email) return avisar('Escreva seu e-mail primeiro', 'erro');
    await db.cliente.auth.resetPasswordForEmail(email, { redirectTo: location.href });
    avisar('Link enviado para ' + email);
  };
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

  if (r.estado === 'sem-config') return telaConfig();
  if (r.estado === 'sem-sessao') return telaLogin();

  desenharCasca();
  db.aoMudar(redesenhar);
  window.addEventListener('hashchange', montarTela);
  window.addEventListener('online', atualizarStatusSync);
  window.addEventListener('offline', atualizarStatusSync);
  await montarTela();
  atualizarStatusSync();

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
