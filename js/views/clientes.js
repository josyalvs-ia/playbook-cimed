// CLIENTES — ficha, histórico e o que a cliente costuma fazer.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, chave, hoje, avisar, abrirModal, fecharModal, confirmar, lerForm,
         vazio, inicial, primeiroNome } from '../ui.js';
import { FORMAS_PAGAMENTO } from '../pricing.js';
import * as M from '../metricas.js';
import { abrirComanda } from './comandas.js';

let busca = '';
let ordem = 'nome';

export function render(raiz) {
  const termo = chave(busca);
  // Buscar por telefone tem de funcionar com ou sem máscara: a agenda grava só
  // os números, a ficha às vezes vinha com parênteses, e quem digita "11 99999"
  // não encontrava a própria cliente que acabou de cadastrar.
  const so = (t) => String(t || '').replace(/\D/g, '');
  const numeros = so(busca);
  let lista = db.estado.clientes
    .filter((c) => !termo
      || chave(c.nome).includes(termo)
      || (numeros && so(c.telefone).includes(numeros)))
    .map((c) => ({ c, f: M.fichaCliente(c) }));

  if (ordem === 'gasto') lista.sort((a, b) => b.f.total - a.f.total);
  else if (ordem === 'sumidas') lista.sort((a, b) => (b.f.diasSemVir ?? -1) - (a.f.diasSemVir ?? -1));
  else lista.sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));

  const ativas = db.estado.clientes.length;
  // Faturamento DAS CLIENTES CADASTRADAS. Somar toda comanda fechada aqui
  // dava um cartão que se contradizia: "0 clientes" ao lado de "R$ 90,00",
  // porque atendimento sem cadastro entrava na conta do mesmo jeito.
  const total = db.estado.comandas
    .filter((c) => c.status === 'fechada' && c.cliente_id)
    .reduce((s, c) => s + Number(c.total || 0), 0);

  raiz.innerHTML = `
    <div class="grade c3 mb">
      <div class="kpi"><div class="rotulo">Clientes cadastradas</div><div class="valor">${ativas}</div></div>
      <div class="kpi"><div class="rotulo">Faturamento acumulado</div><div class="valor">${fmt.brlCurto(total)}</div></div>
      <div class="kpi"><div class="rotulo">Precisam de contato</div>
        <div class="valor">${M.clientesParaResgatar().length}</div>
        <div class="nota">passaram do próprio ritmo de retorno</div></div>
    </div>

    <div class="cartao">
      <div class="cartao-cabeca">
        <div class="crescer" style="position:relative;max-width:320px">
          <input type="search" id="busca" placeholder="Buscar por nome ou telefone" value="${esc(busca)}">
        </div>
        <select id="ordem" style="width:auto">
          <option value="nome" ${ordem === 'nome' ? 'selected' : ''}>Ordem alfabética</option>
          <option value="gasto" ${ordem === 'gasto' ? 'selected' : ''}>Quem mais gasta</option>
          <option value="sumidas" ${ordem === 'sumidas' ? 'selected' : ''}>Quem sumiu</option>
        </select>
        ${(() => {
          const n = repetidas().length;
          return n ? `<button class="btn btn-sm" id="ver-repetidas">
            <span class="selo alerta">${n}</span> Repetidas</button>` : '';
        })()}
        <button class="btn btn-primario btn-sm" id="nova">${ico('mais')}Nova</button>
      </div>

      ${lista.length ? `<div class="tabela-wrap"><table><thead><tr>
          <th>Cliente</th><th>Telefone</th><th class="n">Visitas</th>
          <th class="n">Total gasto</th><th class="n">Ticket</th><th>Última</th><th></th>
        </tr></thead><tbody>
        ${lista.map(({ c, f }) => `<tr data-cli="${c.id}" style="cursor:pointer">
          <td><div class="flex" style="gap:9px">
            <span class="avatar verde">${esc(inicial(c.nome))}</span>
            <span><strong>${esc(c.nome)}</strong>
              ${c.alergias ? '<div class="pequeno erro-c">⚠ ' + esc(c.alergias) + '</div>' : ''}</span>
          </div></td>
          <td class="pequeno t2">${fmt.telefone(c.telefone)}</td>
          <td class="n num">${f.visitas}</td>
          <td class="n num">${fmt.brl(f.total)}</td>
          <td class="n num t2">${f.visitas ? fmt.brl(f.ticket) : '—'}</td>
          <td class="pequeno t2">${f.ultima ? fmt.dataCurta(f.ultima) : '—'}
            ${f.diasSemVir != null && f.intervaloMedio && f.diasSemVir > f.intervaloMedio * 1.4
              ? `<span class="selo alerta">${f.diasSemVir}d</span>` : ''}</td>
          <td style="width:30px">${ico('editar')}</td>
        </tr>`).join('')}
      </tbody></table></div>`
      : vazio(busca ? 'Nenhuma cliente encontrada.' : 'Nenhuma cliente cadastrada ainda.',
              '<button class="btn btn-primario" id="nova2">Cadastrar a primeira</button>')}
    </div>`;

  const b = raiz.querySelector('#busca');
  b.oninput = (e) => { busca = e.target.value; const p = e.target.selectionStart; render(raiz);
    const n = raiz.querySelector('#busca'); n.focus(); n.setSelectionRange(p, p); };
  raiz.querySelector('#ordem').onchange = (e) => { ordem = e.target.value; render(raiz); };
  raiz.querySelector('#nova').onclick = () => abrirCliente();
  raiz.querySelector('#ver-repetidas')?.addEventListener('click', abrirRepetidas);
  raiz.querySelector('#nova2')?.addEventListener('click', () => abrirCliente());
  raiz.querySelectorAll('[data-cli]').forEach((el) => el.onclick = () => abrirCliente(el.dataset.cli));
}

