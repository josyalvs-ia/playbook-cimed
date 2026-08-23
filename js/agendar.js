// ═══════════════════════════════════════════════════════════════════════════
// AGENDAMENTO PELA VITRINE
//
// A cliente escolhe serviço, dia e horário, e o horário já fica fechado.
// Esta página nunca lê a agenda: pergunta ao banco só os horários livres, e
// pede para marcar. Nome e telefone das outras clientes ficam do outro lado.
// ═══════════════════════════════════════════════════════════════════════════

import { esc, fmt, avisar, precoTexto, linkMapa } from './ui.js';

const DIAS_A_FRENTE = 45;
const GUARDADOS = 'alento.meus-horarios';

/** A frase que fecha o agendamento. Escolhida pelo studio, do manual da marca. */
const RECADO = 'Beleza que acolhe e renova. Te esperamos.';

/** Horários que esta pessoa marcou, guardados no navegador dela. */
export function meusHorarios() {
  try {
    const agora = Date.now();
    return JSON.parse(localStorage.getItem(GUARDADOS) || '[]')
      .filter((h) => new Date(h.quando).getTime() > agora)
      .sort((a, b) => a.quando.localeCompare(b.quando));
  } catch { return []; }
}

function guardar(h) {
  try {
    localStorage.setItem(GUARDADOS, JSON.stringify([...meusHorarios(), h]));
  } catch { /* navegador anônimo: o horário está marcado do mesmo jeito */ }
}

export function esquecer(codigo) {
  try {
    localStorage.setItem(GUARDADOS,
      JSON.stringify(meusHorarios().filter((h) => h.codigo !== codigo)));
  } catch {}
}

