// ═══════════════════════════════════════════════════════════════════════════
// AGENDA
// O dia de cada profissional em colunas. A cliente marca sozinha pelo site e
// cai aqui; quando ela chega, um toque transforma o horário em comanda.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, hoje, avisar, abrirModal, confirmar, lerForm, vazio, chave, uid, linkMapa } from '../ui.js';
import { abrirComanda, fazEsseServico } from './comandas.js';

let dia = hoje();

/** Chamado pelo sino: abre a agenda já no dia da novidade. */
export function irParaDia(d) {
  dia = d;
  const alvo = document.getElementById('conteudo');
  if (alvo) { alvo.innerHTML = ''; render(alvo); }
}

const atendentes = () =>
  db.estado.profissionais.filter((p) => p.atende !== false && p.ativo !== false);

/** Agendamentos de um dia, já ordenados. O banco guarda em UTC. */
function doDia(data) {
  return db.estado.agendamentos
    .filter((a) => a.status !== 'cancelado' && localData(a.inicio) === data)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

const localData = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localHora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function somarDias(data, n) {
  const d = new Date(data + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function render(raiz) {
  const lista = doDia(dia);
  const profs = atendentes();
  const total = lista.reduce((s, a) => s + Number(a.valor || 0), 0);
  const horas = lista.reduce((s, a) => s + Number(a.duracao_min || 0), 0) / 60;
  const bloqueiosHoje = db.estado.bloqueios.filter((b) =>
    localData(b.inicio) <= dia && localData(b.fim) >= dia);

  raiz.innerHTML = `
    <div class="flex envolve mb" style="gap:8px">
      <button class="btn-icone" id="anterior" title="Dia anterior">${ico('voltar')}</button>
      <input type="date" id="dia" value="${dia}" style="width:auto">
      <button class="btn-icone" id="proximo" title="Próximo dia" style="transform:rotate(180deg)">${ico('voltar')}</button>
      <button class="btn btn-sm ${dia === hoje() ? 'btn-primario' : ''}" id="hoje">Hoje</button>
      <span class="crescer"></span>
      <button class="btn btn-sm" id="bloquear">${ico('relogio')}Folga</button>
      <button class="btn btn-primario btn-sm" id="novo">${ico('mais')}Encaixar</button>
    </div>

    <div class="flex mb" style="gap:10px">
      ${estrela()}<span class="eyebrow">${diaPorExtenso(dia)}</span>
    </div>

    <div class="grade c3 mb">
      <div class="kpi destaque"><div class="rotulo">Agendado no dia</div>
        <div class="valor">${fmt.brlCurto(total)}</div>
        <div class="nota">${lista.length} horário${lista.length === 1 ? '' : 's'}</div></div>
      <div class="kpi"><div class="rotulo">Cadeira ocupada</div>
        <div class="valor">${fmt.horas(horas)}</div></div>
      <div class="kpi"><div class="rotulo">Já atendidas</div>
        <div class="valor">${lista.filter((a) => a.status === 'concluido').length}
          <span class="t3" style="font-size:18px">/ ${lista.length}</span></div></div>
    </div>

    ${bloqueiosHoje.length ? `<div class="aviso alerta mb">${ico('relogio')}<div>
      ${bloqueiosHoje.map((b) => `<div><strong>${esc(nomeProf(b.profissional_id) || 'Studio inteiro')}</strong>
        — ${esc(b.motivo || 'bloqueado')}
        <button class="btn btn-sm" data-desbloquear="${b.id}">Liberar</button></div>`).join('')}
    </div>` : ''}

    <div class="grade agenda-colunas" style="--colunas:${Math.max(1, profs.length)}">
      ${profs.map((p) => coluna(p, lista.filter((a) => a.profissional_id === p.id))).join('')
        || vazio('Nenhuma profissional cadastrada para atender.')}
    </div>`;

  raiz.querySelector('#dia').onchange = (e) => { dia = e.target.value; render(raiz); };
  raiz.querySelector('#anterior').onclick = () => { dia = somarDias(dia, -1); render(raiz); };
  raiz.querySelector('#proximo').onclick = () => { dia = somarDias(dia, 1); render(raiz); };
  raiz.querySelector('#hoje').onclick = () => { dia = hoje(); render(raiz); };
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

function coluna(prof, itens) {
  return `
    <div class="cartao">
      <div class="cartao-cabeca">
        <span class="avatar verde">${esc(prof.nome[0].toUpperCase())}</span>
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
      const selServico = veu.querySelector('[name=servico_id]');
      const selProf = veu.querySelector('[name=profissional_id]');
      if (!selServico || !selProf) return;

      // A lista de profissionais nunca encolhe; a de serviços acompanha quem
      // foi escolhida. Se ela não fizer nenhum, mostra todos em vez de nada.
      // Nada vem escolhido de véspera: campo preenchido sozinho é convite a
      // marcar a pessoa errada sem perceber.
      const filtrarServicos = () => {
        const p = profs.find((x) => x.id === selProf.value);
        if (!p) {
          selServico.innerHTML = '<option value="">Escolha a profissional primeiro</option>';
          selServico.disabled = true;
          return;
        }
        const antes = selServico.value;
        const dela = servicos.filter((x) => fazEsseServico(p, x));
        const lista = dela.length ? dela : servicos;
        selServico.disabled = false;
        selServico.innerHTML = '<option value="">Escolha o serviço…</option>'
          + lista.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('');
        if (lista.some((x) => x.id === antes)) selServico.value = antes;
      };

      const mostrarDuracao = () => {
        const s = servicos.find((x) => x.id === selServico.value);
        veu.querySelector('#duracao').textContent =
          s ? `${fmt.horas(s.tempo)} · ${fmt.brl(s.preco)}` : '';
      };

      selProf.onchange = () => { filtrarServicos(); mostrarDuracao(); };
      selServico.onchange = mostrarDuracao;

      filtrarServicos();
      mostrarDuracao();
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

    <!-- A profissional vem primeiro: escolher quem atende é o que enxuga a
         lista de serviços. O caminho contrário deixaria a lista de pessoas
         curta demais para trocar de ideia. -->
    <label class="campo"><span>Profissional</span>
      <select name="profissional_id">
        <option value="">Escolha quem vai atender…</option>
        ${profs.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
      </select></label>
    <label class="campo"><span>Serviço</span>
      <select name="servico_id" disabled>
        <option value="">Escolha a profissional primeiro</option>
      </select>
      <span class="dica t3" id="duracao"></span></label>
    <div class="linha-campos">
      <label class="campo"><span>Dia</span>
        <input type="date" name="data" value="${dataPadrao || hoje()}"></label>
      <label class="campo"><span>Hora</span>
        <input type="time" name="hora" value="09:00" step="900"></label>
    </div>
    <label class="campo"><span>Observações</span>
      <input name="observacoes" placeholder="Ex.: quer francesinha"></label>`;
}

function fichaAgendamento(a) {
  return `
    <div class="grade c3 mb">
      <div class="kpi"><div class="rotulo">Quando</div>
        <div class="valor">${localHora(a.inicio)}</div>
        <div class="nota">${fmt.data(localData(a.inicio))}</div></div>
      <div class="kpi"><div class="rotulo">Duração</div>
        <div class="valor">${fmt.horas(a.duracao_min / 60)}</div></div>
      <div class="kpi"><div class="rotulo">Valor</div>
        <div class="valor">${fmt.brlCurto(a.valor)}</div></div>
    </div>
    <table><tbody>
      <tr><td class="t2">Serviço</td><td><strong>${esc(a.servico_nome)}</strong></td></tr>
      <tr><td class="t2">Profissional</td><td>${esc(nomeProf(a.profissional_id) || '—')}</td></tr>
      <tr><td class="t2">WhatsApp</td><td>${fmt.telefone(a.cliente_telefone)}</td></tr>
      <tr><td class="t2">Marcado</td><td>${a.origem === 'site' ? 'pela cliente, no site' : 'pelo studio'}</td></tr>
      ${a.observacoes ? `<tr><td class="t2">Observações</td><td>${esc(a.observacoes)}</td></tr>` : ''}
    </tbody></table>
    ${a.status === 'concluido'
      ? `<div class="aviso ok mt">${ico('check')}<div>Atendimento concluído.</div></div>` : ''}`;
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
  await db.salvar('agendamentos', { ...a, status: 'concluido', cliente_id: clienteId });
  abrirComanda(null, {
    cliente_nome: a.cliente_nome,
    cliente_id: clienteId,
    profissional_id: a.profissional_id,
    data: localData(a.inicio),
    servico_id: a.servico_id,
  });
}

async function salvarNovo(fechar, veu, servicos) {
  const d = lerForm(veu);
  if (!d.cliente_nome) return avisar('Informe o nome da cliente', 'erro');
  if (!d.profissional_id) return avisar('Escolha quem vai atender', 'erro');
  const s = servicos.find((x) => x.id === d.servico_id);
  if (!s) return avisar('Escolha o serviço', 'erro');

  const inicio = new Date(`${d.data}T${d.hora}:00`);
  const dur = Math.max(15, Math.round((Number(s.tempo) || 1) * 60));

  // Choque é recusado pelo banco, mas avisar antes evita a viagem perdida.
  const choque = db.estado.agendamentos.find((x) =>
    x.profissional_id === d.profissional_id
    && ['confirmado', 'concluido'].includes(x.status)
    && new Date(x.inicio) < new Date(inicio.getTime() + dur * 60000)
    && new Date(x.fim || x.inicio) > inicio);
  if (choque) {
    return avisar(`${nomeProf(d.profissional_id)} já tem ${choque.cliente_nome} às ${localHora(choque.inicio)}`, 'erro');
  }

  try {
    await db.salvar('agendamentos', {
      id: uid(),
      profissional_id: d.profissional_id,
      servico_id: s.id, servico_nome: s.nome,
      cliente_nome: d.cliente_nome,
      cliente_telefone: (d.cliente_telefone || '').replace(/\D/g, '') || null,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + dur * 60000).toISOString(),
      duracao_min: dur,
      valor: Number(s.preco) || 0,
      status: 'confirmado', origem: 'studio',
      observacoes: d.observacoes || null,
    });
    dia = d.data;
    fechar();
    avisar('Horário marcado');
  } catch (e) {
    avisar(e.message || 'Não foi possível marcar', 'erro');
  }
}

// ─── Folga e férias ────────────────────────────────────────────────────────
export function abrirBloqueio(dataPadrao) {
  abrirModal({
    titulo: 'Bloquear agenda',
    corpo: `
      <p class="t2 pequeno mb">Folga, férias, curso, médico. No período bloqueado
        as clientes não conseguem marcar pelo site.</p>
      <label class="campo"><span>Quem</span>
        <select name="profissional_id">
          <option value="">O studio inteiro</option>
          ${atendentes().map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
        </select></label>
      <div class="linha-campos">
        <label class="campo"><span>De</span>
          <input type="date" name="de" value="${dataPadrao || hoje()}"></label>
        <label class="campo"><span>Até</span>
          <input type="date" name="ate" value="${dataPadrao || hoje()}"></label>
      </div>
      <label class="check"><input type="checkbox" name="dia_todo" checked>
        <span>Dia todo</span></label>
      <div class="linha-campos" id="horas" hidden>
        <label class="campo"><span>Das</span><input type="time" name="hi" value="12:00"></label>
        <label class="campo"><span>Às</span><input type="time" name="hf" value="14:00"></label>
      </div>
      <label class="campo"><span>Motivo</span>
        <input name="motivo" placeholder="Ex.: férias, curso, médico"></label>`,
    acoes: [{ texto: 'Bloquear', classe: 'btn-primario', onClick: async (fechar, veu) => {
      const d = lerForm(veu);
      if (!d.de || !d.ate) return avisar('Informe o período', 'erro');
      if (d.ate < d.de) return avisar('A data final não pode ser antes da inicial', 'erro');
      const inicio = new Date(`${d.de}T${d.dia_todo ? '00:00' : d.hi}:00`);
      const fim = new Date(`${d.ate}T${d.dia_todo ? '23:59' : d.hf}:00`);
      if (fim <= inicio) return avisar('O fim precisa ser depois do início', 'erro');
      await db.salvar('bloqueios', {
        profissional_id: d.profissional_id || null,
        inicio: inicio.toISOString(), fim: fim.toISOString(),
        motivo: d.motivo || null,
      });
      fechar(); avisar('Agenda bloqueada');
    } }],
    aoAbrir: (veu) => {
      const chk = veu.querySelector('[name=dia_todo]');
      const horas = veu.querySelector('#horas');
      chk.onchange = () => { horas.hidden = chk.checked; };
    },
  });
}
