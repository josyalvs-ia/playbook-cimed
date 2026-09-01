// ═══════════════════════════════════════════════════════════════════════════
// CAIXA — tudo que entra e tudo que sai. Atendimentos entram sozinhos quando a
// comanda é fechada; compras de insumo entram quando a nota é lançada no
// estoque. O resto é lançado à mão aqui.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, hoje, mesAtual, avisar, abrirModal, confirmar, lerForm, vazio, dataLocal } from '../ui.js';
import * as M from '../metricas.js';
import { FORMAS_PAGAMENTO } from '../pricing.js';

let mes = mesAtual();
let filtroTipo = '';

export function render(raiz) {
  const de = mes + '-01';
  const ate = fimDoMes(mes);
  const { linhas, entradas, saidas, saldo } = M.caixaPeriodo({ de, ate });
  const lista = linhas.filter((l) => !filtroTipo || l.tipo === filtroTipo);
  const porCat = M.saidasPorCategoria(linhas);
  const comandas = M.comandasFechadas({ de, ate });
  const pgto = M.porPagamento(comandas);
  const p = M.premissas();
  const taxasPagas = comandas.reduce((s, c) => s + Number(c.total) * M.taxaDe(c.forma_pagamento, p), 0);

  raiz.innerHTML = `
    <div class="flex envolve mb" style="gap:10px">
      <input type="month" id="mes" value="${mes}" style="width:auto">
      <div class="pilulas crescer">
        ${[['', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas']]
          .map(([id, t]) => `<button class="pilula ${filtroTipo === id ? 'ativa' : ''}" data-tipo="${id}">${t}</button>`).join('')}
      </div>
      <button class="btn btn-primario btn-sm" id="lancar">${ico('mais')}Lançar</button>
    </div>

    <div class="grade c4 mb">
      <div class="kpi"><div class="rotulo">Entrou</div>
        <div class="valor ok-c">${fmt.brlCurto(entradas)}</div></div>
      <div class="kpi"><div class="rotulo">Saiu</div>
        <div class="valor erro-c">${fmt.brlCurto(saidas)}</div></div>
      <div class="kpi destaque"><div class="rotulo">Saldo do mês</div>
        <div class="valor">${fmt.brlCurto(saldo)}</div>
        <div class="nota">${saldo >= 0 ? 'sobrou' : 'faltou'} no período</div></div>
      <div class="kpi"><div class="rotulo">Ficou com a maquininha</div>
        <div class="valor">${fmt.brlCurto(taxasPagas)}</div>
        <div class="nota">taxa média ${fmt.pct(M.taxaMedia(p), 2)}</div></div>
    </div>

    <div class="grade c2 mb">
      <div class="cartao">
        <div class="cartao-cabeca">${ico('caixa')}<h3>Como as clientes pagaram</h3></div>
        ${pgto.some((f) => f.qtd) ? pgto.map((f) => {
          // Um mês inteiro de cortesia soma zero: dividir por ele dá NaN, e a
          // barra desaparecia sem explicação.
          const totalPago = comandas.reduce((s, c) => s + Number(c.total || 0), 0);
          const pct = totalPago > 0 ? (f.valor / totalPago) * 100 : 0;
          return `<div style="margin-bottom:11px">
            <div class="flex-entre pequeno"><span>${f.nome} <span class="t3">· ${f.qtd}×</span></span>
              <strong class="num">${fmt.brl(f.valor)}</strong></div>
            <div class="barra"><i style="width:${pct}%"></i></div>
          </div>`;
        }).join('') : '<p class="t3 pequeno">Nenhum atendimento fechado no mês.</p>'}
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('grafico')}<h3>Para onde foi o dinheiro</h3></div>
        ${porCat.length ? porCat.map((c) => `
          <div style="margin-bottom:11px">
            <div class="flex-entre pequeno"><span>${esc(c.categoria)}</span>
              <strong class="num">${fmt.brl(c.valor)}</strong></div>
            <div class="barra erro"><i style="width:${porCat[0].valor ? (c.valor / porCat[0].valor) * 100 : 0}%"></i></div>
          </div>`).join('') : '<p class="t3 pequeno">Nenhuma saída lançada no mês.</p>'}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-cabeca"><h3>Lançamentos</h3>
        <span class="t3 pequeno">${lista.length} no mês</span></div>
      ${lista.length ? `<div class="tabela-wrap"><table><thead><tr>
          <th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th>
          <th class="n">Valor</th><th></th>
        </tr></thead><tbody>
        ${lista.map((l) => `<tr>
          <td class="pequeno t2 num">${fmt.dataCurta(l.data)}</td>
          <td>${esc(l.descricao || '—')}
            ${l.comanda_id ? '<span class="selo">comanda</span>' : ''}</td>
          <td class="pequeno t2">${esc(l.categoria)}</td>
          <td class="pequeno t3">${esc(FORMAS_PAGAMENTO.find((f) => f.id === l.forma_pagamento)?.nome || '—')}</td>
          <td class="n num ${l.tipo === 'entrada' ? 'ok-c' : 'erro-c'}">
            <strong>${l.tipo === 'entrada' ? '+' : '−'} ${fmt.brl(l.valor)}</strong></td>
          <td style="width:34px">${l.comanda_id
            ? `<button class="btn-icone" data-comanda="${l.comanda_id}"
                 title="Abrir o atendimento que gerou este lançamento">${ico('editar')}</button>`
            : `<button class="btn-icone" data-editar="${l.id}">${ico('editar')}</button>`}</td>
        </tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum lançamento neste mês.')}
    </div>`;

  raiz.querySelector('#mes').onchange = (e) => { mes = e.target.value; render(raiz); };
  raiz.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => { filtroTipo = b.dataset.tipo; render(raiz); });
  raiz.querySelector('#lancar').onclick = () => abrirLancamento();
  raiz.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () => abrirLancamento(b.dataset.editar));

  // Lançamento que veio de um atendimento não se edita aqui — ele é o reflexo
  // da comanda. Antes a linha simplesmente não tinha botão, e quem quisesse
  // apagar ficava sem caminho nenhum. Agora abre a comanda, onde dá para
  // excluir de verdade (e a entrada no caixa some junto).
  raiz.querySelectorAll('[data-comanda]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.comanda;
    const existe = db.estado.comandas.some((c) => c.id === id);
    if (!existe) {
      // Sobra de um atendimento que já foi apagado pela metade: dá para
      // limpar aqui mesmo, senão o valor fica no caixa para sempre.
      const l = db.estado.caixa.find((x) => x.comanda_id === id);
      const ok = await confirmar('Apagar este lançamento?',
        'O atendimento que gerou este valor não existe mais — sobrou só a entrada no '
        + 'caixa. Apagar aqui tira o valor das contas do mês.');
      if (ok) { await db.remover('caixa', l.id); avisar('Lançamento apagado'); }
      return;
    }
    const m = await import('./comandas.js');
    m.abrirComanda(id);
  });
}