export async function iniciarAgendamento({ sb, servicos, categorias, studio, raiz }) {
  let etapa = 1;
  let escolha = { servico: null, dia: null, horario: null };
  let livres = [];

  const nomeCat = (id) => categorias.find((c) => c.id === id)?.nome || id;

  function pintar() {
    raiz.innerHTML = `
      <div class="ag-passos">
        ${['Serviço', 'Dia e hora', 'Seus dados'].map((t, i) => `
          <span class="ag-passo ${etapa === i + 1 ? 'atual' : etapa > i + 1 ? 'feito' : ''}">
            <b>${i + 1}</b>${t}</span>`).join('')}
      </div>
      <div id="ag-corpo"></div>`;
    ({ 1: passoServico, 2: passoHorario, 3: passoDados }[etapa])();
  }

  // ── 1. Serviço ───────────────────────────────────────────────────────────
  function passoServico() {
    const porCat = new Map();
    for (const s of servicos) {
      if (!porCat.has(s.categoria)) porCat.set(s.categoria, []);
      porCat.get(s.categoria).push(s);
    }
    document.getElementById('ag-corpo').innerHTML = `
      <p class="t2 pequeno mb">O que você quer fazer?</p>
      ${[...porCat.entries()].map(([cat, itens]) => `
        <div class="ag-grupo">
          <div class="ag-grupo-titulo">${esc(nomeCat(cat))}</div>
          ${itens.map((s) => `
            <button class="ag-opcao" data-serv="${esc(s.id)}">
              <span class="crescer">
                <strong>${esc(s.nome)}</strong>
                <span class="ag-dur">${fmt.horas(s.tempo)}</span>
              </span>
              <span class="ag-preco">${esc(precoTexto(s))}</span>
            </button>`).join('')}
        </div>`).join('')}`;

    raiz.querySelectorAll('[data-serv]').forEach((b) => b.onclick = () => {
      escolha.servico = servicos.find((s) => s.id === b.dataset.serv);
      escolha.dia = null; escolha.horario = null;
      etapa = 2; pintar();
    });
  }

  // ── 2. Dia e hora ────────────────────────────────────────────────────────
  function passoHorario() {
    const dias = [];
    const hoje = new Date();
    for (let i = 0; i < DIAS_A_FRENTE; i++) {
      const d = new Date(hoje); d.setDate(hoje.getDate() + i);
      dias.push(d);
    }
    if (!escolha.dia) escolha.dia = iso(dias[0]);

    document.getElementById('ag-corpo').innerHTML = `
      <button class="ag-voltar" id="voltar">&larr; Trocar serviço</button>
      <div class="ag-escolhido">
        <strong>${esc(escolha.servico.nome)}</strong>
        <span>${fmt.horas(escolha.servico.tempo)} · ${esc(precoTexto(escolha.servico))}</span>
      </div>
      <div class="ag-dias" id="dias">
        ${dias.map((d) => `
          <button class="ag-dia ${iso(d) === escolha.dia ? 'atual' : ''}" data-dia="${iso(d)}">
            <span class="sem">${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
            <span class="num">${String(d.getDate()).padStart(2, '0')}</span>
            <span class="mes">${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
          </button>`).join('')}
      </div>
      <div id="ag-horarios"><p class="t3 pequeno centro" style="padding:26px">Procurando horários…</p></div>`;

    raiz.querySelector('#voltar').onclick = () => { etapa = 1; pintar(); };
    raiz.querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => {
      escolha.dia = b.dataset.dia; escolha.horario = null; passoHorario();
    });
    raiz.querySelector('.ag-dia.atual')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    buscarHorarios();
  }

  async function buscarHorarios() {
    const alvo = raiz.querySelector('#ag-horarios');
    const { data, error } = await sb.rpc('horarios_livres', {
      p_servico_id: escolha.servico.id, p_data: escolha.dia,
    });
    if (error) {
      alvo.innerHTML = `<div class="aviso erro">Não consegui carregar os horários. Tente de novo.</div>`;
      return;
    }
    livres = data || [];
    if (!livres.length) {
      alvo.innerHTML = `<div class="ag-vazio">
        <p>Nenhum horário livre neste dia.</p>
        <p class="pequeno">Escolha outro dia acima${studio.whatsapp
          ? ` ou <a href="https://wa.me/55${String(studio.whatsapp).replace(/\D/g, '')}" target="_blank" rel="noopener">fale com a gente</a>` : ''}.</p>
      </div>`;
      return;
    }
    // Manhã e tarde separadas: é assim que a cliente pensa o próprio dia.
    const manha = livres.filter((h) => new Date(h.quando).getHours() < 12);
    const tarde = livres.filter((h) => new Date(h.quando).getHours() >= 12);
    const bloco = (titulo, itens) => itens.length ? `
      <div class="ag-turno">
        <div class="ag-turno-titulo">${titulo}</div>
        <div class="ag-horas">
          ${itens.map((h) => `
            <button class="ag-hora" data-quando="${esc(h.quando)}" data-prof="${esc(h.prof_id)}">
              ${hora(h.quando)}<span>${esc(h.prof_nome)}</span>
            </button>`).join('')}
        </div>
      </div>` : '';
    alvo.innerHTML = bloco('Manhã', manha) + bloco('Tarde', tarde);

    alvo.querySelectorAll('[data-quando]').forEach((b) => b.onclick = () => {
      escolha.horario = { quando: b.dataset.quando, prof_id: b.dataset.prof,
                          prof_nome: b.textContent.trim().split('\n').pop().trim() };
      etapa = 3; pintar();
    });
  }

  // ── 3. Dados e confirmação ───────────────────────────────────────────────
  function passoDados() {
    const h = escolha.horario;
    document.getElementById('ag-corpo').innerHTML = `
      <button class="ag-voltar" id="voltar">&larr; Trocar horário</button>
      <div class="ag-resumo">
        <div class="linha"><span>Serviço</span><strong>${esc(escolha.servico.nome)}</strong></div>
        <div class="linha"><span>Quando</span><strong>${dataLonga(h.quando)} às ${hora(h.quando)}</strong></div>
        <div class="linha"><span>Com</span><strong>${esc(h.prof_nome)}</strong></div>
        <div class="linha total"><span>Valor</span><strong>${esc(precoTexto(escolha.servico))}</strong></div>
      </div>
      <label class="campo"><span>Seu nome</span>
        <input id="ag-nome" autocomplete="name" placeholder="Nome e sobrenome"></label>
      <label class="campo"><span>Seu WhatsApp</span>
        <input id="ag-tel" type="tel" autocomplete="tel" inputmode="numeric" placeholder="(11) 99999-9999"></label>
      <label class="campo"><span>Quer avisar alguma coisa? (opcional)</span>
        <input id="ag-obs" placeholder="Ex.: tenho alergia a acetona"></label>
      <button class="btn btn-primario btn-bloco" id="ag-confirmar">Confirmar horário</button>
      <p class="pequeno t3 centro mt">Ao confirmar, o horário fica reservado no seu nome.</p>`;

    raiz.querySelector('#voltar').onclick = () => { etapa = 2; pintar(); };
    raiz.querySelector('#ag-confirmar').onclick = confirmar;
  }

  async function confirmar() {
    const btn = raiz.querySelector('#ag-confirmar');
    const nome = raiz.querySelector('#ag-nome').value.trim();
    const tel = raiz.querySelector('#ag-tel').value.replace(/\D/g, '');
    if (nome.length < 2) return avisar('Escreva seu nome', 'erro');
    if (tel.length < 10) return avisar('Escreva seu WhatsApp com DDD', 'erro');

    btn.disabled = true; btn.textContent = 'Marcando…';
    const { data, error } = await sb.rpc('criar_agendamento', {
      p_servico_id: escolha.servico.id,
      p_profissional_id: escolha.horario.prof_id,
      p_inicio: escolha.horario.quando,
      p_nome: nome, p_telefone: tel,
      p_observacoes: raiz.querySelector('#ag-obs').value.trim() || null,
    });

    if (error) {
      avisar(limparErro(error.message), 'erro');
      btn.disabled = false; btn.textContent = 'Confirmar horário';
      // O horário pode ter sido tomado: volta para a lista, já atualizada.
      if (/preenchido/i.test(error.message)) { etapa = 2; pintar(); }
      return;
    }
    mostrarPronto(data[0], nome);
  }

  function mostrarPronto(r, nome) {
    const zap = String(studio.whatsapp || '').replace(/\D/g, '');


    guardar({ codigo: r.codigo, quando: r.quando, servico: r.servico,
              prof: r.prof_nome, nome });

    // A marca ocupa o centro: é o momento em que a cliente fecha com o studio.
    document.querySelector('.ag-topo')?.setAttribute('hidden', '');
    raiz.innerHTML = `
      <div class="ag-pronto">
        <img class="ag-marca" src="assets/marca.svg" alt="Alento — Studio de Beleza">
        <div class="ag-selo">✓</div>
        <h2>Horário marcado!</h2>
        <p class="ag-recado">${esc(RECADO)}</p>
        <p class="t2">${esc(nome.split(' ')[0])}, te esperamos <strong>${dataLonga(r.quando)}
          às ${hora(r.quando)}</strong>, com ${esc(r.prof_nome)}.</p>
        <div class="ag-resumo mt">
          <div class="linha"><span>Serviço</span><strong>${esc(r.servico)}</strong></div>
          ${studio.endereco ? `
            <div class="linha"><span>Onde</span>
              <strong style="text-align:right">${esc(studio.endereco)}</strong></div>
            <div class="linha"><span></span>
              <a href="${esc(linkMapa(studio.endereco))}" target="_blank" rel="noopener"
                 style="color:var(--creme)">Como chegar &rarr;</a></div>` : ''}
        </div>
        <div class="flex mt" style="gap:8px;justify-content:center;flex-wrap:wrap">
          ${zap ? `<a class="btn btn-primario" target="_blank" rel="noopener"
            href="https://wa.me/55${zap}?text=${encodeURIComponent(
              `Oi! Marquei ${r.servico} para ${dataLonga(r.quando)} às ${hora(r.quando)}. Meu nome é ${nome}.`)}">
            Avisar no WhatsApp</a>` : ''}
          <button class="btn" id="ag-outro">Marcar outro horário</button>
        </div>
        <p class="pequeno t3 mt" style="max-width:34ch;margin-left:auto;margin-right:auto">
          Precisa desmarcar? É só voltar nesta página — seu horário fica salvo aqui
          no seu celular.</p>
        <button class="ag-desmarcar" id="ag-desmarcar">Desmarcar este horário</button>
      </div>`;

    raiz.querySelector('#ag-outro').onclick = () => {
      document.querySelector('.ag-topo')?.removeAttribute('hidden');
      escolha = { servico: null, dia: null, horario: null }; etapa = 1; pintar();
    };
    raiz.querySelector('#ag-desmarcar').onclick = () => desmarcar(sb, r.codigo, () => {
      document.querySelector('.ag-topo')?.removeAttribute('hidden');
      escolha = { servico: null, dia: null, horario: null }; etapa = 1; pintar();
    });
  }

  pintar();
}

/** Desmarca de verdade, no banco, e tira do que está guardado no navegador. */
export async function desmarcar(sb, codigo, depois) {
  const { data, error } = await sb.rpc('cancelar_agendamento', { p_token: codigo });
  if (error || data === false) {
    return avisar('Não consegui desmarcar. Chame o studio no WhatsApp, por favor.', 'erro');
  }
  esquecer(codigo);
  avisar('Horário desmarcado');
  depois?.();
}

// ─── Auxiliares ────────────────────────────────────────────────────────────
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const hora = (q) =>
  new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const dataLonga = (q) =>
  new Date(q).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

/** O Postgres devolve o texto com prefixos técnicos; a cliente lê só o recado. */
function limparErro(msg) {
  return String(msg || '').replace(/^.*?:\s*/, '').trim() || 'Não consegui marcar. Tente de novo.';
}