export function abrirCliente(id) {
  const c = id ? db.estado.clientes.find((x) => x.id === id) : { ativo: true };
  const f = id ? M.fichaCliente(c) : null;
  const hist = id ? M.historicoCliente(id) : [];
  const proximos = id ? M.proximosDaCliente(id, c.nome) : [];

  abrirModal({
    largo: !!id,
    titulo: id ? c.nome : 'Nova cliente',
    corpo: `
      ${f ? `<div class="grade c4 mb">
        <div class="kpi"><div class="rotulo">Visitas</div><div class="valor">${f.visitas}</div></div>
        <div class="kpi"><div class="rotulo">Total gasto</div><div class="valor">${fmt.brlCurto(f.total)}</div></div>
        <div class="kpi"><div class="rotulo">Ticket médio</div><div class="valor">${fmt.brlCurto(f.ticket)}</div></div>
        <div class="kpi"><div class="rotulo">Volta a cada</div>
          <div class="valor">${f.intervaloMedio ? f.intervaloMedio + 'd' : '—'}</div>
          <div class="nota">${f.diasSemVir != null ? f.diasSemVir + ' dias desde a última' : ''}</div></div>
      </div>` : ''}

      <div class="linha-campos">
        <label class="campo"><span>Nome</span><input name="nome" required value="${esc(c.nome || '')}"></label>
        <label class="campo"><span>WhatsApp</span>
          <input name="telefone" type="tel" placeholder="(11) 99999-9999"
                 value="${esc(c.telefone ? fmt.telefone(c.telefone) : '')}">
          <!-- O número repetido é dito na hora em que é digitado, que é a
               única hora em que ainda dá para não criar a segunda ficha. -->
          <span class="dica t3" id="tel-repetido"></span></label>
        <label class="campo"><span>Aniversário</span>
          <input name="nascimento" type="date" value="${c.nascimento || ''}">
          <span class="dica t3">Opcional. Com a data, ela aparece no painel no dia.</span></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Como conheceu</span>
          <input name="indicacao" value="${esc(c.indicacao || '')}" placeholder="Instagram, indicação de…"></label>
        <label class="campo"><span>Alergias / cuidados</span>
          <input name="alergias" value="${esc(c.alergias || '')}" placeholder="Ex.: alergia a acetona"></label>
      </div>
      <label class="campo"><span>Observações técnicas</span>
        <textarea name="observacoes" placeholder="Formato preferido, cor que usa sempre, unha frágil…">${esc(c.observacoes || '')}</textarea></label>

      ${id ? `
        <div class="regua mb">${estrela()}</div>
        <div class="flex-entre mb">
          <h3>Pacotes</h3>
          <button class="btn btn-sm" id="novo-pacote">${ico('mais')}Novo pacote</button>
        </div>
        ${listaPacotes(id)}

        <div class="regua mb">${estrela()}</div>
        <div class="flex-entre mb">
          <h3>Ficha</h3>
          <button class="btn btn-sm" id="nova-ficha">${ico('mais')}Nova anotação</button>
        </div>
        ${listaFichas(id)}

        <div class="regua mb">${estrela()}</div>
        <h3 class="mb">Agenda dela</h3>
        ${proximos.length ? `<div class="tabela-wrap" style="max-height:200px;overflow-y:auto"><table><tbody>
          ${proximos.map((a) => `<tr>
            <td class="pequeno t2 num" style="width:118px">${fmt.dataHora(a.inicio)}</td>
            <td>${esc(a.servico_nome)}
              <span class="t3 pequeno">com ${esc(primeiroNome(nomeProf(a.profissional_id)))}</span></td>
            <td class="n num t2">${fmt.brl(a.valor)}</td>
          </tr>`).join('')}
        </tbody></table></div>`
        : '<p class="t3 pequeno">Nenhum horário marcado daqui para a frente.</p>'}

        <div class="regua mb">${estrela()}</div>
        <h3 class="mb">Já foi feito</h3>
        ${hist.length ? `<div class="tabela-wrap" style="max-height:280px;overflow-y:auto"><table><tbody>
          ${hist.map((h) => `<tr>
            <td class="pequeno t2 num" style="width:82px">${fmt.data(h.data)}</td>
            <td>${esc(M.itensDe(h.id).map((i) => i.nome).join(', ')) || '—'}
              ${fichaDe(h.id) ? `<button class="btn-link" data-ficha="${esc(h.id)}">ver a ficha</button>`
                : `<button class="btn-link" data-ficha="${esc(h.id)}">anotar na ficha</button>`}</td>
            <td class="n num"><strong>${fmt.brl(h.total)}</strong></td>
          </tr>`).join('')}
        </tbody></table></div>` : '<p class="t3 pequeno">Sem atendimentos registrados.</p>'}` : ''}`,

    acoes: [
      ...(id ? [
        { texto: ico('lixo'), classe: 'btn-perigo', onClick: async (fechar) => {
            if (await confirmar('Excluir cliente?', 'O histórico de atendimentos é mantido, mas deixa de ficar ligado a ela.')) {
              await db.remover('clientes', id); fechar(); avisar('Cliente excluída');
            }
          } },
        { texto: 'Novo atendimento', classe: 'btn-fantasma', onClick: (fechar) => {
            // Aberto de dentro da ficha, o atendimento já é dela: obrigar a
            // redigitar o nome é como se o sistema não soubesse de quem falava.
            fechar();
            setTimeout(() => abrirComanda(null, { cliente_nome: c.nome, cliente_id: c.id }), 60);
          } },
      ] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          if (!d.nome) return avisar('O nome é obrigatório', 'erro');
          // Telefone guardado só em números, como a agenda faz: é o formato do
          // link do WhatsApp, e é o que deixa a busca achar a cliente.
          await db.salvar('clientes', { ...c, ...d,
            telefone: (d.telefone || '').replace(/\D/g, '') || null, ativo: true });
          fechar(); avisar('Cliente salva');
        } },
    ],

    aoAbrir: (veu) => {
      veu.querySelector('#novo-pacote')?.addEventListener('click', () => {
        // O modal do pacote entra por cima; ao fechar, a ficha volta com o
        // pacote novo na lista — senão ela salva e acha que não gravou.
        abrirPacote(c, () => abrirCliente(id));
      });
      const campoTel = veu.querySelector('[name=telefone]');
      const aviso = veu.querySelector('#tel-repetido');
      const conferirTel = () => {
        const iguais = mesmoTelefone(campoTel.value, id);
        aviso.innerHTML = iguais.length
          ? `<span class="erro-c">⚠ Este número já é de ${iguais.map((x) => esc(x.nome)).join(', ')}.</span>`
            + ' Se for a mesma pessoa, salve e depois junte em Clientes → Repetidas.'
          : '';
      };
      campoTel.oninput = conferirTel;
      conferirTel();

      veu.querySelector('#nova-ficha')?.addEventListener('click', () => {
        abrirFicha(c, null, () => abrirCliente(id));
      });
      veu.querySelectorAll('[data-ficha]').forEach((b) => b.onclick = () => {
        abrirFicha(c, b.dataset.ficha, () => abrirCliente(id));
      });
      veu.querySelectorAll('[data-abrir-ficha]').forEach((b) => b.onclick = () => {
        abrirFicha(c, { fichaId: b.dataset.abrirFicha }, () => abrirCliente(id));
      });
      veu.querySelectorAll('[data-encerrar-pacote]').forEach((b) => b.onclick = async () => {
        const pac = db.estado.pacotes.find((x) => x.id === b.dataset.encerrarPacote);
        if (!pac) return;
        if (await confirmar('Encerrar o pacote?',
              'Ele para de aparecer nos atendimentos. O que já foi usado continua no histórico.',
              'Encerrar', false)) {
          await db.salvar('pacotes', { ...pac, ativo: false });
          avisar('Pacote encerrado');
          abrirCliente(id);
        }
      });
    },
  });
}

