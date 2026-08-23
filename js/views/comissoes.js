// COMISSÕES — quanto cada profissional produziu e quanto tem a receber.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, mesAtual, avisar, abrirModal, confirmar, lerForm, vazio, hoje,
         retrato, fotoReduzida } from '../ui.js';
import * as M from '../metricas.js';
import { baixarCSV } from './precificacao.js';

let mes = mesAtual();

export function render(raiz) {
  const de = mes + '-01';
  const ate = fimDoMes(mes);
  const p = M.premissas();
  // Comissão é de quem atende. Quem só administra o studio não entra aqui.
  const fechamentos = db.estado.profissionais
    .filter((x) => x.ativo !== false && x.atende !== false)
    .map((x) => M.fechamentoProfissional(x, { de, ate }, p));

  const totalBruto = fechamentos.reduce((s, f) => s + f.bruto, 0);
  const totalComissao = fechamentos.reduce((s, f) => s + f.comissao, 0);

  raiz.innerHTML = `
    <div class="flex-entre mb envolve">
      <input type="month" id="mes" value="${mes}" style="width:auto">
      <div class="flex" style="gap:8px">
        <button class="btn btn-sm" id="exportar">${ico('baixar')}Exportar</button>
        <button class="btn btn-sm" id="equipe">${ico('clientes')}Equipe</button>
      </div>
    </div>

    <div class="grade c3 mb">
      <div class="kpi destaque"><div class="rotulo">Faturamento do mês</div>
        <div class="valor">${fmt.brlCurto(totalBruto)}</div></div>
      <div class="kpi"><div class="rotulo">Comissões do mês</div>
        <div class="valor">${fmt.brlCurto(totalComissao)}</div></div>
      <div class="kpi"><div class="rotulo">Fica no studio</div>
        <div class="valor">${fmt.brlCurto(totalBruto - totalComissao)}</div>
        <div class="nota">antes de custos fixos e impostos</div></div>
    </div>

    ${fechamentos.length ? `<div class="grade c2">
      ${fechamentos.map((f) => `
        <div class="cartao">
          <div class="cartao-cabeca">
            ${retrato(f.profissional, { tam: 46 })}
            <div class="crescer">
              <h3>${esc(f.profissional.nome)}</h3>
              <div class="pequeno t3">${fmt.pct(f.profissional.comissao_pct, 0)} de comissão ·
                ${f.profissional.funcao === 'cabelo' ? 'Cabelos' : f.profissional.funcao === 'ambos' ? 'Unhas e cabelos' : 'Unhas'}</div>
            </div>
          </div>

          <div class="grade c2 mb">
            <div><div class="rotulo">Produziu</div>
              <div class="display num" style="font-size:24px">${fmt.brl(f.bruto)}</div>
              <div class="pequeno t3">${f.atendimentos} atendimento(s) · ${fmt.horas(f.tempo)}</div></div>
            <div><div class="rotulo">A receber</div>
              <div class="display num ${f.aReceber > 0 ? 'alerta-c' : 'ok-c'}" style="font-size:24px">${fmt.brl(f.aReceber)}</div>
              <div class="pequeno t3">${fmt.brl(f.pagos)} já retirado</div></div>
          </div>

          <div class="pequeno t2" style="border-top:1px solid var(--linha);padding-top:11px">
            <div class="flex-entre"><span>Comissão calculada</span><span class="num">${fmt.brl(f.comissao)}</span></div>
            <div class="flex-entre"><span>Ticket médio</span><span class="num">${fmt.brl(f.ticket)}</span></div>
            <div class="flex-entre"><span>Por hora de cadeira</span><span class="num">${f.tempo ? fmt.brl(f.bruto / f.tempo) : '—'}</span></div>
            <div class="flex-entre"><span>Material consumido</span><span class="num">${fmt.brl(f.material)}</span></div>
          </div>

          <button class="btn btn-primario btn-bloco mt" data-pagar="${f.profissional.id}"
            ${f.aReceber <= 0 ? 'disabled' : ''}>Registrar retirada de ${fmt.brl(Math.max(0, f.aReceber))}</button>
        </div>`).join('')}
    </div>` : vazio('Nenhuma profissional cadastrada.')}

    <div class="cartao mt">
      <div class="cartao-cabeca">${ico('info')}<h3>Como a comissão é calculada</h3></div>
      <p class="t2 pequeno">Cada item da comanda gera comissão pelo percentual da profissional
      (ou pelo percentual do próprio item, quando definido). Desconto dado na comanda reduz a
      base proporcionalmente. As retiradas já feitas aparecem no caixa como
      <strong>Comissão/retirada</strong> e são abatidas do valor a receber.</p>
    </div>`;

  raiz.querySelector('#mes').onchange = (e) => { mes = e.target.value; render(raiz); };
  raiz.querySelector('#equipe').onclick = () => abrirEquipe();
  raiz.querySelectorAll('[data-pagar]').forEach((b) => b.onclick = () => {
    const f = fechamentos.find((x) => x.profissional.id === b.dataset.pagar);
    registrarRetirada(f);
  });
  raiz.querySelector('#exportar').onclick = () => {
    baixarCSV(`comissoes-${mes}.csv`, [
      ['Profissional', 'Atendimentos', 'Faturamento', 'Ticket médio', 'Horas', 'Comissão', 'Retirado', 'A receber'],
      ...fechamentos.map((f) => [f.profissional.nome, f.atendimentos, f.bruto.toFixed(2),
        f.ticket.toFixed(2), f.tempo.toFixed(2), f.comissao.toFixed(2), f.pagos.toFixed(2), f.aReceber.toFixed(2)]),
    ]);
  };
}

