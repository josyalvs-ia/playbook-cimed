// AJUSTES — dados do studio, link do Trinks, equipe, backup e carga inicial.
import * as db from '../db.js';
import { ico, estrela, esc, fmt, avisar, abrirModal, confirmar, lerForm, retrato } from '../ui.js';
import { abrirEquipe } from './comissoes.js';
import { abrirBloqueio } from './agenda.js';
import { RECADO_PADRAO } from '../agendar.js';
import { REGRAS } from '../data/servicos.js';

/** Onde o site está publicado. Serve para a equipe achar os endereços sem
    ter de decorar nada — e sem cair no github.com, que é outro lugar. */
const BASE_PUBLICA = location.origin + location.pathname.replace(/[^/]*$/, '');

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
        <label class="campo"><span>Frase que fecha o agendamento</span>
          <input name="recado" value="${esc(s.recado || '')}"
                 placeholder="${esc(RECADO_PADRAO)}" maxlength="120">
          <span class="dica t3">É o que a cliente lê depois de marcar. Em branco, vale
            "${esc(RECADO_PADRAO)}". Cada profissional pode ter a sua própria, em
            Comissões &rarr; Equipe.</span></label>
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
          Dia sem horário marcado é dia fechado, e almoço em branco é dia sem
          pausa fixa — a cliente pode marcar em qualquer horário aberto.</p>
        <div id="horarios-lista"></div>
        <div class="flex mt" style="gap:8px">
          <button class="btn btn-primario" id="salvar-horarios">Salvar horários</button>
          <button class="btn" id="folga">${ico('relogio')}Folga ou férias</button>
        </div>
      </div>

      <!-- Procedimento entra e sai da tabela, e o aviso que vale hoje pode não
           valer no mês que vem. Elas editam sem depender de ninguém. -->
      <div class="cartao">
        <div class="cartao-cabeca">${ico('info')}<h3>Boas de saber</h3></div>
        <p class="pequeno t2 mb">Os avisos que aparecem no fim da página das clientes.
          Um assunto por bloco, um aviso por linha. Assunto sem nenhum aviso não
          aparece para a cliente.</p>
        <div id="regras-lista"></div>
        <div class="flex mt" style="gap:8px;flex-wrap:wrap">
          <button class="btn" id="mais-regra">${ico('mais')}Assunto</button>
          <button class="btn btn-primario" id="salvar-regras">Salvar avisos</button>
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
          <button class="btn" id="trocar-senha">${ico('ajustes')}Trocar minha senha</button>
          <button class="btn btn-fantasma" id="trocar">Trocar servidor</button>
          <button class="btn btn-perigo" id="sair">${ico('sair')}Sair da conta</button>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-cabeca">${ico('nuvem')}<h3>Os endereços do studio</h3></div>
        <p class="pequeno t2 mb">Toque para copiar. Todos começam com
          <code>josyalvs-ia.github.io</code> — se aparecer <code>github.com</code>,
          é o lugar onde o código mora, não o site.</p>
        <div class="enderecos">
          ${[
            ['Site das clientes', 'vitrine.html', 'O que vocês divulgam. Tabela de valores e agendamento.'],
            ['Sistema de vocês', '', 'Este aqui. Só para a equipe.'],
            ['Manual da marca', 'apresentacao-marca.html', 'Logo, cores, tipografia e voz, em 14 telas.'],
            ['Guia do domínio', 'guia-dominio.html', 'Passo a passo para comprar o alentoostudio.com.br.'],
            ['DNS do domínio', 'guia-dns.html', 'O que configurar no Registro.br para o domínio abrir o site.'],
          ].map(([nome, caminho, oque]) => {
            const url = BASE_PUBLICA + caminho;
            return `<button class="endereco" data-copiar="${esc(url)}">
              <span class="crescer">
                <strong>${esc(nome)}</strong>
                <span class="pequeno t3">${esc(oque)}</span>
                <span class="pequeno url">${esc(url.replace('https://', ''))}</span>
              </span>
              ${ico('baixar')}
            </button>`;
          }).join('')}
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

  // Senha que a pessoa não escolheu é senha que ela anota num papel.
  raiz.querySelectorAll('.endereco').forEach((b) => b.onclick = async () => {
    const url = b.dataset.copiar;
    try {
      await navigator.clipboard.writeText(url);
      avisar('Endereço copiado');
    } catch {
      // Sem permissão para a área de transferência: mostra para copiar à mão.
      abrirModal({ titulo: 'Endereço', corpo:
        `<p class="t2 pequeno mb">Selecione e copie:</p>
         <input value="${esc(url)}" readonly onclick="this.select()">` });
    }
  });

  raiz.querySelector('#trocar-senha').onclick = () => abrirModal({
    titulo: 'Trocar minha senha',
    corpo: `
      <p class="t2 pequeno mb">A nova senha vale a partir de agora, neste e em qualquer
        outro aparelho onde você entrar.</p>
      <label class="campo"><span>Nova senha</span>
        <input type="password" name="s1" autocomplete="new-password" required>
        <span class="dica t3">Pelo menos 8 caracteres.</span></label>
      <label class="campo"><span>Repita a nova senha</span>
        <input type="password" name="s2" autocomplete="new-password" required></label>`,
    acoes: [{ texto: 'Trocar senha', classe: 'btn-primario', onClick: async (fechar, veu) => {
      const d = lerForm(veu);
      if (d.s1 !== d.s2) return avisar('As duas senhas não são iguais', 'erro');
      try {
        await db.trocarSenha(d.s1);
        fechar();
        avisar('Senha trocada. É esta que você usa da próxima vez.');
      } catch (e) { avisar(e.message, 'erro'); }
    } }],
  });

  raiz.querySelector('#equipe').onclick = () => abrirEquipe();
  raiz.querySelector('#folga').onclick = () => abrirBloqueio();
  pintarHorarios(raiz);
  raiz.querySelectorAll('[data-sem-almoco]').forEach((b) => {
    b.onclick = () => {
      raiz.querySelectorAll(`#horarios-lista tr[data-prof="${b.dataset.semAlmoco}"]`)
        .forEach((tr) => tr.querySelectorAll('[data-campo^=pausa]').forEach((c) => { c.value = ''; }));
      avisar('Almoço limpo — toque em "Salvar horários" para valer');
    };
  });
  raiz.querySelector('#salvar-horarios').onclick = () => salvarHorarios(raiz);

  pintarRegras(raiz);
  raiz.querySelector('#mais-regra').onclick = () => {
    raiz.querySelector('#regras-lista')
      .insertAdjacentHTML('beforeend', blocoRegra({ titulo: '', itens: [] }));
    ligarRegras(raiz);
    raiz.querySelector('#regras-lista').lastElementChild.querySelector('[data-titulo]').focus();
  };
  raiz.querySelector('#salvar-regras').onclick = async () => {
    const s = db.cfg('studio') || {};
    const regras = [...raiz.querySelectorAll('#regras-lista .regra-bloco')]
      .map((b) => ({
        titulo: b.querySelector('[data-titulo]').value.trim(),
        itens: b.querySelector('[data-itens]').value.split('\n')
          .map((x) => x.trim()).filter(Boolean),
      }))
      .filter((r) => r.titulo && r.itens.length);
    await db.setCfg('studio', { ...s, regras });
    avisar(regras.length ? `${regras.length} assunto(s) salvo(s)` : 'Avisos removidos da página');
  };

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
      <!-- Almoço fixo não serve para todo mundo: quem faz cor e mecha almoça
           no intervalo que sobrar, não às 12h. Limpar hora a hora num celular
           é trabalhoso — daí o botão. -->
      <div class="flex-entre mb" style="gap:10px">
        <span class="rotulo">${esc(p.nome)}</span>
        <button class="btn btn-sm btn-fantasma" data-sem-almoco="${p.id}">Sem almoço fixo</button>
      </div>
      <div class="tabela-wrap"><table><thead><tr>
        <th style="width:38px"></th><th>Dia</th><th>Abre</th><th>Fecha</th>
        <th>Almoço de</th><th>até</th>
      </tr></thead><tbody>
      <!-- Almoço em branco = sem pausa fixa; a agenda oferece o dia inteiro. -->
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

