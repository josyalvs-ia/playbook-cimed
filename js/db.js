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

/**
 * Troca a senha de quem está logada.
 *
 * Só existia o "esqueci a senha", que manda link por e-mail. Quem entrou com
 * a senha provisória do convite não tinha como escolher a sua — e senha que a
 * pessoa não escolheu é senha que ela anota num papel.
 */
export async function trocarSenha(nova) {
  if (!cliente) throw new Error('Sem conexão com o servidor.');
  if (String(nova).length < 8) throw new Error('A senha precisa de pelo menos 8 caracteres.');
  const { error } = await cliente.auth.updateUser({ password: nova });
  if (error) {
    throw new Error(/should be different|same as/i.test(error.message)
      ? 'Escolha uma senha diferente da atual.'
      : (error.message || 'Não consegui trocar a senha.'));
  }
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

/**
 * Por que a última tentativa de subir não deu certo.
 *
 * Antes, tudo o que falhava caía na fila sem uma palavra: a tela mostrava
 * "4 para sincronizar" e ninguém tinha como saber que o servidor estava
 * recusando — nem o quê. Um dado salvo só no aparelho some no próximo login,
 * porque a carga do servidor substitui o que estava em memória.
 */
export let ultimoErro = null;

/** Traduz o economês do Postgres para o que a pessoa precisa fazer. */
function explicar(erro, tabela) {
  const msg = String(erro?.message || erro || '');
  const col = msg.match(/'([a-z_]+)' column/i)?.[1] || msg.match(/column "([a-z_]+)"/i)?.[1];
  if (erro?.code === 'PGRST204' || /could not find the .* column|column .* does not exist/i.test(msg)) {
    return {
      curto: `O banco ainda não tem a coluna ${col ? `"${col}"` : 'nova'} em ${tabela}.`,
      comoResolver: 'Abra o Supabase → SQL Editor → New query, cole o conteúdo de '
                  + 'db/atualizar.sql do repositório e clique em Run. Depois volte aqui '
                  + 'e toque em "Recarregar do servidor".',
    };
  }
  if (erro?.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return { curto: 'O banco recusou a gravação nesta conta.',
             comoResolver: 'Confira em Comissões → Equipe se esta pessoa está com acesso liberado.' };
  }
  if (/failed to fetch|networkerror|offline/i.test(msg)) {
    return { curto: 'Sem conexão com o servidor agora.',
             comoResolver: 'Fica guardado no aparelho e sobe sozinho quando a internet voltar.' };
  }
  return { curto: msg || 'O servidor recusou a gravação.',
           comoResolver: 'Se continuar, mostre esta mensagem para quem cuida do sistema.' };
}

function enfileirar(op, erro) {
  const f = lerFila();
  f.push({ ...op, ts: Date.now() });
  gravarFila(f);

  // Falta de rede é normal e a fila resolve sozinha. Recusa do servidor não é:
  // ali a fila nunca vai esvaziar, e é preciso dizer isso na hora.
  const offline = !navigator.onLine || /failed to fetch|networkerror|offline/i.test(String(erro?.message || ''));
  if (!offline) {
    ultimoErro = { ...explicar(erro, op.tabela), tabela: op.tabela, quando: new Date().toISOString() };
    console.error('Alento — o servidor recusou:', op.tabela, erro);
    avisar(ultimoErro.curto + ' Guardei no aparelho por enquanto.', 'erro');
  }
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
    } catch (e) {
      restante.push(op);
      const offline = !navigator.onLine || /failed to fetch|networkerror/i.test(String(e?.message || ''));
      if (!offline) {
        ultimoErro = { ...explicar(e, op.tabela), tabela: op.tabela, quando: new Date().toISOString() };
        console.error('Alento — o servidor recusou:', op.tabela, e);
      }
    }
  }
  gravarFila(restante);
  if (f.length !== restante.length) {
    avisar(`${f.length - restante.length} alteração(ões) sincronizada(s)`);
    if (!restante.length) ultimoErro = null;
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
  } catch (e) {
    enfileirar({ acao: 'upsert', tabela, dados: r }, e);
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
    } catch (e) {
      parte.forEach((r) => enfileirar({ acao: 'upsert', tabela, dados: r }, e));
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
  } catch (e) {
    enfileirar({ acao: 'remover', tabela, id }, e);
  }
}

/**
 * O banco tem tudo o que esta versão do app precisa?
 *
 * Existe para não haver mais adivinhação. Quando o `schema.sql` avança e o
 * banco de quem já estava usando fica para trás, o sintoma chega torto: a foto
 * salva na tela e some no login seguinte, o cartão de horário não desmarca. Em
 * vez de deduzir isso pelo sintoma, o app pergunta.
 *
 * Cada item traz o que resolve, para a resposta não ser só "faltou".
 */
const EXIGENCIAS = [
  { o_que: 'Foto e apresentação da equipe', tipo: 'coluna', tabela: 'profissionais', coluna: 'foto',
    serve_para: 'a foto de cada uma aparecer no sistema e para a cliente' },
  { o_que: 'Apresentação da equipe', tipo: 'coluna', tabela: 'profissionais', coluna: 'bio',
    serve_para: 'a linha que descreve cada uma no site das clientes' },
  { o_que: 'Equipe visível para a cliente', tipo: 'view', nome: 'equipe_publica',
    serve_para: 'mostrar quem atende no site sem expor a comissão' },
  { o_que: 'Conferência dos horários da cliente', tipo: 'funcao', nome: 'situacao_agendamentos',
    args: { p_tokens: [] },
    serve_para: 'tirar do celular dela o horário que já foi cancelado' },
  { o_que: 'Agendamento pelo site', tipo: 'funcao', nome: 'horarios_livres',
    args: { p_servico_id: '__x__', p_data: '2000-01-01' },
    serve_para: 'a cliente ver os horários livres e marcar' },
];

export async function conferirBanco() {
  if (!cliente) return { erro: 'Sem conexão com o servidor.' };
  const faltando = [];

  for (const e of EXIGENCIAS) {
    try {
      if (e.tipo === 'coluna') {
        const { error } = await cliente.from(e.tabela).select(e.coluna).limit(1);
        if (error) throw error;
      } else if (e.tipo === 'view') {
        const { error } = await cliente.from(e.nome).select('id').limit(1);
        if (error) throw error;
      } else {
        const { error } = await cliente.rpc(e.nome, e.args);
        // A função existe: erro de dado (serviço inexistente) não é falta dela.
        if (error && /does not exist|could not find|schema cache/i.test(error.message)) throw error;
      }
    } catch (err) {
      faltando.push({ ...e, motivo: String(err?.message || err) });
    }
  }
  return { faltando };
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
  } catch (e) {
    enfileirar({ acao: 'upsert', tabela: 'config', dados: r }, e);
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