function registrarRetirada(f) {
  abrirModal({
    titulo: 'Retirada — ' + f.profissional.nome,
    corpo: `
      <p class="t2 pequeno mb">Isso lança uma saída no caixa e abate do valor a receber.</p>
      <div class="linha-campos">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${hoje()}"></label>
        <label class="campo"><span>Valor</span>
          <input type="number" name="valor" step="0.01" value="${f.aReceber.toFixed(2)}"></label>
      </div>
      <label class="campo"><span>Observação</span>
        <input name="descricao" value="Comissão ${mes}"></label>`,
    acoes: [{ texto: 'Registrar', classe: 'btn-primario', onClick: async (fechar, veu) => {
      const d = lerForm(veu);
      if (!d.valor || d.valor <= 0) return avisar('Informe o valor', 'erro');
      await db.salvar('caixa', {
        data: d.data, tipo: 'saida', categoria: 'Comissão/retirada',
        descricao: d.descricao, valor: d.valor, profissional_id: f.profissional.id,
      });
      fechar(); avisar('Retirada registrada');
    } }],
  });
}

export function abrirEquipe() {
  abrirModal({
    largo: true,
    titulo: 'Equipe do studio',
    corpo: `
      <div class="tabela-wrap"><table><thead><tr>
        <th>Nome</th><th>Função</th><th class="n">Comissão</th><th>Acesso</th><th></th>
      </tr></thead><tbody>
      ${db.estado.profissionais.map((p) => `<tr>
        <td><div class="flex" style="gap:9px">
          ${retrato(p, { tam: 38 })}
          <span><strong>${esc(p.nome)}</strong>
            ${p.user_id
              ? '<div class="pequeno t3">acessa o app</div>'
              : '<div class="pequeno alerta-c">sem login — pode ser sobra de uma conta apagada</div>'}</span>
        </div></td>
        <td class="pequeno t2">${p.atende === false
          ? '<span class="t3">não atende</span>'
          : (p.funcao === 'cabelo' ? 'Cabelos' : p.funcao === 'ambos' ? 'Unhas e cabelos' : 'Unhas')}</td>
        <td class="n num">${fmt.pct(p.comissao_pct, 0)}</td>
        <td>${p.ativo === false
          ? '<span class="selo erro">sem acesso</span>'
          : '<span class="selo ok">ativa</span>'}</td>
        <td style="width:34px"><button class="btn-icone" data-prof="${p.id}">${ico('editar')}</button></td>
      </tr>`).join('')}
      </tbody></table></div>
      <div class="aviso mt">${ico('info')}<div>
        Para dar acesso a alguém, convide o e-mail dela em
        <strong>Supabase → Authentication → Users → Invite user</strong>.
        O cadastro aqui é criado sozinho no primeiro login.</div></div>`,
    acoes: [{ texto: 'Adicionar profissional', classe: 'btn-fantasma', onClick: (f) => { f(); abrirProfissional(); } }],
    aoAbrir: (veu) => veu.querySelectorAll('[data-prof]').forEach((b) =>
      b.onclick = () => abrirProfissional(b.dataset.prof)),
  });
}