/** Um assunto: o título e os avisos, um por linha. */
function blocoRegra(r) {
  return `
    <div class="regra-bloco" style="border-top:1px solid var(--linha);padding-top:14px;margin-top:14px">
      <div class="flex" style="gap:10px;align-items:flex-end">
        <label class="campo crescer" style="margin-bottom:0"><span>Assunto</span>
          <input data-titulo value="${esc(r.titulo || '')}" placeholder="Ex.: Manutenção do alongamento"></label>
        <button class="btn-icone" data-tirar title="Tirar este assunto">${ico('lixo')}</button>
      </div>
      <label class="campo" style="margin-top:12px"><span>Avisos</span>
        <textarea data-itens style="min-height:130px"
          placeholder="Um aviso por linha.">${esc((r.itens || []).join('\n'))}</textarea></label>
    </div>`;
}

/**
 * Começa mostrando o que a página mostra hoje.
 *
 * Sem nada salvo ainda, os avisos vêm do arquivo — e editar a partir do texto
 * que já está no ar é bem mais fácil do que escrever tudo de novo do zero.
 */
function pintarRegras(raiz) {
  const s = db.cfg('studio') || {};
  const regras = Array.isArray(s.regras) && s.regras.length ? s.regras : REGRAS;
  raiz.querySelector('#regras-lista').innerHTML = regras.map(blocoRegra).join('');
  ligarRegras(raiz);
}

function ligarRegras(raiz) {
  raiz.querySelectorAll('#regras-lista [data-tirar]').forEach((b) => {
    b.onclick = () => b.closest('.regra-bloco').remove();
  });
}

async function salvarHorarios(raiz) {
  const linhas = [...raiz.querySelectorAll('#horarios-lista tr[data-prof]')];
  const guardar = [];
  const apagar = [];

  for (const tr of linhas) {
    const prof = tr.dataset.prof;
    const dia = Number(tr.dataset.dia);
    const v = (c) => tr.querySelector(`[data-campo=${c}]`);
    // `Number()` dos dois lados: a tela compara como texto ao desenhar a
    // grade, e comparar de outro jeito aqui faria o sistema não reconhecer a
    // linha que já existe — e tentar criar uma segunda para o mesmo dia.
    const existente = db.estado.horarios.find(
      (x) => x.profissional_id === prof && Number(x.dia_semana) === dia);

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