/**
 * Os pacotes da cliente, com o que já foi e o que falta.
 *
 * A pergunta que a Laura faz na cadeira é "quantas ainda faltam?" — então é
 * isso que fica grande, e não o que ela pagou.
 */
function listaPacotes(clienteId) {
  const pacotes = M.pacotesDe(clienteId);
  if (!pacotes.length) {
    return `<div class="aviso">${ico('info')}<div>Nenhum pacote.
      Quando a cliente fechar um, cadastre aqui: o atendimento passa a ser
      descontado dele sozinho, sem precisar zerar o valor na mão.</div></div>`;
  }
  return `<div class="tabela-wrap mb"><table><tbody>
    ${pacotes.map((p) => `<tr>
      <td><strong>${esc(p.servico_nome)}</strong>
        <div class="pequeno t3">${p.validade ? `vale até ${fmt.data(p.validade)}` : 'sem prazo'}
          ${p.valor ? ` · ${fmt.brl(p.valor)}` : ''}${p.observacoes ? ` · ${esc(p.observacoes)}` : ''}</div></td>
      <td class="n" style="width:120px">
        <strong class="display num" style="font-size:19px">${p.restam}</strong>
        <span class="t3 pequeno"> de ${p.total}</span>
        <div class="pequeno ${p.valido ? 't3' : 'erro-c'}">
          ${p.valido ? `${p.usadas} usada${p.usadas === 1 ? '' : 's'}`
            : (p.vencido ? 'vencido' : (p.restam ? 'encerrado' : 'terminou'))}</div></td>
      <td style="width:40px">${p.valido
        ? `<button class="btn-icone" data-encerrar-pacote="${p.id}" title="Encerrar pacote">${ico('fechar')}</button>`
        : ''}</td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

/**
 * Cadastrar um pacote que a cliente fechou.
 *
 * O pagamento entra no caixa junto, porque foi hoje que o dinheiro entrou —
 * mas dá para desmarcar: pacote fechado semana passada já foi lançado, e
 * lançar de novo inventaria uma receita que não existiu.
 */
export function abrirPacote(cliente, aoFechar) {
  const servicos = db.estado.servicos
    .filter((s) => s.ativo !== false && s.tipo !== 'adicional');

  const catalogo = db.pacotesCatalogo();

  abrirModal({
    titulo: `Pacote de ${cliente.nome}`,
    corpo: `
      ${catalogo.length ? `<label class="campo"><span>Qual pacote ela fechou?</span>
        <select name="modelo" id="modelo-pacote">
          ${catalogo.map((k) => `<option value="${esc(k.id)}">${esc(k.nome)} — ${fmt.brl(k.valor)}</option>`).join('')}
          <option value="">Outro, combinado à parte…</option>
        </select>
        <span class="dica t3">Escolhendo um da lista, o resto vem preenchido.
          A lista é editada em Tabela de preços &rarr; Pacotes.</span></label>` : ''}

      <label class="campo"><span>Serviço do pacote</span>
        <select name="servico_id">
          ${servicos.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}
        </select></label>
      <div class="linha-campos">
        <label class="campo"><span>Quantas sessões</span>
          <input type="number" name="sessoes" min="1" max="60" step="1" value="10" inputmode="numeric"></label>
        <label class="campo"><span>Valor total pago</span>
          <input type="number" name="valor" min="0" step="0.01" value="0"></label>
        <label class="campo"><span>Vale até</span>
          <input type="date" name="validade">
          <span class="dica t3">Opcional.</span></label>
      </div>
      <label class="campo"><span>Observações</span>
        <input name="observacoes" placeholder="Ex.: combinado com desconto de 10%"></label>

      <label class="check mt"><input type="checkbox" name="no_caixa" checked>
        <span>Lançar o pagamento no caixa de hoje</span></label>
      <div id="pacote-pgto">
        <div class="campo"><span>Forma de pagamento</span>
          <div class="pilulas" id="pacote-formas">
            ${FORMAS_PAGAMENTO.map((f, i) =>
              `<button type="button" class="pilula ${i === 0 ? 'ativa' : ''}" data-pg="${f.id}">${esc(f.nome)}</button>`).join('')}
          </div>
        </div>
      </div>
      <p class="dica t3">Cada atendimento deste serviço passa a sair do pacote,
        com valor zero na comanda — o dinheiro já entrou aqui.</p>`,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-fantasma', onClick: (f) => { f(); aoFechar?.(); } },
      { texto: 'Salvar pacote', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          const s = servicos.find((x) => x.id === d.servico_id);
          if (!s) return avisar('Escolha o serviço', 'erro');
          const sessoes = Math.round(Number(d.sessoes) || 0);
          if (sessoes < 1) return avisar('Quantas sessões o pacote tem?', 'erro');

          const valor = Number(d.valor) || 0;
          await db.salvar('pacotes', {
            cliente_id: cliente.id, cliente_nome: cliente.nome,
            servico_id: s.id, servico_nome: s.nome,
            sessoes, valor, validade: d.validade || null,
            observacoes: d.observacoes || null, ativo: true,
          });

          if (d.no_caixa && valor > 0) {
            await db.salvar('caixa', {
              data: hoje(), tipo: 'entrada', categoria: 'Pacote',
              descricao: `Pacote · ${sessoes}× ${s.nome} · ${cliente.nome}`,
              valor,
              forma_pagamento: veu.querySelector('#pacote-formas .ativa')?.dataset.pg || null,
              profissional_id: db.eu?.id || null,
            });
          }
          fechar();
          avisar(`Pacote de ${sessoes} sessões cadastrado`);
          aoFechar?.();
        } },
    ],
    aoAbrir: (veu) => {
      // Escolher o pacote da lista preenche serviço, sessões e valor: ela não
      // precisa lembrar de cor que o cronograma médio são 4 sessões por 540.
      const modelo = veu.querySelector('#modelo-pacote');
      if (modelo) {
        const aplicar = () => {
          const k = catalogo.find((x) => x.id === modelo.value);
          if (!k) return;
          const sel = veu.querySelector('[name=servico_id]');
          if ([...sel.options].some((o) => o.value === k.servico_id)) sel.value = k.servico_id;
          veu.querySelector('[name=sessoes]').value = k.sessoes;
          veu.querySelector('[name=valor]').value = k.valor;
        };
        modelo.onchange = aplicar;
        aplicar();
      }

      const check = veu.querySelector('[name=no_caixa]');
      const bloco = veu.querySelector('#pacote-pgto');
      const ver = () => { bloco.hidden = !check.checked; };
      check.onchange = ver; ver();
      veu.querySelectorAll('#pacote-formas [data-pg]').forEach((b) => b.onclick = () => {
        veu.querySelectorAll('#pacote-formas [data-pg]').forEach((x) => x.classList.remove('ativa'));
        b.classList.add('ativa');
      });
    },
  });
}

