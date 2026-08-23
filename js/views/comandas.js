// ═══════════════════════════════════════════════════════════════════════════
// ATENDIMENTOS (COMANDAS)
// Registrar o que foi feito, para quem, por quem e como foi pago. Ao fechar,
// a comanda joga a entrada no caixa e dá baixa nos insumos da ficha técnica.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, hoje, avisar, abrirModal, confirmar, vazio, chave, uid, precoTexto } from '../ui.js';
import { FORMAS_PAGAMENTO } from '../pricing.js';
import { resumo, taxaDe, premissas } from '../metricas.js';

let filtro = { periodo: 'hoje', de: hoje(), ate: hoje(), profissional: '', status: '' };

/** Quem de fato atende clientes — quem só administra fica de fora. */
const atendentes = () =>
  db.estado.profissionais.filter((p) => p.atende !== false && p.ativo !== false);

/**
 * A Laura faz cabelo, a Julia faz unha. Cada serviço já sabe de quem é, e cada
 * profissional já sabe o que faz — então dá para cruzar os dois e nunca mostrar
 * à Laura uma lista cheia de esmaltação.
 */
export function fazEsseServico(prof, servico) {
  if (!prof || !servico) return true;
  const tipo = servico.profissional || 'unhas';
  return tipo === 'ambos' || prof.funcao === 'ambos' || prof.funcao === tipo;
}

const servicosDe = (profId, catalogo) => {
  const prof = db.estado.profissionais.find((p) => p.id === profId);
  const dela = catalogo.filter((s) => fazEsseServico(prof, s));
  // Sem nada para ela, é melhor mostrar tudo do que uma lista vazia.
  return dela.length ? dela : catalogo;
};

function intervalo() {
  const d = new Date();
  if (filtro.periodo === 'hoje') return { de: hoje(), ate: hoje() };
  if (filtro.periodo === 'semana') {
    const ini = new Date(d); ini.setDate(d.getDate() - 6);
    return { de: ini.toISOString().slice(0, 10), ate: hoje() };
  }
  if (filtro.periodo === 'mes') return { de: hoje().slice(0, 8) + '01', ate: hoje() };
  return { de: filtro.de, ate: filtro.ate };
}

