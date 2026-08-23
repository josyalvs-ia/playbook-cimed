// ═══════════════════════════════════════════════════════════════════════════
// PRECIFICAÇÃO — a planilha "Precificacao_Studio_Unhas_2026" viva.
// Mexa numa premissa e a tabela inteira se recalcula na hora.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, avisar, abrirModal, lerForm } from '../ui.js';
import { precoTecnico, custoFixoMensal, custoFixoPorAtendimento, taxaMediaCartao } from '../pricing.js';
import { premissas } from '../metricas.js';
import { OBSERVACOES_PREMISSAS, ETAPAS_TECNICA, COMO_USAR, PREMISSAS_PADRAO } from '../data/premissas.js';

let aba = 'tabela';

export function render(raiz) {
  const p = premissas();
  const servicos = db.estado.servicos.filter((s) => s.ativo !== false);
  const calc = servicos.map((s) => ({ s, r: precoTecnico(s, p, { adicional: s.tipo === 'adicional' }) }));
  const abaixo = calc.filter((x) => x.r.abaixoDoPiso);
  const perdaMes = abaixo.reduce((acc, x) => acc + (-x.r.diferenca), 0);

  raiz.innerHTML = `
    <div class="grade c4 mb">
      <div class="kpi"><div class="rotulo">Custo fixo do mês</div>
        <div class="valor">${fmt.brlCurto(custoFixoMensal(p))}</div>
        <div class="nota">${fmt.brl(custoFixoPorAtendimento(p))} por atendimento</div></div>
      <div class="kpi"><div class="rotulo">Taxa média de cartão</div>
        <div class="valor">${fmt.pct(taxaMediaCartao(p), 2)}</div>
        <div class="nota">pelo mix Pix/débito/crédito</div></div>
      <div class="kpi ${abaixo.length ? '' : ''}"><div class="rotulo">Abaixo do piso</div>
        <div class="valor ${abaixo.length ? 'erro-c' : 'ok-c'}">${abaixo.length}</div>
        <div class="nota">de ${calc.length} serviços</div></div>
      <div class="kpi"><div class="rotulo">Diferença somada</div>
        <div class="valor erro-c">${fmt.brlCurto(perdaMes)}</div>
        <div class="nota">se fizesse um de cada, uma vez</div></div>
    </div>

    <div class="pilulas mb">
      ${[['tabela', 'Preço técnico'], ['premissas', 'Premissas'], ['guia', 'Como calcular o custo']]
        .map(([id, t]) => `<button class="pilula ${aba === id ? 'ativa' : ''}" data-aba="${id}">${t}</button>`).join('')}
    </div>

    <div id="painel-preco"></div>`;

  raiz.querySelectorAll('[data-aba]').forEach((b) => b.onclick = () => { aba = b.dataset.aba; render(raiz); });
  const alvo = raiz.querySelector('#painel-preco');
  ({ tabela: () => abaTabela(alvo, calc, p),
     premissas: () => abaPremissas(alvo, p, raiz),
     guia: () => abaGuia(alvo) })[aba]();
}

function abaTabela(alvo, calc, p) {
  const ordenado = [...calc].sort((a, b) => a.r.diferenca - b.r.diferenca);

  alvo.innerHTML = `
    <div class="aviso mb">${ico('info')}<div>
      O <strong>piso técnico</strong> é o mínimo para o atendimento se pagar: material +
      custo fixo + seu tempo, já embutindo imposto, taxa de cartão e a margem de
      ${fmt.pct(p.margem, 0)}. Não é pesquisa de mercado — serve para enxergar o que está
      barato demais, não para derrubar o que já está saudável.</div></div>

    <div class="cartao">
      <div class="cartao-cabeca">${estrela()}<h3>Serviço a serviço</h3>
        <button class="btn btn-sm" id="exportar">${ico('baixar')}Exportar CSV</button></div>
      <div class="tabela-wrap"><table><thead><tr>
        <th>Serviço</th><th class="n">Cobra</th><th class="n">Material</th><th class="n">Fixo</th>
        <th class="n">Seu tempo</th><th class="n">Piso</th><th class="n">Sugerido</th>
        <th class="n">Diferença</th><th>Situação</th>
      </tr></thead><tbody>
      ${ordenado.map(({ s, r }) => `<tr>
        <td><strong>${esc(s.nome)}</strong>
          ${s.tipo === 'adicional' ? '<span class="selo">adicional</span>' : ''}
          ${s.estimado ? '<span class="selo alerta" title="custo/tempo estimados">est.</span>' : ''}</td>
        <td class="n num">${fmt.brl(s.preco)}</td>
        <td class="n num t3">${fmt.brl(r.material)}</td>
        <td class="n num t3">${fmt.brl(r.fixo)}</td>
        <td class="n num t3">${fmt.brl(r.mao)}</td>
        <td class="n num"><strong>${fmt.brl(r.tecnico)}</strong></td>
        <td class="n num t2">${fmt.brl(r.minimo)}</td>
        <td class="n num ${r.diferenca < 0 ? 'erro-c' : 'ok-c'}">
          ${r.diferenca < 0 ? '−' : '+'} ${fmt.brl(Math.abs(r.diferenca))}</td>
        <td>${r.abaixoDoPiso
          ? '<span class="selo erro">rever</span>'
          : '<span class="selo ok">ok</span>'}</td>
      </tr>`).join('')}
      </tbody></table></div>
    </div>`;

  alvo.querySelector('#exportar').onclick = () => {
    const linhas = [['Serviço', 'Preço atual', 'Material', 'Custo fixo', 'Remuneração tempo',
                     'Piso técnico', 'Preço sugerido', 'Diferença', 'Situação'],
      ...ordenado.map(({ s, r }) => [s.nome, s.preco, r.material.toFixed(2), r.fixo.toFixed(2),
        r.mao.toFixed(2), r.tecnico.toFixed(2), r.minimo, r.diferenca.toFixed(2),
        r.abaixoDoPiso ? 'Abaixo do piso' : 'OK'])];
    baixarCSV('precificacao-alento.csv', linhas);
  };
}

