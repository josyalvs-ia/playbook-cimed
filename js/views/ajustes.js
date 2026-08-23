// AJUSTES — dados do studio, link do Trinks, equipe, backup e carga inicial.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, avisar, abrirModal, confirmar, lerForm, retrato } from '../ui.js';
import { abrirEquipe } from './comissoes.js';
import { abrirBloqueio } from './agenda.js';

export function render(raiz) {
  const s = db.cfg('studio') || {};
  const cats = db.cfg('categorias_caixa') || { entrada: [], saida: [] };

  raiz.innerHTML = `
    <div class="grade c2">
      <div class="cartao">
        <div class="cartao-cabeca">${estrela()}<h3>O studio</h3></div>
        <label class="campo"><span>Nome</span><input name="nome" value="${esc(s.nome || 'Alento Studio de Beleza')}"></label>
        <div class="linha-campos">
          <label class="campo"><span>Instagram</span><input name="instagram" value="${esc(s.instagram || '')}" placeholder="@alentostudio"></label>
          <label class="campo"><span>WhatsApp</span><input name="whatsapp" value="${esc(s.whatsapp || '')}" placeholder="(11) 99999-9999"></label>
        </div>
        <label class="campo"><span>Endereço</span><input name="endereco" value="${esc(s.endereco || '')}" placeholder="Rua, número — Cidade/UF"></label>
        <label class="campo"><span>Link do Trinks (reserva)</span>
          <input name="trinks" value="${esc(s.trinks || '')}" placeholder="https://www.trinks.com/...">
          <span class="dica t3">O agendamento agora acontece no próprio site. Este link só é
            usado se o banco estiver fora do ar — deixe em branco se já saiu do Trinks.</span></label>
        <button class="btn btn-primario" id="salvar-studio">Salvar</button>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('clientes')}<h3>Quem usa o sistema</h3></div>
        <div class="tabela-wrap mb"><table><tbody>
          ${db.estado.profissionais.map((p) => `<tr>
            <td><div class="flex" style="gap:9px">
              ${retrato(p, { tam: 38 })}
              <span><strong>${esc(p.nome)}</strong>
                <div class="pequeno t3">${p.user_id ? 'com acesso ao app' : 'sem login'} ·
                  ${p.atende === false ? 'não atende clientes' : fmt.pct(p.comissao_pct, 0) + ' de comissão'}</div></span>
            </div></td>
          </tr>`).join('') || '<tr><td class="t3 pequeno">Ninguém cadastrado.</td></tr>'}
        </tbody></table></div>
        <button class="btn" id="equipe">Gerenciar equipe</button>
        <div class="aviso mt">${ico('info')}<div>
          Para dar acesso a mais alguém: <strong>Supabase → Authentication → Users →
          Invite user</strong>. Ela recebe o convite por e-mail e o cadastro aparece aqui
          sozinho no primeiro login.</div></div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('agenda')}<h3>Horário de funcionamento</h3></div>
        <p class="pequeno t2 mb">É isto que define os horários que a cliente vê no site.
          Dia sem horário marcado é dia fechado.</p>
        <div id="horarios-lista"></div>
        <div class="flex mt" style="gap:8px">
          <button class="btn btn-primario" id="salvar-horarios">Salvar horários</button>
          <button class="btn" id="folga">${ico('relogio')}Folga ou férias</button>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('caixa')}<h3>Categorias do caixa</h3></div>
        <label class="campo"><span>Entradas</span>
          <textarea id="cat-entrada" style="min-height:70px">${esc(cats.entrada.join('\n'))}</textarea>
          <span class="dica t3">Uma por linha.</span></label>
        <label class="campo"><span>Saídas</span>
          <textarea id="cat-saida" style="min-height:150px">${esc(cats.saida.join('\n'))}</textarea></label>
        <button class="btn btn-primario" id="salvar-cats">Salvar categorias</button>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('nuvem')}<h3>Dados e backup</h3></div>
        <div class="pequeno t2 mb">
          <div class="flex-entre"><span>Serviços</span><strong>${db.estado.servicos.length}</strong></div>
          <div class="flex-entre"><span>Insumos</span><strong>${db.estado.materiais.length}</strong></div>
          <div class="flex-entre"><span>Clientes</span><strong>${db.estado.clientes.length}</strong></div>
          <div class="flex-entre"><span>Atendimentos</span><strong>${db.estado.comandas.length}</strong></div>
          <div class="flex-entre"><span>Lançamentos no caixa</span><strong>${db.estado.caixa.length}</strong></div>
          <div class="flex-entre"><span>Aguardando sincronizar</span>
            <strong class="${db.pendentes() ? 'alerta-c' : ''}">${db.pendentes()}</strong></div>
        </div>
        <div class="flex envolve" style="gap:8px">
          <button class="btn" id="backup">${ico('baixar')}Baixar backup</button>
          <button class="btn" id="recarregar">${ico('nuvem')}Recarregar do servidor</button>
          <button class="btn" id="conferir-banco">${ico('check')}Conferir o banco</button>
          <button class="btn btn-fantasma" id="seed">Instalar dados iniciais</button>
        </div>
        <div class="aviso mt">${ico('info')}<div>
          O backup é um arquivo <code>.json</code> com tudo. Guarde uma cópia por mês:
          é o seu seguro contra qualquer imprevisto.</div></div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('ajustes')}<h3>Este aparelho</h3></div>
        <p class="pequeno t2 mb">Conectado em <code>${esc(db.lerConfig()?.url || '—')}</code></p>
        <div class="flex envolve" style="gap:8px">
          <button class="btn btn-fantasma" id="trocar">Trocar servidor</button>
          <button class="btn btn-perigo" id="sair">${ico('sair')}Sair da conta</button>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${estrela()}<h3>Sobre</h3></div>
        <p class="pequeno t2">Sistema do Alento Studio de Beleza. Precificação, estoque, caixa,
        clientes e comissão em um lugar só. Os agendamentos continuam no Trinks — a página
        pública leva as clientes direto para lá.</p>
        <p class="pequeno t3 mt">Identidade visual conforme o manual da marca.
        Tabela de valores conforme o PDF oficial. Custos e insumos conforme a planilha
        de precificação 2026.</p>
      </div>
    </div>`;

  raiz.querySelector('#salvar-studio').onclick = async () => {
    const d = lerForm(raiz.querySelector('#salvar-studio').closest('.cartao'));
    if (d.trinks && !/^https?:\/\//.test(d.trinks)) return avisar('O link do Trinks precisa começar com https://', 'erro');
    await db.setCfg('studio', { ...s, ...d });
    avisar('Dados do studio salvos');
  };

  raiz.querySelector('#salvar-cats').onclick = async () => {
    const lst = (id) => raiz.querySelector(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
    await db.setCfg('categorias_caixa', { entrada: lst('#cat-entrada'), saida: lst('#cat-saida') });
    avisar('Categorias salvas');
  };

  raiz.querySelector('#equipe').onclick = () => abrirEquipe();
  raiz.querySelector('#folga').onclick = () => abrirBloqueio();
  pintarHorarios(raiz);
  raiz.querySelector('#salvar-horarios').onclick = () => salvarHorarios(raiz);

  raiz.querySelector('#backup').onclick = () => {
    const dados = { gerado_em: new Date().toISOString(), ...db.estado };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `alento-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    avisar('Backup baixado');
  };

  // Em vez de deduzir pelo sintoma que o banco ficou para trás, pergunta.
  raiz.querySelector('#conferir-banco').onclick = async (e) => {
    const b = e.currentTarget;
    b.disabled = true; b.textContent = 'Conferindo…';
    const { faltando, erro } = await db.conferirBanco();
    b.disabled = false; b.innerHTML = ico('check') + 'Conferir o banco';

    if (erro) return avisar(erro, 'erro');

    abrirModal({
      titulo: faltando.length ? 'O banco está atrasado' : 'Banco em dia',
      corpo: faltando.length ? `
        <p class="t2 mb">Estas partes do sistema não vão funcionar até você rodar a
          atualização do banco. É o que faz a foto sumir no próximo login, por exemplo:
          o app salva no aparelho, o servidor recusa, e o que ficou só no celular
          desaparece.</p>
        <div class="tabela-wrap mb"><table><tbody>
          ${faltando.map((f) => `<tr>
            <td><strong>${esc(f.o_que)}</strong>
              <div class="pequeno t3">serve para ${esc(f.serve_para)}</div></td>
            <td class="n"><span class="selo erro">falta</span></td>
          </tr>`).join('')}
        </tbody></table></div>
        <div class="aviso">${ico('info')}<div>
          <strong>Como resolver, uma vez só:</strong><br>
          1. Abra o Supabase e vá em <strong>SQL Editor → New query</strong><br>
          2. Cole o conteúdo do arquivo <code>db/atualizar.sql</code> do repositório<br>
          3. Clique em <strong>Run</strong><br>
          4. Volte aqui e toque em <strong>Recarregar do servidor</strong>
        </div></div>`
        : `<div class="aviso ok">${ico('check')}<div>
            O banco tem tudo o que esta versão do sistema precisa. Se alguma coisa não
            estiver salvando, não é por aqui.</div></div>`,
    });
  };

  raiz.querySelector('#recarregar').onclick = async () => {
    await db.drenarFila();
    await db.recarregar();
    avisar('Dados atualizados');
  };

  raiz.querySelector('#seed').onclick = async () => {
    const forcar = await confirmar('Instalar dados iniciais',
      'Serviços e insumos que já existem são preservados. Quer também restaurar os que você alterou para o valor original da planilha?',
      'Sim, restaurar tudo', false);
    const s = await import('../seed.js');
    await s.instalar({ forcar });
  };

  raiz.querySelector('#trocar').onclick = async () => {
    if (await confirmar('Trocar servidor?', 'Você vai precisar colar a URL e a chave de novo neste aparelho.')) {
      localStorage.removeItem('alento.supabase');
      location.reload();
    }
  };

  raiz.querySelector('#sair').onclick = () => db.sair();
}


// ─── Horário de funcionamento ──────────────────────────────────────────────
const DIAS = [['1', 'Segunda'], ['2', 'Terça'], ['3', 'Quarta'], ['4', 'Quinta'],
              ['5', 'Sexta'], ['6', 'Sábado'], ['0', 'Domingo']];

function pintarHorarios(raiz) {
  const profs = db.estado.profissionais.filter((p) => p.atende !== false && p.ativo !== false);
  const alvo = raiz.querySelector('#horarios-lista');
  if (!alvo) return;

  if (!profs.length) {
    alvo.innerHTML = '<p class="t3 pequeno">Nenhuma profissional atendendo.</p>';
    return;
  }

  alvo.innerHTML = profs.map((p) => `
    <div style="margin-bottom:18px">
      <div class="rotulo mb">${esc(p.nome)}</div>
      <div class="tabela-wrap"><table><thead><tr>
        <th style="width:38px"></th><th>Dia</th><th>Abre</th><th>Fecha</th>
        <th>Almoço de</th><th>até</th>
      </tr></thead><tbody>
      ${DIAS.map(([d, nome]) => {
        const h = db.estado.horarios.find((x) => x.profissional_id === p.id && String(x.dia_semana) === d);
        const on = h && h.ativo !== false;
        return `<tr data-prof="${p.id}" data-dia="${d}">
          <td><input type="checkbox" data-campo="ativo" ${on ? 'checked' : ''}></td>
          <td>${nome}</td>
          <td><input type="time" data-campo="abre"  value="${h?.abre?.slice(0, 5) || '09:00'}" step="900"></td>
          <td><input type="time" data-campo="fecha" value="${h?.fecha?.slice(0, 5) || '19:00'}" step="900"></td>
          <td><input type="time" data-campo="pausa_inicio" value="${h?.pausa_inicio?.slice(0, 5) || ''}" step="900"></td>
          <td><input type="time" data-campo="pausa_fim"    value="${h?.pausa_fim?.slice(0, 5) || ''}" step="900"></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    </div>`).join('');
}

async function salvarHorarios(raiz) {
  const linhas = [...raiz.querySelectorAll('#horarios-lista tr[data-prof]')];
  const guardar = [];
  const apagar = [];

  for (const tr of linhas) {
    const prof = tr.dataset.prof;
    const dia = Number(tr.dataset.dia);
    const v = (c) => tr.querySelector(`[data-campo=${c}]`);
    const existente = db.estado.horarios.find(
      (x) => x.profissional_id === prof && x.dia_semana === dia);

    if (!v('ativo').checked) {
      if (existente) apagar.push(existente.id);
      continue;
    }
    const abre = v('abre').value, fecha = v('fecha').value;
    if (!abre || !fecha) continue;
    if (fecha <= abre) {
      return avisar(`${DIAS.find(([d]) => Number(d) === dia)[1]}: o fechamento precisa ser depois da abertura`, 'erro');
    }
    guardar.push({
      id: existente?.id, profissional_id: prof, dia_semana: dia,
      abre, fecha,
      pausa_inicio: v('pausa_inicio').value || null,
      pausa_fim: v('pausa_fim').value || null,
      ativo: true,
    });
  }

  for (const id of apagar) await db.remover('horarios', id);
  if (guardar.length) await db.salvarLote('horarios', guardar);
  avisar('Horários salvos');
}