export function render(raiz) {
  const { de, ate } = intervalo();
  const lista = db.estado.comandas.filter((c) =>
    c.data >= de && c.data <= ate
    && (!filtro.profissional || c.profissional_id === filtro.profissional)
    && (!filtro.status || c.status === filtro.status));

  const fechadas = lista.filter((c) => c.status === 'fechada');
  const abertas = lista.filter((c) => c.status === 'aberta');
  const r = resumo(fechadas);

  raiz.innerHTML = `
    <div class="flex envolve mb" style="gap:8px">
      <div class="pilulas crescer">
        ${[['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', 'Este mês'], ['custom', 'Escolher']]
          .map(([id, t]) => `<button class="pilula ${filtro.periodo === id ? 'ativa' : ''}" data-per="${id}">${t}</button>`).join('')}
      </div>
      <select id="f-prof" style="width:auto;min-width:150px">
        <option value="">Todas as profissionais</option>
        ${atendentes().map((p) => `<option value="${p.id}" ${filtro.profissional === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select>
    </div>

    ${filtro.periodo === 'custom' ? `
      <div class="linha-campos mb" style="max-width:420px">
        <label class="campo"><span>De</span><input type="date" id="f-de" value="${de}"></label>
        <label class="campo"><span>Até</span><input type="date" id="f-ate" value="${ate}"></label>
      </div>` : ''}

    <div class="grade c4 mb">
      <div class="kpi destaque"><div class="rotulo">Faturado</div>
        <div class="valor">${fmt.brlCurto(r.bruto)}</div>
        <div class="nota">${r.atendimentos} atendimento${r.atendimentos === 1 ? '' : 's'}</div></div>
      <div class="kpi"><div class="rotulo">Ticket médio</div>
        <div class="valor">${fmt.brlCurto(r.ticket)}</div></div>
      <div class="kpi"><div class="rotulo">Sobra do período</div>
        <div class="valor ${r.resultado < 0 ? 'erro-c' : ''}">${fmt.brlCurto(r.resultado)}</div>
        <div class="nota">depois de taxa, imposto, material e custo fixo</div></div>
      <div class="kpi"><div class="rotulo">Horas na cadeira</div>
        <div class="valor">${fmt.horas(r.tempo)}</div>
        <div class="nota">${r.porHora ? fmt.brl(r.porHora) + '/h líquido' : '—'}</div></div>
    </div>

    ${abertas.length ? `
      <div class="cartao mb" style="border-color:var(--alerta)">
        <div class="cartao-cabeca">${ico('relogio')}<h3 style="color:var(--alerta)">Comandas em aberto (${abertas.length})</h3></div>
        ${linhasComanda(abertas)}
      </div>` : ''}

    <div class="cartao">
      <div class="cartao-cabeca">
        <h3>Atendimentos</h3>
        <button class="btn btn-primario btn-sm" id="nova">${ico('mais')}Novo</button>
      </div>
      ${fechadas.length ? linhasComanda(fechadas)
        : vazio('Nenhum atendimento fechado neste período.',
                '<button class="btn btn-primario" id="nova2">Registrar o primeiro</button>')}
    </div>`;

  raiz.querySelectorAll('[data-per]').forEach((b) => b.onclick = () => {
    filtro.periodo = b.dataset.per; render(raiz);
  });
  raiz.querySelector('#f-prof').onchange = (e) => { filtro.profissional = e.target.value; render(raiz); };
  raiz.querySelector('#f-de')?.addEventListener('change', (e) => { filtro.de = e.target.value; render(raiz); });
  raiz.querySelector('#f-ate')?.addEventListener('change', (e) => { filtro.ate = e.target.value; render(raiz); });
  raiz.querySelector('#nova').onclick = () => abrirComanda();
  raiz.querySelector('#nova2')?.addEventListener('click', () => abrirComanda());
  raiz.querySelectorAll('[data-comanda]').forEach((el) =>
    el.onclick = () => abrirComanda(el.dataset.comanda));
}

function linhasComanda(lista) {
  const profs = new Map(db.estado.profissionais.map((p) => [p.id, p]));
  return `<div class="tabela-wrap"><table><thead><tr>
      <th>Data</th><th>Cliente</th><th>Serviços</th><th>Profissional</th>
      <th>Pgto</th><th class="n">Total</th><th></th>
    </tr></thead><tbody>
    ${lista.map((c) => {
      const itens = db.estado.comanda_itens.filter((i) => i.comanda_id === c.id);
      const nomes = itens.map((i) => i.nome).join(', ');
      const forma = FORMAS_PAGAMENTO.find((f) => f.id === c.forma_pagamento);
      return `<tr data-comanda="${c.id}" style="cursor:pointer">
        <td class="num">${fmt.dataCurta(c.data)}</td>
        <td><strong>${esc(c.cliente_nome || 'Sem cadastro')}</strong></td>
        <td class="t2 pequeno truncar" style="max-width:280px" title="${esc(nomes)}">${esc(nomes) || '—'}</td>
        <td class="pequeno">${esc(profs.get(c.profissional_id)?.nome || '—')}</td>
        <td class="pequeno t2">${forma ? esc(forma.nome) : (c.status === 'aberta' ? '<span class="selo alerta">aberta</span>' : '—')}</td>
        <td class="n"><strong>${fmt.brl(c.total)}</strong></td>
        <td style="width:30px">${ico('editar')}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

// ─── Modal da comanda ──────────────────────────────────────────────────────
/**
 * `inicial` vem da agenda: a cliente chegou e o atendimento já começa
 * preenchido com quem, quando e o que ela marcou.
 */
export function abrirComanda(id, inicial) {
  const existente = id ? db.estado.comandas.find((c) => c.id === id) : null;
  const c = existente
    ? { ...existente }
    : { id: uid(), data: inicial?.data || hoje(), status: 'aberta', desconto: 0,
        cliente_nome: inicial?.cliente_nome || null,
        cliente_id: inicial?.cliente_id || null,
        // Quem está logada só é a profissional padrão se ela mesma atender.
        profissional_id: inicial?.profissional_id
                         || (db.eu?.atende !== false ? db.eu?.id : null)
                         || atendentes()[0]?.id || null };

  let itens = existente
    ? db.estado.comanda_itens.filter((i) => i.comanda_id === id).map((i) => ({ ...i }))
    : [];

  if (!existente && inicial?.servico_id) {
    const s = db.estado.servicos.find((x) => x.id === inicial.servico_id);
    if (s) {
      itens.push({ id: uid(), comanda_id: c.id, servico_id: s.id, nome: s.nome,
                   tipo: s.tipo || 'servico', qtd: 1, valor: Number(s.preco) || 0,
                   custo: Number(s.custo) || 0, tempo: Number(s.tempo) || 0,
                   confirmar_valor: s.preco_tipo && s.preco_tipo !== 'fixo' });
    }
  }

  const catalogo = db.estado.servicos.filter((s) => s.ativo !== false);
  const fechada = c.status === 'fechada';

  const fechar = abrirModal({
    largo: true,
    titulo: existente ? 'Atendimento' : 'Novo atendimento',
    corpo: `
      <div class="linha-campos">
        <label class="campo"><span>Cliente</span>
          <input id="cli" list="lista-clientes" value="${esc(c.cliente_nome || '')}"
                 placeholder="Nome da cliente" autocomplete="off">
          <datalist id="lista-clientes">
            ${db.estado.clientes.map((x) => `<option value="${esc(x.nome)}">`).join('')}
          </datalist>
        </label>
        <label class="campo"><span>Profissional</span>
          <select id="prof">
            ${atendentes().map((p) =>
              `<option value="${p.id}" ${c.profissional_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select>
        </label>
        <label class="campo"><span>Data</span>
          <input type="date" id="data" value="${c.data}"></label>
      </div>

      <div class="regua mb">${estrela()}</div>

      <div class="flex mb" style="gap:8px">
        <select id="add-serv" class="crescer">
          <option value="">Adicionar serviço…</option>
          ${agrupado(servicosDe(c.profissional_id, catalogo))}
        </select>
        <button class="btn btn-sm" id="add-livre">${ico('mais')}Avulso</button>
      </div>

      <div id="itens"></div>

      <div class="regua mt mb">${estrela()}</div>

      <div class="linha-campos">
        <label class="campo"><span>Desconto (R$)</span>
          <input type="number" id="desc" min="0" step="0.01" value="${Number(c.desconto) || 0}"></label>
        <label class="campo"><span>Observações</span>
          <input type="text" id="obs" value="${esc(c.observacoes || '')}" placeholder="Ex.: alergia, preferência de cor"></label>
      </div>

      <div class="campo"><span>Forma de pagamento</span>
        <div class="pilulas" id="pgto">
          ${FORMAS_PAGAMENTO.map((f) =>
            `<button type="button" class="pilula ${c.forma_pagamento === f.id ? 'ativa' : ''}" data-pg="${f.id}">${f.nome}</button>`).join('')}
        </div>
      </div>

      <div id="totais"></div>`,

    acoes: existente
      ? [
          { texto: ico('lixo') + ' Excluir', classe: 'btn-perigo', onClick: async (f) => {
              if (await confirmar('Excluir atendimento?',
                    'A entrada no caixa também é removida. O estoque baixado não volta automaticamente.')) {
                await excluirComanda(c.id); f();
              }
            } },
          { texto: 'Salvar', classe: 'btn-fantasma', onClick: (f) => guardar(false, f) },
          ...(fechada ? [] : [{ texto: 'Fechar comanda', classe: 'btn-primario', onClick: (f) => guardar(true, f) }]),
        ]
      : [
          { texto: 'Deixar em aberto', classe: 'btn-fantasma', onClick: (f) => guardar(false, f) },
          { texto: 'Fechar comanda', classe: 'btn-primario', onClick: (f) => guardar(true, f) },
        ],

    aoAbrir: (veu) => {
      const $ = (s) => veu.querySelector(s);

      const pintarItens = () => {
        const alvo = $('#itens');
        if (!itens.length) {
          alvo.innerHTML = `<div class="aviso">${ico('info')}<div>Adicione ao menos um serviço.</div></div>`;
        } else {
          alvo.innerHTML = `<div class="tabela-wrap"><table><thead><tr>
              <th>Serviço</th><th style="width:74px">Qtd</th><th style="width:110px" class="n">Valor</th>
              <th class="n" style="width:96px">Subtotal</th><th style="width:34px"></th>
            </tr></thead><tbody>
            ${itens.map((it, i) => `<tr>
              <td>${esc(it.nome)}${it.tipo === 'adicional' ? ' <span class="selo">adicional</span>' : ''}${
                it.confirmar_valor ? ' <span class="selo alerta" title="o valor deste serviço varia">confirmar valor</span>' : ''}</td>
              <td><input type="number" min="1" step="1" value="${it.qtd}" data-i="${i}" data-campo="qtd"></td>
              <td><input type="number" min="0" step="0.01" value="${it.valor}" data-i="${i}" data-campo="valor" style="text-align:right"></td>
              <td class="n num">${fmt.brl(it.valor * it.qtd)}</td>
              <td><button class="btn-icone" data-remover="${i}" title="Remover">${ico('fechar')}</button></td>
            </tr>`).join('')}
          </tbody></table></div>`;
        }

        alvo.querySelectorAll('input[data-campo]').forEach((inp) => {
          inp.onchange = () => {
            itens[+inp.dataset.i][inp.dataset.campo] = Number(inp.value) || 0;
            pintarItens(); pintarTotais();
          };
        });
        alvo.querySelectorAll('[data-remover]').forEach((b) => {
          b.onclick = () => { itens.splice(+b.dataset.remover, 1); pintarItens(); pintarTotais(); };
        });
      };

      const pintarTotais = () => {
        const bruto = itens.reduce((s, i) => s + i.valor * i.qtd, 0);
        const desconto = Number($('#desc').value) || 0;
        const total = Math.max(0, bruto - desconto);
        const custo = itens.reduce((s, i) => s + (Number(i.custo) || 0) * i.qtd, 0);
        const tempo = itens.reduce((s, i) => s + (Number(i.tempo) || 0) * i.qtd, 0);
        const p = premissas();
        const forma = veu.querySelector('.pilula.ativa')?.dataset.pg;
        const taxa = total * taxaDe(forma, p);
        const imposto = total * Number(p.imposto || 0);

        $('#totais').innerHTML = `
          <div class="cartao" style="background:var(--fundo);padding:14px">
            <div class="flex-entre"><span class="t2">Serviços</span><span class="num">${fmt.brl(bruto)}</span></div>
            ${desconto ? `<div class="flex-entre"><span class="t2">Desconto</span><span class="num erro-c">− ${fmt.brl(desconto)}</span></div>` : ''}
            <div class="flex-entre" style="margin:8px 0;padding-top:8px;border-top:1px solid var(--linha)">
              <strong style="font-size:17px">Total a cobrar</strong>
              <strong class="display num" style="font-size:24px">${fmt.brl(total)}</strong>
            </div>
            <div class="pequeno t3">
              ${forma ? `Taxa ${fmt.brl(taxa)} · ` : ''}Imposto ${fmt.brl(imposto)} ·
              Material ${fmt.brl(custo)} · ${fmt.horas(tempo)} de cadeira
            </div>
          </div>`;
      };

      // Trocou a profissional: a lista de serviços acompanha.
      $('#prof').onchange = () => {
        const sel = $('#add-serv');
        sel.innerHTML = '<option value="">Adicionar serviço…</option>'
                      + agrupado(servicosDe($('#prof').value, catalogo));
      };

      $('#add-serv').onchange = (e) => {
        const s = catalogo.find((x) => x.id === e.target.value);
        e.target.value = '';
        if (!s) return;
        const ja = itens.find((i) => i.servico_id === s.id);
        if (ja) ja.qtd++;
        else itens.push({ id: uid(), comanda_id: c.id, servico_id: s.id, nome: s.nome,
                          tipo: s.tipo || 'servico', qtd: 1, valor: Number(s.preco) || 0,
                          custo: Number(s.custo) || 0, tempo: Number(s.tempo) || 0,
                          confirmar_valor: s.preco_tipo && s.preco_tipo !== 'fixo' });
        pintarItens(); pintarTotais();
        if (s.preco_tipo === 'avaliacao') avisar('Serviço sob avaliação — informe o valor combinado');
        else if (s.preco_tipo === 'a_partir') avisar('Valor inicial — ajuste conforme o atendimento');
      };

      $('#add-livre').onclick = () => {
        itens.push({ id: uid(), comanda_id: c.id, servico_id: null, nome: 'Serviço avulso',
                     tipo: 'servico', qtd: 1, valor: 0, custo: 0, tempo: 0 });
        pintarItens(); pintarTotais();
        const ultima = veu.querySelectorAll('#itens tbody tr');
        ultima[ultima.length - 1]?.querySelector('input')?.focus();
      };

      veu.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => {
        veu.querySelectorAll('[data-pg]').forEach((x) => x.classList.remove('ativa'));
        b.classList.add('ativa'); pintarTotais();
      });
      $('#desc').oninput = pintarTotais;

      pintarItens(); pintarTotais();
    },
  });

  async function guardar(fecharComanda, fecharModal_) {
    const veu = document.querySelector('.veu');
    const $ = (s) => veu.querySelector(s);
    const nomeCliente = $('#cli').value.trim();

    if (!itens.length) return avisar('Adicione ao menos um serviço', 'erro');
    const forma = veu.querySelector('.pilula.ativa')?.dataset.pg;
    if (fecharComanda && !forma) return avisar('Escolha a forma de pagamento', 'erro');

    // Cliente: acha pelo nome ou cadastra na hora.
    let clienteId = null;
    if (nomeCliente) {
      const achado = db.estado.clientes.find((x) => chave(x.nome) === chave(nomeCliente));
      clienteId = achado ? achado.id
        : (await db.salvar('clientes', { nome: nomeCliente, ativo: true })).id;
    }

    const bruto = itens.reduce((s, i) => s + i.valor * i.qtd, 0);
    const desconto = Number($('#desc').value) || 0;

    const comanda = {
      ...c,
      cliente_id: clienteId,
      cliente_nome: nomeCliente || null,
      profissional_id: $('#prof').value || null,
      data: $('#data').value,
      forma_pagamento: forma || null,
      desconto,
      observacoes: $('#obs').value.trim() || null,
      total: Math.max(0, bruto - desconto),
      custo_total: itens.reduce((s, i) => s + (Number(i.custo) || 0) * i.qtd, 0),
      tempo_total: itens.reduce((s, i) => s + (Number(i.tempo) || 0) * i.qtd, 0),
      status: fecharComanda ? 'fechada' : 'aberta',
      fechada_em: fecharComanda ? new Date().toISOString() : null,
    };

    await db.salvar('comandas', comanda);

    // Itens: remove os que saíram, grava os que ficaram.
    const antigos = db.estado.comanda_itens.filter((i) => i.comanda_id === c.id);
    const idsAgora = new Set(itens.map((i) => i.id));
    for (const a of antigos) if (!idsAgora.has(a.id)) await db.remover('comanda_itens', a.id);
    // `confirmar_valor` é só um aviso de tela; não existe como coluna no banco.
    await db.salvarLote('comanda_itens', itens.map(({ confirmar_valor, ...i }) => ({ ...i, comanda_id: c.id })));

    if (fecharComanda) {
      await lancarNoCaixa(comanda);
      const baixados = await baixarEstoque(comanda, itens);
      avisar(`Comanda fechada — ${fmt.brl(comanda.total)}${baixados ? ` · ${baixados} insumo(s) baixado(s)` : ''}`);
    } else {
      avisar('Comanda salva em aberto');
    }

    fecharModal_();
  }
}

/** Entrada no caixa espelhando a comanda. Reescreve se já existir. */
async function lancarNoCaixa(comanda) {
  const ja = db.estado.caixa.find((l) => l.comanda_id === comanda.id);
  await db.salvar('caixa', {
    id: ja?.id,
    data: comanda.data,
    tipo: 'entrada',
    categoria: 'Atendimento',
    descricao: comanda.cliente_nome || 'Atendimento',
    valor: comanda.total,
    forma_pagamento: comanda.forma_pagamento,
    profissional_id: comanda.profissional_id,
    comanda_id: comanda.id,
  });
}

/** Baixa dos insumos previstos na ficha técnica de cada serviço. */
async function baixarEstoque(comanda, itens) {
  const fichas = db.estado.ficha_tecnica;
  if (!fichas.length) return 0;

  const consumo = new Map();
  for (const it of itens) {
    for (const f of fichas.filter((x) => x.servico_id === it.servico_id)) {
      consumo.set(f.material_id, (consumo.get(f.material_id) || 0) + Number(f.qtd) * it.qtd);
    }
  }
  if (!consumo.size) return 0;

  for (const [materialId, qtd] of consumo) {
    const m = db.estado.materiais.find((x) => x.id === materialId);
    if (!m) continue;
    await db.salvar('materiais', { ...m, estoque: Number(m.estoque || 0) - qtd });
    await db.salvar('estoque_mov', {
      material_id: materialId, tipo: 'saida', qtd,
      motivo: 'Atendimento — ' + (comanda.cliente_nome || 'sem cadastro'),
      comanda_id: comanda.id, profissional_id: comanda.profissional_id,
      criado_em: new Date().toISOString(),
    });
  }
  return consumo.size;
}

async function excluirComanda(id) {
  for (const i of db.estado.comanda_itens.filter((x) => x.comanda_id === id)) {
    await db.remover('comanda_itens', i.id);
  }
  for (const l of db.estado.caixa.filter((x) => x.comanda_id === id)) {
    await db.remover('caixa', l.id);
  }
  await db.remover('comandas', id);
  avisar('Atendimento excluído');
}

/** <optgroup> por categoria, para o seletor não virar uma lista infinita. */
function agrupado(catalogo) {
  const cats = db.cfg('categorias') || [];
  const nomeCat = (id) => cats.find((c) => c.id === id)?.nome || (id === 'adicionais' ? 'Adicionais' : id);
  const grupos = new Map();
  for (const s of catalogo) {
    if (!grupos.has(s.categoria)) grupos.set(s.categoria, []);
    grupos.get(s.categoria).push(s);
  }
  return [...grupos.entries()].map(([cat, lista]) => `
    <optgroup label="${esc(nomeCat(cat))}">
      ${lista.map((s) => `<option value="${s.id}">${esc(s.nome)} — ${esc(precoTexto(s))}</option>`).join('')}
    </optgroup>`).join('');
}
