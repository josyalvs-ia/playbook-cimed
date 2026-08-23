// TABELA DE PREÇOS — o catálogo oficial, editável. É o que a vitrine mostra
// e o que a comanda oferece.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, avisar, abrirModal, confirmar, lerForm, chave, vazio } from '../ui.js';
import { REGRAS } from '../data/servicos.js';
import { precoTecnico } from '../pricing.js';
import { premissas } from '../metricas.js';

export function render(raiz) {
  const cats = db.cfg('categorias') || [];
  const p = premissas();
  const servicos = db.estado.servicos.filter((s) => s.tipo !== 'adicional');
  const adicionais = db.estado.servicos.filter((s) => s.tipo === 'adicional');

  const porCat = new Map();
  for (const s of servicos) {
    if (!porCat.has(s.categoria)) porCat.set(s.categoria, []);
    porCat.get(s.categoria).push(s);
  }
  const nomeCat = (id) => cats.find((c) => c.id === id)?.nome || id;

  raiz.innerHTML = `
    <div class="flex-entre mb envolve">
      <p class="t2 pequeno" style="max-width:520px">
        Esta é a tabela oficial do studio. Alterar aqui muda o preço na comanda
        e na página pública ao mesmo tempo.</p>
      <div class="flex" style="gap:8px">
        <button class="btn btn-sm" id="ver-vitrine">${ico('tabela')}Ver página pública</button>
        <button class="btn btn-primario btn-sm" id="novo">${ico('mais')}Serviço</button>
      </div>
    </div>

    ${servicos.length ? [...porCat.entries()].map(([cat, lista]) => `
      <div class="cartao mb">
        <div class="cartao-cabeca">${estrela()}<h3>${esc(nomeCat(cat))}</h3>
          <span class="t3 pequeno">${lista.length} serviço(s)</span></div>
        <div class="tabela-wrap"><table><thead><tr>
          <th>Serviço</th><th class="n">Preço</th><th class="n">Material</th>
          <th class="n">Tempo</th><th class="n">Piso técnico</th><th>Situação</th><th></th>
        </tr></thead><tbody>
        ${lista.map((s) => {
          const r = precoTecnico(s, p);
          return `<tr>
            <td><strong>${esc(s.nome)}</strong>
              ${s.estimado ? '<span class="selo" title="custo e tempo estimados — confira">estimado</span>' : ''}
              ${s.nota ? `<div class="pequeno t3">${esc(s.nota)}</div>` : ''}</td>
            <td class="n num"><strong>${fmt.brl(s.preco)}</strong></td>
            <td class="n num t2">${fmt.brl(s.custo)}</td>
            <td class="n num t2">${fmt.horas(s.tempo)}</td>
            <td class="n num t2">${fmt.brl(r.tecnico)}</td>
            <td>${r.abaixoDoPiso
              ? `<span class="selo erro">${fmt.brl(-r.diferenca)} abaixo</span>`
              : `<span class="selo ok">ok</span>`}</td>
            <td style="width:34px"><button class="btn-icone" data-serv="${s.id}">${ico('editar')}</button></td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
      </div>`).join('')
      : vazio('Nenhum serviço cadastrado.', '<button class="btn btn-primario" id="novo2">Cadastrar</button>')}

    ${adicionais.length ? `
      <div class="cartao mb">
        <div class="cartao-cabeca">${estrela()}<h3>Adicionais</h3></div>
        <div class="tabela-wrap"><table><tbody>
          ${adicionais.map((s) => `<tr>
            <td><strong>${esc(s.nome)}</strong>
              ${s.unidade ? `<span class="t3 pequeno"> · ${esc(s.unidade)}</span>` : ''}</td>
            <td class="n num"><strong>+ ${fmt.brl(s.preco)}</strong></td>
            <td style="width:34px"><button class="btn-icone" data-serv="${s.id}">${ico('editar')}</button></td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>` : ''}

    <div class="cartao">
      <div class="cartao-cabeca">${ico('info')}<h3>Regras da tabela</h3></div>
      <div class="grade c3">
        ${REGRAS.map((r) => `<div>
          <div class="rotulo mb">${esc(r.titulo)}</div>
          <ul style="list-style:none;font-size:13.5px" class="t2">
            ${r.itens.map((i) => `<li style="padding-left:14px;position:relative;margin-bottom:7px">
              <span style="position:absolute;left:0;opacity:.5">·</span>${esc(i)}</li>`).join('')}
          </ul></div>`).join('')}
      </div>
    </div>`;

  raiz.querySelector('#ver-vitrine').onclick = () => window.open('vitrine.html', '_blank');
  raiz.querySelector('#novo').onclick = () => abrirServico();
  raiz.querySelector('#novo2')?.addEventListener('click', () => abrirServico());
  raiz.querySelectorAll('[data-serv]').forEach((b) => b.onclick = () => abrirServico(b.dataset.serv));
}

export function abrirServico(id) {
  const cats = db.cfg('categorias') || [];
  const s = id ? db.estado.servicos.find((x) => x.id === id)
              : { tipo: 'servico', categoria: cats[0]?.id || 'maos', ativo: true, preco: 0, custo: 0, tempo: 1 };
  const p = premissas();

  abrirModal({
    titulo: id ? s.nome : 'Novo serviço',
    corpo: `
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(s.nome || '')}" required></label>
      <div class="linha-campos">
        <label class="campo"><span>Categoria</span>
          <select name="categoria">
            ${cats.map((c) => `<option value="${c.id}" ${s.categoria === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
            <option value="adicionais" ${s.categoria === 'adicionais' ? 'selected' : ''}>Adicionais</option>
          </select></label>
        <label class="campo"><span>Tipo</span>
          <select name="tipo">
            <option value="servico" ${s.tipo === 'servico' ? 'selected' : ''}>Serviço</option>
            <option value="adicional" ${s.tipo === 'adicional' ? 'selected' : ''}>Adicional</option>
          </select></label>
        <label class="campo"><span>Quem faz</span>
          <select name="profissional">
            <option value="unhas" ${s.profissional === 'unhas' ? 'selected' : ''}>Unhas</option>
            <option value="cabelo" ${s.profissional === 'cabelo' ? 'selected' : ''}>Cabelos</option>
            <option value="ambos" ${s.profissional === 'ambos' ? 'selected' : ''}>Qualquer uma</option>
          </select></label>
      </div>
      <div class="linha-campos">
        <label class="campo"><span>Preço cobrado</span>
          <input type="number" name="preco" step="0.01" min="0" value="${s.preco ?? 0}"></label>
        <label class="campo"><span>Custo de material</span>
          <input type="number" name="custo" step="0.01" min="0" value="${s.custo ?? 0}"></label>
        <label class="campo"><span>Tempo (horas)</span>
          <input type="number" name="tempo" step="0.05" min="0" value="${s.tempo ?? 0}"></label>
      </div>
      <label class="campo"><span>Observação</span>
        <input name="nota" value="${esc(s.nota || '')}" placeholder="aparece na tabela pública"></label>
      <div id="previa-preco"></div>`,
    acoes: [
      ...(id ? [{ texto: ico('lixo'), classe: 'btn-perigo', onClick: async (f) => {
        if (await confirmar('Excluir serviço?', 'Comandas antigas mantêm o nome e o valor cobrados na época.')) {
          await db.remover('servicos', id); f(); avisar('Serviço excluído');
        }
      } }] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
          const d = lerForm(veu);
          if (!d.nome) return avisar('Informe o nome', 'erro');
          await db.salvar('servicos', {
            ...s, ...d,
            id: s.id || chave(d.nome).replace(/[^a-z0-9]+/g, '-').slice(0, 50),
            ativo: true, estimado: false,
          });
          fechar(); avisar('Serviço salvo');
        } },
    ],
    aoAbrir: (veu) => {
      const previa = () => {
        const d = lerForm(veu);
        const r = precoTecnico(d, p, { adicional: d.tipo === 'adicional' });
        veu.querySelector('#previa-preco').innerHTML = `
          <div class="cartao" style="background:var(--fundo);padding:14px">
            <div class="flex-entre pequeno t2"><span>Material</span><span class="num">${fmt.brl(r.material)}</span></div>
            <div class="flex-entre pequeno t2"><span>Custo fixo do atendimento</span><span class="num">${fmt.brl(r.fixo)}</span></div>
            <div class="flex-entre pequeno t2"><span>Seu tempo</span><span class="num">${fmt.brl(r.mao)}</span></div>
            <div class="flex-entre pequeno t2"><span>Taxa + imposto + margem</span>
              <span class="num">${fmt.brl(r.taxaCartao + r.imposto + r.lucro)}</span></div>
            <div class="flex-entre" style="margin-top:9px;padding-top:9px;border-top:1px solid var(--linha)">
              <strong>Piso técnico</strong><strong class="num display" style="font-size:20px">${fmt.brl(r.tecnico)}</strong>
            </div>
            ${r.abaixoDoPiso
              ? `<div class="aviso erro mt">${ico('alerta')}<div>Cobrando ${fmt.brl(-r.diferenca)} a menos que o piso. Sugestão: ${fmt.brl(r.minimo)}.</div></div>`
              : `<div class="aviso ok mt">${ico('check')}<div>Preço saudável — ${fmt.brl(r.diferenca)} acima do piso.</div></div>`}
          </div>`;
      };
      veu.querySelectorAll('[name]').forEach((c) => { c.oninput = previa; c.onchange = previa; });
      previa();
    },
  });
}