/** A ficha daquele atendimento, se já foi anotada. */
function fichaDe(comandaId) {
  return db.estado.fichas_cliente.find((f) => f.comanda_id === comandaId) || null;
}

const nomeProf = (id) => db.estado.profissionais.find((p) => p.id === id)?.nome || '';

/**
 * A ficha da cliente — o prontuário, não a receita de insumos.
 *
 * "Que nem eu faço terapia capilar, daí eu poder colocar anamnese dentro do
 * sistema, colocar foto da tricoscopia, o dia que fez a tricoscopia; tanto de
 * eu colocar coloração, a Júlia colocar o esmalte que a cliente usou" — Laura.
 *
 * Uma anotação por atendimento, e não uma por cliente. A fórmula de março não
 * é a de setembro, e a graça da tricoscopia é comparar a foto de hoje com a de
 * três meses atrás: sobrescrever apagaria justamente a evolução, que é o que o
 * tratamento inteiro quer mostrar.
 *
 * Os campos aparecem todos para as duas. Separar "o que é de cabelo" de "o que
 * é de unha" obriga a escolher antes de escrever, e quem está com a cliente na
 * cadeira quer escrever, não escolher. O que não serve fica em branco.
 */
export function abrirFicha(cliente, alvo, aoFechar) {
  // `alvo` é o atendimento a que a anotação se refere, a anotação já existente,
  // ou nada — anotação solta, do dia, sem atendimento fechado por trás.
  const comandaId = typeof alvo === 'string' ? alvo : alvo?.comandaId || null;
  const existente = alvo?.fichaId
    ? db.estado.fichas_cliente.find((x) => x.id === alvo.fichaId) || null
    : (comandaId ? fichaDe(comandaId) : null);
  const f = existente || {
    cliente_id: cliente.id, cliente_nome: cliente.nome,
    comanda_id: comandaId || null,
    profissional_id: db.eu?.id || null,
    data: hoje(), fotos: [],
  };
  let fotos = Array.isArray(f.fotos) ? f.fotos.map((x) => ({ ...x })) : [];
  const novas = [];      // arquivos escolhidos agora, ainda não subidos
  const apagar = [];     // caminhos a remover do balde ao salvar

  const atendimento = comandaId
    ? db.estado.comandas.find((x) => x.id === comandaId) : null;

  abrirModal({
    largo: true,
    titulo: `Ficha de ${cliente.nome}`,
    corpo: `
      ${atendimento ? `<div class="aviso mb">${ico('info')}<div>
        Atendimento de <strong>${fmt.data(atendimento.data)}</strong> —
        ${esc(M.itensDe(atendimento.id).map((i) => i.nome).join(', ') || 'sem serviços')}.</div></div>` : ''}

      <div class="linha-campos">
        <label class="campo"><span>Dia da anotação</span>
          <input type="date" name="data" value="${f.data || hoje()}"></label>
        <label class="campo"><span>Quem anotou</span>
          <select name="profissional_id">
            <option value="">—</option>
            ${db.estado.profissionais.filter((p) => p.ativo !== false).map((p) =>
              `<option value="${p.id}" ${f.profissional_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select></label>
      </div>

      <label class="campo"><span>Anamnese</span>
        <textarea name="anamnese" rows="3"
          placeholder="O que ela relata, o que você observou, medicação, química anterior…">${esc(f.anamnese || '')}</textarea></label>

      <div class="linha-campos">
        <label class="campo"><span>Tricoscopia — o que se viu</span>
          <textarea name="tricoscopia" rows="2"
            placeholder="Ex.: afinamento difuso no topo, couro com descamação leve">${esc(f.tricoscopia || '')}</textarea></label>
        <label class="campo"><span>Dia da tricoscopia</span>
          <input type="date" name="tricoscopia_em" value="${f.tricoscopia_em || ''}">
          <span class="dica t3">Para comparar com a próxima.</span></label>
      </div>

      <div class="linha-campos">
        <label class="campo"><span>Fórmula de coloração</span>
          <input name="formula" value="${esc(f.formula || '')}"
            placeholder="Ex.: 8.1 + 7.11 (1:1) + ox 20vol · 35 min"></label>
        <label class="campo"><span>Esmalte usado</span>
          <input name="esmalte" value="${esc(f.esmalte || '')}"
            placeholder="Ex.: Risqué Vermelho Clássico · gel"></label>
      </div>

      <label class="campo"><span>Observações</span>
        <textarea name="observacoes" rows="2"
          placeholder="O que lembrar na próxima vez">${esc(f.observacoes || '')}</textarea></label>

      <div class="regua mb">${estrela()}</div>
      <div class="flex-entre mb">
        <h3>Fotos</h3>
        <label class="btn btn-sm" style="cursor:pointer">${ico('mais')}Adicionar foto
          <input type="file" id="foto-nova" accept="image/*" multiple hidden></label>
      </div>
      <p class="dica t3 mb">Ficam guardadas em lugar privado — só quem entra no
        sistema vê. A foto é encolhida antes de subir, para não demorar no 4G.</p>
      <div id="galeria"></div>`,

    acoes: [
      ...(existente ? [{ texto: ico('lixo'), classe: 'btn-perigo', onClick: async (fechar) => {
          if (await confirmar('Excluir esta anotação?',
                'As fotos dela também são apagadas. Não dá para desfazer.')) {
            for (const x of fotos) await db.apagarFoto(x.caminho);
            await db.remover('fichas_cliente', existente.id);
            fechar(); avisar('Anotação excluída'); aoFechar?.();
          }
        } }] : []),
      { texto: 'Cancelar', classe: 'btn-fantasma', onClick: (f2) => { f2(); aoFechar?.(); } },
      { texto: 'Salvar ficha', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const botao = veu.querySelector('.modal-pe .btn-primario');
          const d = lerForm(veu);
          try {
            // As fotos sobem ANTES de gravar a ficha: uma ficha que aponta
            // para foto que não subiu é pior que ficha sem foto — ela abre
            // com um quadrado quebrado e ninguém sabe o que era.
            if (novas.length) {
              if (botao) { botao.disabled = true; botao.textContent = 'Subindo as fotos…'; }
              for (const item of novas) {
                const caminho = await db.subirFoto(cliente.id, item.arquivo);
                fotos.push({ caminho, legenda: item.legenda || '', em: d.tricoscopia_em || d.data || hoje() });
              }
              novas.length = 0;
            }
            for (const caminho of apagar) await db.apagarFoto(caminho);

            await db.salvar('fichas_cliente', { ...f, ...d, fotos,
              cliente_id: cliente.id, comanda_id: f.comanda_id || null });
            fechar();
            avisar('Ficha salva');
            aoFechar?.();
          } catch (e) {
            if (botao) { botao.disabled = false; botao.textContent = 'Salvar ficha'; }
            avisar(e.message || 'Não consegui salvar a ficha', 'erro');
          }
        } },
    ],

    aoAbrir: async (veu) => {
      const galeria = veu.querySelector('#galeria');

      const pintar = async () => {
        const links = await db.verFotos(fotos.map((x) => x.caminho));
        const cartoes = [
          ...fotos.map((x, i) => `<figure class="foto-ficha">
            ${links[x.caminho]
              ? `<a href="${esc(links[x.caminho])}" target="_blank" rel="noopener">
                   <img src="${esc(links[x.caminho])}" alt="${esc(x.legenda || 'foto da ficha')}" loading="lazy"></a>`
              : `<div class="foto-vazia">${ico('info')}<span>não consegui abrir</span></div>`}
            <figcaption>
              <input value="${esc(x.legenda || '')}" data-legenda="${i}" placeholder="legenda">
              <button type="button" class="btn-icone" data-tirar="${i}" title="Tirar">${ico('fechar')}</button>
            </figcaption>
          </figure>`),
          ...novas.map((n, i) => `<figure class="foto-ficha">
            <img src="${esc(n.previa)}" alt="foto nova">
            <figcaption>
              <input value="${esc(n.legenda || '')}" data-legenda-nova="${i}" placeholder="legenda">
              <button type="button" class="btn-icone" data-tirar-nova="${i}" title="Tirar">${ico('fechar')}</button>
            </figcaption>
            <span class="selo alerta">sobe ao salvar</span>
          </figure>`),
        ];
        galeria.innerHTML = cartoes.length
          ? `<div class="galeria-fichas">${cartoes.join('')}</div>`
          : '<p class="t3 pequeno">Nenhuma foto ainda.</p>';

        galeria.querySelectorAll('[data-legenda]').forEach((inp) => {
          inp.onchange = () => { fotos[+inp.dataset.legenda].legenda = inp.value; };
        });
        galeria.querySelectorAll('[data-legenda-nova]').forEach((inp) => {
          inp.onchange = () => { novas[+inp.dataset.legendaNova].legenda = inp.value; };
        });
        galeria.querySelectorAll('[data-tirar]').forEach((b) => {
          b.onclick = () => {
            // Só sai do balde quando ela salvar: desistir no meio não pode
            // apagar a foto de verdade.
            apagar.push(fotos[+b.dataset.tirar].caminho);
            fotos.splice(+b.dataset.tirar, 1);
            pintar();
          };
        });
        galeria.querySelectorAll('[data-tirar-nova]').forEach((b) => {
          b.onclick = () => {
            URL.revokeObjectURL(novas[+b.dataset.tirarNova].previa);
            novas.splice(+b.dataset.tirarNova, 1);
            pintar();
          };
        });
      };

      veu.querySelector('#foto-nova').onchange = (e) => {
        for (const arquivo of e.target.files) {
          if (!/^image\//.test(arquivo.type)) { avisar('Isso não é uma foto', 'erro'); continue; }
          novas.push({ arquivo, legenda: '', previa: URL.createObjectURL(arquivo) });
        }
        e.target.value = '';
        pintar();
      };

      pintar();
    },
  });
}

/**
 * As anotações da ficha, da mais nova para a mais antiga.
 *
 * O que aparece na lista é o que responde à pergunta de quem está com a
 * cliente na cadeira: a fórmula que usou da última vez, e se tem tricoscopia
 * para comparar. O resto se lê abrindo.
 */
function listaFichas(clienteId) {
  const lista = db.estado.fichas_cliente
    .filter((f) => f.cliente_id === clienteId)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  if (!lista.length) {
    return `<div class="aviso">${ico('info')}<div>Nenhuma anotação ainda.
      É aqui que ficam a anamnese, a tricoscopia com foto, a fórmula de
      coloração e o esmalte usado.</div></div>`;
  }
  return `<div class="tabela-wrap" style="max-height:230px;overflow-y:auto"><table><tbody>
    ${lista.map((f) => {
      const fotos = Array.isArray(f.fotos) ? f.fotos.length : 0;
      const resumo = [
        f.formula ? `fórmula: ${f.formula}` : '',
        f.esmalte ? `esmalte: ${f.esmalte}` : '',
        f.tricoscopia_em ? `tricoscopia de ${fmt.dataCurta(f.tricoscopia_em)}` : '',
      ].filter(Boolean).join(' · ');
      return `<tr>
        <td class="pequeno t2 num" style="width:82px">${fmt.data(f.data)}</td>
        <td><button class="btn-link" data-abrir-ficha="${esc(f.id)}">
              ${esc(resumo || f.anamnese?.slice(0, 60) || 'anotação')}</button>
          ${fotos ? `<span class="selo">${fotos} foto${fotos > 1 ? 's' : ''}</span>` : ''}
          ${f.profissional_id ? `<div class="pequeno t3">${esc(nomeProf(f.profissional_id))}</div>` : ''}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CADASTROS REPETIDOS
// ═══════════════════════════════════════════════════════════════════════════
// "A gente tá com alguns cadastros duplicados — se não tem como o sistema,
// quando insere o mesmo número de telefone, unificar os cadastros" — Laura.
//
// Juntar sozinho, sem perguntar, seria o caminho curto e o errado: mãe e filha
// dividem telefone, e duas pessoas de verdade viram uma só sem ninguém notar.
// O histórico de uma passa a contar como da outra, e não há como desfazer.
//
// Então o sistema faz as duas metades que pode fazer sem errar: avisa na hora
// em que o número repetido é digitado — que é quando ainda dá para não criar a
// segunda ficha — e, para as que já existem, mostra os pares e junta com um
// toque, com quem usa decidindo qual fica.

/** Só os dígitos, e só os últimos 8: DDD e nono dígito variam na digitação. */
const fimDoTelefone = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-8) : '';
};

/** Quem mais tem este telefone, fora ela mesma. */
export function mesmoTelefone(telefone, exceto) {
  const f = fimDoTelefone(telefone);
  if (!f) return [];
  return db.estado.clientes.filter((c) => c.id !== exceto && fimDoTelefone(c.telefone) === f);
}

/** Os grupos de fichas que parecem ser a mesma pessoa. */
export function repetidas() {
  const porTelefone = new Map();
  for (const c of db.estado.clientes) {
    const f = fimDoTelefone(c.telefone);
    if (!f) continue;
    if (!porTelefone.has(f)) porTelefone.set(f, []);
    porTelefone.get(f).push(c);
  }
  // Nome igual sem telefone nenhum também é repetição — e é a que mais
  // acontece, porque a ficha nasce do nome digitado na agenda.
  const porNome = new Map();
  for (const c of db.estado.clientes) {
    if (fimDoTelefone(c.telefone)) continue;
    const k = chave(c.nome || '');
    if (!k) continue;
    if (!porNome.has(k)) porNome.set(k, []);
    porNome.get(k).push(c);
  }
  return [...[...porTelefone.values()].map((fichas) => ({ motivo: 'telefone', fichas })),
          ...[...porNome.values()].map((fichas) => ({ motivo: 'nome', fichas }))]
    .filter((g) => g.fichas.length > 1)
    .map((g) => ({ ...g, fichas: g.fichas.sort((a, b) => peso(b) - peso(a)) }));
}

/** Qual das fichas é a "de verdade": a que tem mais coisa ligada a ela. */
function peso(c) {
  return M.historicoCliente(c.id).length * 10
       + db.estado.agendamentos.filter((a) => a.cliente_id === c.id).length * 5
       + M.pacotesDe(c.id).length * 20
       + db.estado.fichas_cliente.filter((f) => f.cliente_id === c.id).length * 8
       + (c.telefone ? 2 : 0) + (c.nascimento ? 1 : 0);
}

/** O que está pendurado numa ficha — é o que se perde se ela for apagada. */
function pendurado(id) {
  return {
    comandas: db.estado.comandas.filter((x) => x.cliente_id === id),
    agendamentos: db.estado.agendamentos.filter((x) => x.cliente_id === id),
    pacotes: db.estado.pacotes.filter((x) => x.cliente_id === id),
    fichas: db.estado.fichas_cliente.filter((x) => x.cliente_id === id),
  };
}

/**
 * Junta duas fichas numa só.
 *
 * Tudo que apontava para a que sai passa a apontar para a que fica, e só
 * então a que sai é apagada. Nessa ordem: apagar primeiro deixaria atendimento
 * e pacote órfãos, e pacote órfão é sessão paga que some.
 *
 * Os dados da ficha que fica só são completados onde ela está em branco —
 * telefone, aniversário, alergias. Sobrescrever o que já estava preenchido
 * seria trocar a informação boa pela duvidosa.
 */
export async function juntarClientes(saiId, ficaId) {
  const sai = db.estado.clientes.find((c) => c.id === saiId);
  const fica = db.estado.clientes.find((c) => c.id === ficaId);
  if (!sai || !fica || saiId === ficaId) throw new Error('Fichas inválidas para juntar.');

  const p = pendurado(saiId);
  for (const x of p.comandas)      await db.salvar('comandas',       { ...x, cliente_id: ficaId, cliente_nome: fica.nome });
  for (const x of p.agendamentos)  await db.salvar('agendamentos',   { ...x, cliente_id: ficaId, cliente_nome: fica.nome });
  for (const x of p.pacotes)       await db.salvar('pacotes',        { ...x, cliente_id: ficaId, cliente_nome: fica.nome });
  for (const x of p.fichas)        await db.salvar('fichas_cliente', { ...x, cliente_id: ficaId });

  const completado = { ...fica };
  for (const campo of ['telefone', 'nascimento', 'indicacao', 'alergias']) {
    if (!completado[campo] && sai[campo]) completado[campo] = sai[campo];
  }
  // Observação é texto escrito à mão: as duas valem, então ficam as duas.
  if (sai.observacoes && sai.observacoes !== completado.observacoes) {
    completado.observacoes = [completado.observacoes, sai.observacoes].filter(Boolean).join(' · ');
  }
  await db.salvar('clientes', completado);
  await db.remover('clientes', saiId);

  return { comandas: p.comandas.length, agendamentos: p.agendamentos.length,
           pacotes: p.pacotes.length, fichas: p.fichas.length };
}

/** A tela que mostra os pares e junta. */
export function abrirRepetidas() {
  const grupos = repetidas();

  abrirModal({
    largo: true,
    titulo: 'Cadastros repetidos',
    corpo: grupos.length
      ? `<p class="t2 mb">${grupos.length} ${grupos.length === 1 ? 'cliente parece estar' : 'clientes parecem estar'}
           cadastrada mais de uma vez. Confira antes de juntar: mãe e filha às
           vezes dividem o mesmo telefone, e aí são duas pessoas mesmo.</p>
         ${grupos.map((g, gi) => `
           <div class="cartao mb" style="padding:14px">
             <div class="pequeno t3 mb">Mesmo ${g.motivo}</div>
             <table><tbody>
               ${g.fichas.map((c, i) => {
                 const p = pendurado(c.id);
                 const tem = [
                   p.comandas.length ? `${p.comandas.length} atendimento${p.comandas.length > 1 ? 's' : ''}` : '',
                   p.agendamentos.length ? `${p.agendamentos.length} horário${p.agendamentos.length > 1 ? 's' : ''}` : '',
                   p.pacotes.length ? `${p.pacotes.length} pacote${p.pacotes.length > 1 ? 's' : ''}` : '',
                   p.fichas.length ? `${p.fichas.length} anotação${p.fichas.length > 1 ? 'ões' : ''}` : '',
                 ].filter(Boolean).join(' · ');
                 return `<tr>
                   <td><strong>${esc(c.nome)}</strong>
                     ${i === 0 ? '<span class="selo ok">fica esta</span>' : ''}
                     <div class="pequeno t3">${esc(fmt.telefone(c.telefone))}${tem ? ' · ' + tem : ' · ficha vazia'}</div></td>
                   <td class="n">${i === 0 ? '' :
                     `<button class="btn btn-sm" data-juntar="${esc(c.id)}" data-em="${esc(g.fichas[0].id)}">
                        Juntar nesta de cima</button>`}</td>
                 </tr>`;
               }).join('')}
             </tbody></table>
           </div>`).join('')}`
      : `<div class="aviso ok">${ico('check')}<div>Nenhum cadastro repetido.
           O sistema avisa assim que um telefone já cadastrado for digitado de novo.</div></div>`,
    acoes: [{ texto: 'Fechar', classe: 'btn-fantasma', onClick: (f) => f() }],
    aoAbrir: (veu) => {
      veu.querySelectorAll('[data-juntar]').forEach((b) => b.onclick = async () => {
        const sai = db.estado.clientes.find((c) => c.id === b.dataset.juntar);
        const fica = db.estado.clientes.find((c) => c.id === b.dataset.em);
        if (!sai || !fica) return;
        const p = pendurado(sai.id);
        if (!await confirmar(`Juntar "${sai.nome}" em "${fica.nome}"?`,
              `Tudo que está em "${sai.nome}" passa para "${fica.nome}": `
              + `${p.comandas.length} atendimento(s), ${p.agendamentos.length} horário(s), `
              + `${p.pacotes.length} pacote(s) e ${p.fichas.length} anotação(ões) de ficha.\n\n`
              + 'A ficha repetida é apagada. Não dá para desfazer.',
              'Juntar', false)) return;
        b.disabled = true; b.textContent = 'Juntando…';
        try {
          const r = await juntarClientes(sai.id, fica.id);
          avisar(`Juntado — ${r.comandas} atendimento(s), ${r.pacotes} pacote(s) e `
               + `${r.fichas} anotação(ões) passaram para ${fica.nome}`);
          fecharModal();
          setTimeout(abrirRepetidas, 80);
        } catch (e) {
          b.disabled = false; b.textContent = 'Juntar nesta de cima';
          avisar(e.message || 'Não consegui juntar', 'erro');
        }
      });
    },
  });
}
