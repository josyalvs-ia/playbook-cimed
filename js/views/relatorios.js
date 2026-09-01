// RELATÓRIOS — o mês inteiro em uma tela, incluindo o resultado real
// depois de tudo que sai.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, mesAtual, dataLocal } from '../ui.js';
import * as M from '../metricas.js';
import { custoFixoMensal } from '../pricing.js';
import { baixarCSV } from './precificacao.js';

let mes = mesAtual();

export function render(raiz) {
  const de = mes + '-01', ate = fimDoMes(mes);
  const p = M.premissas();
  const comandas = M.comandasFechadas({ de, ate });
  const r = M.resumo(comandas, p);
  const cx = M.caixaPeriodo({ de, ate });
  const ranking = M.rankingServicos(comandas, 12);
  const retorno = M.taxaRetorno({ de, ate });
  const meses = ultimosMeses(6);
  const serie = meses.map((m) => ({
    mes: m,
    valor: M.resumo(M.comandasFechadas({ de: m + '-01', ate: fimDoMes(m) }), p).bruto,
  }));
  const maxSerie = Math.max(1, ...serie.map((s) => s.valor));

  // Resultado do mês pelo caixa: o que realmente sobrou.
  const fixoPrevisto = custoFixoMensal(p);
  const saidasReais = cx.saidas;

  raiz.innerHTML = `
    <div class="flex-entre mb envolve">
      <input type="month" id="mes" value="${mes}" style="width:auto">
      <button class="btn btn-sm" id="exportar">${ico('baixar')}Exportar mês</button>
    </div>

    <div class="grade c4 mb">
      <div class="kpi destaque"><div class="rotulo">Faturamento</div>
        <div class="valor">${fmt.brlCurto(r.bruto)}</div>
        <div class="nota">${r.atendimentos} atendimentos</div></div>
      <div class="kpi"><div class="rotulo">Ticket médio</div>
        <div class="valor">${fmt.brlCurto(r.ticket)}</div></div>
      <div class="kpi"><div class="rotulo">Recebido líquido</div>
        <div class="valor">${fmt.brlCurto(r.liquido)}</div>
        <div class="nota">após taxa e imposto</div></div>
      <div class="kpi"><div class="rotulo">Sobra estimada</div>
        <div class="valor ${r.resultado < 0 ? 'erro-c' : 'ok-c'}">${fmt.brlCurto(r.resultado)}</div>
        <div class="nota">após material e custo fixo</div></div>
    </div>

    <div class="grade c2 mb">
      <div class="cartao">
        <div class="cartao-cabeca">${ico('grafico')}<h3>Últimos 6 meses</h3></div>
        <div style="display:flex;align-items:flex-end;gap:10px;height:150px;padding-top:8px">
          ${serie.map((s) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%">
              <div class="pequeno num t2" style="font-size:11px">${s.valor ? fmt.brlCurto(s.valor).replace('R$ ', '') : ''}</div>
              <div style="flex:1;width:100%;display:flex;align-items:flex-end">
                <div style="width:100%;height:${Math.max(2, (s.valor / maxSerie) * 100)}%;
                     background:${s.mes === mes ? 'var(--creme)' : 'var(--verde-claro)'};
                     border-radius:5px 5px 0 0"></div>
              </div>
              <div class="pequeno t3" style="font-size:10px">${rotuloMes(s.mes)}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('caixa')}<h3>Resultado do mês pelo caixa</h3></div>
        <table><tbody>
          <tr><td>Entradas no caixa</td><td class="n num ok-c">${fmt.brl(cx.entradas)}</td></tr>
          <tr><td>Saídas lançadas</td><td class="n num erro-c">− ${fmt.brl(saidasReais)}</td></tr>
          <tr><td><strong>Saldo do caixa</strong></td>
              <td class="n num"><strong>${fmt.brl(cx.saldo)}</strong></td></tr>
        </tbody></table>
        <div class="aviso mt pequeno">${ico('info')}<div>
          Custo fixo previsto nas premissas: <strong>${fmt.brl(fixoPrevisto)}</strong>/mês.
          ${saidasReais < fixoPrevisto * 0.6
            ? 'As saídas lançadas estão bem abaixo disso — provavelmente falta lançar contas no caixa.'
            : 'As saídas lançadas estão coerentes com o previsto.'}</div></div>
      </div>
    </div>

    <div class="grade c2 mb">
      <div class="cartao">
        <div class="cartao-cabeca">${estrela()}<h3>Serviços que mais faturaram</h3></div>
        ${ranking.length ? `<div class="tabela-wrap"><table><thead><tr>
            <th>Serviço</th><th class="n">Vezes</th><th class="n">Receita</th><th class="n">Horas</th><th class="n">R$/hora</th>
          </tr></thead><tbody>
          ${ranking.map((s) => `<tr>
            <td>${esc(s.nome)}</td>
            <td class="n num">${s.qtd}</td>
            <td class="n num"><strong>${fmt.brl(s.valor)}</strong></td>
            <td class="n num t3">${fmt.horas(s.tempo)}</td>
            <td class="n num t2">${s.tempo ? fmt.brl(s.valor / s.tempo) : '—'}</td>
          </tr>`).join('')}
        </tbody></table></div>` : '<p class="t3 pequeno">Sem atendimentos no mês.</p>'}
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('clientes')}<h3>Clientes no mês</h3></div>
        <div class="grade c2 mb">
          <div><div class="rotulo">Taxa de retorno</div>
            <div class="display" style="font-size:32px">${fmt.pct(retorno.taxa, 0)}</div></div>
          <div><div class="rotulo">Clientes atendidas</div>
            <div class="display" style="font-size:32px">${retorno.total}</div></div>
        </div>
        <table><tbody>
          <tr><td>Já eram clientes</td><td class="n num">${retorno.recorrentes}</td></tr>
          <tr><td>Primeira vez</td><td class="n num">${retorno.novas}</td></tr>
          <tr><td>Horas atendidas</td><td class="n num">${fmt.horas(r.tempo)}</td></tr>
          <tr><td>Receita por hora de cadeira</td><td class="n num">${r.tempo ? fmt.brl(r.bruto / r.tempo) : '—'}</td></tr>
        </tbody></table>
      </div>
    </div>

    <div class="cartao">
      <div class="cartao-cabeca">${ico('grafico')}<h3>De onde vem e para onde vai</h3></div>
      <div class="grade c2">
        <div>
          <div class="rotulo mb">Recebimento por forma</div>
          ${M.porPagamento(comandas).map((f) => `
            <div style="margin-bottom:10px">
              <div class="flex-entre pequeno"><span>${f.nome}</span><span class="num">${fmt.brl(f.valor)}</span></div>
              <div class="barra"><i style="width:${r.bruto ? (f.valor / r.bruto) * 100 : 0}%"></i></div>
            </div>`).join('')}
        </div>
        <div>
          <div class="rotulo mb">Saídas por categoria</div>
          ${M.saidasPorCategoria(cx.linhas).slice(0, 8).map((c, i, arr) => `
            <div style="margin-bottom:10px">
              <div class="flex-entre pequeno"><span>${esc(c.categoria)}</span><span class="num">${fmt.brl(c.valor)}</span></div>
              <div class="barra erro"><i style="width:${arr[0].valor ? (c.valor / arr[0].valor) * 100 : 0}%"></i></div>
            </div>`).join('') || '<p class="t3 pequeno">Nenhuma saída lançada.</p>'}
        </div>
      </div>
    </div>`;

  raiz.querySelector('#mes').onchange = (e) => { mes = e.target.value; render(raiz); };
  raiz.querySelector('#exportar').onclick = () => {
    baixarCSV(`atendimentos-${mes}.csv`, [
      ['Data', 'Cliente', 'Profissional', 'Serviços', 'Forma', 'Desconto', 'Total', 'Material', 'Horas'],
      ...comandas.map((c) => [
        c.data, c.cliente_nome || '', nomeProf(c.profissional_id),
        M.itensDe(c.id).map((i) => `${i.qtd}× ${i.nome}`).join(' + '),
        c.forma_pagamento || '', Number(c.desconto || 0).toFixed(2),
        Number(c.total || 0).toFixed(2), Number(c.custo_total || 0).toFixed(2),
        Number(c.tempo_total || 0).toFixed(2)]),
    ]);
  };
}

const nomeProf = (id) => db.estado.profissionais.find((p) => p.id === id)?.nome || '';

function ultimosMeses(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(dataLocal(x).slice(0, 7));
  }
  return out;
}

function rotuloMes(m) {
  return new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function fimDoMes(m) {
  const [a, mm] = m.split('-').map(Number);
  return dataLocal(new Date(a, mm, 0));
}
