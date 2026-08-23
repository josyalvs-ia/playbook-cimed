// PAINEL — o que importa saber ao abrir o studio de manhã.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, hoje, mesAtual, animarNumeros } from '../ui.js';
import * as M from '../metricas.js';
import { irPara } from '../app.js';

export function render(raiz) {
  const mes = mesAtual();
  const inicioMes = mes + '-01';
  const doDia = M.comandasFechadas({ de: hoje(), ate: hoje() });
  const doMes = M.comandasFechadas({ de: inicioMes, ate: hoje() });
  const rDia = M.resumo(doDia);
  const rMes = M.resumo(doMes);

  const caixaMes = M.caixaPeriodo({ de: inicioMes, ate: hoje() });
  const emFalta = M.materiaisEmFalta();
  const abertas = db.estado.comandas.filter((c) => c.status === 'aberta');
  const resgatar = M.clientesParaResgatar().slice(0, 5);
  const aniver = M.aniversariantes();
  const retorno = M.taxaRetorno({ de: inicioMes, ate: hoje() });
  const ranking = M.rankingServicos(doMes, 5);

  raiz.innerHTML = `
    <div class="flex mb" style="gap:10px">
      ${estrela()}<span class="eyebrow">${saudacao()}, ${esc((db.eu?.nome || '').split(' ')[0])}</span>
    </div>

    <div class="grade c4 mb">
      <div class="kpi destaque">
        <div class="rotulo">Hoje</div>
        <div class="valor" data-conta="${rDia.bruto}">${fmt.brlCurto(rDia.bruto)}</div>
        <div class="nota">${rDia.atendimentos} atendimento${rDia.atendimentos === 1 ? '' : 's'}</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Mês até agora</div>
        <div class="valor" data-conta="${rMes.bruto}">${fmt.brlCurto(rMes.bruto)}</div>
        <div class="nota">ticket médio ${fmt.brl(rMes.ticket)}</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Sobra do mês</div>
        <div class="valor ${rMes.resultado < 0 ? 'erro-c' : 'ok-c'}" data-conta="${rMes.resultado}">${fmt.brlCurto(rMes.resultado)}</div>
        <div class="nota">receita − taxa, imposto, material e fixo</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Saldo do caixa no mês</div>
        <div class="valor ${caixaMes.saldo < 0 ? 'erro-c' : ''}" data-conta="${caixaMes.saldo}">${fmt.brlCurto(caixaMes.saldo)}</div>
        <div class="nota">${fmt.brl(caixaMes.entradas)} entrou · ${fmt.brl(caixaMes.saidas)} saiu</div>
      </div>
    </div>

    ${alertas({ abertas, emFalta })}

    <div class="grade c2">
      <div class="cartao">
        <div class="cartao-cabeca">${ico('comanda')}<h3>Atendimentos de hoje</h3>
          <button class="btn btn-sm" data-ir="comandas">Ver todos</button></div>
        ${doDia.length ? `<div class="tabela-wrap"><table><tbody>
            ${doDia.map((c) => `<tr>
              <td><strong>${esc(c.cliente_nome || 'Sem cadastro')}</strong>
                <div class="pequeno t3">${esc(M.itensDe(c.id).map((i) => i.nome).join(', '))}</div></td>
              <td class="n"><strong>${fmt.brl(c.total)}</strong></td>
            </tr>`).join('')}
          </tbody></table></div>`
          : `<p class="t3 pequeno">Nada fechado ainda hoje.</p>`}
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('grafico')}<h3>Mais vendidos no mês</h3></div>
        ${ranking.length ? `<div class="tabela-wrap"><table><tbody>
            ${ranking.map((s) => `<tr>
              <td>${esc(s.nome)}<div class="pequeno t3">${s.qtd}×</div></td>
              <td class="n"><strong>${fmt.brl(s.valor)}</strong></td>
            </tr>`).join('')}
          </tbody></table></div>`
          : `<p class="t3 pequeno">Sem dados neste mês.</p>`}
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('clientes')}<h3>Taxa de retorno do mês</h3></div>
        <div class="flex envolve" style="gap:16px 20px">
          <div style="min-width:0">
            <div class="display" style="font-size:38px;line-height:1">${fmt.pct(retorno.taxa, 0)}</div>
            <div class="pequeno t3">das clientes já tinham vindo antes</div>
          </div>
          <div class="crescer pequeno t2" style="min-width:150px">
            <div class="flex-entre"><span>Recorrentes</span><strong>${retorno.recorrentes}</strong></div>
            <div class="flex-entre"><span>Novas</span><strong>${retorno.novas}</strong></div>
            <div class="flex-entre"><span>Total atendido</span><strong>${retorno.total}</strong></div>
          </div>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('whatsapp')}<h3>Vale uma mensagem</h3></div>
        ${resgatar.length ? `<div class="tabela-wrap"><table><tbody>
            ${resgatar.map((r) => `<tr>
              <td><strong>${esc(r.cliente.nome)}</strong>
                <div class="pequeno t3">costuma voltar a cada ${r.intervaloMedio} dias</div></td>
              <td class="n"><span class="selo alerta">${r.diasSemVir}d</span></td>
              <td style="width:34px">${r.cliente.telefone
                ? `<a class="btn-icone" target="_blank" rel="noopener"
                     href="https://wa.me/55${String(r.cliente.telefone).replace(/\D/g, '')}">${ico('whatsapp')}</a>` : ''}</td>
            </tr>`).join('')}
          </tbody></table></div>`
          : `<p class="t3 pequeno">Ninguém atrasado no retorno. Bom sinal.</p>`}
        ${aniver.length ? `<div class="aviso mt">${ico('info')}<div>
            <strong>Aniversariantes do mês:</strong> ${aniver.map((a) => esc(a.nome) + ' (' + a.nascimento.slice(8) + ')').join(', ')}
          </div></div>` : ''}
      </div>
    </div>`;

  raiz.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => irPara(b.dataset.ir));
  animarNumeros(raiz);
}

function alertas({ abertas, emFalta }) {
  const itens = [];
  if (abertas.length) itens.push(`<div class="aviso alerta">${ico('relogio')}<div>
      <strong>${abertas.length} comanda(s) em aberto.</strong> Elas ainda não entraram no caixa.
      <button class="btn btn-sm mt" data-ir="comandas">Ver</button></div></div>`);
  if (emFalta.length) itens.push(`<div class="aviso erro">${ico('alerta')}<div>
      <strong>${emFalta.length} insumo(s) no mínimo ou abaixo:</strong>
      ${emFalta.slice(0, 4).map((m) => esc(m.nome)).join(', ')}${emFalta.length > 4 ? '…' : ''}
      <button class="btn btn-sm mt" data-ir="estoque">Ver estoque</button></div></div>`);
  return itens.length ? `<div class="grade mb">${itens.join('')}</div>` : '';
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
