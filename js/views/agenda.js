// ═══════════════════════════════════════════════════════════════════════════
// AGENDA
// O dia de cada profissional em colunas. A cliente marca sozinha pelo site e
// cai aqui; quando ela chega, um toque transforma o horário em comanda.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, hoje, avisar, abrirModal, fecharModal, confirmar, lerForm, vazio,
         chave, uid, linkMapa, retrato } from '../ui.js';
import { abrirComanda, fazEsseServico } from './comandas.js';

let dia = hoje();

/**
 * Como a agenda está sendo olhada.
 *
 * O dia responde "o que faço agora"; o mês responde "como está minha semana
 * que vem" — e é essa segunda pergunta que faz alguém abrir a agenda no
 * domingo à noite. A lista serve para quem quer só o próximo compromisso.
 */
let visao = 'dia';   // dia | semana | mes | lista

/** Chamado pelo sino: abre a agenda já no dia da novidade. */
export function irParaDia(d) {
  dia = d;
  const alvo = document.getElementById('conteudo');
  if (alvo) { alvo.innerHTML = ''; render(alvo); }
}

const atendentes = () =>
  db.estado.profissionais.filter((p) => p.atende !== false && p.ativo !== false);

/**
 * De quem é a agenda que estou vendo.
 *
 * `null` = o studio inteiro. Quem atende abre vendo a própria: ver a coluna
 * da outra o dia todo é ruído — e num celular, come metade da tela. Quem só
 * administra abre vendo todas, porque é disso que ela precisa.
 */
let sóEu = null;
function quemVejo() {
  if (sóEu === null) sóEu = db.eu?.atende !== false && !!db.eu?.id;
  return sóEu ? db.eu.id : null;
}

/** Agendamentos de um dia, já ordenados. O banco guarda em UTC. */
function doDia(data) {
  return doPeriodo(data, data);
}

