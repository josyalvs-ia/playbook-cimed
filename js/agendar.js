// ═══════════════════════════════════════════════════════════════════════════
// AGENDAMENTO PELA VITRINE
//
// A cliente escolhe serviço, dia e horário, e o horário já fica fechado.
// Esta página nunca lê a agenda: pergunta ao banco só os horários livres, e
// pede para marcar. Nome e telefone das outras clientes ficam do outro lado.
// ═══════════════════════════════════════════════════════════════════════════

import { esc, fmt, avisar, precoTexto, linkMapa, retrato, destaque, icoDestaque,
         familiaDe, RECADO_AGENDA } from './ui.js';

const DIAS_A_FRENTE = 45;
const GUARDADOS = 'alento.meus-horarios';

/**
 * A frase que fecha o agendamento.
 *
 * Vale a da profissional que vai atender; sem ela, a do studio; sem nenhuma
 * das duas, esta — que é a do manual da marca e foi escolhida pelo studio.
 */
export const RECADO_PADRAO = 'Beleza que acolhe e renova. Te esperamos.';

const recadoDe = (prof, studio) =>
  (prof?.recado || '').trim() || (studio?.recado || '').trim() || RECADO_PADRAO;

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

/**
 * Confere no banco os horários que estão guardados neste aparelho.
 *
 * Sem isto o cartão "Seu próximo horário" era só memória do celular: um
 * horário cancelado do lado do studio continuava aparecendo, e o botão de
 * desmarcar respondia "não consegui" para sempre, porque no banco já não havia
 * nada para cancelar. Agora o que sumiu ou foi cancelado sai da tela, e o que
 * o studio remarcou aparece com o horário novo.
 *
 * Se a função ainda não existir no banco, não faz nada: a página continua
 * funcionando como antes em vez de ficar sem o cartão.
 */
export async function conferirMeusHorarios(sb) {
  const meus = meusHorarios();
  if (!sb || !meus.length) return meus;

  const { data, error } = await sb.rpc('situacao_agendamentos',
    { p_tokens: meus.map((h) => h.codigo) });
  if (error || !Array.isArray(data)) return meus;

  const noBanco = new Map(data.map((x) => [x.codigo, x]));
  const atualizados = meus
    .map((h) => {
      const x = noBanco.get(h.codigo);
      if (!x) return null;                          // apagado no banco
      if (x.situacao !== 'confirmado') return null; // cancelado, faltou, concluído
      return { ...h, quando: x.quando, servico: x.servico, prof: x.prof_nome };
    })
    .filter(Boolean);

  try { localStorage.setItem(GUARDADOS, JSON.stringify(atualizados)); } catch {}
  return meusHorarios();
}

