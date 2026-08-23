// ═══════════════════════════════════════════════════════════════════════════
// CAMADA DE DADOS
//
// O studio tem wi-fi de salão: cai. Então o app é local-first — a tela sempre
// lê do cache em memória, que é espelhado no localStorage. As escritas vão
// para o Supabase; se a rede falhar, entram numa fila e sobem sozinhas quando
// a conexão voltar. Nenhum atendimento se perde por causa do sinal.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { avisar, uid } from './ui.js';

const CHAVE_CONFIG = 'alento.supabase';
const CHAVE_CACHE  = 'alento.cache.v1';
const CHAVE_FILA   = 'alento.fila.v1';

export const TABELAS = ['profissionais', 'clientes', 'servicos', 'materiais', 'ficha_tecnica',
                        'estoque_mov', 'comandas', 'comanda_itens', 'caixa', 'config',
                        'horarios', 'bloqueios', 'agendamentos'];

/** Coleções em memória. As telas leem daqui, sempre. */
export const estado = Object.fromEntries(TABELAS.map((t) => [t, []]));

export let cliente = null;      // client do Supabase
export let sessao = null;       // sessão de auth
export let eu = null;           // registro em `profissionais` de quem está logado

const ouvintes = new Set();
export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
function notificar() { ouvintes.forEach((f) => f()); }

// ─── Configuração de conexão ───────────────────────────────────────────────
export function lerConfig() {
  try {
    const local = JSON.parse(localStorage.getItem(CHAVE_CONFIG) || 'null');
    if (local?.url && local?.anonKey) return local;
  } catch {}
  const g = globalThis.ALENTO_CONFIG;
  if (g?.url && g?.anonKey && !g.url.includes('SUA-')) return g;
  return null;
}

export function gravarConfig(cfg) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(cfg));
}

export function conectar() {
  const cfg = lerConfig();
  if (!cfg) return null;
  cliente = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cliente;
}

// ─── Autenticação ──────────────────────────────────────────────────────────
export async function entrar(email, senha) {
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  sessao = data.session;
  return data;
}

export async function sair() {
  await cliente?.auth.signOut();
  sessao = null; eu = null;
  localStorage.removeItem(CHAVE_CACHE);
  location.hash = '';
  location.reload();
}

export async function sessaoAtual() {
  if (!cliente) return null;
  const { data } = await cliente.auth.getSession();
  sessao = data.session;
  return sessao;
}

// ─── Cache local ───────────────────────────────────────────────────────────
function salvarCache() {
  try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(estado)); }
  catch { /* cota estourada: o cache é dispensável, seguimos sem ele */ }
}

function carregarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null');
    if (c) for (const t of TABELAS) if (Array.isArray(c[t])) estado[t] = c[t];
    return !!c;
  } catch { return false; }
}

// ─── Fila offline ──────────────────────────────────────────────────────────
function lerFila() {
  try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]'); } catch { return []; }
}
function gravarFila(f) { localStorage.setItem(CHAVE_FILA, JSON.stringify(f)); }
export function pendentes() { return lerFila().length; }

function enfileirar(op) {
  const f = lerFila();
  f.push({ ...op, ts: Date.now() });
  gravarFila(f);
  notificar();
}

/** Sobe tudo o que ficou pendente. Chamado ao carregar e ao voltar a rede. */
export async function drenarFila() {
  if (!cliente || !navigator.onLine) return;
  let f = lerFila();
  if (!f.length) return;
  const restante = [];
  for (const op of f) {
    try {
      if (op.acao === 'upsert') {
        const { error } = await cliente.from(op.tabela).upsert(op.dados);
        if (error) throw error;
      } else if (op.acao === 'remover') {
        const { error } = await cliente.from(op.tabela).delete().eq('id', op.id);
        if (error) throw error;
      }
    } catch {
      restante.push(op);
    }
  }
  gravarFila(restante);
  if (f.length !== restante.length) {
    avisar(`${f.length - restante.length} alteração(ões) sincronizada(s)`);
    await recarregar();
  }
  notificar();
}

// ─── Leitura ───────────────────────────────────────────────────────────────
export async function recarregar() {
  if (!cliente) return;
  const resultados = await Promise.all(TABELAS.map((t) => cliente.from(t).select('*')));
  TABELAS.forEach((t, i) => {
    const { data, error } = resultados[i];
    if (!error && data) estado[t] = data;
  });
  ordenar();
  salvarCache();
  notificar();
}

function ordenar() {
  estado.servicos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  estado.clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  estado.materiais.sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  estado.comandas.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criado_em || '').localeCompare(a.criado_em || ''));
  estado.caixa.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criado_em || '').localeCompare(a.criado_em || ''));
  estado.estoque_mov.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
  estado.agendamentos.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
}

// ─── Escrita ───────────────────────────────────────────────────────────────
/**
 * Grava (insere ou atualiza) e já reflete na tela. Se a rede falhar, o
 * registro fica na fila — a interface não espera pelo servidor.
 */