function abaPremissas(alvo, p, raiz) {
  const campos = [
    ['Custos fixos do mês', [
      ['aluguel_total', 'Aluguel total do studio', 'R$'],
      ['aluguel_rateio', 'Sua parte do aluguel', '%'],
      ['utilidades_total', 'Água + luz + internet', 'R$'],
      ['utilidades_rateio', 'Sua parte das utilidades', '%'],
      ['contador', 'Contador', 'R$'],
      ['outros_fixos', 'Outros custos fixos', 'R$'],
    ]],
    ['Sua operação', [
      ['atendimentos_mes', 'Atendimentos produtivos por mês', 'n'],
      ['remuneracao_hora', 'Quanto você quer ganhar por hora', 'R$'],
      ['margem', 'Margem de lucro desejada', '%'],
      ['imposto', 'Imposto estimado', '%'],
    ]],
    ['Recebimento', [
      ['taxa_pix', 'Taxa do Pix', '%'],
      ['taxa_debito', 'Taxa do débito', '%'],
      ['taxa_credito', 'Taxa do crédito à vista', '%'],
      ['mix_pix', 'Das vendas, quanto é Pix', '%'],
      ['mix_debito', 'Das vendas, quanto é débito', '%'],
      ['mix_credito', 'Das vendas, quanto é crédito', '%'],
    ]],
  ];

  alvo.innerHTML = `
    <div class="grade c3 mb">
      ${campos.map(([titulo, lista]) => `
        <div class="cartao">
          <div class="cartao-cabeca"><h3>${titulo}</h3></div>
          ${lista.map(([k, rot, un]) => `
            <label class="campo"><span>${rot}${un === '%' ? ' (%)' : ''}</span>
              <input type="number" step="${un === '%' ? '0.01' : un === 'n' ? '1' : '0.01'}"
                     data-k="${k}" data-un="${un}"
                     value="${un === '%' ? (Number(p[k]) * 100).toFixed(2).replace(/\.?0+$/, '') : p[k]}">
            </label>`).join('')}
        </div>`).join('')}
    </div>

    <div class="flex mb" style="gap:8px">
      <button class="btn btn-primario" id="salvar-prem">Salvar premissas</button>
      <button class="btn btn-fantasma" id="restaurar">Voltar ao original da planilha</button>
    </div>

    <div class="cartao">
      <div class="cartao-cabeca">${ico('info')}<h3>O que confirmar antes de fechar preço</h3></div>
      <ul style="list-style:none">
        ${OBSERVACOES_PREMISSAS.map((o) => `<li class="t2 pequeno" style="padding-left:18px;position:relative;margin-bottom:9px">
          <span style="position:absolute;left:0;opacity:.5">${estrela()}</span>${esc(o)}</li>`).join('')}
      </ul>
    </div>`;

  alvo.querySelector('#salvar-prem').onclick = async () => {
    const novo = { ...p };
    alvo.querySelectorAll('[data-k]').forEach((i) => {
      const v = Number(i.value) || 0;
      novo[i.dataset.k] = i.dataset.un === '%' ? v / 100 : v;
    });
    const soma = novo.mix_pix + novo.mix_debito + novo.mix_credito;
    if (Math.abs(soma - 1) > 0.02) {
      return avisar(`O mix de pagamento soma ${fmt.pct(soma, 0)} — precisa dar 100%`, 'erro');
    }
    await db.setCfg('premissas', novo);
    avisar('Premissas atualizadas');
    render(raiz);
  };

  alvo.querySelector('#restaurar').onclick = async () => {
    await db.setCfg('premissas', PREMISSAS_PADRAO);
    avisar('Premissas restauradas'); render(raiz);
  };
}

function abaGuia(alvo) {
  alvo.innerHTML = `
    <div class="grade c2">
      <div class="cartao">
        <div class="cartao-cabeca">${estrela()}<h3>O que entra no custo de cada técnica</h3></div>
        <div class="tabela-wrap"><table><tbody>
          ${ETAPAS_TECNICA.map(([t, e]) => `<tr>
            <td style="width:34%"><strong>${esc(t)}</strong></td>
            <td class="pequeno t2">${esc(e)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="cartao">
        <div class="cartao-cabeca">${ico('info')}<h3>Como chegar no custo real</h3></div>
        <div class="tabela-wrap"><table><tbody>
          ${COMO_USAR.map(([t, e]) => `<tr>
            <td style="width:30%"><strong>${esc(t)}</strong></td>
            <td class="pequeno t2">${esc(e)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </div>`;
}

export function baixarCSV(nome, linhas) {
  const csv = linhas.map((l) => l.map((c) => {
    const s = String(c ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
