// ═══════════════════════════════════════════════════════════════════════════
// ESTOQUE — 176 insumos da planilha, com entrada de compra, baixa por
// atendimento (ficha técnica), lista do que comprar e histórico de movimentos.
// ═══════════════════════════════════════════════════════════════════════════

import * as db from '../db.js';
import { ico, estrela, esc, fmt, chave, avisar, abrirModal, confirmar, lerForm, vazio, hoje } from '../ui.js';
import * as M from '../metricas.js';
import { custoUnitario, custoDeUso, unidadeDe } from '../pricing.js';

let aba = 'itens';
let busca = '';
let categoria = '';
let soFalta = false;

export function render(raiz) {
  const emFalta = M.materiaisEmFalta();
  const valor = M.valorEstoque();
  const cats = [...new Set(db.estado.materiais.map((m) => m.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  raiz.innerHTML = `
    <div class="grade c4 mb">
      <div class="kpi"><div class="rotulo">Itens cadastrados</div>
        <div class="valor">${db.estado.materiais.length}</div>
        <div class="nota">${cats.length} categorias</div></div>
      <div class="kpi"><div class="rotulo">Valor em estoque</div>
        <div class="valor">${fmt.brlCurto(valor)}</div>
        <div class="nota">pelo preço pago (ou referência)</div></div>
      <div class="kpi ${emFalta.length ? '' : ''}"><div class="rotulo">Precisa comprar</div>
        <div class="valor ${emFalta.length ? 'erro-c' : 'ok-c'}">${emFalta.length}</div>
        <div class="nota">no mínimo ou abaixo</div></div>
      <div class="kpi"><div class="rotulo">Fichas técnicas</div>
        <div class="valor">${new Set(db.estado.ficha_tecnica.map((f) => f.servico_id)).size}</div>
        <div class="nota">serviços com baixa automática</div></div>
    </div>

    <div class="pilulas mb">
      ${[['itens', 'Itens e saldo'], ['comprar', `Lista de compras${emFalta.length ? ' (' + emFalta.length + ')' : ''}`],
         ['ficha', 'Ficha técnica'], ['mov', 'Movimentos']]
        .map(([id, t]) => `<button class="pilula ${aba === id ? 'ativa' : ''}" data-aba="${id}">${t}</button>`).join('')}
    </div>

    <div id="painel-estoque"></div>`;

  raiz.querySelectorAll('[data-aba]').forEach((b) => b.onclick = () => { aba = b.dataset.aba; render(raiz); });

  const alvo = raiz.querySelector('#painel-estoque');
  ({ itens: abaItens, comprar: abaComprar, ficha: abaFicha, mov: abaMov })[aba](alvo, cats);
}

// ─── Itens ─────────────────────────────────────────────────────────────────
function abaItens(alvo, cats) {
  const termo = chave(busca);
  const lista = db.estado.materiais.filter((m) =>
    (!termo || chave(m.nome).includes(termo))
    && (!categoria || m.categoria === categoria)
    && (!soFalta || (Number(m.estoque_minimo) > 0 && Number(m.estoque) <= Number(m.estoque_minimo))));

  alvo.innerHTML = `
    <div class="cartao">
      <div class="cartao-cabeca">
        <input type="search" id="busca" placeholder="Buscar insumo" value="${esc(busca)}" style="max-width:260px">
        <select id="cat" style="width:auto">
          <option value="">Todas as categorias</option>
          ${cats.map((c) => `<option ${categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <label class="check" style="margin:0"><input type="checkbox" id="falta" ${soFalta ? 'checked' : ''}><span class="pequeno">Só o que falta</span></label>
        <button class="btn btn-primario btn-sm" id="novo">${ico('mais')}Item</button>
      </div>

      ${lista.length ? `<div class="tabela-wrap"><table><thead><tr>
          <th>Insumo</th><th>Apresentação</th><th>Tipo</th>
          <th class="n">Saldo</th><th class="n">Mínimo</th><th style="width:100px">Nível</th>
          <th class="n">Preço da embalagem</th><th></th>
        </tr></thead><tbody>
        ${lista.map((m) => {
          const est = Number(m.estoque) || 0, min = Number(m.estoque_minimo) || 0;
          const pct = min > 0 ? Math.min(100, (est / (min * 2)) * 100) : (est > 0 ? 100 : 0);
          const cls = min > 0 && est <= min ? 'erro' : (min > 0 && est <= min * 1.5 ? 'alerta' : '');
          return `<tr>
            <td><strong>${esc(m.nome)}</strong><div class="pequeno t3">${esc(m.categoria)}</div></td>
            <td class="pequeno t2">${esc(m.apresentacao || '—')}</td>
            <td><span class="selo">${esc(m.tipo || '—')}</span></td>
            <td class="n num"><strong class="${cls === 'erro' ? 'erro-c' : ''}">${fmt.num(est)}</strong>
              <span class="t3 pequeno"> ${esc(unidadeDe(m))}</span></td>
            <td class="n num t3">${min || '—'}</td>
            <td><div class="barra ${cls}"><i style="width:${pct}%"></i></div></td>
            <td class="n num t2">${m.preco_pago != null ? fmt.brl(m.preco_pago)
              : `<span class="t3" title="valor de referência de mercado">${fmt.brl(m.preco_ref)}*</span>`}
              <div class="pequeno t3">${fmt.brl(custoUnitario(m))}/${esc(unidadeDe(m))}</div></td>
            <td style="width:118px"><div class="flex-fim">
              <button class="btn btn-sm" data-entrada="${m.id}" title="Registrar compra">${ico('subir')}</button>
              <button class="btn-icone" data-editar="${m.id}">${ico('editar')}</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
      <p class="pequeno t3 mt">* preço de referência da planilha — registre uma compra para o app passar a usar o valor real.
      O saldo é contado na unidade de uso (ml, g, unidades), não em embalagens.</p>`
      : vazio('Nenhum insumo encontrado com esses filtros.')}
    </div>`;

  const b = alvo.querySelector('#busca');
  b.oninput = (e) => { busca = e.target.value; const p = e.target.selectionStart;
    abaItens(alvo, cats); const n = alvo.querySelector('#busca'); n.focus(); n.setSelectionRange(p, p); };
  alvo.querySelector('#cat').onchange = (e) => { categoria = e.target.value; abaItens(alvo, cats); };
  alvo.querySelector('#falta').onchange = (e) => { soFalta = e.target.checked; abaItens(alvo, cats); };
  alvo.querySelector('#novo').onclick = () => abrirMaterial();
  alvo.querySelectorAll('[data-editar]').forEach((x) => x.onclick = () => abrirMaterial(x.dataset.editar));
  alvo.querySelectorAll('[data-entrada]').forEach((x) => x.onclick = () => abrirMovimento(x.dataset.entrada));
}

// ─── Lista de compras ──────────────────────────────────────────────────────
function abaComprar(alvo) {
  const falta = M.materiaisEmFalta();
  // Repor até o dobro do mínimo, arredondando para embalagens inteiras —
  // ninguém compra meio frasco.
  const repor = (m) => {
    const falta_ = Math.max(0, (Number(m.estoque_minimo) || 0) * 2 - Number(m.estoque || 0));
    const emb = Number(m.qtd_embalagem) || 1;
    const caixas = Math.max(1, Math.ceil(falta_ / emb));
    return { caixas, unidades: caixas * emb, custo: caixas * Number(m.preco_pago ?? m.preco_ref ?? 0) };
  };
  const custo = falta.reduce((s, m) => s + repor(m).custo, 0);

  alvo.innerHTML = `
    <div class="cartao">
      <div class="cartao-cabeca">${ico('estoque')}<h3>O que comprar</h3>
        ${falta.length ? `<button class="btn btn-sm" id="copiar">${ico('baixar')}Copiar lista</button>` : ''}
      </div>
      ${falta.length ? `
        <div class="aviso mb">${ico('info')}<div>
          Sugestão de reposição até o dobro do mínimo. Custo estimado:
          <strong>${fmt.brl(custo)}</strong></div></div>
        <div class="tabela-wrap"><table><thead><tr>
          <th>Insumo</th><th>Apresentação</th><th class="n">Tem</th><th class="n">Mínimo</th>
          <th class="n">Comprar</th><th class="n">Custo estimado</th>
        </tr></thead><tbody>
        ${falta.map((m) => {
          const r = repor(m);
          return `<tr>
            <td><strong>${esc(m.nome)}</strong><div class="pequeno t3">${esc(m.categoria)}</div></td>
            <td class="pequeno t2">${esc(m.apresentacao || '—')}</td>
            <td class="n num erro-c">${fmt.num(m.estoque)} <span class="t3">${esc(unidadeDe(m))}</span></td>
            <td class="n num t3">${fmt.num(m.estoque_minimo)}</td>
            <td class="n num"><strong>${r.caixas}</strong> <span class="t3 pequeno">emb.</span></td>
            <td class="n num t2">${fmt.brl(r.custo)}</td>
          </tr>`;
        }).join('')}
        </tbody></table></div>`
        : `<div class="aviso ok">${ico('check')}<div>Nenhum insumo abaixo do mínimo. Estoque em dia.</div></div>
           <p class="pequeno t3 mt">Dica: defina o estoque mínimo de cada item em <strong>Itens e saldo</strong>
           para o app avisar antes de acabar.</p>`}
    </div>`;

  alvo.querySelector('#copiar')?.addEventListener('click', () => {
    const txt = 'Lista de compras — Alento\n\n' + falta.map((m) => {
      const r = repor(m);
      return `• ${m.nome} (${m.apresentacao || '—'}) — ${r.caixas} embalagem(ns)`;
    }).join('\n');
    navigator.clipboard.writeText(txt).then(() => avisar('Lista copiada'));
  });
}

// ─── Ficha técnica ─────────────────────────────────────────────────────────
function abaFicha(alvo) {
  const servicos = db.estado.servicos.filter((s) => s.ativo !== false);

  alvo.innerHTML = `
    <div class="cartao">
      <div class="cartao-cabeca">${ico('tabela')}<h3>Ficha técnica dos serviços</h3></div>
      <div class="aviso mb">${ico('info')}<div>
        Diga quanto de cada insumo sai em cada serviço, <strong>na unidade de uso</strong> —
        10 ml de álcool, 0,5 g de base gel, 1 par de luvas. O app já sabe o preço por ml, por
        grama e por unidade, então ele calcula o custo sozinho. A partir daí, fechar uma
        comanda <strong>baixa o estoque</strong> e o custo do serviço passa a ser o custo real,
        não uma estimativa.
        <br><br>Os serviços mais feitos já vêm com uma <strong>ficha de rascunho</strong>:
        quantidades de mercado para você corrigir com o que realmente gasta. Abra, ajuste e
        salve — ao salvar, o custo do serviço passa a ser o da ficha.</div></div>

      <div class="tabela-wrap"><table><thead><tr>
        <th>Serviço</th><th class="n">Preço</th><th>Insumos na ficha</th>
        <th class="n">Custo pela ficha</th><th class="n">Custo cadastrado</th><th></th>
      </tr></thead><tbody>
      ${servicos.map((s) => {
        const f = db.estado.ficha_tecnica.filter((x) => x.servico_id === s.id);
        const custoFicha = custoDaFicha(f);
        return `<tr>
          <td><strong>${esc(s.nome)}</strong></td>
          <td class="n num t2">${fmt.brl(s.preco)}</td>
          <td class="pequeno t2">${f.length ? f.length + ' insumo(s)' : '<span class="t3">—</span>'}</td>
          <td class="n num">${f.length ? fmt.brl(custoFicha) : '—'}</td>
          <td class="n num t2">${fmt.brl(s.custo)}
            ${f.length && Math.abs(custoFicha - Number(s.custo)) > 0.5
              ? `<div class="pequeno ${custoFicha > s.custo ? 'erro-c' : 'ok-c'}">
                   ${custoFicha > s.custo ? '+' : '−'} ${fmt.brl(Math.abs(custoFicha - Number(s.custo)))} pela ficha</div>`
              : ''}</td>
          <td style="width:40px"><button class="btn-icone" data-ficha="${s.id}">${ico('editar')}</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    </div>`;

  alvo.querySelectorAll('[data-ficha]').forEach((b) => b.onclick = () => abrirFicha(b.dataset.ficha));
}

function abrirFicha(servicoId) {
  const s = db.estado.servicos.find((x) => x.id === servicoId);
  let linhas = db.estado.ficha_tecnica.filter((f) => f.servico_id === servicoId).map((f) => ({ ...f }));
  const removidos = [];

  abrirModal({
    largo: true,
    titulo: 'Ficha técnica — ' + s.nome,
    corpo: `
      <div class="flex mb" style="gap:8px">
        <select id="add-mat" class="crescer">
          <option value="">Adicionar insumo…</option>
          ${categoriasMateriais()}
        </select>
      </div>
      <div id="linhas"></div>
      <div id="resumo-ficha" class="mt"></div>`,
    acoes: [
      { texto: 'Salvar ficha', classe: 'btn-primario', onClick: async (fechar) => {
          for (const id of removidos) await db.remover('ficha_tecnica', id);
          await db.salvarLote('ficha_tecnica', linhas.filter((l) => Number(l.qtd) > 0));
          const custo = custoDaFicha(linhas);
          if (custo > 0) await db.salvar('servicos', { ...s, custo: Number(custo.toFixed(2)) });
          fechar();
          avisar('Ficha salva — custo do serviço atualizado');
        } },
    ],
    aoAbrir: (veu) => {
      const pintar = () => {
        const alvo = veu.querySelector('#linhas');
        alvo.innerHTML = linhas.length ? `<div class="tabela-wrap"><table><thead><tr>
            <th>Insumo</th><th style="width:150px">Gasto por atendimento</th>
            <th class="n" style="width:110px">Custo</th><th style="width:34px"></th>
          </tr></thead><tbody>
          ${linhas.map((l, i) => {
            const m = db.estado.materiais.find((x) => x.id === l.material_id);
            return `<tr>
              <td>${esc(m?.nome || l.material_id)}
                <div class="pequeno t3">${esc(m?.apresentacao || '')} ·
                  ${fmt.brl(custoUnitario(m))} por ${esc(unidadeDe(m))}</div></td>
              <td><div class="flex" style="gap:6px">
                <input type="number" min="0" step="0.01" value="${l.qtd}" data-i="${i}">
                <span class="t3 pequeno">${esc(unidadeDe(m))}</span></div></td>
              <td class="n num">${fmt.brl(custoDeUso(m, l.qtd))}</td>
              <td><button class="btn-icone" data-rm="${i}">${ico('fechar')}</button></td>
            </tr>`;
          }).join('')}
        </tbody></table></div>` : `<div class="aviso">${ico('info')}<div>Nenhum insumo na ficha ainda.</div></div>`;

        alvo.querySelectorAll('input[data-i]').forEach((inp) => inp.onchange = () => {
          linhas[+inp.dataset.i].qtd = Number(inp.value) || 0; pintar();
        });
        alvo.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => {
          const l = linhas.splice(+b.dataset.rm, 1)[0];
          if (l.id && db.estado.ficha_tecnica.some((f) => f.id === l.id)) removidos.push(l.id);
          pintar();
        });

        const custo = custoDaFicha(linhas);
        veu.querySelector('#resumo-ficha').innerHTML = `
          <div class="cartao" style="background:var(--fundo);padding:14px">
            <div class="flex-entre"><span class="t2">Custo de material pela ficha</span>
              <strong class="num">${fmt.brl(custo)}</strong></div>
            <div class="flex-entre"><span class="t2">Custo cadastrado hoje</span>
              <span class="num t2">${fmt.brl(s.custo)}</span></div>
            <p class="pequeno t3 mt">Ao salvar, o custo do serviço passa a ser o da ficha.</p>
          </div>`;
      };

      veu.querySelector('#add-mat').onchange = (e) => {
        const id = e.target.value; e.target.value = '';
        if (!id || linhas.some((l) => l.material_id === id)) return;
        linhas.push({ servico_id: servicoId, material_id: id, qtd: 1 });
        pintar();
      };
      pintar();
    },
  });
}

function custoDaFicha(linhas) {
  return linhas.reduce((acc, l) => {
    const m = db.estado.materiais.find((y) => y.id === l.material_id);
    return acc + custoDeUso(m, l.qtd);
  }, 0);
}

function categoriasMateriais() {
  const grupos = new Map();
  for (const m of db.estado.materiais) {
    if (!grupos.has(m.categoria)) grupos.set(m.categoria, []);
    grupos.get(m.categoria).push(m);
  }
  return [...grupos.entries()].map(([c, l]) => `<optgroup label="${esc(c)}">
    ${l.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</optgroup>`).join('');
}

// ─── Movimentos ────────────────────────────────────────────────────────────
function abaMov(alvo) {
  const movs = db.estado.estoque_mov.slice(0, 200);
  const mats = new Map(db.estado.materiais.map((m) => [m.id, m]));
  const rotulo = { entrada: ['Entrada', 'ok'], saida: ['Saída', ''], ajuste: ['Ajuste', 'alerta'], perda: ['Perda', 'erro'] };

  alvo.innerHTML = `
    <div class="cartao">
      <div class="cartao-cabeca">${ico('relogio')}<h3>Últimos movimentos</h3>
        <button class="btn btn-primario btn-sm" id="novo-mov">${ico('mais')}Lançar</button></div>
      ${movs.length ? `<div class="tabela-wrap"><table><thead><tr>
          <th>Quando</th><th>Insumo</th><th>Tipo</th><th class="n">Qtd</th><th>Motivo</th>
        </tr></thead><tbody>
        ${movs.map((v) => {
          const [txt, cls] = rotulo[v.tipo] || [v.tipo, ''];
          return `<tr>
            <td class="pequeno t2 num">${fmt.data(v.criado_em)}</td>
            <td>${esc(mats.get(v.material_id)?.nome || v.material_id)}</td>
            <td><span class="selo ${cls}">${txt}</span></td>
            <td class="n num">${v.tipo === 'entrada' ? '+' : '−'}${fmt.num(Math.abs(v.qtd))}</td>
            <td class="pequeno t2">${esc(v.motivo || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>` : vazio('Nenhum movimento registrado ainda.')}
    </div>`;

  alvo.querySelector('#novo-mov').onclick = () => abrirMovimento();
}

// ─── Modais ────────────────────────────────────────────────────────────────
export function abrirMovimento(materialId) {
  abrirModal({
    titulo: 'Movimentar estoque',
    corpo: `
      <label class="campo"><span>Insumo</span>
        <select name="material_id">${categoriasMateriais()}</select></label>
      <label class="campo"><span>Tipo</span>
        <select name="tipo">
          <option value="entrada">Entrada — compra</option>
          <option value="saida">Saída — uso manual</option>
          <option value="perda">Perda / quebra</option>
          <option value="ajuste">Ajuste — contagem</option>
        </select></label>
      <div class="linha-campos">
        <label class="campo"><span>Quantidade</span>
          <input type="number" name="qtd" min="0" step="0.01" value="1"></label>
        <label class="campo"><span>Contando em</span>
          <select name="medida">
            <option value="emb">embalagens</option>
            <option value="uso">unidade de uso</option>
          </select></label>
        <label class="campo"><span>Valor pago por embalagem</span>
          <input type="number" name="custo_unit" min="0" step="0.01" placeholder="opcional">
          <span class="dica t3">Preenchendo, o preço do insumo passa a ser este.</span></label>
      </div>
      <label class="campo"><span>Motivo</span>
        <input name="motivo" placeholder="Ex.: compra no fornecedor X"></label>
      <div class="aviso" id="previa"></div>`,
    acoes: [
      { texto: 'Lançar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          const m = db.estado.materiais.find((x) => x.id === d.material_id);
          if (!m || !d.qtd) return avisar('Escolha o insumo e a quantidade', 'erro');

          const atual = Number(m.estoque) || 0;
          const q = emUso(m, d);
          const novo = d.tipo === 'entrada' ? atual + q
                     : d.tipo === 'ajuste' ? q
                     : atual - q;

          const patch = { ...m, estoque: novo };
          if (d.custo_unit) patch.preco_pago = Number(d.custo_unit);
          await db.salvar('materiais', patch);
          await db.salvar('estoque_mov', {
            material_id: m.id, tipo: d.tipo, qtd: q, custo_unit: d.custo_unit || null,
            motivo: d.motivo || null, profissional_id: db.eu?.id || null,
            criado_em: new Date().toISOString(),
          });

          // Compra é dinheiro que sai: entra no caixa automaticamente.
          if (d.tipo === 'entrada' && d.custo_unit) {
            const emb = Number(m.qtd_embalagem) || 1;
            const caixas = d.medida === 'emb' ? Number(d.qtd) : Number(d.qtd) / emb;
            await db.salvar('caixa', {
              data: hoje(), tipo: 'saida', categoria: 'Materiais e insumos',
              descricao: `${m.nome} — ${fmt.num(caixas)} × ${fmt.brl(d.custo_unit)}`,
              valor: caixas * Number(d.custo_unit), profissional_id: db.eu?.id || null,
            });
          }

          fechar();
          avisar('Movimento registrado');
        } },
    ],
    aoAbrir: (veu) => {
      if (materialId) veu.querySelector('[name=material_id]').value = materialId;
      const previa = () => {
        const d = lerForm(veu);
        const m = db.estado.materiais.find((x) => x.id === d.material_id);
        if (!m) return;
        const un = unidadeDe(m);
        const atual = Number(m.estoque) || 0;
        const q = emUso(m, d);
        const novo = d.tipo === 'entrada' ? atual + q : d.tipo === 'ajuste' ? q : atual - q;
        veu.querySelector('#previa').innerHTML =
          `${ico('info')}<div>
            ${d.medida === 'emb' && Number(m.qtd_embalagem)
              ? `${fmt.num(d.qtd)} embalagem(ns) de ${esc(m.apresentacao || '')} = <strong>${fmt.num(q)} ${esc(un)}</strong>.<br>` : ''}
            Saldo de <strong>${esc(m.nome)}</strong>: ${fmt.num(atual)} → <strong>${fmt.num(novo)} ${esc(un)}</strong>
            ${novo < 0 ? '<span class="erro-c"> (ficará negativo)</span>' : ''}</div>`;
      };
      const ajustarMedida = () => {
        const tipo = veu.querySelector('[name=tipo]').value;
        veu.querySelector('[name=medida]').value = tipo === 'entrada' ? 'emb' : 'uso';
      };
      veu.querySelector('[name=tipo]').addEventListener('change', () => { ajustarMedida(); previa(); });
      veu.querySelectorAll('[name]').forEach((c) => { c.oninput = previa; c.onchange = previa; });
      ajustarMedida();
      previa();
    },
  });
}

export function abrirMaterial(id) {
  const m = id ? db.estado.materiais.find((x) => x.id === id) : { tipo: 'consumível', estoque: 0, estoque_minimo: 0, ativo: true };
  const cats = [...new Set(db.estado.materiais.map((x) => x.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  abrirModal({
    titulo: id ? m.nome : 'Novo insumo',
    corpo: `
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(m.nome || '')}" required></label>
      <div class="linha-campos">
        <label class="campo"><span>Categoria</span>
          <input name="categoria" list="cats-mat" value="${esc(m.categoria || '')}">
          <datalist id="cats-mat">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="campo"><span>Apresentação</span>
          <input name="apresentacao" value="${esc(m.apresentacao || '')}" placeholder="1 L, caixa 100 un…"></label>
        <label class="campo"><span>Tipo</span>
          <select name="tipo">
            ${['consumível', 'descartável', 'reutilizável', 'equipamento']
              .map((t) => `<option ${m.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Preço de referência</span>
          <input type="number" name="preco_ref" step="0.01" value="${m.preco_ref ?? ''}"></label>
        <label class="campo"><span>Preço que você paga</span>
          <input type="number" name="preco_pago" step="0.01" value="${m.preco_pago ?? ''}" placeholder="o valor real"></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Qtd da embalagem</span>
          <input type="number" name="qtd_embalagem" step="0.01" value="${m.qtd_embalagem ?? ''}" placeholder="ex.: 1000"></label>
        <label class="campo"><span>Unidade</span>
          <input name="unidade" value="${esc(m.unidade || '')}" placeholder="ml, g, un"></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Saldo atual</span>
          <input type="number" name="estoque" step="0.001" value="${m.estoque ?? 0}"></label>
        <label class="campo"><span>Estoque mínimo</span>
          <input type="number" name="estoque_minimo" step="0.001" value="${m.estoque_minimo ?? 0}">
          <span class="dica t3">Abaixo disso o app avisa.</span></label>
      </div>`,
    acoes: [
      ...(id ? [{ texto: ico('lixo'), classe: 'btn-perigo', onClick: async (fechar) => {
        if (await confirmar('Excluir insumo?', 'Ele sai também das fichas técnicas em que aparece.')) {
          for (const f of db.estado.ficha_tecnica.filter((x) => x.material_id === id)) {
            await db.remover('ficha_tecnica', f.id);
          }
          await db.remover('materiais', id); fechar(); avisar('Insumo excluído');
        }
      } }] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          if (!d.nome || !d.categoria) return avisar('Nome e categoria são obrigatórios', 'erro');
          await db.salvar('materiais', { ...m, ...d, id: m.id || slug(d.nome), ativo: true });
          fechar(); avisar('Insumo salvo');
        } },
    ],
  });
}

/** Converte a quantidade digitada para a unidade de uso do insumo. */
function emUso(material, d) {
  const q = Number(d.qtd) || 0;
  if (d.medida !== 'emb') return q;
  return q * (Number(material.qtd_embalagem) || 1);
}

function slug(s) {
  return chave(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6);
}