export async function salvar(tabela, registro) {
  const r = { ...registro };
  if (!r.id) r.id = uid();

  const lista = estado[tabela];
  const i = lista.findIndex((x) => x.id === r.id);
  if (i >= 0) lista[i] = { ...lista[i], ...r };
  else lista.push(r);
  ordenar();
  salvarCache();
  notificar();

  try {
    if (!cliente || !navigator.onLine) throw new Error('offline');
    const { data, error } = await cliente.from(tabela).upsert(r).select().single();
    if (error) throw error;
    const j = estado[tabela].findIndex((x) => x.id === r.id);
    if (j >= 0) estado[tabela][j] = data;
    salvarCache();
  } catch {
    enfileirar({ acao: 'upsert', tabela, dados: r });
  }
  return r;
}

/** Grava vários de uma vez (usado na carga inicial e nas importações). */
export async function salvarLote(tabela, registros) {
  if (!registros.length) return;
  registros.forEach((r) => { if (!r.id) r.id = uid(); });
  const mapa = new Map(estado[tabela].map((x) => [x.id, x]));
  registros.forEach((r) => mapa.set(r.id, { ...mapa.get(r.id), ...r }));
  estado[tabela] = [...mapa.values()];
  ordenar(); salvarCache(); notificar();

  for (let i = 0; i < registros.length; i += 200) {
    const parte = registros.slice(i, i + 200);
    try {
      if (!cliente || !navigator.onLine) throw new Error('offline');
      const { error } = await cliente.from(tabela).upsert(parte);
      if (error) throw error;
    } catch {
      parte.forEach((r) => enfileirar({ acao: 'upsert', tabela, dados: r }));
    }
  }
}

export async function remover(tabela, id) {
  estado[tabela] = estado[tabela].filter((x) => x.id !== id);
  salvarCache(); notificar();
  try {
    if (!cliente || !navigator.onLine) throw new Error('offline');
    const { error } = await cliente.from(tabela).delete().eq('id', id);
    if (error) throw error;
  } catch {
    enfileirar({ acao: 'remover', tabela, id });
  }
}

// ─── Config (premissas, link do Trinks…) ───────────────────────────────────
export function cfg(chave, padrao = null) {
  const r = estado.config.find((c) => c.chave === chave);
  return r ? r.valor : padrao;
}

export async function setCfg(chave, valor) {
  const lista = estado.config;
  const i = lista.findIndex((c) => c.chave === chave);
  const r = { chave, valor };
  if (i >= 0) lista[i] = r; else lista.push(r);
  salvarCache(); notificar();
  try {
    if (!cliente || !navigator.onLine) throw new Error('offline');
    const { error } = await cliente.from('config').upsert(r);
    if (error) throw error;
  } catch {
    enfileirar({ acao: 'upsert', tabela: 'config', dados: r });
  }
}

// ─── Inicialização ─────────────────────────────────────────────────────────
export async function iniciar() {
  if (!conectar()) return { estado: 'sem-config' };

  const s = await sessaoAtual();
  if (!s) return { estado: 'sem-sessao' };

  const tinhaCache = carregarCache();
  if (tinhaCache) notificar();

  await recarregar();
  await drenarFila();

  eu = estado.profissionais.find((p) => p.user_id === s.user.id) || null;

  // Só quem está cadastrada como profissional ativa enxerga o studio. Quem
  // criou conta por conta própria fica aqui, sem acesso a nada.
  if (!eu || eu.ativo === false) {
    return { estado: 'sem-acesso', email: s.user.email, inativa: !!eu };
  }

  window.addEventListener('online', drenarFila);
  cliente.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });

  // Tempo real: o que a Laura fecha aparece na tela da Ju na hora.
  // Só funciona se as tabelas estiverem publicadas no Realtime do Supabase —
  // e tabela nova NÃO entra sozinha. Por isso não dá para depender disto.
  try {
    cliente.channel('alento')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { recarregar(); })
      .subscribe();
  } catch { /* segue com a checagem periódica abaixo */ }

  vigiar();

  return { estado: 'pronto' };
}

/**
 * Checagem periódica.
 *
 * É o que garante que um horário marcado pela cliente apareça — mesmo sem o
 * Realtime ligado, mesmo com a aba em segundo plano. Sem ela, o app só
 * descobre novidade quando alguém recarrega a página.
 *
 * O volume é irrisório para um studio de duas pessoas: um punhado de consultas
 * por hora. Com a aba escondida o intervalo dobra, para não gastar bateria.
 */
const VIGIA_ATIVO   = 45_000;
const VIGIA_OCULTO  = 120_000;
let vigiaId = null;

function vigiar() {
  const agendar = () => {
    clearTimeout(vigiaId);
    const espera = document.visibilityState === 'visible' ? VIGIA_ATIVO : VIGIA_OCULTO;
    vigiaId = setTimeout(async () => {
      if (navigator.onLine) {
        await drenarFila();
        await recarregar();
      }
      agendar();
    }, espera);
  };

  // Voltou para a aba: confere na hora, sem esperar o próximo ciclo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) recarregar();
    agendar();
  });

  agendar();
}

export function estaVazio() {
  return estado.servicos.length === 0 && estado.materiais.length === 0;
}