export function abrirLancamento(id) {
  const l = id ? db.estado.caixa.find((x) => x.id === id) : { tipo: 'saida', data: hoje() };
  const cats = db.cfg('categorias_caixa') || { entrada: ['Atendimento', 'Outros'], saida: ['Outros'] };

  abrirModal({
    titulo: id ? 'Editar lançamento' : 'Lançar no caixa',
    corpo: `
      <div class="campo"><span>Tipo</span>
        <div class="pilulas" id="tipo">
          <button type="button" class="pilula ${l.tipo === 'saida' ? 'ativa' : ''}" data-t="saida">Saída</button>
          <button type="button" class="pilula ${l.tipo === 'entrada' ? 'ativa' : ''}" data-t="entrada">Entrada</button>
        </div></div>
      <div class="linha-campos">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${l.data || hoje()}"></label>
        <label class="campo"><span>Valor</span>
          <input type="number" name="valor" step="0.01" min="0" value="${l.valor ?? ''}" required></label>
      </div>
      <label class="campo"><span>Categoria</span>
        <select name="categoria" id="cat"></select></label>
      <label class="campo"><span>Descrição</span>
        <input name="descricao" value="${esc(l.descricao || '')}" placeholder="Ex.: aluguel de agosto"></label>
      <div class="linha-campos">
        <label class="campo"><span>Forma</span>
          <select name="forma_pagamento">
            <option value="">—</option>
            ${FORMAS_PAGAMENTO.map((f) => `<option value="${f.id}" ${l.forma_pagamento === f.id ? 'selected' : ''}>${f.nome}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Profissional</span>
          <select name="profissional_id">
            <option value="">—</option>
            ${db.estado.profissionais.map((p) => `<option value="${p.id}" ${l.profissional_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select></label>
      </div>`,
    acoes: [
      ...(id ? [{ texto: ico('lixo'), classe: 'btn-perigo', onClick: async (f) => {
        if (await confirmar('Excluir lançamento?', 'Essa linha some do caixa.')) {
          await db.remover('caixa', id); f(); avisar('Lançamento excluído');
        }
      } }] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          d.tipo = veu.querySelector('#tipo .ativa').dataset.t;
          if (!d.valor || d.valor <= 0) return avisar('Informe um valor', 'erro');
          await db.salvar('caixa', { ...l, ...d });
          fechar(); avisar('Lançamento salvo');
        } },
    ],
    aoAbrir: (veu) => {
      const sel = veu.querySelector('#cat');
      const pintarCats = () => {
        const tipo = veu.querySelector('#tipo .ativa').dataset.t;
        sel.innerHTML = (cats[tipo] || []).map((c) =>
          `<option ${l.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
      };
      veu.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
        veu.querySelectorAll('[data-t]').forEach((x) => x.classList.remove('ativa'));
        b.classList.add('ativa'); pintarCats();
      });
      pintarCats();
    },
  });
}

function fimDoMes(m) {
  const [a, mm] = m.split('-').map(Number);
  return dataLocal(new Date(a, mm, 0));
}
