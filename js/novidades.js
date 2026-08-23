// ═══════════════════════════════════════════════════════════════════════════
// NOVIDADES
//
// O que mudou na agenda desde a última vez que a equipe olhou: cliente que
// marcou pelo site, horário desmarcado, falta registrada.
//
// Não precisa de coluna nova no banco. O app guarda no aparelho uma foto do
// que já viu — id e situação de cada agendamento — e compara a cada carga.
// O que estiver diferente vira novidade. Como cada aparelho tem a própria
// foto, o sininho da Laura não some porque a Julia leu o dela.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from './db.js';

const FOTO  = 'alento.agenda.visto';
const CAIXA = 'alento.novidades';
const LIMITE = 40;

const ler = (chave, padrao) => {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; }
  catch { return padrao; }
};
const gravar = (chave, valor) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {}
};

export const novidades = () => ler(CAIXA, []);
export const quantasNaoLidas = () => novidades().filter((n) => !n.lida).length;

export function marcarTodasLidas() {
  gravar(CAIXA, novidades().map((n) => ({ ...n, lida: true })));
}

export function limpar() { gravar(CAIXA, []); }

/**
 * Compara a agenda de agora com a última foto e devolve quantas novidades
 * apareceram. Na primeira vez só tira a foto: senão a equipe abriria o app
 * com dezenas de "novidades" que na verdade são o histórico.
 */
export function conferir() {
  const agora = Object.fromEntries(
    db.estado.agendamentos.map((a) => [a.id, a.status]));
  const foto = ler(FOTO, null);

  if (foto === null) { gravar(FOTO, agora); return 0; }

  const achadas = [];
  const nome = (a) => a.cliente_nome || 'Cliente';

  for (const a of db.estado.agendamentos) {
    const antes = foto[a.id];

    if (antes === undefined) {
      // Horário que a equipe marcou pelo app não é novidade para ela mesma.
      if (a.origem === 'site' && a.status === 'confirmado') {
        achadas.push(nova('marcou', a, `${nome(a)} marcou ${a.servico_nome}`));
      }
    } else if (antes !== a.status) {
      if (a.status === 'cancelado') {
        achadas.push(nova('desmarcou', a, `${nome(a)} desmarcou ${a.servico_nome}`));
      } else if (a.status === 'faltou') {
        achadas.push(nova('faltou', a, `${nome(a)} não veio`));
      }
    }
  }

  gravar(FOTO, agora);
  if (achadas.length) {
    gravar(CAIXA, [...achadas, ...novidades()].slice(0, LIMITE));
  }
  return achadas.length;
}

function nova(tipo, a, texto) {
  return {
    id: `${a.id}:${tipo}`,
    tipo, texto,
    agendamento_id: a.id,
    quando: a.inicio,
    visto_em: new Date().toISOString(),
    lida: false,
  };
}

/**
 * Aviso do sistema operacional, para quem deixa o app aberto numa aba de
 * fundo. Só com permissão dada, e só quando a aba não está à vista.
 */
export function avisarNaTela(texto) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    new Notification('Alento — novo horário', { body: texto, icon: 'assets/icone-192.png' });
  } catch {}
}

export async function pedirPermissao() {
  if (!('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export const permissao = () =>
  ('Notification' in window) ? Notification.permission : 'indisponivel';
