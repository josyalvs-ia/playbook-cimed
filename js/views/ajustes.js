// AJUSTES — dados do studio, link do Trinks, equipe, backup e carga inicial.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, avisar, abrirModal, confirmar, lerForm } from '../ui.js';
import { abrirEquipe } from './comissoes.js';

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
        <label class="campo"><span>Link de agendamento no Trinks</span>
          <input name="trinks" value="${esc(s.trinks || '')}" placeholder="https://www.trinks.com/...">
          <span class="dica t3">É este link que o botão "Agendar" da página pública abre.
            Cole quando tiver em mãos.</span></label>
        <button class="btn btn-primario" id="salvar-studio">Salvar</button>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('clientes')}<h3>Quem usa o sistema</h3></div>
        <div class="tabela-wrap mb"><table><tbody>
          ${db.estado.profissionais.map((p) => `<tr>
            <td><div class="flex" style="gap:9px">
              <span class="avatar verde">${esc(p.nome[0].toUpperCase())}</span>
              <span><strong>${esc(p.nome)}</strong>
                <div class="pequeno t3">${p.user_id ? 'com acesso ao app' : 'sem login'} ·
                  ${fmt.pct(p.comissao_pct, 0)} de comissão</div></span>
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