export function abrirProfissional(id) {
  const p = id ? db.estado.profissionais.find((x) => x.id === id)
              : { funcao: 'unhas', comissao_pct: 0.5, ativo: true, atende: true };
  let foto = p.foto || null;

  abrirModal({
    titulo: id ? p.nome : 'Nova profissional',
    corpo: `
      <div class="foto-campo">
        <div id="foto-previa">${retrato({ ...p, foto }, { tam: 92 })}</div>
        <div class="crescer">
          <div class="rotulo" style="margin-bottom:6px">Foto</div>
          <p class="pequeno t3" style="margin-bottom:9px">Aparece no canto de quem está
            usando o sistema e para a cliente na hora de escolher com quem marcar.</p>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <label class="btn btn-sm" style="cursor:pointer">${ico('subir')} Escolher foto
              <input type="file" id="foto-arquivo" accept="image/*" hidden></label>
            <button class="btn btn-sm btn-fantasma" id="foto-tirar"
              ${foto ? '' : 'hidden'}>Tirar foto</button>
          </div>
        </div>
      </div>
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(p.nome || '')}" required></label>
      <label class="campo"><span>Como se apresenta para a cliente</span>
        <input name="bio" value="${esc(p.bio || '')}" maxlength="90"
               placeholder="Nails designer. Alongamento em gel e blindagem.">
        <span class="dica t3">Uma linha curta, que aparece embaixo do nome no site
          das clientes.</span></label>
      <div class="linha-campos">
        <label class="campo"><span>Função</span>
          <select name="funcao">
            <option value="unhas" ${p.funcao === 'unhas' ? 'selected' : ''}>Unhas</option>
            <option value="cabelo" ${p.funcao === 'cabelo' ? 'selected' : ''}>Cabelos</option>
            <option value="ambos" ${p.funcao === 'ambos' ? 'selected' : ''}>Unhas e cabelos</option>
          </select></label>
        <label class="campo"><span>Comissão (%)</span>
          <input type="number" name="pct" step="1" min="0" max="100" value="${Math.round((p.comissao_pct ?? 0) * 100)}"></label>
      </div>
      <label class="check"><input type="checkbox" name="ativo" ${p.ativo !== false ? 'checked' : ''}>
        <span>Pode usar o sistema
          <div class="pequeno t3">Desmarcado, a conta continua existindo mas não enxerga nada do studio.</div>
        </span></label>
      <label class="check"><input type="checkbox" name="atende" ${p.atende !== false ? 'checked' : ''}>
        <span>Atende clientes
          <div class="pequeno t3">Desmarcado, some dos atendimentos e das comissões, mas continua
            com acesso ao sistema. É o caso de quem só administra.</div>
        </span></label>`,
    aoAbrir: (veu) => {
      const previa = veu.querySelector('#foto-previa');
      const tirar  = veu.querySelector('#foto-tirar');
      const pintar = () => {
        previa.innerHTML = retrato({ ...p, foto }, { tam: 92 });
        tirar.hidden = !foto;
      };
      veu.querySelector('#foto-arquivo').onchange = async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        try { foto = await fotoReduzida(arquivo); pintar(); }
        catch (err) { avisar(err.message, 'erro'); }
        e.target.value = '';
      };
      tirar.onclick = () => { foto = null; pintar(); };
    },
    acoes: [
      ...(id ? [{ texto: ico('lixo') + ' Excluir', classe: 'btn-perigo', onClick: async (fechar) => {
        const atendimentos = db.estado.comandas.filter((c) => c.profissional_id === id).length;
        const ok = await confirmar('Excluir cadastro?',
          atendimentos
            ? `Esta profissional tem ${atendimentos} atendimento(s) no histórico. Eles não somem, mas deixam de ter dono — o faturamento continua no caixa e nos relatórios do studio.`
            : 'Este cadastro não tem nenhum atendimento no histórico.');
        if (!ok) return;
        await db.remover('profissionais', id);
        fechar(); avisar('Cadastro excluído');
      } }] : []),
      { texto: 'Salvar', classe: 'btn-primario', onClick: async (fechar, veu) => {
        const d = lerForm(veu);
        if (!d.nome) return avisar('Informe o nome', 'erro');
        await db.salvar('profissionais', {
          ...p, nome: d.nome, funcao: d.funcao, bio: d.bio || null, foto,
          comissao_pct: (Number(d.pct) || 0) / 100,
          ativo: !!d.ativo, atende: !!d.atende,
        });
        fechar(); avisar('Profissional salva');
      } },
    ],
  });
}

function fimDoMes(m) {
  const [a, mm] = m.split('-').map(Number);
  return new Date(a, mm, 0).toISOString().slice(0, 10);
}
