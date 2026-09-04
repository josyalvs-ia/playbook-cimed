// CLIENTES — ficha, histórico e o que a cliente costuma fazer.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, chave, hoje, avisar, abrirModal, confirmar, lerForm, vazio } from '../ui.js';
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
        <button class="btn btn-primario btn-sm" id="nova">${ico('mais')}Nova</button>
      </div>

      ${lista.length ? `<div class="tabela-wrap"><table><thead><tr>
          <th>Cliente</th><th>Telefone</th><th class="n">Visitas</th>
          <th class="n">Total gasto</th><th class="n">Ticket</th><th>Última</th><th></th>
        </tr></thead><tbody>
        ${lista.map(({ c, f }) => `<tr data-cli="${c.id}" style="cursor:pointer">
          <td><div class="flex" style="gap:9px">
            <span class="avatar verde">${esc(c.nome[0].toUpperCase())}</span>
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
  raiz.querySelector('#nova2')?.addEventListener('click', () => abrirCliente());
  raiz.querySelectorAll('[data-cli]').forEach((el) => el.onclick = () => abrirCliente(el.dataset.cli));
}

export function abrirCliente(id) {
  const c = id ? db.estado.clientes.find((x) => x.id === id) : { ativo: true };
  const f = id ? M.fichaCliente(c) : null;
  const hist = id ? M.historicoCliente(id) : [];

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
                 value="${esc(c.telefone ? fmt.telefone(c.telefone) : '')}"></label>
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
        <h3 class="mb">Histórico</h3>
        ${hist.length ? `<div class="tabela-wrap" style="max-height:280px;overflow-y:auto"><table><tbody>
          ${hist.map((h) => `<tr>
            <td class="pequeno t2 num" style="width:82px">${fmt.data(h.data)}</td>
            <td>${esc(M.itensDe(h.id).map((i) => i.nome).join(', ')) || '—'}</td>
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

  abrirModal({
    titulo: `Pacote de ${cliente.nome}`,
    corpo: `
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