/** Tudo o que está de pé entre duas datas, do primeiro ao último horário. */
function doPeriodo(de, ate) {
  const eu = quemVejo();
  return db.estado.agendamentos
    .filter((a) => a.status !== 'cancelado'
      && localData(a.inicio) >= de && localData(a.inicio) <= ate
      && (!eu || a.profissional_id === eu))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Domingo da semana de uma data — é por ele que a grade do mês se alinha. */
function domingoDa(data) {
  const d = new Date(data + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const primeiroDoMes = (data) => data.slice(0, 8) + '01';
function ultimoDoMes(data) {
  const [a, m] = data.split('-').map(Number);
  return iso(new Date(a, m, 0));
}

const localData = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localHora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Quanto tempo de cadeira o período ocupa, em horas.
 *
 * Somar a duração de cada horário contaria o encaixe duas vezes: o corte feito
 * enquanto a cor processa não é mais uma hora no dia dela. Então o que se soma
 * é a união dos períodos de cada profissional.
 */
function horasOcupadas(lista) {
  const porProf = new Map();
  for (const a of lista) {
    const ini = new Date(a.inicio).getTime();
    const fim = a.fim ? new Date(a.fim).getTime() : ini + Number(a.duracao_min || 0) * 60000;
    if (!(fim > ini)) continue;
    if (!porProf.has(a.profissional_id)) porProf.set(a.profissional_id, []);
    porProf.get(a.profissional_id).push([ini, fim]);
  }
  let ms = 0;
  for (const faixas of porProf.values()) {
    faixas.sort((x, y) => x[0] - y[0]);
    let [de, ate] = faixas[0];
    for (const [i, f] of faixas.slice(1)) {
      if (i > ate) { ms += ate - de; de = i; ate = f; }
      else ate = Math.max(ate, f);
    }
    ms += ate - de;
  }
  return ms / 3600000;
}

/**
 * As datas de uma cliente fixa.
 *
 * O passo é em dias, não em "mês do calendário": foi assim que a Julia pediu
 * (semana, quinze, trinta) e é assim que o intervalo entre um atendimento e
 * outro fica sempre igual — que é o que importa para unha e para raiz.
 */
function datasDaSerie(inicio, passo, meses) {
  if (!inicio || !passo) return [inicio].filter(Boolean);
  const limite = new Date(inicio + 'T12:00:00');
  limite.setMonth(limite.getMonth() + (meses || 3));
  const datas = [];
  for (let d = inicio; new Date(d + 'T12:00:00') <= limite && datas.length < 60;
       d = somarDias(d, passo)) {
    datas.push(d);
  }
  return datas;
}

/**
 * De quantos em quantos dias a cliente volta.
 *
 * As opções cobrem o que elas usam todo dia; "outro" existe porque cliente de
 * unha volta a cada 18, 21, 25 dias — o intervalo é da unha dela, não do
 * calendário.
 */
const passoDe = (escolha, dias) => {
  if (!escolha) return 0;
  const n = escolha === 'outro' ? Math.round(Number(dias)) : Number(escolha);
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : 0;
};

/** O relógio de um instante, no formato que o campo de hora entende. */
const relogio = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Datas por extenso, sem virar um parágrafo quando são muitas. */
const listar = (datas) => datas.length <= 3
  ? datas.map(fmt.data).join(', ')
  : `${datas.slice(0, 3).map(fmt.data).join(', ')} e mais ${datas.length - 3}`;

/** Já tem alguém na cadeira nesse pedaço de tempo? */
function choqueCom(profissional_id, inicio, dur, ignorar) {
  const fim = new Date(inicio.getTime() + dur * 60000);
  return db.estado.agendamentos.find((x) =>
    x.id !== ignorar
    && x.profissional_id === profissional_id
    && ['confirmado', 'concluido'].includes(x.status)
    && new Date(x.inicio) < fim
    && new Date(x.fim || x.inicio) > inicio);
}

/**
 * Bateu com outro horário: pergunta em vez de recusar.
 *
 * Encaixe é trabalho, não engano: enquanto a cor processa dá para cortar o
 * cabelo de outra cliente, e é assim que o dia rende. Mas continua sendo raro
 * o suficiente para merecer uma pergunta — quem digitou a hora errada tem de
 * ver o aviso antes de a agenda ficar com duas clientes no mesmo minuto.
 */
async function pedirEncaixe(choque, profissional_id) {
  return confirmar('Encaixar mesmo assim?',
    `${nomeProf(profissional_id)} já tem ${choque.cliente_nome} das `
    + `${localHora(choque.inicio)} às ${localHora(choque.fim || choque.inicio)}`
    + ` (${choque.servico_nome}).\n\n`
    + 'Se for encaixe — um corte enquanto a cor processa, por exemplo — pode '
    + 'seguir: os dois ficam na agenda, e este entra marcado como encaixe.',
    'Encaixar', false);
}

/** O tempo de tabela do serviço, em minutos. */
const minutosDe = (s) => Math.max(15, Math.round((Number(s?.tempo) || 1) * 60));

/**
 * A duração que vale para este horário.
 *
 * O tempo da tabela é o ponto de partida; quem está marcando pode esticar ou
 * encurtar. Campo vazio ou fora do razoável volta para o da tabela — meia
 * hora digitada errada vira duas clientes no mesmo horário.
 */
function duracaoValida(valor, s) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) && n >= 15 && n <= 600 ? n : minutosDe(s);
}

function somarDias(data, n) {
  const d = new Date(data + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function render(raiz) {
  const profs = atendentes();
  const eu = quemVejo();
  const visiveis = eu ? profs.filter((p) => p.id === eu) : profs;
  const podeAlternar = profs.length > 1 && db.eu?.atende !== false;

  const { de, ate } = janela();
  const lista = doPeriodo(de, ate);
  const total = lista.reduce((s, a) => s + Number(a.valor || 0), 0);
  const horas = horasOcupadas(lista);
  const bloqueiosHoje = db.estado.bloqueios.filter((b) =>
    localData(b.inicio) <= ate && localData(b.fim) >= de);

  raiz.innerHTML = `
    <div class="flex envolve mb" style="gap:8px">
      <div class="pilulas">
        ${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista']].map(([v, t]) =>
          `<button class="pilula ${visao === v ? 'ativa' : ''}" data-visao="${v}">${t}</button>`).join('')}
      </div>
      <span class="crescer"></span>
      ${podeAlternar ? `
        <div class="pilulas">
          <button class="pilula ${eu ? 'ativa' : ''}" data-ver="eu">Só eu</button>
          <button class="pilula ${eu ? '' : 'ativa'}" data-ver="todas">Studio</button>
        </div>` : ''}
    </div>

    <div class="flex envolve mb" style="gap:8px">
      ${visao === 'lista' ? '' : `
        <button class="btn-icone" id="anterior" title="Anterior">${ico('voltar')}</button>
        <input type="date" id="dia" value="${dia}" style="width:auto">
        <button class="btn-icone" id="proximo" title="Próximo" style="transform:rotate(180deg)">${ico('voltar')}</button>
        <button class="btn btn-sm ${dia === hoje() ? 'btn-primario' : ''}" id="hoje">Hoje</button>`}
      <span class="crescer"></span>
      <button class="btn btn-sm" id="bloquear">${ico('relogio')}Bloquear</button>
      <button class="btn btn-primario btn-sm" id="novo">${ico('mais')}Encaixar</button>
    </div>

    <div class="flex mb" style="gap:10px">
      ${estrela()}<span class="eyebrow">${tituloDoPeriodo()}</span>
    </div>

    <div class="grade c3 mb">
      <div class="kpi destaque"><div class="rotulo">Agendado ${visao === 'dia' ? 'no dia' : 'no período'}</div>
        <div class="valor">${fmt.brlCurto(total)}</div>
        <div class="nota">${lista.length} horário${lista.length === 1 ? '' : 's'}</div></div>
      <div class="kpi"><div class="rotulo">Cadeira ocupada</div>
        <div class="valor">${fmt.horas(horas)}</div></div>
      <div class="kpi"><div class="rotulo">Já atendidas</div>
        <div class="valor">${lista.filter((a) => a.status === 'concluido').length}
          <span class="t3" style="font-size:18px">/ ${lista.length}</span></div></div>
    </div>

    ${bloqueiosHoje.length ? `<div class="aviso alerta mb">${ico('relogio')}<div>
      ${bloqueiosHoje.map((b) => `<div style="margin-bottom:4px">
        <strong>${esc(nomeProf(b.profissional_id) || 'Studio inteiro')}</strong>
        · ${esc(quandoBloqueio(b))}${b.motivo ? ` · ${esc(b.motivo)}` : ''}
        <button class="btn btn-sm" data-desbloquear="${b.id}">Liberar</button></div>`).join('')}
    </div>` : ''}

    ${({ dia: () => corpoDia(visiveis, lista),
        semana: () => corpoSemana(de),
        mes: () => corpoMes(),
        lista: () => corpoLista() })[visao]()}`;

  raiz.querySelectorAll('[data-visao]').forEach((b) => b.onclick = () => {
    visao = b.dataset.visao; render(raiz);
  });
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => {
    sóEu = b.dataset.ver === 'eu'; render(raiz);
  });
  // Tocar num dia da grade do mês ou da semana leva para aquele dia.
  raiz.querySelectorAll('[data-ir-dia]').forEach((b) => b.onclick = () => {
    dia = b.dataset.irDia; visao = 'dia'; render(raiz);
  });

  raiz.querySelector('#dia')?.addEventListener('change', (e) => { dia = e.target.value; render(raiz); });
  raiz.querySelector('#anterior')?.addEventListener('click', () => { dia = andar(-1); render(raiz); });
  raiz.querySelector('#proximo')?.addEventListener('click', () => { dia = andar(1); render(raiz); });
  raiz.querySelector('#hoje')?.addEventListener('click', () => { dia = hoje(); render(raiz); });
  raiz.querySelector('#novo').onclick = () => abrirAgendamento(null, dia);
  raiz.querySelector('#bloquear').onclick = () => abrirBloqueio(dia);
  raiz.querySelectorAll('[data-agend]').forEach((el) =>
    el.onclick = () => abrirAgendamento(el.dataset.agend));
  raiz.querySelectorAll('[data-desbloquear]').forEach((b) => b.onclick = async () => {
    if (await confirmar('Liberar a agenda?', 'O bloqueio some e os horários voltam a aparecer para as clientes.', 'Liberar', false)) {
      await db.remover('bloqueios', b.dataset.desbloquear);
      avisar('Agenda liberada');
    }
  });
}

/** O pedaço de tempo que a visão de agora abrange. */
function janela() {
  if (visao === 'semana') { const de = domingoDa(dia); return { de, ate: somarDias(de, 6) }; }
  if (visao === 'mes')    return { de: primeiroDoMes(dia), ate: ultimoDoMes(dia) };
  if (visao === 'lista')  return { de: hoje(), ate: somarDias(hoje(), 60) };
  return { de: dia, ate: dia };
}

/** As setas andam no passo da visão: um dia, uma semana, um mês. */
function andar(n) {
  if (visao === 'semana') return somarDias(dia, 7 * n);
  if (visao === 'mes') {
    const [a, m] = dia.split('-').map(Number);
    const d = new Date(a, m - 1 + n, 1);
    // Dia 31 pulando para um mês de 30 não pode virar o mês seguinte.
    const ultimo = new Date(a, m + n, 0).getDate();
    d.setDate(Math.min(Number(dia.slice(8)), ultimo));
    return iso(d);
  }
  return somarDias(dia, n);
}

function tituloDoPeriodo() {
  if (visao === 'lista') return 'Próximos horários';
  if (visao === 'mes') {
    const t = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (visao === 'semana') {
    const de = domingoDa(dia);
    const curto = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${curto(de)} a ${curto(somarDias(de, 6))}`;
  }
  return diaPorExtenso(dia);
}

// ─── As quatro visões ──────────────────────────────────────────────────────

function corpoDia(visiveis, lista) {
  return `
    <div class="grade agenda-colunas" style="--colunas:${Math.max(1, visiveis.length)}">
      ${visiveis.map((p) => coluna(p, lista.filter((a) => a.profissional_id === p.id))).join('')
        || vazio('Nenhuma profissional cadastrada para atender.')}
    </div>`;
}

/** A semana em sete blocos, um por dia. Dia vazio aparece do mesmo jeito:
    é o buraco na semana que interessa ver. */
function corpoSemana(domingo) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
  return `<div class="semana">
    ${dias.map((d) => {
      const itens = doDia(d);
      const nome = new Date(d + 'T12:00:00')
        .toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return `<div class="semana-dia ${d === hoje() ? 'hoje' : ''}">
        <button class="semana-topo" data-ir-dia="${d}">
          <span class="rotulo">${esc(nome)}</span>
          <span class="num display">${d.slice(8)}</span>
          ${itens.length ? `<span class="selo">${itens.length}</span>` : ''}
        </button>
        ${itens.length ? itens.map((a) => `
          <button class="semana-item" data-agend="${a.id}">
            <span class="num" style="font-weight:600">${localHora(a.inicio)}</span>
            <span class="truncar">${esc(a.cliente_nome)}</span>
            <span class="pequeno t3 truncar">${esc(a.servico_nome)}</span>
          </button>`).join('')
          : '<span class="pequeno t3 centro" style="padding:10px 0">livre</span>'}
      </div>`;
    }).join('')}
  </div>`;
}

/** O mês inteiro numa grade, com uma bolinha por horário — é a visão que
    responde "como está minha semana que vem" de um relance. */
function corpoMes() {
  const inicio = domingoDa(primeiroDoMes(dia));
  const fimMes = ultimoDoMes(dia);
  const semanas = [];
  for (let d = inicio; d <= fimMes || semanas.length * 7 < 1; ) {
    const semana = Array.from({ length: 7 }, (_, i) => somarDias(d, i));
    semanas.push(semana);
    d = somarDias(d, 7);
    if (d > fimMes) break;
  }
  const mesAtual = dia.slice(0, 7);
  const cor = { concluido: 'ok', faltou: 'erro' };

  return `<div class="mes">
    <div class="mes-cabeca">
      ${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
        .map((d) => `<span class="rotulo">${d}</span>`).join('')}
    </div>
    ${semanas.map((semana) => `<div class="mes-linha">
      ${semana.map((d) => {
        const itens = doDia(d);
        const foraDoMes = d.slice(0, 7) !== mesAtual;
        return `<button class="mes-dia ${foraDoMes ? 'fora' : ''} ${d === hoje() ? 'hoje' : ''}"
                        data-ir-dia="${d}" title="${itens.length} horário(s)">
          <span class="n">${d.slice(8)}</span>
          <span class="pontos">
            ${itens.slice(0, 4).map((a) =>
              `<i class="ponto ${cor[a.status] || ''}"></i>`).join('')}
            ${itens.length > 4 ? `<i class="mais">+${itens.length - 4}</i>` : ''}
          </span>
        </button>`;
      }).join('')}
    </div>`).join('')}
  </div>`;
}

/** O que vem pela frente, em ordem, agrupado por dia. */
function corpoLista() {
  const proximos = doPeriodo(hoje(), somarDias(hoje(), 60))
    .filter((a) => new Date(a.inicio) >= new Date(Date.now() - 3600e3));
  if (!proximos.length) return vazio('Nenhum horário marcado daqui para a frente.');

  const porDia = new Map();
  for (const a of proximos) {
    const d = localData(a.inicio);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(a);
  }

  return `<div class="cartao">
    ${[...porDia.entries()].map(([d, itens]) => `
      <div class="lista-dia">
        <button class="lista-cabeca" data-ir-dia="${d}">
          <span class="rotulo">${esc(diaPorExtenso(d))}</span>
          <span class="pequeno t3">${itens.length} horário${itens.length === 1 ? '' : 's'}</span>
        </button>
        ${itens.map(cartaoHorario).join('')}
      </div>`).join('')}
  </div>`;
}

function coluna(prof, itens) {
  return `
    <div class="cartao">
      <div class="cartao-cabeca">
        ${retrato(prof, { tam: 34 })}
        <h3>${esc(prof.nome)}</h3>
        <span class="t3 pequeno">${itens.length}</span>
      </div>
      ${itens.length ? itens.map(cartaoHorario).join('')
        : '<p class="t3 pequeno centro" style="padding:20px 0">Dia livre.</p>'}
    </div>`;
}

function cartaoHorario(a) {
  const selo = {
    confirmado: ['', 'marcado'],
    concluido:  ['ok', 'atendida'],
    faltou:     ['erro', 'faltou'],
  }[a.status] || ['', a.status];

  return `
    <div data-agend="${a.id}" style="cursor:pointer;padding:12px 0;border-top:1px solid var(--linha)">
      <div class="flex-entre" style="align-items:flex-start">
        <div class="crescer">
          <div class="flex" style="gap:9px">
            <strong class="num display" style="font-size:19px">${localHora(a.inicio)}</strong>
            <span class="selo ${selo[0]}">${selo[1]}</span>
            ${a.origem === 'site' ? '<span class="selo" title="a cliente marcou pelo site">site</span>' : ''}
            ${a.encaixe ? '<span class="selo" title="marcado dentro de outro horário, de propósito">encaixe</span>' : ''}
            ${a.serie_id ? '<span class="selo" title="cliente fixa: este horário se repete">fixo</span>' : ''}
            ${a.grupo_id ? '<span class="selo" title="a cliente tem mais de um serviço nesta ida">mesma ida</span>' : ''}
          </div>
          <div style="font-weight:600;margin-top:3px">${esc(a.cliente_nome)}</div>
          <div class="pequeno t2">${esc(a.servico_nome)} · ${fmt.horas(a.duracao_min / 60)}</div>
        </div>
        <div style="text-align:right">
          <div class="num" style="font-weight:600">${fmt.brl(a.valor)}</div>
          ${a.cliente_telefone ? `<a class="btn-icone" style="margin-top:5px" target="_blank" rel="noopener"
              onclick="event.stopPropagation()"
              href="https://wa.me/55${esc(a.cliente_telefone)}?text=${encodeURIComponent(mensagemConfirmacao(a))}"
              title="Confirmar pelo WhatsApp">${ico('whatsapp')}</a>` : ''}
        </div>
      </div>
    </div>`;
}

const nomeProf = (id) => db.estado.profissionais.find((p) => p.id === id)?.nome;

/** A confirmação que a cliente recebe já vai com o endereço e o mapa. */
function mensagemConfirmacao(a) {
  const studio = db.cfg('studio') || {};
  const linhas = [
    `Oi, ${a.cliente_nome.split(' ')[0]}! Passando para confirmar seu horário de `
      + `${a.servico_nome} ${diaPorExtenso(localData(a.inicio))} às ${localHora(a.inicio)}.`,
  ];
  if (studio.endereco) {
    linhas.push('', `📍 ${studio.endereco}`, linkMapa(studio.endereco));
  }
  linhas.push('', 'Te esperamos! ✨');
  return linhas.join('\n');
}

function diaPorExtenso(d) {
  const data = new Date(d + 'T12:00:00');
  const txt = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  if (d === hoje()) return 'Hoje, ' + txt;
  if (d === somarDias(hoje(), 1)) return 'Amanhã, ' + txt;
  return txt;
}

// ─── Marcar ou editar ──────────────────────────────────────────────────────
export function abrirAgendamento(id, dataPadrao) {
  const a = id ? db.estado.agendamentos.find((x) => x.id === id) : null;
  const servicos = db.estado.servicos.filter((s) => s.ativo !== false && s.tipo !== 'adicional');
  const profs = atendentes();

  abrirModal({
    titulo: a ? a.cliente_nome : 'Encaixar horário',
    corpo: a ? fichaAgendamento(a) : formNovo(servicos, profs, dataPadrao),
    acoes: a ? acoesDe(a) : [
      { texto: 'Marcar', classe: 'btn-primario', onClick: (fechar, veu) => salvarNovo(fechar, veu, servicos) },
    ],
    aoAbrir: (veu) => {
      veu.querySelector('#mudar')?.addEventListener('click', () => {
        fecharModal();
        setTimeout(() => abrirEditar(a), 80);
      });

      const lista = veu.querySelector('#servicos-lista');
      if (!lista) return;

      // A lista de profissionais nunca encolhe; a de serviços acompanha quem
      // foi escolhida. Se ela não fizer nenhum, mostra todos em vez de nada.
      // Nada vem escolhido de véspera: campo preenchido sozinho é convite a
      // marcar a pessoa errada sem perceber.
      const filtrarServicos = (linha) => {
        const selProf = linha.querySelector('[data-prof]');
        const selServico = linha.querySelector('[data-serv]');
        const p = profs.find((x) => x.id === selProf.value);
        if (!p) {
          selServico.innerHTML = '<option value="">Escolha a profissional primeiro</option>';
          selServico.disabled = true;
          return;
        }
        const antes = selServico.value;
        const dela = servicos.filter((x) => fazEsseServico(p, x));
        const dela2 = dela.length ? dela : servicos;
        selServico.disabled = false;
        selServico.innerHTML = '<option value="">Escolha o serviço…</option>'
          + dela2.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('');
        if (dela2.some((x) => x.id === antes)) selServico.value = antes;
      };

      /**
       * Redesenha os tempos: cada serviço começa quando o anterior termina.
       *
       * É o que responde "a que horas ela sai daqui" com dois procedimentos na
       * mesma ida — e o que resolvia o tempo quebrado com um só.
       */
      const recalcular = () => {
        const dataEscolhida = veu.querySelector('[name=data]').value;
        let quando = null;                       // fim do serviço anterior
        let total = 0, dinheiro = 0, completos = 0, ultimoFim = null;
        for (const linha of lista.querySelectorAll('.linha-servico')) {
          const s = servicos.find((x) => x.id === linha.querySelector('[data-serv]').value);
          const min = Number(linha.querySelector('[data-dur]').value);
          const campoHora = linha.querySelector('[data-hora]');

          // A hora sugerida é logo depois do serviço anterior — é o caso comum.
          // Mas quem está marcando pode mudar: às vezes a cliente faz a unha às
          // 14h e o cabelo só às 16h, com uma folga no meio. Linha em que ela
          // mexeu na hora não é mais recalculada.
          if (!campoHora.dataset.tocada && quando != null) campoHora.value = relogio(quando);
          if (!campoHora.value) campoHora.value = '09:00';

          const ini = new Date(`${dataEscolhida}T${campoHora.value}:00`).getTime();
          linha.querySelector('[data-tabela]').textContent =
            s ? `Tabela: ${fmt.horas(s.tempo)} · ${fmt.brl(s.preco)}` : '';
          linha.querySelector('[data-quando]').textContent =
            s && min > 0 && !isNaN(ini) ? `até ${localHora(ini + min * 60000)}` : '';
          if (s && min > 0 && !isNaN(ini)) {
            quando = ini + min * 60000;
            ultimoFim = Math.max(ultimoFim ?? quando, quando);
            total += min; dinheiro += Number(s.preco) || 0; completos++;
          }
        }
        const quandoFim = ultimoFim;
        // O botão de tirar só faz sentido com mais de uma linha, e o número
        // só quando há mais de um serviço para diferenciar.
        const linhas = lista.querySelectorAll('.linha-servico');
        linhas.forEach((l, i) => {
          l.querySelector('[data-remover]').hidden = linhas.length < 2;
          l.querySelector('[data-numero]').textContent =
            linhas.length > 1 ? `Serviço ${i + 1}` : 'Serviço';
        });

        veu.querySelector('#termina').textContent = completos && quandoFim
          ? `Termina às ${localHora(quandoFim)} · ${fmt.horas(total / 60)} de atendimento`
            + (completos > 1 ? ` · ${completos} serviços · ${fmt.brl(dinheiro)}` : '')
          : '';
      };

      const ligar = (linha) => {
        const selProf = linha.querySelector('[data-prof]');
        const selServico = linha.querySelector('[data-serv]');
        const campoDur = linha.querySelector('[data-dur]');
        // Trocar de serviço traz o tempo da tabela de volta; digitar depois
        // manda. O contrário — insistir no número antigo — é o que faz alguém
        // marcar quatro horas de mechas achando que marcou uma de manicure.
        const doServico = () => {
          const s = servicos.find((x) => x.id === selServico.value);
          if (s) campoDur.value = minutosDe(s);
          recalcular();
        };
        const campoHora = linha.querySelector('[data-hora]');
        selProf.onchange = () => { filtrarServicos(linha); doServico(); };
        selServico.onchange = doServico;
        campoDur.oninput = recalcular;
        // Mexeu na hora: esta linha passa a mandar na própria, e as seguintes
        // se reorganizam a partir dela.
        campoHora.oninput = () => { campoHora.dataset.tocada = '1'; recalcular(); };
        linha.querySelector('[data-remover]').onclick = () => { linha.remove(); recalcular(); };
        filtrarServicos(linha);
      };

      const novaLinha = () => {
        lista.insertAdjacentHTML('beforeend', linhaServico(profs));
        const linha = lista.lastElementChild;
        ligar(linha);
        recalcular();
        return linha;
      };

      veu.querySelector('#mais-servico').onclick = () => {
        novaLinha().querySelector('[data-prof]').focus();
      };

      veu.querySelector('[name=data]').onchange = () => { recalcular(); mostrarRepeticao(); };

      // Dizer quantas vezes e até quando: "repetir" sem número na tela é um
      // salto no escuro — ela precisa saber que vai marcar 13 horários.
      const selRep = veu.querySelector('[name=repetir]');
      const selAte = veu.querySelector('[name=repetir_ate]');
      const quantos = veu.querySelector('#quantos');
      const selDias = veu.querySelector('[name=repetir_dias]');
      const mostrarRepeticao = () => {
        veu.querySelector('#campo-ate').hidden = !selRep.value;
        veu.querySelector('#campo-dias').hidden = selRep.value !== 'outro';
        const datas = datasDaSerie(veu.querySelector('[name=data]').value,
                                   passoDe(selRep.value, selDias.value), Number(selAte.value));
        quantos.textContent = selRep.value && datas.length > 1
          ? `${datas.length} idas ao studio, até ${fmt.data(datas[datas.length - 1])}` : '';
      };
      selRep.onchange = mostrarRepeticao;
      selAte.onchange = mostrarRepeticao;
      selDias.oninput = mostrarRepeticao;
      mostrarRepeticao();

      novaLinha();
    },
  });
}

function formNovo(servicos, profs, dataPadrao) {
  return `
    <label class="campo"><span>Cliente</span>
      <input name="cliente_nome" list="lista-clientes-ag" placeholder="Nome da cliente" required>
      <datalist id="lista-clientes-ag">
        ${db.estado.clientes.map((c) => `<option value="${esc(c.nome)}">`).join('')}
      </datalist></label>
    <label class="campo"><span>WhatsApp</span>
      <input name="cliente_telefone" type="tel" placeholder="(11) 99999-9999"></label>
    <label class="campo"><span>Dia</span>
      <input type="date" name="data" value="${dataPadrao || hoje()}"></label>

    <!-- Uma ida ao studio pode ter mais de um serviço: manicure e depois o
         corte. Antes era preciso fechar, abrir de novo e redigitar nome e
         telefone para cada um. Cada linha tem a sua profissional, porque o
         segundo serviço costuma ser com a outra. -->
    <div class="rotulo" style="margin:18px 0 8px">Serviços</div>
    <div id="servicos-lista"></div>
    <button type="button" class="btn btn-sm btn-fantasma" id="mais-servico"
      style="margin-top:4px">${ico('mais')}Adicionar serviço</button>
    <p class="dica t3" id="termina" style="margin-top:8px"></p>

    <!-- Cliente fixa. Um horário que volta sozinho é o que segura a agenda de
         quem vem sempre — e é ela que sustenta o mês. -->
    <div class="linha-campos" style="margin-top:16px">
      <label class="campo"><span>Repetir</span>
        <select name="repetir">
          <option value="">Só desta vez</option>
          <option value="7">Toda semana</option>
          <option value="14">A cada 15 dias</option>
          <option value="21">A cada 3 semanas</option>
          <option value="28">A cada 30 dias</option>
          <option value="outro">Outro intervalo…</option>
        </select></label>
      <label class="campo" id="campo-dias" hidden><span>A cada quantos dias</span>
        <input type="number" name="repetir_dias" min="1" max="120" step="1"
               inputmode="numeric" value="21"></label>
      <label class="campo" id="campo-ate" hidden><span>Até</span>
        <select name="repetir_ate">
          <option value="3">daqui a 3 meses</option>
          <option value="6">daqui a 6 meses</option>
          <option value="12">daqui a 1 ano</option>
        </select></label>
    </div>
    <p class="dica t3" id="quantos"></p>

    <label class="campo"><span>Observações</span>
      <input name="observacoes" placeholder="Ex.: quer francesinha"></label>`;
}

/** Uma linha de serviço: quem atende, o quê, e por quanto tempo. */
function linhaServico(profs) {
  return `
    <div class="linha-servico">
      <!-- Cabeçalho da linha: o número e o botão de tirar. Solto na grade, o
           ícone de lixeira caía num canto qualquer do celular, sem dizer de
           qual serviço era. -->
      <div class="linha-servico-topo">
        <span class="rotulo" data-numero>Serviço</span>
        <button type="button" class="btn-icone" data-remover
          title="Tirar este serviço">${ico('lixo')}</button>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Profissional</span>
          <select data-prof>
            <option value="">Escolha quem vai atender…</option>
            ${profs.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Serviço</span>
          <select data-serv disabled>
            <option value="">Escolha a profissional primeiro</option>
          </select>
          <span class="dica t3" data-tabela></span></label>
        <label class="campo"><span>Hora</span>
          <input type="time" data-hora step="900"></label>
        <label class="campo"><span>Duração (min)</span>
          <input type="number" data-dur min="15" max="600" step="5" inputmode="numeric" placeholder="—">
          <span class="dica t3" data-quando></span></label>
      </div>
    </div>`;
}

function fichaAgendamento(a) {
  return `
    <div class="grade c3 mb">
      <div class="kpi"><div class="rotulo">Quando</div>
        <div class="valor">${localHora(a.inicio)}</div>
        <div class="nota">${fmt.data(localData(a.inicio))}</div></div>
      <div class="kpi"><div class="rotulo">Duração</div>
        <div class="valor">${fmt.horas(a.duracao_min / 60)}</div>
        <div class="nota">até ${localHora(new Date(a.inicio).getTime() + a.duracao_min * 60000)}</div></div>
      <div class="kpi"><div class="rotulo">Valor</div>
        <div class="valor">${fmt.brlCurto(a.valor)}</div></div>
    </div>
    <table><tbody>
      <tr><td class="t2">Serviço</td><td><strong>${esc(a.servico_nome)}</strong></td></tr>
      <tr><td class="t2">Profissional</td><td>${esc(nomeProf(a.profissional_id) || '—')}</td></tr>
      <tr><td class="t2">WhatsApp</td><td>${fmt.telefone(a.cliente_telefone)}</td></tr>
      <tr><td class="t2">Marcado</td><td>${a.origem === 'site' ? 'pela cliente, no site' : 'pelo studio'}${
        a.encaixe ? ', como encaixe' : ''}</td></tr>
      ${a.serie_id ? `<tr><td class="t2">Cliente fixa</td><td>${esc(descreverSerie(a))}</td></tr>` : ''}
      ${outrosDaIda(a).length ? `<tr><td class="t2">Nesta mesma ida</td><td>${
        outrosDaIda(a).map((x) => `${esc(x.servico_nome)} às ${localHora(x.inicio)}`
          + ` <span class="t3">com ${esc((nomeProf(x.profissional_id) || '').split(' ')[0])}</span>`)
          .join('<br>')}</td></tr>` : ''}
      ${a.observacoes ? `<tr><td class="t2">Observações</td><td>${esc(a.observacoes)}</td></tr>` : ''}
    </tbody></table>
    ${a.status === 'concluido'
      ? `<div class="aviso ok mt">${ico('check')}<div>Atendimento concluído.</div></div>`
      : `<button class="btn btn-fantasma btn-sm mt" id="mudar">${ico('editar')}Editar este horário</button>`}`;
}

/** Os outros serviços da mesma ida ao studio. */
const outrosDaIda = (a) => db.estado.agendamentos
  .filter((x) => a.grupo_id && x.grupo_id === a.grupo_id && x.id !== a.id && x.status !== 'cancelado')
  .sort((x, y) => x.inicio.localeCompare(y.inicio));

/** Os outros horários da mesma cliente fixa, do mais cedo para o mais tarde. */
const daSerie = (a) => db.estado.agendamentos
  .filter((x) => a.serie_id && x.serie_id === a.serie_id && x.status !== 'cancelado')
  .sort((x, y) => x.inicio.localeCompare(y.inicio));

/**
 * "Toda semana", "a cada 15 dias" — deduzido do intervalo entre dois da série.
 * Guardar o passo no banco seria uma coluna a mais para dizer o que os próprios
 * horários já dizem.
 */
function descreverSerie(a) {
  // Conta DIAS, não horários: uma ida com manicure e corte tem dois horários
  // no mesmo dia, e a distância entre eles é uma hora, não uma semana.
  const dias = [...new Set(daSerie(a).map((x) => localData(x.inicio)))].sort();
  const hoje = localData(a.inicio);
  const restam = dias.filter((d) => d > hoje).length;
  const cauda = restam ? ` · faltam ${restam}` : ' · esta é a última';
  if (dias.length < 2) return 'sim' + cauda;
  const passo = Math.round(
    (new Date(dias[1] + 'T12:00:00') - new Date(dias[0] + 'T12:00:00')) / 86400000);
  const nome = { 7: 'toda semana', 14: 'a cada 15 dias', 28: 'a cada 30 dias' }[passo]
    || `a cada ${passo} dias`;
  return nome + cauda;
}

/**
 * Desmarcar um horário de cliente fixa: só este, ou daqui para a frente?
 *
 * Perguntar é o único caminho honesto — desmarcar a série inteira sem avisar
 * apaga meses de agenda, e desmarcar só um deixa a equipe apagando de semana
 * em semana. Os já atendidos ficam onde estão.
 */
function pedirAlcance(a) {
  const proximos = daSerie(a).filter((x) => x.inicio >= a.inicio && x.status === 'confirmado');
  return new Promise((resolve) => {
    abrirModal({
      titulo: 'Desmarcar cliente fixa',
      corpo: `<p class="t2">${esc(a.cliente_nome)} tem ${proximos.length} horário(s)
        marcado(s) daqui para a frente, ${esc(descreverSerie(a))}.</p>`,
      acoes: [
        { texto: 'Voltar', classe: 'btn-fantasma', onClick: (f) => { f(); resolve(null); } },
        { texto: 'Só este', onClick: (f) => { f(); resolve([a]); } },
        { texto: `Este e os próximos (${proximos.length})`, classe: 'btn-perigo',
          onClick: (f) => { f(); resolve(proximos); } },
      ],
    });
  });
}

function acoesDe(a) {
  if (a.status === 'concluido') {
    return [{ texto: 'Fechar', classe: 'btn-fantasma', onClick: (f) => f() }];
  }
  return [
    { texto: 'Não veio', classe: 'btn-perigo', onClick: async (fechar) => {
        if (await confirmar('Marcar falta?', 'O horário fica registrado como falta e some da agenda ativa.')) {
          await db.salvar('agendamentos', { ...a, status: 'faltou' });
          fechar(); avisar('Falta registrada');
        }
      } },
    { texto: 'Desmarcar', classe: 'btn-fantasma', onClick: async (fechar) => {
        if (a.serie_id) {
          const alvos = await pedirAlcance(a);
          if (!alvos) return;
          db.salvarLote('agendamentos', alvos.map((x) => ({ ...x, status: 'cancelado' })));
          fechar();
          avisar(alvos.length === 1 ? 'Horário liberado' : `${alvos.length} horários liberados`);
          return;
        }
        if (await confirmar('Desmarcar?', 'O horário volta a ficar livre para outra cliente.')) {
          await db.salvar('agendamentos', { ...a, status: 'cancelado' });
          fechar(); avisar('Horário liberado');
        }
      } },
    { texto: 'Cliente chegou', classe: 'btn-primario', onClick: (fechar) => {
        fechar();
        setTimeout(() => virarComanda(a), 80);
      } },
  ];
}

/** O horário vira comanda já preenchida — é o encontro da agenda com o caixa. */
async function virarComanda(a) {
  let clienteId = a.cliente_id;
  if (!clienteId && a.cliente_nome) {
    const achada = db.estado.clientes.find((c) => chave(c.nome) === chave(a.cliente_nome));
    clienteId = achada ? achada.id
      : (await db.salvar('clientes', {
          nome: a.cliente_nome, telefone: a.cliente_telefone || null, ativo: true,
        })).id;
  }
  // Uma ida com manicure e corte vira UMA comanda com os dois serviços. Abrir
  // duas obrigaria a cliente a pagar duas vezes pela mesma ida.
  const daIda = a.grupo_id
    ? db.estado.agendamentos.filter((x) => x.grupo_id === a.grupo_id && x.status === 'confirmado')
        .sort((x, y) => x.inicio.localeCompare(y.inicio))
    : [a];

  db.salvarLote('agendamentos',
    daIda.map((x) => ({ ...x, status: 'concluido', cliente_id: clienteId })));

  abrirComanda(null, {
    cliente_nome: a.cliente_nome,
    cliente_id: clienteId,
    profissional_id: a.profissional_id,
    data: localData(a.inicio),
    servico_ids: daIda.map((x) => x.servico_id).filter(Boolean),
  });
}

async function salvarNovo(fechar, veu, servicos) {
  const d = lerForm(veu);
  if (!d.cliente_nome) return avisar('Informe o nome da cliente', 'erro');
  if (!d.data) return avisar('Informe o dia', 'erro');

  // Uma ida ao studio, um ou mais serviços, cada um começando quando o
  // anterior termina.
  const pedidos = [];
  const linhas = [...veu.querySelectorAll('.linha-servico')];
  for (const linha of linhas) {
    const prof = linha.querySelector('[data-prof]').value;
    const s = servicos.find((x) => x.id === linha.querySelector('[data-serv]').value);
    // Uma linha extra esquecida em branco não atrapalha; a única em branco é
    // que precisa ser cobrada, e pela primeira coisa que falta.
    if (!prof && !s && linhas.length > 1) continue;
    if (!prof) return avisar('Escolha quem vai atender', 'erro');
    if (!s) return avisar('Escolha o serviço', 'erro');
    const hora = linha.querySelector('[data-hora]').value;
    if (!hora) return avisar('Informe a hora do serviço', 'erro');
    pedidos.push({ prof, s, hora, dur: duracaoValida(linha.querySelector('[data-dur]').value, s) });
  }
  if (!pedidos.length) return avisar('Escolha o serviço', 'erro');

  // O dia muda ANTES de salvar. Salvar já redesenha a tela (a gravação é
  // otimista), e trocar o dia depois disso deixava a agenda parada no dia
  // anterior — o horário existia, mas ela não via e marcava de novo.
  dia = d.data;

  /**
   * Os horários de uma ida. Cada serviço tem a sua hora: em geral um começa
   * quando o outro termina, mas a cliente pode fazer a unha às 14h e o cabelo
   * só às 16h — e a agenda tem de aceitar isso.
   */
  const idaDe = (data) => pedidos.map(({ prof, s, dur, hora }) =>
    ({ prof, s, dur, ini: new Date(`${data}T${hora}:00`) }));

  // A primeira ida pergunta sobre choque; as seguintes pulam o dia inteiro se
  // esbarrarem em alguém — quebrar a ida no meio deixaria a cliente com o
  // corte marcado e a unha não.
  const choque = idaDe(d.data).map((h) => choqueCom(h.prof, h.ini, h.dur)).find(Boolean);
  const encaixe = choque ? await pedirEncaixe(choque, choque.profissional_id) : false;
  if (choque && !encaixe) return;

  const datas = datasDaSerie(d.data, passoDe(d.repetir, d.repetir_dias), Number(d.repetir_ate));
  const serie_id = datas.length > 1 ? uid() : null;

  const horarios = [];
  const pulados = [];
  for (const data of datas) {
    const ida = idaDe(data);
    if (data !== d.data && ida.some((h) => choqueCom(h.prof, h.ini, h.dur))) {
      pulados.push(data);
      continue;
    }
    const grupo_id = ida.length > 1 ? uid() : null;
    for (const { prof, s, dur, ini } of ida) {
      horarios.push({
        id: uid(),
        profissional_id: prof,
        servico_id: s.id, servico_nome: s.nome,
        cliente_nome: d.cliente_nome,
        cliente_telefone: (d.cliente_telefone || '').replace(/\D/g, '') || null,
        inicio: ini.toISOString(),
        fim: new Date(ini.getTime() + dur * 60000).toISOString(),
        duracao_min: dur,
        valor: Number(s.preco) || 0,
        status: 'confirmado', origem: 'studio',
        encaixe: data === d.data && !!choque && !!choqueCom(prof, ini, dur),
        serie_id, grupo_id,
        observacoes: d.observacoes || null,
      });
    }
  }

  try {
    // As duas gravam local primeiro e sobem depois — a tela não espera a rede.
    if (horarios.length === 1) await db.salvar('agendamentos', horarios[0]);
    else db.salvarLote('agendamentos', horarios);
    fechar();
    avisar(horarios.length === 1 ? 'Horário marcado'
      : `${horarios.length} horários marcados`
        + (pulados.length ? ` · ${pulados.length} dia(s) pulado(s), já tinha cliente: ${listar(pulados)}` : ''));
  } catch (e) {
    avisar(e.message || 'Não foi possível marcar', 'erro');
  }
}

/**
 * Editar um horário já marcado — tudo, não só o relógio.
 *
 * Antes, mudar o serviço ou a profissional exigia desmarcar e marcar de novo:
 * a cliente recebia dois avisos por um atendimento que não mudou, e o horário
 * ficava livre no meio do caminho para outra pessoa pegar.
 */
export function abrirEditar(a) {
  const profs = atendentes();
  const servicos = db.estado.servicos.filter((x) => x.ativo !== false && x.tipo !== 'adicional');

  abrirModal({
    titulo: `Editar ${a.cliente_nome}`,
    corpo: `
      <label class="campo"><span>Cliente</span>
        <input name="cliente_nome" list="lista-clientes-ed" value="${esc(a.cliente_nome || '')}" required>
        <datalist id="lista-clientes-ed">
          ${db.estado.clientes.map((c) => `<option value="${esc(c.nome)}">`).join('')}
        </datalist></label>
      <label class="campo"><span>WhatsApp</span>
        <input name="cliente_telefone" type="tel" placeholder="(11) 99999-9999"
               value="${esc(a.cliente_telefone ? fmt.telefone(a.cliente_telefone) : '')}"></label>
      <div class="linha-campos">
        <label class="campo"><span>Profissional</span>
          <select name="profissional_id">
            ${profs.map((p) => `<option value="${p.id}" ${p.id === a.profissional_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Serviço</span>
          <select name="servico_id">
            ${servicos.map((x) => `<option value="${x.id}" ${x.id === a.servico_id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
          </select>
          <span class="dica t3" id="ed-tabela"></span></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Dia</span>
          <input type="date" name="data" value="${localData(a.inicio)}"></label>
        <label class="campo"><span>Hora</span>
          <input type="time" name="hora" value="${localHora(a.inicio)}" step="900"></label>
        <label class="campo"><span>Duração (min)</span>
          <input type="number" name="duracao_min" min="15" max="600" step="5"
                 inputmode="numeric" value="${a.duracao_min}"></label>
      </div>
      <p class="dica t3" id="termina"></p>
      <label class="campo"><span>Valor</span>
        <input type="number" name="valor" step="0.01" min="0" value="${a.valor ?? 0}">
        <span class="dica t3">Trocar o serviço traz o preço da tabela; aqui dá para
          ajustar só para esta cliente.</span></label>
      <label class="campo"><span>Observações</span>
        <input name="observacoes" value="${esc(a.observacoes || '')}"
               placeholder="Ex.: quer francesinha"></label>
      ${a.serie_id ? `<div class="aviso mt">${ico('info')}<div>Esta cliente é fixa
        (${esc(descreverSerie(a))}). A mudança vale só para este horário.</div></div>` : ''}`,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-fantasma', onClick: (f) => f() },
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          if (!d.cliente_nome) return avisar('Informe o nome da cliente', 'erro');
          if (!d.data || !d.hora) return avisar('Informe o dia e a hora', 'erro');
          const s = servicos.find((x) => x.id === d.servico_id);
          if (!s) return avisar('Escolha o serviço', 'erro');

          const inicio = new Date(`${d.data}T${d.hora}:00`);
          const dur = duracaoValida(d.duracao_min, s);

          const choque = choqueCom(d.profissional_id, inicio, dur, a.id);
          const encaixe = choque ? await pedirEncaixe(choque, d.profissional_id) : false;
          if (choque && !encaixe) return;

          dia = d.data;
          try {
            await db.salvar('agendamentos', {
              ...a,
              cliente_nome: d.cliente_nome,
              cliente_telefone: (d.cliente_telefone || '').replace(/\D/g, '') || null,
              profissional_id: d.profissional_id,
              servico_id: s.id, servico_nome: s.nome,
              inicio: inicio.toISOString(),
              fim: new Date(inicio.getTime() + dur * 60000).toISOString(),
              duracao_min: dur,
              valor: d.valor == null ? (Number(s.preco) || 0) : Number(d.valor),
              observacoes: d.observacoes || null,
              encaixe: encaixe || !!a.encaixe,
            });
            fechar();
            avisar('Horário atualizado');
          } catch (e) {
            avisar(e.message || 'Não foi possível salvar', 'erro');
          }
        } },
    ],
    aoAbrir: (veu) => {
      const selServico = veu.querySelector('[name=servico_id]');
      const campoDur = veu.querySelector('[name=duracao_min]');
      const campoValor = veu.querySelector('[name=valor]');

      const ver = () => {
        const d = lerForm(veu);
        const s = servicos.find((x) => x.id === d.servico_id);
        const min = Number(d.duracao_min);
        veu.querySelector('#ed-tabela').textContent =
          s ? `Tabela: ${fmt.horas(s.tempo)} · ${fmt.brl(s.preco)}` : '';
        veu.querySelector('#termina').textContent = min > 0 && d.data && d.hora
          ? `Termina às ${localHora(new Date(`${d.data}T${d.hora}:00`).getTime() + min * 60000)}`
            + ` · ${fmt.horas(min / 60)}`
          : '';
      };
      // Trocar o serviço traz tempo e preço da tabela; depois disso, o que ela
      // digitar manda.
      selServico.onchange = () => {
        const s = servicos.find((x) => x.id === selServico.value);
        if (s) { campoDur.value = minutosDe(s); campoValor.value = Number(s.preco) || 0; }
        ver();
      };
      veu.querySelectorAll('[name]').forEach((c) => { c.oninput = ver; c.onchange = c.onchange || ver; });
      ver();
    },
  });
}

// ─── Folga e férias ────────────────────────────────────────────────────────
/**
 * Bloquear a agenda: o dia inteiro ou só um pedaço dele.
 *
 * As duas coisas sempre couberam aqui, mas a de pedaço vivia atrás de uma
 * caixinha marcada — e quem abria a tela concluía que só dava para tirar o dia
 * todo. Agora as duas aparecem lado a lado, e a de horário já vem escolhida:
 * férias se marca uma vez por ano, um buraco na tarde se marca toda semana.
 */
export function abrirBloqueio(dataPadrao) {
  // Sugere a próxima hora cheia, dentro do horário em que o studio funciona:
  // abrir a tela às onze da noite e ver "23:00" não ajuda ninguém.
  const agora = new Date();
  const hora = Math.min(20, Math.max(8, agora.getHours() + 1));
  const dois = (n) => String(n).padStart(2, '0');
  const proximaHora = `${dois(hora)}:00`;
  const maisUma = `${dois(hora + 1)}:00`;

  abrirModal({
    titulo: 'Bloquear agenda',
    corpo: `
      <p class="t2 pequeno mb">Almoço, médico, curso, férias. No período bloqueado
        ninguém consegue marcar pelo site, e a agenda mostra o motivo.</p>
      <label class="campo"><span>Quem fica bloqueada</span>
        <select name="profissional_id">
          ${atendentes().map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
          <option value="">O studio inteiro</option>
        </select></label>

      <div class="campo"><span class="rotulo" style="display:block;margin-bottom:7px">Quanto tempo</span>
        <div class="pilulas">
          <button type="button" class="pilula ativa" data-quanto="horario">Só um horário</button>
          <button type="button" class="pilula" data-quanto="dia">Dia todo</button>
        </div>
      </div>
      <input type="hidden" name="dia_todo" value="">

      <div class="linha-campos">
        <label class="campo"><span>De</span>
          <input type="date" name="de" value="${dataPadrao || hoje()}"></label>
        <label class="campo" id="campo-ate" hidden><span>Até</span>
          <input type="date" name="ate" value="${dataPadrao || hoje()}"></label>
      </div>
      <div class="linha-campos" id="horas">
        <label class="campo"><span>Das</span>
          <input type="time" name="hi" value="${proximaHora}" step="900"></label>
        <label class="campo"><span>Às</span>
          <input type="time" name="hf" value="${maisUma}" step="900"></label>
      </div>
      <label class="campo"><span>Motivo</span>
        <input name="motivo" placeholder="Ex.: almoço, médico, curso"></label>`,
    acoes: [{ texto: 'Bloquear', classe: 'btn-primario', onClick: async (fechar, veu) => {
      const d = lerForm(veu);
      const diaTodo = !!d.dia_todo;
      if (!d.de) return avisar('Informe o dia', 'erro');
      const ate = diaTodo ? (d.ate || d.de) : d.de;
      if (ate < d.de) return avisar('A data final não pode ser antes da inicial', 'erro');
      if (!diaTodo && (!d.hi || !d.hf)) return avisar('Informe o horário', 'erro');

      const inicio = new Date(`${d.de}T${diaTodo ? '00:00' : d.hi}:00`);
      const fim = new Date(`${ate}T${diaTodo ? '23:59' : d.hf}:00`);
      if (fim <= inicio) return avisar('O fim precisa ser depois do início', 'erro');

      // Bloquear por cima de quem já está marcada não desmarca ninguém — mas
      // ela precisa saber, senão descobre no dia.
      const pegou = db.estado.agendamentos.filter((a) =>
        ['confirmado', 'concluido'].includes(a.status)
        && (!d.profissional_id || a.profissional_id === d.profissional_id)
        && new Date(a.inicio) < fim && new Date(a.fim || a.inicio) > inicio);
      if (pegou.length && !await confirmar('Já tem cliente nesse período',
        `${pegou.map((a) => `${a.cliente_nome} às ${localHora(a.inicio)}`).join(', ')}.\n\n`
        + 'O bloqueio não desmarca ninguém: impede novos horários e fica anotado na agenda.',
        'Bloquear assim mesmo', false)) return;

      dia = d.de;
      await db.salvar('bloqueios', {
        profissional_id: d.profissional_id || null,
        inicio: inicio.toISOString(), fim: fim.toISOString(),
        motivo: d.motivo || null,
      });
      fechar();
      avisar(diaTodo ? 'Dia bloqueado' : `Bloqueado das ${d.hi} às ${d.hf}`);
    } }],
    aoAbrir: (veu) => {
      const marca = veu.querySelector('[name=dia_todo]');
      veu.querySelectorAll('[data-quanto]').forEach((b) => {
        b.onclick = () => {
          const diaTodo = b.dataset.quanto === 'dia';
          veu.querySelectorAll('[data-quanto]').forEach((x) => x.classList.toggle('ativa', x === b));
          marca.value = diaTodo ? '1' : '';
          veu.querySelector('#horas').hidden = diaTodo;
          veu.querySelector('#campo-ate').hidden = !diaTodo;
        };
      });
    },
  });
}

/** "hoje, 12:00 às 13:30" ou "de 2 a 9 de setembro" — o que a tela precisa dizer. */
function quandoBloqueio(b) {
  const de = localData(b.inicio), ate = localData(b.fim);
  const diaTodo = localHora(b.inicio) === '00:00' && localHora(b.fim) >= '23:00';
  if (!diaTodo && de === ate) {
    return `${fmt.data(de)}, das ${localHora(b.inicio)} às ${localHora(b.fim)}`;
  }
  return de === ate ? `${fmt.data(de)}, dia todo`
                    : `de ${fmt.data(de)} a ${fmt.data(ate)}`;
}