export async function iniciarAgendamento({ sb, servicos, categorias, studio, equipe = [], raiz }) {
  let etapa = 1;
  let escolha = { servico: null, dia: null, horario: null };

  /** Este serviço se marca sozinha pelo site? */
  const marcaSozinha = (s) => s?.agenda_online !== false;

  /**
   * Quem atende este serviço.
   *
   * Serviço de cabelo que se combina por mensagem tem de cair no WhatsApp de
   * quem faz cabelo — mandar a cliente para o número errado é fazê-la contar a
   * história duas vezes. Quem faz as duas coisas serve para qualquer serviço,
   * mas só entra se não houver alguém da área.
   */
  function quemFaz(s) {
    const tipo = s?.profissional || 'unhas';
    return equipe.find((p) => p.funcao === tipo)
        || equipe.find((p) => p.funcao === 'ambos')
        || null;
  }

  const primeiroNome = (p) => String(p?.apelido || p?.nome || '').split(' ')[0];

  /** O WhatsApp para falar sobre este serviço: o de quem faz, ou o do studio. */
  const zapDe = (s) =>
    String(quemFaz(s)?.whatsapp || studio.whatsapp || '').replace(/\D/g, '');

  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Palavras que aparecem em serviço demais para dizer que dois são parentes.
  const VAZIAS = new Set(['avaliacao', 'avaliacoes', 'cabelo', 'cabelos', 'unha', 'unhas',
                          'servico', 'sessao', 'completa', 'completo']);
  const palavrasDe = (nome) => new Set(
    semAcento(nome).split(/[^a-z0-9]+/).filter((p) => p.length > 3 && !VAZIAS.has(p)));

  /**
   * A avaliação DESTE serviço — não uma avaliação qualquer.
   *
   * A Laura tem uma avaliação para cada procedimento de cor. Escolher a
   * primeira da mesma família oferecia "avaliação correção de cor" a quem
   * queria mechas: manda a cliente para o horário errado e ela descobre na
   * cadeira. Por isso a escolha é por parentesco de nome, e na dúvida não
   * oferece nada — botão nenhum é melhor que o botão errado.
   */
  function avaliacaoDe(s) {
    const alvo = palavrasDe(s.nome);
    if (!alvo.size) return null;
    let melhor = null, nota = 0;
    for (const x of servicos) {
      if (x.id === s.id || !marcaSozinha(x) || !/avalia/i.test(x.nome)) continue;
      const quantas = [...palavrasDe(x.nome)].filter((p) => alvo.has(p)).length;
      if (quantas > nota) { melhor = x; nota = quantas; }
    }
    return nota ? melhor : null;
  }
  let familia = null;                 // destaque escolhido no passo 1
  let livres = [];

  const nomeCat = (id) => categorias.find((c) => c.id === id)?.nome || id;
  const quemE = (id) => equipe.find((p) => p.id === id) || null;

  function pintar() {
    raiz.innerHTML = `
      <div class="ag-passos">
        ${['Serviço', marcaSozinha(escolha.servico) ? 'Dia e hora' : 'Como marcar', 'Seus dados']
          .map((t, i) => `
          <button class="ag-passo ${etapa === i + 1 ? 'atual' : etapa > i + 1 ? 'feito' : ''}"
                  ${etapa > i + 1 ? `data-voltar-para="${i + 1}"` : 'disabled'}>
            <b>${etapa > i + 1 ? '✓' : i + 1}</b>${t}</button>`).join('')}
      </div>
      <div id="ag-corpo"></div>`;

    // Passo já cumprido volta a ser clicável: dá para trocar o serviço no meio
    // do caminho sem recomeçar do zero.
    raiz.querySelectorAll('[data-voltar-para]').forEach((b) => b.onclick = () => {
      etapa = Number(b.dataset.voltarPara); pintar();
    });
    if (etapa === 2 && !marcaSozinha(escolha.servico)) return passoRecado();
    ({ 1: passoServico, 2: passoHorario, 3: passoDados }[etapa])();
  }

  // ── 1. Serviço ───────────────────────────────────────────────────────────
  // A escolha começa pelos destaques do manual: unhas, cabelos, tratamentos.
  // São dezenas de serviços — pedir a família primeiro encurta a lista para o
  // tamanho de uma tela de celular.
  function passoServico() {
    const familias = ['unhas', 'cabelos', 'tratamentos']
      .filter((f) => servicos.some((s) => familiaDe(s.categoria) === f));
    const rotulo = { unhas: 'Unhas', cabelos: 'Cabelos', tratamentos: 'Tratamentos' };

    const visiveis = familia ? servicos.filter((s) => familiaDe(s.categoria) === familia) : servicos;
    // Sem filtro, a lista sai na ordem da tabela impressa — que alterna cabelo
    // e tratamento, e termina em unha. Aqui as categorias saem agrupadas pela
    // mesma família dos destaques: unha com unha, cabelo com cabelo.
    const porCat = new Map();
    for (const fam of ['unhas', 'cabelos', 'tratamentos']) {
      for (const s of visiveis) {
        if (familiaDe(s.categoria) !== fam) continue;
        if (!porCat.has(s.categoria)) porCat.set(s.categoria, []);
        porCat.get(s.categoria).push(s);
      }
    }

    document.getElementById('ag-corpo').innerHTML = `
      ${familias.length > 1 ? `
        <nav class="destaques" id="ag-familias">
          ${familias.map((f) => destaque(f, rotulo[f], {
            attrs: `data-fam="${f}"`,
            nota: `${servicos.filter((s) => familiaDe(s.categoria) === f).length} serviços`,
          })).join('')}
        </nav>` : ''}
      <p class="t2 pequeno mb centro">${familia
        ? `${rotulo[familia]} — escolha o serviço`
        : 'O que você quer fazer?'}</p>
      ${[...porCat.entries()].map(([cat, itens]) => `
        <div class="ag-grupo">
          <div class="ag-grupo-titulo">
            ${icoDestaque(familiaDe(cat))}${esc(nomeCat(cat))}</div>
          ${itens.map((s) => `
            <button class="ag-opcao" data-serv="${esc(s.id)}">
              <span class="crescer">
                <strong>${esc(s.nome)}</strong>
                <!-- A descrição inteira, a mesma da tabela de preços. A cliente
                     escolhe o serviço aqui: esconder o que está incluso é
                     obrigá-la a voltar à tabela para decidir. -->
                ${s.nota ? `<span class="ag-nota">${esc(s.nota)}</span>` : ''}
                <span class="ag-dur">${marcaSozinha(s)
                  ? fmt.horas(s.tempo)
                  : 'combinado no WhatsApp'}</span>
              </span>
              <span class="ag-preco">${esc(precoTexto(s))}</span>
            </button>`).join('')}
        </div>`).join('')}`;

    raiz.querySelectorAll('[data-fam]').forEach((b) => {
      b.classList.toggle('ativo', b.dataset.fam === familia);
      b.onclick = () => {
        familia = familia === b.dataset.fam ? null : b.dataset.fam;
        passoServico();
        raiz.querySelector('#ag-familias')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    });

    raiz.querySelectorAll('[data-serv]').forEach((b) => b.onclick = () => {
      escolha.servico = servicos.find((s) => s.id === b.dataset.serv);
      escolha.dia = null; escolha.horario = null;
      etapa = 2; pintar();
    });
  }

  // ── 2b. Serviço que se combina no WhatsApp ───────────────────────────────
  // Cor exige ver o cabelo antes: o mesmo "mechas" leva quatro horas num
  // cabelo e sete noutro. Some da lista seria pior — a cliente procuraria o
  // preço e não acharia. Então o serviço fica à vista, com preço e descrição,
  // e no lugar dos horários abre este recado com o botão do WhatsApp.
  function passoRecado() {
    const s = escolha.servico;
    const dona = quemFaz(s);
    const zap = zapDe(s);
    const texto = (s.recado_agenda || '').trim() || RECADO_AGENDA;
    const avaliacao = avaliacaoDe(s);

    document.getElementById('ag-corpo').innerHTML = `
      <button class="ag-voltar" id="voltar">&larr; Trocar serviço</button>
      <div class="ag-escolhido">
        <strong>${esc(s.nome)}</strong>
        <span>${esc(precoTexto(s))}</span>
      </div>
      <div class="ag-combinar">
        ${icoDestaque(familiaDe(s.categoria), 'ico grande')}
        <p>${esc(texto)}</p>
        ${s.nota ? `<p class="pequeno t2">${esc(s.nota)}</p>` : ''}
        ${zap ? `
          <a class="btn btn-primario" id="ag-zap" target="_blank" rel="noopener"
             href="https://wa.me/55${zap}?text=${encodeURIComponent(
               'Oi! Queria fazer ' + s.nome + '. Podemos combinar?')}">
            Falar ${dona ? 'com ' + esc(primeiroNome(dona)) : ''} no WhatsApp</a>` : ''}
        ${avaliacao ? `
          <button class="btn btn-fantasma" data-serv-av="${esc(avaliacao.id)}">
            Marcar ${esc(avaliacao.nome.toLowerCase())}</button>` : ''}
      </div>`;

    raiz.querySelector('#voltar').onclick = () => { etapa = 1; pintar(); };
    raiz.querySelector('[data-serv-av]')?.addEventListener('click', (e) => {
      escolha.servico = servicos.find((x) => x.id === e.currentTarget.dataset.servAv);
      escolha.dia = null; escolha.horario = null;
      pintar();
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
      <div id="ag-horarios">
        <div class="ag-turno-titulo">Procurando horários…</div>
        <div class="ag-horas">
          ${Array.from({ length: 8 }, () => '<span class="ag-esqueleto"></span>').join('')}
        </div>
      </div>`;

    raiz.querySelector('#voltar').onclick = () => { etapa = 1; pintar(); };
    raiz.querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => {
      escolha.dia = b.dataset.dia; escolha.horario = null; passoHorario();
    });
    // Centraliza o dia escolhido movendo SÓ a tira. `scrollIntoView` aqui
    // arrastava a página inteira junto — a vitrine atrás da tela de
    // agendamento saía do lugar e o dedo acertava o campo errado.
    const tira = raiz.querySelector('#dias');
    const atual = tira?.querySelector('.ag-dia.atual');
    if (tira && atual) {
      tira.scrollLeft = atual.offsetLeft - (tira.clientWidth - atual.offsetWidth) / 2;
    }
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
        <p class="pequeno">Escolha outro dia acima${zapDe(escolha.servico)
          ? ` ou <a href="https://wa.me/55${zapDe(escolha.servico)}" target="_blank" rel="noopener">fale com a gente</a>` : ''}.</p>
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
            <button class="ag-hora" data-quando="${esc(h.quando)}" data-prof="${esc(h.prof_id)}"
                    data-prof-nome="${esc(h.prof_nome)}">
              ${retrato(quemE(h.prof_id) || { nome: h.prof_nome }, { tam: 26, cls: 'ag-hora-foto' })}
              <b>${hora(h.quando)}</b><span>${esc(h.prof_nome)}</span>
            </button>`).join('')}
        </div>
      </div>` : '';
    alvo.innerHTML = bloco('Manhã', manha) + bloco('Tarde', tarde);

    alvo.querySelectorAll('[data-quando]').forEach((b) => b.onclick = () => {
      escolha.horario = { quando: b.dataset.quando, prof_id: b.dataset.prof,
                          prof_nome: b.dataset.profNome };
      etapa = 3; pintar();
    });
  }

  // ── 3. Dados e confirmação ───────────────────────────────────────────────
  function passoDados() {
    const h = escolha.horario;
    document.getElementById('ag-corpo').innerHTML = `
      <button class="ag-voltar" id="voltar">&larr; Trocar horário</button>
      ${(() => { const p = quemE(h.prof_id); return p ? `
        <div class="ag-com">
          ${retrato(p, { tam: 58 })}
          <div class="crescer">
            <div class="pequeno t3" style="letter-spacing:.16em;text-transform:uppercase;font-size:10px">
              Quem vai te atender</div>
            <div style="font-family:var(--display);font-size:19px;font-weight:700">${esc(p.apelido || p.nome)}</div>
            ${p.bio ? `<div class="pequeno t2">${esc(p.bio)}</div>` : ''}
          </div>
        </div>` : ''; })()}
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
    // A função do banco devolve o primeiro nome de quem atende, não o id — e é
    // pelo id que se acha a frase dela.
    mostrarPronto({ ...data[0], prof_id: escolha.horario.prof_id }, nome);
  }

  function mostrarPronto(r, nome) {
    const zap = String(studio.whatsapp || '').replace(/\D/g, '');


    guardar({ codigo: r.codigo, quando: r.quando, servico: r.servico,
              prof: r.prof_nome, nome });

    // A marca ocupa o centro: é o momento em que a cliente fecha com o studio.
    document.querySelector('.ag-topo')?.setAttribute('hidden', '');
    raiz.innerHTML = `
      <div class="ag-pronto">
        <img class="ag-marca" src="assets/marca.webp" alt="Alento — Studio de Beleza">
        <div class="ag-selo">✓</div>
        <h2>Horário marcado!</h2>
        <p class="ag-recado">${esc(recadoDe(quemE(r.prof_id), studio))}</p>
        <p class="t2">${esc(nome.split(' ')[0])}, te esperamos <strong>${dataLonga(r.quando)}
          às ${hora(r.quando)}</strong>, com ${esc(r.prof_nome)}.</p>
        <div class="ag-resumo mt">
          <div class="linha"><span>Serviço</span><strong>${esc(r.servico)}</strong></div>
          ${studio.endereco ? `
            <div class="linha onde">
              <span>Onde</span>
              <strong>${esc(studio.endereco)}</strong>
              <a href="${esc(linkMapa(studio.endereco))}" target="_blank"
                 rel="noopener">Como chegar &rarr;</a>
            </div>` : ''}
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

  // Erro técnico é uma coisa; horário que já não está mais de pé é outra. Antes
  // as duas davam o mesmo recado, e no segundo caso o cartão ficava preso na
  // tela — a cliente apertava, dava erro, e não havia saída.
  if (error) {
    console.error('cancelar_agendamento:', error);
    return avisar(limparErro(error.message) || 'Não consegui desmarcar agora. Tente de novo.', 'erro');
  }
  if (data === false) {
    esquecer(codigo);
    depois?.();
    return avisar('Este horário já não estava mais marcado. Tirei do seu celular.', 'alerta');
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
