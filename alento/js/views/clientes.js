// CLIENTES — ficha, histórico e o que a cliente costuma fazer.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, chave, avisar, abrirModal, confirmar, lerForm, vazio } from '../ui.js';
import * as M from '../metricas.js';
import { abrirComanda } from './comandas.js';

let busca = '';
let ordem = 'nome';

export function render(raiz) {
  const termo = chave(busca);
  let lista = db.estado.clientes
    .filter((c) => !termo || chave(c.nome).includes(termo) || String(c.telefone || '').includes(busca))
    .map((c) => ({ c, f: M.fichaCliente(c) }));

  if (ordem === 'gasto') lista.sort((a, b) => b.f.total - a.f.total);
  else if (ordem === 'sumidas') lista.sort((a, b) => (b.f.diasSemVir ?? -1) - (a.f.diasSemVir ?? -1));
  else lista.sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));

  const ativas = db.estado.clientes.length;
  const total = db.estado.comandas.filter((c) => c.status === 'fechada')
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
          <input name="telefone" type="tel" placeholder="(11) 99999-9999" value="${esc(c.telefone || '')}"></label>
        <label class="campo"><span>Aniversário</span>
          <input name="nascimento" type="date" value="${c.nascimento || ''}"></label>
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
            fechar(); setTimeout(() => abrirComanda(), 60);
          } },
      ] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          if (!d.nome) return avisar('O nome é obrigatório', 'erro');
          await db.salvar('clientes', { ...c, ...d, ativo: true });
          fechar(); avisar('Cliente salva');
        } },
    ],
  });
}
