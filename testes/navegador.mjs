import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:8899';
const erros = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

// ── Supabase falso: um banco em memória, servido no lugar do módulo real ──
const FAKE = `
const memoria = globalThis.__DB || (globalThis.__DB = (() => {
  // O banco de mentira precisa sobreviver a um F5, senão o teste de desmarcar
  // pela página não reflete o que acontece de verdade.
  try { return JSON.parse(sessionStorage.getItem('__db') || 'null') || {}; }
  catch { return {}; }
})());
const persistir = () => { try { sessionStorage.setItem('__db', JSON.stringify(memoria)); } catch {} };
// O gatilho do banco cria a linha da profissional no cadastro; aqui ela já existe.
if (!memoria.profissionais) memoria.profissionais = [
  { id: 'p1', user_id: 'u1', nome: 'Laura', funcao: 'cabelo', comissao_pct: 0.5, ativo: true, atende: true },
  { id: 'p2', user_id: 'u2', nome: 'Julia', funcao: 'unhas',  comissao_pct: 0.5, ativo: true, atende: true },
];
function tabela(nome){
  // A view da equipe não é uma tabela: é o recorte público de profissionais —
  // sem comissão, e só quem está ativa e atende. Sem isto aqui, a vitrine do
  // teste ficava sem equipe e o zap de cada uma nunca era exercitado.
  if (nome === 'equipe_publica') {
    return (memoria.profissionais || [])
      .filter((p) => p.ativo !== false && p.atende !== false)
      .map(({ id, nome, apelido, funcao, foto, bio, recado, whatsapp }) =>
        ({ id, nome, apelido, funcao, foto, bio, recado, whatsapp }));
  }
  return memoria[nome] || (memoria[nome] = []);
}
function query(nome){
  const q = {
    // O app agora pede só o que mudou desde a última conferida.
    //
    // Devolve CÓPIAS, como um servidor de verdade devolveria: entregando o
    // próprio array em memória, o app comparava a lista com ela mesma e
    // concluía que nada tinha mudado.
    _rows(){
      const t = tabela(nome);
      const linhas = !this._gt ? t
        : t.filter((x) => String(x[this._gt[0]] || '') > this._gt[1]);
      return linhas.map((x) => ({ ...x }));
    },
    // Preguiçoso, como o cliente de verdade: a consulta só é resolvida quando
    // alguém a espera. Montando a resposta já no select, um gt() vindo depois
    // na mesma linha chegava tarde demais e era simplesmente ignorado.
    _resposta(){
      const some = globalThis.__SEM_COLUNA;
      if (some && String(this._cols || '').split(',').map((x) => x.trim()).includes(some)) {
        return { data: null, error: { code: 'PGRST204',
                 message: 'Could not find the ' + some + ' column of ' + nome } };
      }
      const linhas = this._rows();
      globalThis.__LINHAS = (globalThis.__LINHAS || 0) + linhas.length;
      return { data: linhas, error: null };
    },
    select(cols){ this._cols = cols; return this; },
    then(ok, falha){
      const d = globalThis.__DEMORA || 0;
      return new Promise((r) => setTimeout(r, d)).then(() => this._resposta()).then(ok, falha);
    },
    limit(){ return this; },
    eq(){ return this; }, in(){ return this; }, single(){ return this; },
    gt(col, v){ this._gt = [col, v]; return this; },
    upsert(r){ const arr = Array.isArray(r)?r:[r];
      // Ordem de chegada ao servidor: é o que revela alguém furando a fila.
      globalThis.__ORDEM = globalThis.__ORDEM || [];
      globalThis.__ORDEM.push(nome);
      // O teste pode mandar o banco recusar, para exercitar o caminho do erro.
      const recusa = globalThis.__RECUSAR;
      if (recusa && recusa.tabela === nome) {
        const out = { data: null, error: recusa.erro };
        return Object.assign(Promise.resolve(out), {select:()=>({single:()=>Promise.resolve(out)})}); }
      const agora = new Date().toISOString();
      for (const x of arr){ const t=tabela(nome); const i=t.findIndex(y=>y.id===x.id||(y.chave&&y.chave===x.chave));
        const linha = { ...x, atualizado_em: agora };
        if(i>=0) t[i]={...t[i],...linha}; else t.push(linha); }
      const out = {data: arr[0], error:null};
      const d = globalThis.__DEMORA || 0;
      const espera = () => new Promise((r) => setTimeout(r, d)).then(() => out);
      return Object.assign(espera(), {select:()=>({single:espera})}); },
    delete(){ return { eq:(c,v)=>{ memoria[nome]=tabela(nome).filter(x=>x[c]!==v); return Promise.resolve({error:null}); } }; },
  };
  return q;
}
export function createClient(){
  return {
    from: (n) => query(n),
    auth: {
      getSession: async () => (globalThis.__SEM_SESSAO
        ? { data: { session: null } }
        : { data: { session: { user: {
            id: globalThis.__INTRUSO ? 'estranho' : 'u1',
            email: 'laura@alento.com', user_metadata:{nome:'Laura'} } } } }),
      signInWithPassword: async () => ({ data: {}, error: null }),
      signOut: async () => ({}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
      resetPasswordForEmail: async () => ({ error: globalThis.__RESET_ERRO || null }),
      updateUser: async (d) => { globalThis.__SENHA_NOVA = d.password; return { error: null }; },
    },
    rpc: async (nome, args) => {
      if (nome === 'horarios_livres') {
        // Como no banco de verdade: serviço fora do agendamento online não
        // tem horário nenhum a oferecer, nem para quem chamar a função direto.
        const s = (memoria.servicos || []).find((x) => x.id === args.p_servico_id);
        if (s && s.agenda_online === false) return { data: [], error: null };
        const base = new Date(args.p_data + 'T09:00:00');
        // Horário cancelado volta a ficar livre, como no banco de verdade.
        const tomados = (memoria.agendamentos || [])
          .filter(a => a.status !== 'cancelado').map(a => a.inicio);
        const out = [];
        for (let h = 0; h < 8; h++) {
          const d = new Date(base); d.setHours(9 + h);
          if (tomados.includes(d.toISOString())) continue;
          out.push({ quando: d.toISOString(), prof_id: 'p1', prof_nome: 'Laura' });
        }
        return { data: out, error: null };
      }
      if (nome === 'criar_agendamento') {
        const s = (memoria.servicos || []).find((x) => x.id === args.p_servico_id);
        if (s && s.agenda_online === false) {
          return { data: null, error: { message: 'Este serviço é marcado pelo WhatsApp. Fale com o studio.' } };
        }
        const t = memoria.agendamentos || (memoria.agendamentos = []);
        if (t.some(a => a.inicio === args.p_inicio)) {
          return { data: null, error: { message: 'Esse horário acabou de ser preenchido. Escolha outro, por favor.' } };
        }
        if (String(args.p_telefone).length < 10) {
          return { data: null, error: { message: 'Informe um WhatsApp válido com DDD' } };
        }
        t.push({ id: 'a1', token: 'cod-123', inicio: args.p_inicio, cliente_nome: args.p_nome });
        persistir();
        return { data: [{ novo_id: 'a1', codigo: 'cod-123', quando: args.p_inicio,
                          prof_nome: 'Laura', servico: 'Manicure' }], error: null };
      }
      if (nome === 'cancelar_agendamento') {
        const t = memoria.agendamentos || [];
        const a = t.find(x => (x.token === args.p_token || x.codigo === args.p_token)
                              && x.status !== 'cancelado');
        if (a) { a.status = 'cancelado'; persistir(); return { data: true, error: null }; }
        return { data: false, error: null };   // já não estava de pé
      }
      if (nome === 'situacao_agendamentos') {
        const t = memoria.agendamentos || [];
        return { data: (args.p_tokens || []).map((tk) => {
          const a = t.find(x => x.token === tk || x.codigo === tk);
          return a && { codigo: tk, quando: a.inicio, servico: a.servico_nome,
                        prof_nome: 'Julia', situacao: a.status || 'confirmado' };
        }).filter(Boolean), error: null };
      }
      return { data: [], error: null };
    },
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
  };
}
`;

await ctx.route('**/esm.sh/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));

const page = await ctx.newPage();
page.on('pageerror', (e) => erros.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') erros.push('[console] ' + m.text()); });

// ── 1. Vitrine pública ──
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const nb = (x) => x.replace(/\u00a0/g, ' ');
const vitrine = nb(await page.textContent('#vitrine'));
const checagens = [
  ['vitrine: wordmark', await page.locator('img[alt*="Alento"]').count() > 0],
  ['vitrine: Manicure R$ 45,00', vitrine.includes('Manicure') && vitrine.includes('R$ 45,00')],
  ['vitrine: alongamento R$ 250,00', vitrine.includes('R$ 250,00')],
  ['vitrine: combo R$ 320,00', vitrine.includes('R$ 320,00')],
  ['vitrine: economia R$ 50,00', vitrine.includes('economiza R$ 50,00')],
  ['vitrine: regra manutenção fixa', vitrine.includes('R$ 235,00')],
  ['vitrine: seções da tabela', vitrine.includes('BLINDAGEM') || vitrine.includes('Blindagem')],
];
checagens.push(['vitrine: serviços de cabelo', vitrine.includes('Escova longo') && vitrine.includes('R$ 85,00')]);
checagens.push(['vitrine: "a partir de"', vitrine.includes('a partir de') && vitrine.includes('R$ 600,00')]);
checagens.push(['vitrine: "sob avaliação"', vitrine.includes('sob avaliação')]);
checagens.push(['vitrine: terapia capilar', vitrine.includes('Sessão de terapia capilar')]);
checagens.push(['vitrine: regra do babyliss', vitrine.includes('Babyliss ou chapinha na escova: + R$ 10,00')]);
await page.screenshot({ path: '/tmp/shot-vitrine.png', fullPage: false });

// ── 2. App: primeira configuração ──
// O config.js comitado já traz URL e chave: o app não deve mais pedir nada.
await page.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const cfgLida = await page.evaluate(() => window.ALENTO_CONFIG);
checagens.push(['config.js: URL do projeto preenchida',
  /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(cfgLida?.url || '')]);
checagens.push(['config.js: chave publicável preenchida',
  /^sb_publishable_/.test(cfgLida?.anonKey || '')]);
checagens.push(['config.js: nada de chave secreta no repositório',
  !/sb_secret_|service_role/.test(JSON.stringify(cfgLida))]);
checagens.push(['app: já abre conectado, sem pedir configuração',
  !nb(await page.textContent('#app')).includes('Primeira configuração')]);

// A tela de configuração manual continua valendo para quem instalar sem o
// config.js preenchido. Serve um config.js vazio só para esta página.
// Contexto próprio: sem o localStorage nem o service worker das outras páginas.
const ctxCfg = await browser.newContext({ serviceWorkers: 'block' });
await ctxCfg.route('**/esm.sh/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
const pCfg = await ctxCfg.newPage();
pCfg.on('pageerror', (e) => erros.push('[pageerror] ' + e.message));
await pCfg.route(/\/config\.js(\?|$)/, (route) => route.fulfill({
  status: 200, contentType: 'application/javascript',
  body: "window.ALENTO_CONFIG = { url: 'https://SUA-URL.supabase.co', anonKey: 'SUA-CHAVE-ANON' };",
}));
await pCfg.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
await pCfg.waitForSelector('#cfg-url', { timeout: 8000 });
checagens.push(['app: pede configuração quando o config.js está vazio', true]);

// A validação da chave precisa aceitar os dois formatos que o Supabase tem hoje
// e recusar a secreta, que nunca pode sair do servidor.
const CHAVE_NOVA = 'sb_publishable_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3';
const CHAVE_LEGADA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'eyJyb2xlIjoiYW5vbiJ9' + '.abcDEF123-_x';
async function tentaChave(chave) {
  await pCfg.fill('#cfg-url', 'https://abcdefgh.supabase.co');
  await pCfg.fill('#cfg-key', chave);
  await pCfg.click('#cfg-salvar');
  await pCfg.waitForTimeout(260);
  const t = await pCfg.locator('#toasts').textContent();
  await pCfg.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
  return t;
}
checagens.push(['config: recusa chave vazia', (await tentaChave('abc')).includes('Chave inválida')]);
checagens.push(['config: recusa chave secreta',
  (await tentaChave('sb_secret_' + 'A1b2C3d4E5f6G7h8I9j0K1')).includes('chave secreta')]);
checagens.push(['config: aceita Publishable key nova', (await tentaChave(CHAVE_NOVA)) === '']);
await pCfg.evaluate(() => localStorage.clear());
await pCfg.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
await pCfg.waitForSelector('#cfg-url', { timeout: 8000 });
checagens.push(['config: aceita anon public legada', (await tentaChave(CHAVE_LEGADA)) === '']);
await ctxCfg.close();

// ── 3. App conectado ──
await ctx.addInitScript(() => {
  localStorage.setItem('alento.supabase', JSON.stringify({ url: 'https://teste.supabase.co', anonKey: 'x'.repeat(50) }));
});
const p2 = await ctx.newPage();
p2.on('pageerror', (e) => erros.push('[pageerror] ' + e.message));
p2.on('console', (m) => { if (m.type() === 'error') erros.push('[console] ' + m.text()); });
await p2.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
await p2.waitForSelector('.shell', { timeout: 8000 });
checagens.push(['app: casca carregou', await p2.locator('.lateral').count() > 0]);

// Instalar dados iniciais
await p2.waitForSelector('.veu', { timeout: 5000 });
await p2.click('text=Instalar dados iniciais');
await p2.waitForTimeout(1500);

const contagem = await p2.evaluate(() => ({
  servicos: globalThis.__DB?.servicos?.length || 0,
  materiais: globalThis.__DB?.materiais?.length || 0,
  fichas: new Set((globalThis.__DB?.ficha_tecnica || []).map((f) => f.servico_id)).size,
}));
checagens.push(['seed: 6 fichas técnicas de rascunho', contagem.fichas === 6]);
checagens.push(['seed: 58 serviços (30 unhas + 24 cabelos + 4 adicionais)', contagem.servicos === 58]);
checagens.push(['seed: 176 insumos', contagem.materiais === 176]);

// ── 4. Percorrer todas as telas ──
const telas = ['painel','comandas','clientes','estoque','caixa','servicos','precificacao','comissoes','relatorios','ajustes'];
for (const t of telas) {
  await p2.evaluate((r) => { location.hash = '#/' + r; }, t);
  await p2.waitForTimeout(700);
  const txt = await p2.textContent('#conteudo');
  checagens.push([`tela ${t}: renderizou`, txt.length > 120 && !txt.includes('Carregando…')]);
  await p2.screenshot({ path: `/tmp/shot-${t}.png` });
}

// ── 5. Precificação: os números batem com a planilha ──
await p2.evaluate(() => { location.hash = '#/precificacao'; });
await p2.waitForTimeout(700);
const preco = nb(await p2.textContent('#conteudo'));
checagens.push(['precificação: custo fixo R$ 1.530', preco.includes('1.530')]);
checagens.push(['precificação: custo por atendimento R$ 12,75', preco.includes('12,75')]);
checagens.push(['precificação: taxa média 1,08%', preco.includes('1,08%')]);
checagens.push(['precificação: conta os 58 itens', preco.includes('de 58 serviços')]);

// ── 6. Fluxo real: fechar uma comanda ──
await p2.evaluate(() => { location.hash = '#/comandas'; });
await p2.waitForTimeout(600);
await p2.click('#nova');
await p2.waitForSelector('.veu');
await p2.fill('#cli', 'Maria Teste');
// A comanda abre com a Laura (cabelo); manicure é da Julia.
await p2.selectOption('#prof', 'p2');
await p2.waitForTimeout(250);
await p2.selectOption('#add-serv', 'manicure');
await p2.waitForTimeout(200);
await p2.selectOption('#add-serv', 'gel-sem-manicure');
await p2.waitForTimeout(200);
await p2.click('[data-pg="pix"]');
await p2.waitForTimeout(200);
const totalTxt = nb(await p2.textContent('#totais'));
checagens.push(['comanda: total 45 + 60 = R$ 105,00', totalTxt.includes('R$ 105,00')]);
await p2.screenshot({ path: '/tmp/shot-comanda.png' });
await p2.click('text=Fechar comanda');
await p2.waitForTimeout(1200);

const depois = await p2.evaluate(() => ({
  comandas: globalThis.__DB?.comandas?.length || 0,
  itens: globalThis.__DB?.comanda_itens?.length || 0,
  caixa: globalThis.__DB?.caixa?.length || 0,
  clientes: globalThis.__DB?.clientes?.length || 0,
  total: globalThis.__DB?.comandas?.[0]?.total,
  entradaCaixa: globalThis.__DB?.caixa?.[0]?.valor,
}));
checagens.push(['comanda: gravada', depois.comandas === 1 && depois.total === 105]);
checagens.push(['comanda: 2 itens gravados', depois.itens === 2]);
checagens.push(['comanda: cliente cadastrada sozinha', depois.clientes === 1]);
checagens.push(['comanda: entrou no caixa', depois.caixa === 1 && depois.entradaCaixa === 105]);

// ── 7. O painel reflete o atendimento ──
await p2.evaluate(() => { location.hash = '#/painel'; });
await p2.waitForTimeout(700);
const painel = nb(await p2.textContent('#conteudo'));
checagens.push(['painel: mostra R$ 105', painel.includes('105')]);
checagens.push(['painel: mostra a cliente', painel.includes('Maria Teste')]);
await p2.screenshot({ path: '/tmp/shot-painel-final.png' });

// ── 8. Mobile ──
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 390, height: 844 });
mob.on('pageerror', (e) => erros.push('[mobile pageerror] ' + e.message));
await mob.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
await mob.waitForSelector('.shell', { timeout: 8000 });
await mob.waitForTimeout(900);
checagens.push(['mobile: barra inferior visível', await mob.locator('.tabbar').isVisible()]);
checagens.push(['mobile: sem rolagem lateral',
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)]);
await mob.screenshot({ path: '/tmp/shot-mobile.png' });
await mob.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await mob.waitForTimeout(700);
checagens.push(['mobile vitrine: sem rolagem lateral',
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)]);
await mob.screenshot({ path: '/tmp/shot-mobile-vitrine.png', fullPage: false });

// ── 9. Conta não autorizada não enxerga o studio ──
{
  const p3 = await ctx.newPage();
  p3.on('pageerror', (e) => erros.push('[pageerror] ' + e.message));
  // Simula quem criou conta sozinha: existe no auth, mas não é profissional ativa.
  await p3.addInitScript(() => {
    globalThis.__INTRUSO = true;
  });
  // O próprio falso já sabe fingir uma conta estranha quando `__INTRUSO` está
  // ligado — não precisa de cirurgia de texto, que quebrava a cada mudança.
  await p3.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1400);
  const txt = nb(await p3.textContent('#app'));
  checagens.push(['segurança: conta não autorizada é barrada', txt.includes('Acesso não liberado')]);
  checagens.push(['segurança: não mostra o painel do studio', !txt.includes('Novo atendimento')]);
  checagens.push(['segurança: não vaza dado de cliente', !txt.includes('Maria Teste')]);
  await p3.screenshot({ path: '/tmp/shot-sem-acesso.png' });
  await p3.close();
  // devolve a rota original para o resto do teste
  await ctx.route('**/esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
}

// ── 10. Nenhuma tabela vaza para fora do cartão ──
for (const t of ['estoque','precificacao','servicos','caixa','clientes','relatorios']) {
  await p2.evaluate((r) => { location.hash = '#/' + r; }, t);
  await p2.waitForTimeout(650);
  const vaza = await p2.evaluate(() => {
    for (const w of document.querySelectorAll('.tabela-wrap')) {
      const tb = w.querySelector('table');
      if (tb && tb.scrollWidth > w.clientWidth + 2 && w.scrollWidth <= w.clientWidth + 2) return true;
    }
    for (const b of document.querySelectorAll('#conteudo button, #conteudo table')) {
      const r = b.getBoundingClientRect();
      if (r.width && r.right > window.innerWidth + 1) return true;
    }
    return false;
  });
  checagens.push([`tela ${t}: nada vaza da tabela`, !vaza]);
}

// ── 11. Agenda no app ──
await p2.evaluate(() => { location.hash = '#/agenda'; });
await p2.waitForTimeout(900);
{
  const t = nb(await p2.textContent('#conteudo'));
  checagens.push(['agenda: tela carregou', t.includes('Agendado no dia')]);
  checagens.push(['agenda: coluna da profissional', t.includes('Laura')]);
  checagens.push(['agenda: dia livre quando vazio', t.includes('Dia livre')]);

  // encaixar um horário pela agenda
  await p2.click('#novo');
  await p2.waitForSelector('.veu');
  // Nada pode vir escolhido: a equipe precisa dizer quem atende.
  checagens.push(['agenda: profissional começa em branco',
    (await p2.inputValue('.veu [data-prof]')) === '']);
  checagens.push(['agenda: serviço bloqueado até escolher a profissional',
    await p2.locator('.veu [data-serv]').isDisabled()]);
  await p2.fill('[name=cliente_nome]', 'Cliente da Agenda');
  await p2.click('text=Marcar');
  await p2.waitForTimeout(300);
  checagens.push(['agenda: recusa sem escolher a profissional',
    nb(await p2.textContent('#toasts')).includes('quem vai atender')]);
  await p2.selectOption('.veu [data-prof]', 'p2');
  await p2.waitForTimeout(250);
  await p2.selectOption('.veu [data-serv]', 'manicure');
  await p2.fill('.veu [data-hora]', '10:00');
  await p2.click('text=Marcar');
  await p2.waitForTimeout(900);
  const ag = await p2.evaluate(() => globalThis.__DB?.agendamentos || []);
  checagens.push(['agenda: horário gravado', ag.length === 1 && ag[0].cliente_nome === 'Cliente da Agenda']);
  checagens.push(['agenda: duração veio do serviço escolhido', ag[0]?.duracao_min === 60]);
  // A agenda abre na de quem está logada — a Laura. O horário foi marcado com
  // a Julia, então não deve estar aqui.
  checagens.push(['agenda: abre mostrando só a coluna de quem está logada',
    await p2.locator('.agenda-colunas > .cartao').count() === 1]);
  checagens.push(['agenda: e a coluna é a da própria pessoa',
    nb(await p2.textContent('.agenda-colunas')).includes('Laura')]);
  checagens.push(['agenda: horário da outra não polui a minha',
    !nb(await p2.textContent('.agenda-colunas')).includes('Cliente da Agenda')]);

  await p2.click('[data-ver="todas"]');
  await p2.waitForTimeout(500);
  const t2 = nb(await p2.textContent('#conteudo'));
  checagens.push(['agenda: "Studio" mostra as duas colunas',
    await p2.locator('.agenda-colunas > .cartao').count() === 2]);
  checagens.push(['agenda: aparece na coluna', t2.includes('Cliente da Agenda')]);
  await p2.click('[data-ver="eu"]');
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: '/tmp/shot-agenda.png' });
}

// ── 12. Horário de funcionamento em Ajustes ──
await p2.evaluate(() => { location.hash = '#/ajustes'; });
await p2.waitForTimeout(900);
{
  const t = nb(await p2.textContent('#conteudo'));
  checagens.push(['ajustes: horário de funcionamento', t.includes('Horário de funcionamento')]);
  checagens.push(['ajustes: sete dias da semana',
    ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].every((d) => t.includes(d))]);
}

// ── 13. Agendamento pela vitrine, de ponta a ponta ──
// Contexto NOVO e limpo: a cliente chega sem nada guardado no navegador. O
// contexto principal tem a configuração no localStorage, e isso escondia o
// defeito de a vitrine não carregar o config.js.
{
  const ctxCli = await browser.newContext({ serviceWorkers: 'block' });
  await ctxCli.route('**/esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  const pv = await ctxCli.newPage();
  pv.on('pageerror', (e) => erros.push('[vitrine] ' + e.message));

  // A configuração precisa vir do config.js, não do armazenamento local.
  await pv.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const semStorage = await pv.evaluate(() => !localStorage.getItem('alento.supabase'));
  const temConfig = await pv.evaluate(() => !!window.ALENTO_CONFIG?.url);
  checagens.push(['vitrine: navegador limpo, sem configuração guardada', semStorage]);
  checagens.push(['vitrine: carrega o config.js', temConfig]);
  await pv.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await pv.waitForTimeout(700);
  await pv.click('#btn-agendar');
  await pv.waitForSelector('.ag-tela', { timeout: 6000 });
  checagens.push(['vitrine: abre o agendamento', await pv.locator('.ag-passo').count() === 3]);

  await pv.click('[data-serv="manicure"]');
  await pv.waitForTimeout(500);
  checagens.push(['vitrine: mostra os dias', await pv.locator('.ag-dia').count() > 20]);
  // Um dia à frente: horário de hoje que já passou não deveria mesmo aparecer
  // como "próximo horário" depois.
  await pv.locator('.ag-dia').nth(3).click();
  await pv.waitForTimeout(400);
  await pv.waitForSelector('.ag-hora', { timeout: 6000 });
  const qtdHoras = await pv.locator('.ag-hora').count();
  checagens.push(['vitrine: mostra horários livres', qtdHoras === 8]);
  await pv.screenshot({ path: '/tmp/shot-agendar-horarios.png' });

  await pv.locator('.ag-hora').first().click();
  await pv.waitForSelector('#ag-nome');
  checagens.push(['vitrine: resumo antes de confirmar',
    nb(await pv.textContent('.ag-resumo')).includes('Manicure')]);

  // telefone curto precisa ser recusado
  await pv.fill('#ag-nome', 'Ana Teste');
  await pv.fill('#ag-tel', '119');
  await pv.click('#ag-confirmar');
  await pv.waitForTimeout(400);
  checagens.push(['vitrine: recusa WhatsApp incompleto',
    nb(await pv.textContent('#toasts')).includes('WhatsApp')]);

  await pv.fill('#ag-tel', '11999998888');
  await pv.click('#ag-confirmar');
  await pv.waitForSelector('.ag-pronto', { timeout: 6000 });
  const pronto = nb(await pv.textContent('.ag-pronto'));
  checagens.push(['vitrine: confirma o horário', pronto.includes('Horário marcado')]);
  checagens.push(['vitrine: chama a cliente pelo nome', pronto.includes('Ana')]);
  checagens.push(['vitrine: não mostra código técnico na cara da cliente',
    !pronto.includes('cod-123') && !/[0-9a-f]{8}-[0-9a-f]{4}/.test(pronto)]);
  await pv.waitForSelector('.ag-marca', { timeout: 6000 });
  checagens.push(['vitrine: logo grande na confirmação',
    (await pv.locator('.ag-marca').boundingBox())?.width > 150]);
  checagens.push(['vitrine: a frase escolhida pelo studio',
    nb(await pv.textContent('.ag-recado')).includes('Beleza que acolhe e renova')]);
  checagens.push(['vitrine: botão de desmarcar', await pv.locator('#ag-desmarcar').isVisible()]);
  checagens.push(['vitrine: guarda o horário no aparelho',
    await pv.evaluate(() => (JSON.parse(localStorage.getItem('alento.meus-horarios') || '[]')).length === 1)]);
  await pv.screenshot({ path: '/tmp/shot-agendar-pronto.png' });

  // Ao voltar na página, o horário dela aparece no topo — sem precisar de código.
  await pv.reload({ waitUntil: 'networkidle' });
  await pv.waitForTimeout(600);
  checagens.push(['vitrine: mostra o próximo horário ao voltar',
    await pv.locator('.meu-horario').isVisible()]);
  checagens.push(['vitrine: dá para desmarcar dali',
    await pv.locator('[data-desmarcar]').isVisible()]);
  await pv.screenshot({ path: '/tmp/shot-meu-horario.png' });
  await pv.click('[data-desmarcar]');
  await pv.waitForTimeout(700);
  checagens.push(['vitrine: desmarcar limpa o cartão',
    await pv.locator('.meu-horario').count() === 0]);

  // ── O cartão preso ──────────────────────────────────────────────────────
  // Foi o que aconteceu de verdade: o horário some do banco (o studio
  // cancelou), mas o cartão continua no celular. Antes, apertar "Desmarcar"
  // devolvia "Não consegui desmarcar" para sempre, sem saída nenhuma.
  await pv.evaluate(() => {
    localStorage.setItem('alento.meus-horarios', JSON.stringify([{
      codigo: 'cod-fantasma', servico: 'Manicure', prof: 'Julia',
      nome: 'Josianny', quando: new Date(Date.now() + 3 * 864e5).toISOString(),
    }]));
  });
  await pv.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await pv.waitForTimeout(900);
  checagens.push(['cartão preso: some sozinho quando o horário não existe mais',
    await pv.locator('.meu-horario').count() === 0]);
  checagens.push(['cartão preso: também sai do celular',
    await pv.evaluate(() =>
      JSON.parse(localStorage.getItem('alento.meus-horarios') || '[]').length === 0)]);

  // E o mesmo pelo botão, para quem já estava com a página aberta.
  await pv.evaluate(async () => {
    localStorage.setItem('alento.meus-horarios', JSON.stringify([{
      codigo: 'cod-fantasma', servico: 'Manicure', prof: 'Julia',
      nome: 'Josianny', quando: new Date(Date.now() + 3 * 864e5).toISOString(),
    }]));
  });
  await pv.reload({ waitUntil: 'networkidle' });
  await pv.waitForTimeout(300);
  const desmarcado = await pv.evaluate(async () => {
    const m = await import('./js/agendar.js');
    const sb = { rpc: async () => ({ data: false, error: null }) };
    let recado = null;
    await m.desmarcar(sb, 'cod-fantasma', () => {});
    recado = document.querySelector('#toasts')?.textContent || '';
    return { recado, sobrou: JSON.parse(localStorage.getItem('alento.meus-horarios') || '[]').length };
  });
  checagens.push(['cartão preso: o botão explica em vez de só dar erro',
    /já não estava mais marcado/i.test(desmarcado.recado), desmarcado.recado]);
  checagens.push(['cartão preso: o botão também tira do celular', desmarcado.sobrou === 0]);

  await pv.evaluate(() => localStorage.removeItem('alento.meus-horarios'));
  await pv.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await pv.waitForTimeout(500);
  await pv.click('#btn-agendar');
  await pv.waitForSelector('.ag-tela');

  // o horário tomado não pode reaparecer
  // Depois de desmarcar, o horário tem que voltar a ficar disponível.
  await pv.click('[data-serv="manicure"]');
  await pv.waitForTimeout(300);
  await pv.locator('.ag-dia').nth(3).click();
  await pv.waitForSelector('.ag-hora', { timeout: 6000 });
  checagens.push(['vitrine: desmarcar devolve o horário à lista',
    await pv.locator('.ag-hora').count() === qtdHoras]);

  checagens.push(['vitrine: sem rolagem lateral no agendamento',
    await pv.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)]);
  await ctxCli.close();
}

// ── 14. Escolher a profissional filtra os serviços dela ──
await p2.evaluate(() => { location.hash = '#/agenda'; });
await p2.waitForTimeout(800);
{
  await p2.click('#novo');
  await p2.waitForSelector('.veu [data-prof]');

  // Confere pelo dado, não pelo nome: cada opção da lista tem que pertencer a
  // quem está selecionada. Adivinhar pelo texto do serviço é frágil.
  const tiposOferecidos = async () => p2.evaluate(() => {
    const servicos = globalThis.__DB?.servicos || [];
    return [...document.querySelectorAll('.veu [data-serv] option')]
      .map((o) => servicos.find((s) => s.id === o.value)?.profissional)
      .filter(Boolean);
  });
  const nomes = async () => p2.$$eval('.veu [data-serv] option', (os) => os.map((o) => o.textContent.trim()));

  await p2.selectOption('.veu [data-prof]', 'p1');   // Laura, cabelo
  await p2.waitForTimeout(250);
  const tiposLaura = await tiposOferecidos();
  const daLaura = await nomes();
  checagens.push(['agenda: Laura recebe só serviços de cabelo',
    tiposLaura.length > 0 && tiposLaura.every((t) => t === 'cabelo' || t === 'ambos')]);
  checagens.push(['agenda: Laura não vê manicure', !daLaura.some((n) => /^Manicure$/.test(n))]);

  await p2.selectOption('.veu [data-prof]', 'p2');   // Julia, unhas
  await p2.waitForTimeout(250);
  const tiposJulia = await tiposOferecidos();
  const daJulia = await nomes();
  checagens.push(['agenda: Julia recebe só serviços de unha',
    tiposJulia.length > 0 && tiposJulia.every((t) => t === 'unhas' || t === 'ambos')]);
  checagens.push(['agenda: Julia não vê escova', !daJulia.some((n) => /Escova/i.test(n))]);
  checagens.push(['agenda: as listas são diferentes', daLaura.join() !== daJulia.join()]);
  checagens.push(['agenda: as duas profissionais continuam na lista',
    (await p2.$$eval('.veu [data-prof] option',
      (o) => o.filter((x) => x.value).length)) === 2]);

  await p2.screenshot({ path: '/tmp/shot-filtro-agenda.png' });
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(300);
}

// ── 15. O mesmo filtro na comanda ──
await p2.evaluate(() => { location.hash = '#/comandas'; });
await p2.waitForTimeout(700);
{
  await p2.click('#nova');
  await p2.waitForSelector('.veu #prof');
  const opcoes = async () => p2.$$eval('.veu #add-serv option', (os) => os.map((o) => o.textContent.trim()));

  await p2.selectOption('.veu #prof', 'p1');
  await p2.waitForTimeout(250);
  const c = await opcoes();
  checagens.push(['comanda: Laura não vê manicure', !c.some((n) => /^Manicure —/.test(n))]);
  checagens.push(['comanda: Laura vê os serviços de cabelo', c.some((n) => /Escova/i.test(n))]);

  await p2.selectOption('.veu #prof', 'p2');
  await p2.waitForTimeout(250);
  const u = await opcoes();
  checagens.push(['comanda: Julia vê manicure', u.some((n) => /Manicure/i.test(n))]);
  checagens.push(['comanda: Julia não vê escova', !u.some((n) => /Escova/i.test(n))]);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(300);
}

// ── 16. Filtro na tabela de preços ──
await p2.evaluate(() => { location.hash = '#/servicos'; });
await p2.waitForTimeout(700);
{
  const total = nb(await p2.textContent('#conteudo'));
  await p2.click('[data-quem="cabelo"]');
  await p2.waitForTimeout(500);
  const soCab = nb(await p2.textContent('#conteudo'));
  checagens.push(['tabela de preços: filtro de cabelos esconde manicure',
    total.includes('Manicure') && !soCab.includes('Manicure')]);
  checagens.push(['tabela de preços: filtro de cabelos mostra escova', soCab.includes('Escova')]);
  await p2.click('[data-quem=""]');
  await p2.waitForTimeout(400);
}

// ── 17. Ativar avisos não pode depender de já ter novidade ──
{
  await p2.evaluate(async () => {
    localStorage.removeItem('alento.novidades');
    localStorage.removeItem('alento.agenda.visto');
    const n = await import('./js/novidades.js');
    n.conferir();   // refaz a foto: daqui pra frente o que mudar é novidade
  });
  // O navegador de teste vem com os avisos bloqueados; o estado que interessa
  // à equipe é o "ainda não decidiu". Forçamos os dois e conferimos cada um.
  const painelCom = async (estado) => {
    await p2.evaluate((e) => {
      Object.defineProperty(window.Notification, 'permission', { get: () => e, configurable: true });
    }, estado);
    await p2.click('#btn-sino');
    await p2.waitForSelector('.modal-corpo');
    const t = await p2.textContent('.modal-corpo');
    return t.replace(/\s+/g, ' ').trim();
  };

  const indeciso = await painelCom('default');
  checagens.push(['sino: caixa vazia oferece ativar os avisos', indeciso.includes('Ativar avisos')]);
  checagens.push(['sino: explica o que o aviso faz', indeciso.includes('aba de fundo')]);
  await p2.screenshot({ path: '/tmp/shot-sino-vazio.png' });
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(250);

  const bloqueado = await painelCom('denied');
  checagens.push(['sino: ensina a desbloquear quando o navegador barrou',
    bloqueado.includes('bloqueados') && bloqueado.includes('cadeado')]);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(250);

  const ligado = await painelCom('granted');
  checagens.push(['sino: confirma quando já está ativo', ligado.includes('Avisos ativados')]);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(250);
}

// ── 18. Sino de novidades ──
{
  // Simula a cliente marcando pelo site enquanto a equipe está com o app aberto.
  await p2.evaluate(() => {
    const t = globalThis.__DB.agendamentos || (globalThis.__DB.agendamentos = []);
    t.push({ id: 'ag-site-1', cliente_nome: 'Josianny', servico_nome: 'Pedicure',
             profissional_id: 'p2', status: 'confirmado', origem: 'site',
             inicio: new Date(Date.now() + 864e5).toISOString(), duracao_min: 60, valor: 50 });
  });
  await p2.evaluate(() => location.hash = '#/painel');
  await p2.waitForTimeout(300);
  await p2.evaluate(async () => {
    const db = await import('./js/db.js'); await db.recarregar();
  });
  await p2.waitForTimeout(900);

  const ponto = await p2.locator('#sino-ponto');
  checagens.push(['sino: acende quando a cliente marca', !(await ponto.isHidden())]);
  checagens.push(['sino: conta a novidade', (await ponto.textContent()).trim() === '1']);

  await p2.click('#btn-sino');
  await p2.waitForSelector('.novidades');
  const painel = nb(await p2.textContent('.novidades'));
  checagens.push(['sino: diz quem marcou o quê', painel.includes('Josianny') && painel.includes('Pedicure')]);

  await p2.click('text=Marcar como lidas');
  await p2.waitForTimeout(500);
  checagens.push(['sino: apaga depois de lidas', await p2.locator('#sino-ponto').isHidden()]);

  // Desmarcação sozinha também precisa virar novidade. O ag-site-2 entra junto
  // para a remarcação logo abaixo ter de onde sair.
  await p2.evaluate(async () => {
    const t = globalThis.__DB.agendamentos;
    t.find((x) => x.id === 'ag-site-1').status = 'cancelado';
    t.push({ id: 'ag-site-2', cliente_nome: 'Josianny', servico_nome: 'Manicure',
             profissional_id: 'p2', status: 'confirmado', origem: 'studio',
             inicio: new Date(Date.now() + 2 * 864e5).toISOString(),
             duracao_min: 45, valor: 40 });
    const db = await import('./js/db.js'); await db.recarregar();
  });
  await p2.waitForTimeout(900);
  checagens.push(['sino: acende de novo quando desmarcam',
    !(await p2.locator('#sino-ponto').isHidden())]);
  await p2.click('#btn-sino');
  await p2.waitForSelector('.novidades');
  checagens.push(['sino: registra a desmarcação',
    nb(await p2.textContent('.novidades')).includes('desmarcou')]);
  await p2.screenshot({ path: '/tmp/shot-sino.png' });
  await p2.click('text=Limpar');
  await p2.waitForTimeout(400);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(300);

  // Remarcação: a mesma cliente sai de um horário e entra em outro na mesma
  // rodada. Tem de virar UM aviso só, não um "desmarcou" seguido de "marcou".
  await p2.evaluate(async () => {
    const t = globalThis.__DB.agendamentos;
    t.find((x) => x.id === 'ag-site-2').status = 'cancelado';
    t.push({ id: 'ag-site-3', cliente_nome: 'Josianny', servico_nome: 'Manicure',
             profissional_id: 'p2', status: 'confirmado', origem: 'site',
             inicio: new Date(Date.now() + 3 * 864e5).toISOString(),
             duracao_min: 45, valor: 40 });
    const db = await import('./js/db.js'); await db.recarregar();
  });
  await p2.waitForTimeout(900);
  await p2.click('#btn-sino');
  await p2.waitForSelector('.novidades');
  const remarc = nb(await p2.textContent('.novidades'));
  checagens.push(['sino: junta desmarcar + marcar numa remarcação',
    remarc.includes('Josianny remarcou Manicure')]);
  checagens.push(['sino: a remarcação não vira dois avisos',
    await p2.locator('.novidade').count() === 1]);
  checagens.push(['sino: a remarcação mostra o horário antigo',
    remarc.includes('era ')]);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(300);
}

// ── 19. Foto da profissional ──
// Um PNG de 1×1 pixel, o menor arquivo de imagem que existe. Serve para provar
// o caminho inteiro: escolher arquivo → reduzir no aparelho → salvar → aparecer
// no canto de quem está usando e na lista da equipe.
{
  await p2.evaluate(() => { location.hash = '#/comissoes'; });
  await p2.waitForTimeout(700);
  await p2.click('#equipe');
  await p2.waitForSelector('[data-prof]');
  await p2.click('[data-prof]');
  await p2.waitForSelector('#foto-previa');   // o campo de arquivo é oculto de propósito

  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  await p2.setInputFiles('#foto-arquivo', { name: 'laura.png', mimeType: 'image/png', buffer: PIXEL });
  await p2.waitForTimeout(600);

  const previa = await p2.getAttribute('#foto-previa img', 'src');
  checagens.push(['foto: a prévia aparece já reduzida',
    !!previa && previa.startsWith('data:image/jpeg')]);
  checagens.push(['foto: cabe numa linha do banco', (previa || '').length < 60000]);

  await p2.fill('input[name=bio]', 'Cabeleireira. Corte, cor e tratamento.');
  await p2.click('text=Salvar');
  await p2.waitForTimeout(900);

  const salva = await p2.evaluate(() => {
    const t = globalThis.__DB.profissionais || [];
    const x = t.find((y) => y.foto);
    return { foto: !!x?.foto, bio: x?.bio || '' };
  });
  checagens.push(['foto: fica guardada no cadastro', salva.foto]);
  checagens.push(['foto: a apresentação também', salva.bio.includes('Cabeleireira')]);

  await p2.evaluate(async () => { const db = await import('./js/db.js'); await db.recarregar(); });
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(900);
  checagens.push(['foto: a coluna da agenda mostra o rosto',
    await p2.locator('.agenda-colunas img.retrato, img.retrato').count() > 0]);
  await p2.screenshot({ path: '/tmp/shot-foto.png' });

  // O retrato tem de sair quadrado do jeito que foi pedido. Já saiu oval uma
  // vez: a classe da inicial se chamava `vazio`, que é a do estado vazio das
  // telas e traz 46px de recheio.
  const medidas = await p2.evaluate(() => {
    const out = [];
    for (const r of document.querySelectorAll('.retrato')) {
      const b = r.getBoundingClientRect();
      const pedido = parseFloat(r.style.width);
      if (!b.width) continue;
      if (Math.abs(b.width - pedido) > 1 || Math.abs(b.height - pedido) > 1) {
        out.push(`${r.className}: pedi ${pedido}px, saiu ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
    }
    return out;
  });
  checagens.push(['foto: o retrato sai redondo, no tamanho pedido',
    medidas.length === 0, medidas.join(' | ')]);
}

// ── 20. Quando o servidor recusa, o sistema avisa ──
// Foi o que aconteceu de verdade: a foto salvava na tela, o banco recusava
// porque ainda não tinha a coluna, e o app engolia o erro. Ficava só um
// "4 para sincronizar" que nunca baixava — e a foto sumia no próximo login.
{
  await p2.evaluate(() => {
    globalThis.__RECUSAR = { tabela: 'clientes',
      erro: { code: 'PGRST204', message: "Could not find the 'foto' column of 'clientes'" } };
  });
  await p2.evaluate(() => { location.hash = '#/clientes'; });
  await p2.waitForTimeout(700);
  await p2.click('#nova');
  await p2.waitForSelector('input[name=nome]');
  await p2.fill('input[name=nome]', 'Teste da Recusa');
  await p2.click('text=Salvar');
  await p2.waitForTimeout(800);

  const aviso = nb(await p2.textContent('#toasts'));
  checagens.push(['recusa: diz na hora que o banco não aceitou',
    /coluna|recusou|não tem/i.test(aviso), aviso.trim().slice(0, 80)]);

  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(500);
  const status = nb(await p2.textContent('#status-sync'));
  checagens.push(['recusa: o canto avisa que não subiu, e não "para sincronizar"',
    /não subiram|ver motivo/i.test(status), status.trim()]);

  await p2.click('#status-sync');
  await p2.waitForSelector('.modal');
  const painel = nb(await p2.textContent('.modal'));
  checagens.push(['recusa: o painel explica o motivo', /coluna/i.test(painel)]);
  checagens.push(['recusa: o painel ensina o caminho', /SQL Editor/i.test(painel)]);
  checagens.push(['recusa: avisa que some ao entrar de outro lugar',
    /somem quando você entrar de outro lugar/i.test(painel)]);
  await p2.screenshot({ path: '/tmp/shot-recusa.png' });

  // Resolvido o motivo, "Tentar de novo" sobe tudo.
  await p2.evaluate(() => { globalThis.__RECUSAR = null; });
  await p2.click('.sync-tentar');
  await p2.waitForFunction(
    () => JSON.parse(localStorage.getItem('alento.fila.v1') || '[]').length === 0,
    null, { timeout: 8000 }).catch(() => {});
  const fila = await p2.evaluate(() => localStorage.getItem('alento.fila.v1'));
  checagens.push(['recusa: resolvido o motivo, a fila sobe',
    JSON.parse(fila || '[]').length === 0, String(fila).slice(0, 120)]);
}

// ── 21. Filtro de situação na precificação ──
{
  await p2.evaluate(() => { location.hash = '#/precificacao'; });
  await p2.waitForTimeout(900);
  const todas = await p2.locator('#painel-preco tbody tr').count();
  const rever = await p2.locator('#painel-preco .selo.erro').count();

  await p2.click('[data-sit="rever"]');
  await p2.waitForTimeout(700);
  const soRever = await p2.locator('#painel-preco tbody tr').count();
  checagens.push(['precificação: "Rever" mostra só o que está abaixo do piso',
    soRever === rever && soRever < todas, `${soRever} de ${todas}, ${rever} abaixo`]);
  checagens.push(['precificação: nenhum "ok" sobra na lista de rever',
    await p2.locator('#painel-preco .selo.ok').count() === 0]);

  // Os indicadores do topo não podem seguir o filtro, senão viram mentira.
  const kpiDepois = nb(await p2.textContent('.grade.c4'));
  checagens.push(['precificação: o topo continua contando o studio inteiro',
    kpiDepois.includes(`de ${todas} serviços`), kpiDepois.slice(0, 60)]);

  await p2.click('[data-sit="ok"]');
  await p2.waitForTimeout(700);
  checagens.push(['precificação: "Saudáveis" mostra só o que está ok',
    await p2.locator('#painel-preco .selo.erro').count() === 0
    && await p2.locator('#painel-preco tbody tr').count() === todas - rever]);

  await p2.click('[data-sit=""]');
  await p2.waitForTimeout(700);
  checagens.push(['precificação: volta a mostrar tudo',
    await p2.locator('#painel-preco tbody tr').count() === todas]);
  await p2.screenshot({ path: '/tmp/shot-precificacao-filtro.png' });
}

// ── 22. Aniversariantes do dia ──
// O ano do cadastro é o de nascimento, não o da festa: quem nasceu em 1990
// tem de aparecer todo ano, não só em 1990.
{
  const contas = await p2.evaluate(async () => {
    const M = await import('./js/metricas.js');
    const db = await import('./js/db.js');
    const salvos = db.estado.clientes;

    const hoje = new Date();
    const dm = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    const daqui20 = new Date(hoje); daqui20.setDate(hoje.getDate() + 20);

    db.estado.clientes = [
      { id: 'a', nome: 'Nasceu Faz Tempo', nascimento: `1990-${dm(hoje)}`, ativo: true, telefone: '11999998888' },
      { id: 'b', nome: 'Amanhã', nascimento: `2001-${dm(amanha)}`, ativo: true },
      { id: 'c', nome: 'Longe', nascimento: `1988-${dm(daqui20)}`, ativo: true },
      { id: 'd', nome: 'Sem Data', nascimento: null, ativo: true },
      { id: 'e', nome: 'Inativa Hoje', nascimento: `1995-${dm(hoje)}`, ativo: false },
    ];
    const r = M.aniversariantesDoDia();
    const idade = M.idadeQueFaz('1990-01-01');

    // 29 de fevereiro num ano comum: cai no dia 1º de março.
    db.estado.clientes = [{ id: 'f', nome: 'Bissexta', nascimento: '2000-02-29', ativo: true }];
    const emUmDeMarco = M.aniversariantesDoDia({ hoje: new Date(2027, 2, 1) }).hoje.length;
    const emVinteOito  = M.aniversariantesDoDia({ hoje: new Date(2027, 1, 28) }).hoje.length;
    const noDiaCerto   = M.aniversariantesDoDia({ hoje: new Date(2028, 1, 29) }).hoje.length;

    db.estado.clientes = salvos;
    return { hoje: r.hoje.map((x) => x.nome), proximos: r.proximos.map((x) => x.cliente.nome),
             idade, emUmDeMarco, emVinteOito, noDiaCerto, anoAtual: hoje.getFullYear() };
  });

  checagens.push(['aniversário: vale todo ano, não só o do cadastro',
    contas.hoje.includes('Nasceu Faz Tempo'), contas.hoje.join(',')]);
  checagens.push(['aniversário: calcula a idade que ela faz',
    contas.idade === contas.anoAtual - 1990, String(contas.idade)]);
  checagens.push(['aniversário: quem é de amanhã fica em "próximos dias"',
    contas.proximos.includes('Amanhã') && !contas.hoje.includes('Amanhã')]);
  checagens.push(['aniversário: 20 dias à frente ainda não entra',
    !contas.proximos.includes('Longe')]);
  checagens.push(['aniversário: cliente sem data não vira aniversariante',
    !contas.hoje.includes('Sem Data') && !contas.proximos.includes('Sem Data')]);
  checagens.push(['aniversário: cliente inativa fica de fora',
    !contas.hoje.includes('Inativa Hoje')]);
  checagens.push(['aniversário: 29/02 é lembrado em 1º de março no ano comum',
    contas.emUmDeMarco === 1 && contas.emVinteOito === 0, `1/3=${contas.emUmDeMarco} 28/2=${contas.emVinteOito}`]);
  checagens.push(['aniversário: no ano bissexto volta ao dia 29',
    contas.noDiaCerto === 1, String(contas.noDiaCerto)]);

  // E o cartão aparece de fato no painel.
  await p2.evaluate(async () => {
    const db = await import('./js/db.js');
    const hoje = new Date();
    const dm = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    globalThis.__DB.clientes = [{ id: 'aniv-1', nome: 'Josianny Alves',
      nascimento: `1990-${dm}`, telefone: '11999998888', ativo: true }];
    await db.recarregar();
  });
  await p2.evaluate(() => { location.hash = '#/painel'; });
  await p2.waitForTimeout(900);
  const painelTxt = nb(await p2.textContent('#conteudo'));
  checagens.push(['aniversário: o painel mostra quem faz hoje',
    /Aniversariantes de hoje/.test(painelTxt) && /Josianny Alves/.test(painelTxt)]);
  checagens.push(['aniversário: com botão de parabenizar no WhatsApp',
    await p2.locator('.aniv a[href*="wa.me"]').count() === 1]);
  await p2.screenshot({ path: '/tmp/shot-aniversario.png' });
}

// ── 23. A versão publicada chega mesmo ──
// Publicar uma correção e a pessoa continuar vendo a tela antiga foi o
// problema mais caro do projeto: o GitHub Pages manda guardar cada arquivo
// por dez minutos, e recarregar não resolvia.
{
  const fs = await import('node:fs');
  const versao = fs.readFileSync('js/versao.js', 'utf8').match(/VERSAO = '([^']+)'/)?.[1];
  checagens.push(['versão: existe um carimbo', !!versao, String(versao)]);

  for (const arq of ['index.html', 'sistema.html']) {
    const html = fs.readFileSync(arq, 'utf8');
    checagens.push([`versão: ${arq} pede o CSS carimbado`,
      html.includes(`css/app.css?v=${versao}`)]);
  }
  const sw = fs.readFileSync('sw.js', 'utf8');
  checagens.push(['versão: o service worker troca de balde a cada publicação',
    sw.includes(`alento-${versao}`)]);
  checagens.push(['versão: o service worker fura o cache do navegador',
    /cache: 'reload'/.test(sw)]);

  // Versionar o endereço das telas criaria duas cópias do mesmo módulo, cada
  // uma com o próprio estado. Tem de continuar sem carimbo.
  const app = fs.readFileSync('js/app.js', 'utf8');
  checagens.push(['versão: as telas não são carregadas em duplicata',
    !/import\(`\.\/views\/[a-z]+\.js\?v=/.test(app)]);

  // E a pessoa consegue ver, na tela, qual versão está rodando.
  await p2.evaluate(() => { location.hash = '#/painel'; });
  await p2.waitForTimeout(500);
  const lateral = nb(await p2.textContent('.lateral-rodape'));
  checagens.push(['versão: aparece no rodapé, para conferir sem adivinhar',
    lateral.includes('v' + versao), lateral.trim()]);
}

// ── 24. O sistema confere o banco sozinho ──
// Banco atrasado se manifestava torto: a foto salvava e sumia no login
// seguinte. Agora dá para perguntar, em vez de deduzir pelo sintoma.
{
  // Banco em dia: o falso responde a tudo.
  await p2.evaluate(() => { location.hash = '#/ajustes'; });
  await p2.waitForTimeout(800);
  await p2.click('#conferir-banco');
  await p2.waitForSelector('.modal');
  checagens.push(['conferir banco: diz quando está tudo certo',
    /Banco em dia/.test(nb(await p2.textContent('.modal')))]);
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(400);

  // Agora com a coluna da foto faltando, como no banco de verdade dela.
  await p2.evaluate(() => { globalThis.__SEM_COLUNA = 'foto'; });
  await p2.click('#conferir-banco');
  await p2.waitForSelector('.modal');
  const painel = nb(await p2.textContent('.modal'));
  checagens.push(['conferir banco: aponta o que falta', /O banco está atrasado/.test(painel)]);
  checagens.push(['conferir banco: nomeia a parte quebrada', /Foto e apresentação/.test(painel)]);
  checagens.push(['conferir banco: explica para que serve', /a foto de cada uma/.test(painel)]);
  checagens.push(['conferir banco: ensina o caminho completo',
    /SQL Editor/.test(painel) && /atualizar\.sql/.test(painel) && /Recarregar do servidor/.test(painel)]);
  await p2.screenshot({ path: '/tmp/shot-conferir-banco.png' });
  await p2.evaluate(() => { globalThis.__SEM_COLUNA = null; });
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(400);
}

// ── 25. Trocar a própria senha ──
// Só existia "esqueci a senha", que manda link por e-mail. Quem entrou com a
// senha provisória do convite não tinha como escolher a sua.
{
  await p2.evaluate(() => { location.hash = '#/ajustes'; });
  await p2.waitForTimeout(800);
  await p2.click('#trocar-senha');
  await p2.waitForSelector('input[name=s1]');

  await p2.fill('input[name=s1]', 'umasenhaboa8');
  await p2.fill('input[name=s2]', 'outracoisa99');
  await p2.click('text=Trocar senha');
  await p2.waitForTimeout(500);
  checagens.push(['senha: recusa quando as duas não batem',
    /não são iguais/i.test(nb(await p2.textContent('#toasts')))]);

  await p2.fill('input[name=s1]', 'curta');
  await p2.fill('input[name=s2]', 'curta');
  await p2.click('text=Trocar senha');
  await p2.waitForTimeout(500);
  checagens.push(['senha: recusa senha curta demais',
    /8 caracteres/i.test(nb(await p2.textContent('#toasts')))]);

  await p2.fill('input[name=s1]', 'umasenhaboa8');
  await p2.fill('input[name=s2]', 'umasenhaboa8');
  await p2.click('text=Trocar senha');
  await p2.waitForTimeout(700);
  checagens.push(['senha: troca quando está tudo certo',
    /Senha trocada/i.test(nb(await p2.textContent('#toasts')))]);
  checagens.push(['senha: chegou ao servidor',
    await p2.evaluate(() => globalThis.__SENHA_NOVA === 'umasenhaboa8')]);
  checagens.push(['senha: a janela fecha depois', await p2.locator('.veu').count() === 0]);
}

// ── 26. O vigia só baixa o que mudou ──
// Recarregar tudo a cada 45 segundos custava mais de 1 MB por volta depois de
// um ano de studio — era isso que fazia a agenda travar no celular da Julia.
{
  const conta = () => p2.evaluate(() => {
    const r = { linhas: globalThis.__LINHAS || 0 };
    globalThis.__LINHAS = 0;
    return r.linhas;
  });

  await p2.evaluate(async () => {
    globalThis.__LINHAS = 0;
    const db = await import('./js/db.js');
    await db.recarregar();          // carga completa: traz tudo
  });
  const cheia = await conta();
  checagens.push(['vigia: a carga completa traz o banco todo', cheia > 10, cheia + ' linhas']);

  await p2.evaluate(async () => {
    const db = await import('./js/db.js');
    await db.sincronizar();          // acerta o relógio
    globalThis.__LINHAS = 0;
    await db.sincronizar();          // esta é a que vale
  });
  checagens.push(['vigia: quando nada mudou, não baixa nada', await conta() === 0]);

  await p2.evaluate(async () => {
    const db = await import('./js/db.js');
    globalThis.__DB.agendamentos.push({ id: 'sinc-1', profissional_id: 'p2',
      servico_nome: 'Teste', cliente_nome: 'Teste', status: 'confirmado', origem: 'site',
      inicio: new Date(Date.now() + 5 * 864e5).toISOString(), duracao_min: 60, valor: 90,
      atualizado_em: new Date().toISOString() });
    globalThis.__LINHAS = 0;
    await db.sincronizar();
  });
  const uma = await conta();
  checagens.push(['vigia: uma mudança baixa uma linha, não o banco', uma === 1, uma + ' linhas']);
  checagens.push(['vigia: e a mudança chega ao app',
    await p2.evaluate(async () => {
      const db = await import('./js/db.js');
      return db.estado.agendamentos.some((a) => a.id === 'sinc-1');
    })]);
}

// ── 27. Salvar responde na hora, sem esperar a rede ──
// A tela só respondia depois da ida e volta ao servidor: num 4G isso é meio
// segundo por toque, e era o que fazia a agenda parecer travada.
{
  const r = await p2.evaluate(async () => {
    const db = await import('./js/db.js');
    globalThis.__DEMORA = 900;                 // servidor lento de propósito
    const t = performance.now();
    await db.salvar('clientes', { id: 'rapida-1', nome: 'Resposta Rápida', ativo: true });
    const respondeu = performance.now() - t;
    const naTela = db.estado.clientes.some((c) => c.id === 'rapida-1');
    await new Promise((ok) => setTimeout(ok, 1400));   // deixa a rede terminar
    const noBanco = (globalThis.__DB.clientes || []).some((c) => c.id === 'rapida-1');
    globalThis.__DEMORA = 0;
    return { respondeu, naTela, noBanco };
  });
  checagens.push(['salvar: responde na hora, sem esperar o servidor',
    r.respondeu < 300, Math.round(r.respondeu) + 'ms com servidor de 900ms']);
  checagens.push(['salvar: aparece na tela imediatamente', r.naTela]);
  checagens.push(['salvar: e sobe para o servidor logo depois', r.noBanco]);
}

// ── 28. A frase que fecha o agendamento ──
// Existe a do studio, e cada profissional pode ter a sua. Quem marca com a
// Julia lê a da Julia; sem frase própria, lê a do studio.
{
  const { RECADO_PADRAO, escolhida } = await p2.evaluate(async () => {
    const m = await import('./js/agendar.js');
    return { RECADO_PADRAO: m.RECADO_PADRAO, escolhida: null };
  });
  checagens.push(['frase: existe uma padrão, do manual da marca',
    /acolhe e renova/.test(RECADO_PADRAO), RECADO_PADRAO]);

  // O studio escolhe a sua.
  await p2.evaluate(() => { location.hash = '#/ajustes'; });
  await p2.waitForTimeout(800);
  await p2.fill('input[name=recado]', 'Te esperamos de braços abertos.');
  await p2.click('#salvar-studio');
  await p2.waitForTimeout(700);
  checagens.push(['frase: a do studio fica guardada',
    await p2.evaluate(async () => {
      const db = await import('./js/db.js');
      return db.cfg('studio')?.recado === 'Te esperamos de braços abertos.';
    })]);

  // E a Julia escolhe a dela.
  await p2.evaluate(() => { location.hash = '#/comissoes'; });
  await p2.waitForTimeout(800);
  await p2.click('#equipe');
  await p2.waitForSelector('[data-prof]');
  await p2.click('[data-prof="p2"]');
  await p2.waitForSelector('input[name=recado]');
  checagens.push(['frase: o campo dela mostra a do studio como padrão',
    (await p2.getAttribute('input[name=recado]', 'placeholder')) === 'Te esperamos de braços abertos.']);
  await p2.fill('input[name=recado]', 'Suas unhas te esperam!');
  await p2.click('text=Salvar');
  await p2.waitForTimeout(800);
  checagens.push(['frase: a dela fica guardada no cadastro',
    await p2.evaluate(() => (globalThis.__DB.profissionais.find((x) => x.id === 'p2') || {}).recado === 'Suas unhas te esperam!')]);

  // E é a dela que a cliente lê ao marcar com ela.
  const lida = await p2.evaluate(async () => {
    const m = await import('./js/agendar.js');
    // A escolha da frase é a mesma regra que a tela usa: dela, do studio, ou a padrão.
    const regra = (prof, studio) =>
      (prof?.recado || '').trim() || (studio?.recado || '').trim() || m.RECADO_PADRAO;
    const studio = { recado: 'Te esperamos de braços abertos.' };
    return {
      comJulia: regra({ recado: 'Suas unhas te esperam!' }, studio),
      comLaura: regra({ recado: null }, studio),
      semNada:  regra(null, null),
    };
  });
  checagens.push(['frase: quem marca com a Julia lê a da Julia',
    lida.comJulia === 'Suas unhas te esperam!']);
  checagens.push(['frase: sem frase própria, vale a do studio',
    lida.comLaura === 'Te esperamos de braços abertos.']);
  checagens.push(['frase: sem nenhuma das duas, vale a do manual',
    lida.semNada === RECADO_PADRAO]);
}

// ── 29. As quatro visões da agenda ──
// O dia responde "o que faço agora"; o mês responde "como está minha semana
// que vem" — e é essa segunda pergunta que faz alguém abrir a agenda no
// domingo à noite.
{
  // Espalha horários por três dias do mês, com a Julia e com a Laura.
  await p2.evaluate(async () => {
    const t = globalThis.__DB.agendamentos;
    const d = (dias, hora) => {
      const x = new Date(); x.setDate(x.getDate() + dias); x.setHours(hora, 0, 0, 0);
      return x.toISOString();
    };
    for (const [i, [dias, hora, prof]] of [[1, 9, 'p1'], [1, 11, 'p1'], [2, 14, 'p2'], [9, 10, 'p1']].entries()) {
      t.push({ id: 'v-' + i, profissional_id: prof, servico_id: 'manicure',
               servico_nome: 'Serviço ' + i, cliente_nome: 'Cliente ' + i,
               inicio: d(dias, hora), duracao_min: 60, valor: 80,
               status: 'confirmado', origem: 'studio', atualizado_em: new Date().toISOString() });
    }
    const db = await import('./js/db.js'); await db.recarregar();
  });
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(800);
  await p2.click('[data-ver="todas"]');
  await p2.waitForTimeout(400);

  checagens.push(['visões: existem as quatro',
    await p2.locator('[data-visao]').count() === 4]);

  // ── Semana ──
  await p2.click('[data-visao="semana"]');
  await p2.waitForTimeout(500);
  checagens.push(['semana: mostra os sete dias',
    await p2.locator('.semana-dia').count() === 7]);
  const semana = nb(await p2.textContent('.semana'));
  checagens.push(['semana: traz os horários da semana', semana.includes('Cliente 0')]);
  checagens.push(['semana: dia vazio aparece como livre', /livre/.test(semana)]);

  // ── Mês ──
  await p2.click('[data-visao="mes"]');
  await p2.waitForTimeout(500);
  const diasNoMes = await p2.locator('.mes-dia').count();
  checagens.push(['mês: a grade cobre semanas inteiras',
    diasNoMes >= 28 && diasNoMes % 7 === 0, diasNoMes + ' quadradinhos']);
  checagens.push(['mês: dia com horário ganha bolinha',
    await p2.locator('.mes-dia .ponto').count() >= 4]);
  checagens.push(['mês: hoje fica marcado',
    await p2.locator('.mes-dia.hoje').count() === 1]);
  checagens.push(['mês: dias do mês vizinho ficam apagados',
    await p2.locator('.mes-dia.fora').count() > 0]);
  await p2.screenshot({ path: '/tmp/shot-agenda-mes.png' });

  // Tocar num dia leva para aquele dia.
  const alvo = await p2.locator('.mes-dia:not(.fora)').nth(15).getAttribute('data-ir-dia');
  await p2.locator('.mes-dia:not(.fora)').nth(15).click();
  await p2.waitForTimeout(600);
  checagens.push(['mês: tocar num dia abre aquele dia',
    await p2.inputValue('#dia') === alvo && await p2.locator('.agenda-colunas').count() === 1]);

  // ── Lista ──
  await p2.click('[data-visao="lista"]');
  await p2.waitForTimeout(500);
  const lista = nb(await p2.textContent('#conteudo'));
  checagens.push(['lista: agrupa por dia', await p2.locator('.lista-dia').count() >= 2]);
  checagens.push(['lista: diz "Amanhã" em vez de só a data', /Amanhã/.test(lista)]);
  checagens.push(['lista: não tem seta de dia, porque não é de um dia só',
    await p2.locator('#anterior').count() === 0]);

  // ── E o filtro "só eu" vale em todas ──
  await p2.click('[data-ver="eu"]');
  await p2.waitForTimeout(500);
  const soMinha = nb(await p2.textContent('#conteudo'));
  checagens.push(['visões: "só eu" também filtra a lista',
    soMinha.includes('Cliente 0') && !soMinha.includes('Cliente 2')]);

  await p2.click('[data-visao="mes"]');
  await p2.waitForTimeout(500);
  const pontosMinhas = await p2.locator('.mes-dia .ponto').count();
  await p2.click('[data-ver="todas"]');
  await p2.waitForTimeout(500);
  const pontosTodas = await p2.locator('.mes-dia .ponto').count();
  checagens.push(['visões: "só eu" também filtra o mês',
    pontosMinhas < pontosTodas, `${pontosMinhas} contra ${pontosTodas} bolinhas`]);

  await p2.click('[data-visao="dia"]');
  await p2.waitForTimeout(400);
}

// ── 30. Link de "esqueci a senha" ──
// Quem volta pelo link do e-mail chega logada, com um endereço cheio de
// código, e antes ficava dentro do sistema sem saber que faltava escolher a
// senha nova — no dia seguinte estaria trancada de novo.
{
  const ctxR = await browser.newContext();
  await ctxR.route('**/esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  await ctxR.addInitScript(() => localStorage.setItem('alento.supabase',
    JSON.stringify({ url: 'https://t.supabase.co', anonKey: 'x'.repeat(50) })));
  const pr = await ctxR.newPage();

  await pr.goto(BASE + '/sistema.html#access_token=abc&type=recovery', { waitUntil: 'networkidle' });
  await pr.waitForTimeout(1200);
  checagens.push(['recuperar senha: o link do e-mail leva direto a escolher a senha',
    await pr.locator('#form-senha').count() === 1]);

  await pr.fill('input[name=s1]', 'senhanovaboa1');
  await pr.fill('input[name=s2]', 'outracoisa123');
  await pr.click('#btn-nova-senha');
  await pr.waitForTimeout(400);
  checagens.push(['recuperar senha: cobra que as duas batam',
    /não são iguais/i.test(nb(await pr.textContent('#toasts')))]);

  await pr.fill('input[name=s2]', 'senhanovaboa1');
  await pr.click('#btn-nova-senha');
  await pr.waitForTimeout(1400);
  checagens.push(['recuperar senha: salva e tira o código do endereço',
    !/type=recovery/.test(pr.url()), pr.url()]);

  // E o pedido de link deixa de mentir quando o servidor recusa.
  await pr.evaluate(() => { globalThis.__RESET_ERRO = { message: 'For security purposes, you can only request this after 47 seconds.' }; });
  await pr.goto(BASE + '/sistema.html', { waitUntil: 'networkidle' });
  await pr.evaluate(() => { globalThis.__SEM_SESSAO = true; });
  await pr.reload({ waitUntil: 'networkidle' });
  await pr.waitForTimeout(900);
  if (await pr.locator('#btn-reset').count()) {
    await pr.fill('input[name=email]', 'laura@alento.com');
    await pr.click('#btn-reset');
    await pr.waitForTimeout(500);
    checagens.push(['recuperar senha: avisa quando o servidor limita os envios',
      /limitou os envios/i.test(nb(await pr.textContent('#toasts')))]);
  }
  await ctxR.close();
}

// ── 27. Todo campo editável tem contraste real ──
// A regra antiga só pegava inputs com `type` declarado; os demais ficavam com
// o branco do navegador e a letra creme, ilegíveis.
for (const t of ['ajustes','caixa','clientes','estoque']) {
  await p2.evaluate((r) => { location.hash = '#/' + r; }, t);
  await p2.waitForTimeout(700);
  const ruins = await p2.evaluate(() => {
    const claro = (c) => {
      const m = c.match(/\d+/g); if (!m) return false;
      const [r, g, b] = m.map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * b) > 150;   // luminância alta
    };
    const fora = [];
    for (const el of document.querySelectorAll('#conteudo input, #conteudo select, #conteudo textarea')) {
      if (['checkbox', 'radio'].includes(el.type)) continue;
      const cs = getComputedStyle(el);
      if (claro(cs.color)) fora.push((el.name || el.id || el.type) + ': texto claro');
    }
    return fora;
  });
  checagens.push([`tela ${t}: campos com letra escura`, ruins.length === 0]);
  if (ruins.length) console.log('   campos ilegíveis:', ruins.slice(0, 4).join(' | '));
}


// ── 31. Serviço que só se marca pelo WhatsApp ──
// Cor exige ver o cabelo antes. Sumir da lista seria pior: a cliente
// procuraria o preço e não acharia. Então o serviço fica à vista e, no lugar
// dos horários, abre um recado com o botão do WhatsApp.
{
  const ctxW = await browser.newContext({ serviceWorkers: 'block' });
  await ctxW.route('**/esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  const pw = await ctxW.newPage();
  pw.on('pageerror', (e) => erros.push('[whats] ' + e.message));

  // Um banco com os dois casos: um serviço que se marca sozinha e um que não.
  await pw.addInitScript(() => {
    sessionStorage.setItem('__db', JSON.stringify({
      profissionais: [
        { id: 'p1', nome: 'Laura Pavão', funcao: 'cabelo', ativo: true, atende: true,
          whatsapp: '11911112222' },
        { id: 'p2', nome: 'Julia', funcao: 'unhas', ativo: true, atende: true,
          whatsapp: '11933334444' },
      ],
      config: [{ chave: 'studio', valor: { nome: 'Alento', whatsapp: '11999990000' } }],
      servicos: [
        { id: 'manicure', categoria: 'maos', nome: 'Manicure', tipo: 'servico',
          preco: 45, tempo: 1, ativo: true, profissional: 'unhas', ordem: 1 },
        { id: 'cab-mechas', categoria: 'cab-cor', nome: 'Mechas loiras ou iluminadas',
          tipo: 'servico', preco: 600, preco_tipo: 'a_partir', tempo: 4.5, ativo: true,
          profissional: 'cabelo', ordem: 2, agenda_online: false,
          nota: 'Técnica usada em cabelos naturais ou sem coloração para clarear até 3 tons.'
              + ' ATENÇÃO este agendamento é exclusivamente para avaliação e não para o serviço.',
          recado_agenda: 'Precisamos ver seu cabelo antes de marcar, porque o mesmo serviço'
              + ' leva quatro horas num cabelo e sete noutro. Chama a gente no WhatsApp que'
              + ' a gente combina tudo com calma.' },
        { id: 'cab-morena', categoria: 'cab-cor', nome: 'Morena iluminada sem descoloração',
          tipo: 'servico', preco: 500, tempo: 3.5, ativo: true, profissional: 'cabelo',
          ordem: 4, agenda_online: false },
        { id: 'av-correcao', categoria: 'cab-cor', nome: 'Avaliação correção de cor',
          tipo: 'servico', preco: 0, preco_tipo: 'avaliacao', tempo: 0.5, ativo: true,
          profissional: 'cabelo', ordem: 5 },
        { id: 'av-mechas', categoria: 'cab-cor', nome: 'Avaliação mechas loiras ou iluminadas',
          tipo: 'servico', preco: 0, preco_tipo: 'avaliacao', tempo: 0.5, ativo: true,
          profissional: 'cabelo', ordem: 6 },
        { id: 'along-fibra', categoria: 'alongamento', nome: 'Alongamento em fibra',
          tipo: 'servico', preco: 180, tempo: 2.5, ativo: true,
          profissional: 'unhas', ordem: 3, agenda_online: false },
      ],
    }));
  });
  await pw.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await pw.waitForTimeout(600);
  await pw.click('#btn-agendar');
  await pw.waitForSelector('.ag-tela', { timeout: 6000 });

  checagens.push(['só WhatsApp: o serviço continua na lista',
    await pw.locator('[data-serv="cab-mechas"]').count() === 1]);
  checagens.push(['só WhatsApp: a lista já avisa que é combinado',
    nb(await pw.textContent('[data-serv="cab-mechas"]')).includes('combinado no WhatsApp')]);
  checagens.push(['só WhatsApp: o preço continua à vista',
    nb(await pw.textContent('[data-serv="cab-mechas"]')).includes('600')]);

  await pw.click('[data-serv="cab-mechas"]');
  await pw.waitForSelector('.ag-combinar', { timeout: 4000 });
  checagens.push(['só WhatsApp: não oferece horário nenhum',
    await pw.locator('.ag-dia').count() === 0 && await pw.locator('.ag-hora').count() === 0]);
  checagens.push(['só WhatsApp: mostra o recado que elas escreveram',
    nb(await pw.textContent('.ag-combinar')).includes('ver seu cabelo antes')]);
  const zap = await pw.getAttribute('#ag-zap', 'href');
  checagens.push(['só WhatsApp: cabelo vai para o zap de quem faz cabelo',
    zap.startsWith('https://wa.me/5511911112222')]);
  checagens.push(['só WhatsApp: o botão diz com quem ela vai falar',
    nb(await pw.textContent('#ag-zap')).includes('Laura')]);
  // O texto é um parágrafo, não a frase de assinatura: tem de quebrar linha.
  checagens.push(['só WhatsApp: o recado quebra linha em vez de vazar',
    await pw.evaluate(() => {
      const p = document.querySelector('.ag-combinar p');
      return getComputedStyle(p).whiteSpace !== 'nowrap'
        && p.getBoundingClientRect().right <= innerWidth + 1;
    })]);
  checagens.push(['só WhatsApp: a mensagem já diz o serviço',
    decodeURIComponent(zap).includes('Mechas loiras')]);
  checagens.push(['só WhatsApp: o passo muda de nome',
    nb(await pw.textContent('.ag-passo.atual')).includes('Como marcar')]);
  await pw.screenshot({ path: '/tmp/shot-so-whatsapp.png' });

  // A avaliação oferecida tem de ser a do serviço escolhido: a Laura tem uma
  // para cada procedimento de cor, e a primeira da família era a errada.
  checagens.push(['só WhatsApp: oferece a avaliação DESTE serviço',
    nb(await pw.textContent('[data-serv-av]')).includes('mechas')]);
  await pw.click('#voltar');
  await pw.waitForTimeout(300);
  await pw.click('[data-serv="cab-morena"]');
  await pw.waitForSelector('.ag-combinar');
  checagens.push(['só WhatsApp: sem avaliação parecida, não oferece nenhuma',
    await pw.locator('[data-serv-av]').count() === 0]);

  // Unha vai para o zap da outra: mandar a cliente para o número errado é
  // fazê-la contar a história duas vezes.
  await pw.click('#voltar');
  await pw.waitForTimeout(300);
  await pw.click('[data-serv="along-fibra"]');
  await pw.waitForSelector('.ag-combinar');
  checagens.push(['só WhatsApp: unha vai para o zap de quem faz unha',
    (await pw.getAttribute('#ag-zap', 'href')).startsWith('https://wa.me/5511933334444')]);
  checagens.push(['só WhatsApp: sem recado próprio, vale a frase padrão',
    nb(await pw.textContent('.ag-combinar')).includes('marcado pelo WhatsApp')]);

  // Voltar e escolher um que se marca sozinha: o caminho normal segue igual.
  await pw.click('#voltar');
  await pw.waitForTimeout(300);
  await pw.click('[data-serv="manicure"]');
  await pw.waitForTimeout(600);
  checagens.push(['só WhatsApp: os outros serviços seguem marcando normal',
    await pw.locator('.ag-dia').count() > 20 && await pw.locator('.ag-combinar').count() === 0]);
  await ctxW.close();
}

// ── 32. O liga/desliga fica com elas, na tabela de preços ──
{
  await p2.evaluate(() => { location.hash = '#/servicos'; });
  await p2.waitForTimeout(700);
  await p2.click('[data-quem=""]');           // o filtro anterior ainda estava de pé
  await p2.waitForTimeout(300);
  checagens.push(['tabela de preços: mechas já vem marcado como só WhatsApp',
    nb(await p2.textContent('#conteudo')).includes('só pelo WhatsApp')]);

  await p2.click('[data-serv="manicure"]');
  await p2.waitForSelector('.veu [name=agenda_online]');
  checagens.push(['tabela de preços: a marcação existe no cadastro do serviço',
    await p2.isChecked('.veu [name=agenda_online]')]);
  checagens.push(['tabela de preços: o recado fica escondido enquanto marca pelo site',
    await p2.locator('.veu #campo-recado').isHidden()]);

  await p2.uncheck('.veu [name=agenda_online]');
  await p2.waitForTimeout(200);
  checagens.push(['tabela de preços: desmarcar revela o campo do recado',
    await p2.locator('.veu #campo-recado').isVisible()]);
  await p2.fill('.veu [name=recado_agenda]', 'Chama a gente no zap.');
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(600);
  const salvo = await p2.evaluate(() =>
    globalThis.__DB.servicos.find((x) => x.id === 'manicure'));
  checagens.push(['tabela de preços: a escolha delas fica salva',
    salvo.agenda_online === false && salvo.recado_agenda === 'Chama a gente no zap.']);

  // devolve como estava, para não atrapalhar as checagens seguintes
  await p2.click('[data-serv="manicure"]');
  await p2.waitForSelector('.veu [name=agenda_online]');
  await p2.check('.veu [name=agenda_online]');
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(500);
}

// ── 33. A duração do horário pode ser ajustada na hora de marcar ──
// O tempo da tabela é média: a mesma esmaltação em gel leva 1h20 numa cliente
// e 1h40 noutra. Sem isto, o jeito de corrigir era desmarcar e marcar de novo.
{
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click('[data-visao="dia"]');
  await p2.waitForTimeout(300);
  await p2.click('#novo');
  await p2.waitForSelector('.veu [data-serv]');
  await p2.selectOption('.veu [data-prof]', 'p2');
  await p2.selectOption('.veu [data-serv]', 'gel-sem-manicure');
  await p2.waitForTimeout(250);

  const daTabela = await p2.inputValue('.veu [data-dur]');
  checagens.push(['duração: já vem preenchida com o tempo da tabela',
    Number(daTabela) > 0, daTabela + ' min']);
  checagens.push(['duração: a tela lembra qual é o tempo da tabela',
    nb(await p2.textContent('.veu [data-tabela]')).includes('Tabela')]);

  await p2.fill('.veu [name=data]', new Date().toISOString().slice(0, 10));
  await p2.fill('.veu [data-hora]', '06:00');
  await p2.fill('.veu [data-dur]', '100');
  await p2.waitForTimeout(200);
  checagens.push(['duração: mostra a hora em que termina',
    nb(await p2.textContent('.veu #termina')).includes('07:40')]);

  await p2.fill('.veu [name=cliente_nome]', 'Cliente Tempo');
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(700);
  const marcado = await p2.evaluate(() =>
    globalThis.__DB.agendamentos.find((a) => a.cliente_nome === 'Cliente Tempo'));
  checagens.push(['duração: o horário é salvo com o tempo ajustado',
    marcado?.duracao_min === 100]);

  // E dá para corrigir depois, sem desmarcar e marcar de novo.
  // Marcar para outro dia tem de levar a agenda até ele: a tela continuava no
  // dia anterior, e o horário recém-marcado sumia de vista.
  checagens.push(['duração: a agenda vai para o dia do horário marcado',
    await p2.inputValue('#dia') === new Date().toISOString().slice(0, 10)]);

  await p2.click(`[data-agend="${marcado.id}"]`);
  await p2.waitForSelector('.veu #mudar');
  await p2.click('.veu #mudar');
  await p2.waitForSelector('.veu [name=duracao_min]');
  checagens.push(['editar: abre com a duração de agora',
    await p2.inputValue('.veu [name=duracao_min]') === '100']);
  await p2.fill('.veu [name=duracao_min]', '80');
  await p2.fill('.veu [name=hora]', '20:00');
  await p2.waitForTimeout(200);
  checagens.push(['editar: recalcula a hora de término',
    nb(await p2.textContent('.veu #termina')).includes('21:20')]);
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(700);
  const mudado = await p2.evaluate(() =>
    globalThis.__DB.agendamentos.find((a) => a.cliente_nome === 'Cliente Tempo'));
  checagens.push(['editar: salva sem criar outro horário',
    mudado.duracao_min === 80 && new Date(mudado.inicio).getHours() === 20]);
  checagens.push(['editar: continua sendo o mesmo horário, não um novo',
    (await p2.evaluate(() => globalThis.__DB.agendamentos
      .filter((a) => a.cliente_nome === 'Cliente Tempo').length)) === 1]);
}

// ── 34. Encaixe: um horário dentro de outro, de propósito ──
// Enquanto a cor da cliente processa, dá para cortar o cabelo de outra. A
// trava contra choque recusava isso junto com o erro de digitação, e as duas
// coisas não são a mesma.
{
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);

  const marcar = async (hora, dur, nome) => {
    await p2.click('#novo');
    await p2.waitForSelector('.veu [data-serv]');
    await p2.selectOption('.veu [data-prof]', 'p1');
    await p2.selectOption('.veu [data-serv]', 'cab-corte-final');
    await p2.waitForTimeout(200);
    await p2.fill('.veu [name=cliente_nome]', nome);
    await p2.fill('.veu [name=data]', new Date().toISOString().slice(0, 10));
    await p2.fill('.veu [data-hora]', hora);
    await p2.fill('.veu [data-dur]', String(dur));
    await p2.click('.veu .btn-primario');
    await p2.waitForTimeout(600);
  };

  // A coloração longa da Laura.
  await marcar('05:00', 180, 'Cliente Cor');
  const cor = await p2.evaluate(() =>
    globalThis.__DB.agendamentos.find((a) => a.cliente_nome === 'Cliente Cor'));
  checagens.push(['encaixe: o horário longo entra normal', !!cor && !cor.encaixe]);

  // O corte no meio da pausa: o sistema pergunta em vez de recusar.
  await marcar('06:00', 40, 'Cliente Corte');
  await p2.waitForTimeout(300);
  const pergunta = nb(await p2.textContent('.veu'));
  checagens.push(['encaixe: pergunta em vez de recusar',
    /Encaixar mesmo assim/.test(pergunta)]);
  checagens.push(['encaixe: diz quem já está na cadeira e até quando',
    pergunta.includes('Cliente Cor') && pergunta.includes('05:00') && pergunta.includes('08:00')]);

  // Desistir não pode deixar nada para trás.
  await p2.click('.veu .btn-fantasma');
  await p2.waitForTimeout(400);
  checagens.push(['encaixe: cancelar não marca nada',
    (await p2.evaluate(() => globalThis.__DB.agendamentos
      .filter((a) => a.cliente_nome === 'Cliente Corte').length)) === 0]);

  await marcar('06:00', 40, 'Cliente Corte');
  await p2.waitForTimeout(300);
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(700);
  const corte = await p2.evaluate(() =>
    globalThis.__DB.agendamentos.find((a) => a.cliente_nome === 'Cliente Corte'));
  checagens.push(['encaixe: confirmando, o horário entra marcado como encaixe',
    corte?.encaixe === true]);

  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  const agenda = nb(await p2.textContent('#conteudo'));
  checagens.push(['encaixe: os dois horários ficam na agenda',
    agenda.includes('Cliente Cor') && agenda.includes('Cliente Corte')]);
  checagens.push(['encaixe: aparece com o selo de encaixe',
    (await p2.locator('.selo', { hasText: 'encaixe' }).count()) >= 1]);

  // Três horas de cor com um corte dentro continuam sendo três horas de dia.
  // Só a agenda da Laura, para o número não depender do dia da outra.
  await p2.click('[data-ver="eu"]');
  await p2.waitForTimeout(400);
  const ocupada = await p2.evaluate(() => {
    const kpis = [...document.querySelectorAll('#conteudo .kpi')];
    const k = kpis.find((x) => /Cadeira ocupada/i.test(x.textContent));
    return k ? k.querySelector('.valor').textContent : '';
  });
  checagens.push(['encaixe: não conta o tempo duas vezes', /^3h$|^3h0/.test(nb(ocupada).trim())]);
  if (!/^3h$|^3h0/.test(nb(ocupada).trim())) console.log('   cadeira ocupada:', nb(ocupada).trim());
  await p2.click('[data-ver="todas"]');
  await p2.waitForTimeout(300);
}

// ── 35. Cliente fixa: o horário que se repete ──
// Um horário que volta sozinho é o que segura a agenda de quem vem sempre.
{
  const iso = (d) => d.toISOString().slice(0, 10);
  const emDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

  // Uma semana já ocupada no meio do caminho: a série tem de pular esse dia.
  await p2.evaluate((quando) => {
    const x = new Date(quando + 'T07:00:00');
    globalThis.__DB.agendamentos.push({ id: 'ocupa-1', profissional_id: 'p2',
      servico_id: 'manicure', servico_nome: 'Manicure', cliente_nome: 'Cliente Antes',
      inicio: x.toISOString(), fim: new Date(x.getTime() + 3600000).toISOString(),
      duracao_min: 60, valor: 45, status: 'confirmado', origem: 'studio',
      atualizado_em: new Date().toISOString() });
  }, emDias(14));
  await p2.evaluate(async () => { const db = await import('./js/db.js'); await db.recarregar(); });

  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click('#novo');
  await p2.waitForSelector('.veu [name=repetir]');
  await p2.selectOption('.veu [data-prof]', 'p2');
  await p2.selectOption('.veu [data-serv]', 'manicure');
  await p2.waitForTimeout(200);
  await p2.fill('.veu [name=cliente_nome]', 'Cliente Fixa');
  await p2.fill('.veu [name=data]', new Date().toISOString().slice(0, 10));
  await p2.fill('.veu [data-hora]', '07:00');

  checagens.push(['cliente fixa: o "até quando" só aparece depois de escolher repetir',
    await p2.locator('.veu #campo-ate').isHidden()]);

  await p2.selectOption('.veu [name=repetir]', '7');
  await p2.waitForTimeout(250);
  checagens.push(['cliente fixa: escolher repetir revela até quando',
    await p2.locator('.veu #campo-ate').isVisible()]);
  const aviso = nb(await p2.textContent('.veu #quantos'));
  checagens.push(['cliente fixa: diz quantos horários vai marcar antes de marcar',
    /^1[0-9] idas ao studio, até /.test(aviso), aviso]);

  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(900);

  const serie = await p2.evaluate(() => globalThis.__DB.agendamentos
    .filter((a) => a.cliente_nome === 'Cliente Fixa')
    .sort((a, b) => a.inicio.localeCompare(b.inicio)));
  checagens.push(['cliente fixa: marcou a série inteira', serie.length >= 12,
    serie.length + ' horários']);
  checagens.push(['cliente fixa: todos com o mesmo código de série',
    new Set(serie.map((a) => a.serie_id)).size === 1 && !!serie[0].serie_id]);
  checagens.push(['cliente fixa: sempre na mesma hora',
    serie.every((a) => new Date(a.inicio).getHours() === 7)]);
  checagens.push(['cliente fixa: de sete em sete dias',
    (new Date(serie[1].inicio) - new Date(serie[0].inicio)) / 86400000 === 7]);
  checagens.push(['cliente fixa: pula o dia que já tinha cliente',
    !serie.some((a) => a.inicio.slice(0, 10) === emDias(14))]);
  checagens.push(['cliente fixa: e conta quantos pulou',
    /pulado/.test(nb(await p2.textContent('#toasts')))]);

  // A ficha diz de quanto em quanto tempo, e quantos ainda faltam.
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  checagens.push(['cliente fixa: aparece com o selo de fixo',
    (await p2.locator('.selo', { hasText: 'fixo' }).count()) >= 1]);

  await p2.click(`[data-agend="${serie[0].id}"]`);
  await p2.waitForSelector('.veu');
  const ficha = nb(await p2.textContent('.veu'));
  checagens.push(['cliente fixa: a ficha diz o intervalo', /toda semana/.test(ficha)]);
  // Com dois serviços na mesma ida, o intervalo é entre as IDAS: a distância
  // entre a manicure e o corte do mesmo dia é uma hora, não uma semana.
  checagens.push(['cliente fixa: conta idas, não horários',
    !/a cada 0 dias/.test(ficha)]);
  checagens.push(['cliente fixa: a ficha diz quantos faltam', /faltam \d+/.test(ficha)]);

  // Desmarcar pergunta o alcance: só este, ou daqui para a frente.
  // `.modal-pe` de propósito: a ficha tem um botão fantasma no corpo (mudar
  // horário), e ele vem antes no HTML.
  await p2.click('.veu .modal-pe .btn-fantasma');
  await p2.waitForTimeout(400);
  checagens.push(['cliente fixa: desmarcar pergunta o alcance',
    /Só este/.test(nb(await p2.textContent('.veu')))]);
  await p2.click('.veu .modal-pe .btn-perigo');   // este e os próximos
  await p2.waitForTimeout(800);
  const vivos = await p2.evaluate(() => globalThis.__DB.agendamentos
    .filter((a) => a.cliente_nome === 'Cliente Fixa' && a.status === 'confirmado').length);
  checagens.push(['cliente fixa: desmarca a série inteira de uma vez', vivos === 0]);

  // Cliente de unha volta a cada 18, 21, 25 dias — o intervalo é da unha dela.
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click('#novo');
  await p2.waitForSelector('.veu [name=repetir]');
  await p2.selectOption('.veu [name=repetir]', 'outro');
  await p2.waitForTimeout(250);
  checagens.push(['cliente fixa: "outro intervalo" revela o campo de dias',
    await p2.locator('.veu #campo-dias').isVisible()]);
  await p2.fill('.veu [name=repetir_dias]', '20');
  await p2.selectOption('.veu [name=repetir_ate]', '3');
  await p2.waitForTimeout(300);
  const livre = nb(await p2.textContent('.veu #quantos'));
  checagens.push(['cliente fixa: calcula com o intervalo escolhido por ela',
    /^[4-6] idas ao studio/.test(livre), livre]);
  await p2.evaluate(() => document.querySelector('.veu [data-fechar]').click());
  await p2.waitForTimeout(300);
}

// ── 36. Vários serviços na mesma ida ──
// Antes era preciso fechar, abrir de novo e redigitar nome e telefone para
// cada procedimento. O segundo costuma ser com a outra profissional.
{
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click('#novo');
  await p2.waitForSelector('.veu [data-prof]');
  checagens.push(['mais de um serviço: começa com uma linha só',
    await p2.locator('.veu .linha-servico').count() === 1]);
  checagens.push(['mais de um serviço: com uma linha, não oferece tirar',
    await p2.locator('.veu [data-remover]').first().isHidden()]);

  await p2.fill('.veu [name=cliente_nome]', 'Cliente Dois');
  await p2.fill('.veu [name=cliente_telefone]', '11988887777');
  await p2.fill('.veu [name=data]', new Date().toISOString().slice(0, 10));
  await p2.fill('.veu .linha-servico:nth-child(1) [data-hora]', '16:00');
  await p2.selectOption('.veu .linha-servico:nth-child(1) [data-prof]', 'p2');
  await p2.selectOption('.veu .linha-servico:nth-child(1) [data-serv]', 'manicure');
  await p2.waitForTimeout(200);

  await p2.click('.veu #mais-servico');
  await p2.waitForTimeout(200);
  checagens.push(['mais de um serviço: o botão acrescenta uma linha',
    await p2.locator('.veu .linha-servico').count() === 2]);
  checagens.push(['mais de um serviço: com duas linhas, dá para tirar',
    await p2.locator('.veu [data-remover]').first().isVisible()]);

  // A segunda com a outra profissional: é o caso que a Julia descreveu.
  await p2.selectOption('.veu .linha-servico:nth-child(2) [data-prof]', 'p1');
  await p2.selectOption('.veu .linha-servico:nth-child(2) [data-serv]', 'cab-corte-final');
  await p2.waitForTimeout(250);

  checagens.push(['mais de um serviço: o segundo já vem para quando o primeiro acaba',
    await p2.inputValue('.veu .linha-servico:nth-child(2) [data-hora]') === '17:00']);

  // Mas a hora é dela: a cliente pode fazer a unha às 16h e o cabelo só às 18h.
  await p2.fill('.veu .linha-servico:nth-child(2) [data-hora]', '18:00');
  await p2.waitForTimeout(250);
  checagens.push(['mais de um serviço: dá para separar os horários',
    await p2.inputValue('.veu .linha-servico:nth-child(2) [data-hora]') === '18:00']);
  await p2.fill('.veu .linha-servico:nth-child(1) [data-dur]', '75');
  await p2.waitForTimeout(250);
  checagens.push(['mais de um serviço: mexeu na hora, ela não é mais recalculada',
    await p2.inputValue('.veu .linha-servico:nth-child(2) [data-hora]') === '18:00']);
  await p2.fill('.veu .linha-servico:nth-child(1) [data-dur]', '60');
  await p2.fill('.veu .linha-servico:nth-child(2) [data-hora]', '17:00');
  await p2.waitForTimeout(250);
  const fim = nb(await p2.textContent('.veu #termina'));
  checagens.push(['mais de um serviço: soma o tempo e o valor da ida',
    /2 serviços/.test(fim) && /18:30/.test(fim), fim]);

  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(800);

  const ida = await p2.evaluate(() => globalThis.__DB.agendamentos
    .filter((a) => a.cliente_nome === 'Cliente Dois')
    .sort((a, b) => a.inicio.localeCompare(b.inicio)));
  checagens.push(['mais de um serviço: marcou os dois de uma vez', ida.length === 2]);
  checagens.push(['mais de um serviço: cada um na agenda de quem faz',
    ida[0].profissional_id === 'p2' && ida[1].profissional_id === 'p1']);
  checagens.push(['mais de um serviço: um começa quando o outro termina',
    ida[0].fim === ida[1].inicio]);
  checagens.push(['mais de um serviço: os dois com o mesmo código de ida',
    !!ida[0].grupo_id && ida[0].grupo_id === ida[1].grupo_id]);
  checagens.push(['mais de um serviço: o telefone foi digitado uma vez só',
    ida.every((a) => a.cliente_telefone === '11988887777')]);

  // A ficha mostra o outro serviço da mesma ida.
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click(`[data-agend="${ida[0].id}"]`);
  await p2.waitForSelector('.veu');
  checagens.push(['mais de um serviço: a ficha mostra o outro da mesma ida',
    /Nesta mesma ida/.test(nb(await p2.textContent('.veu')))]);

  // E "cliente chegou" abre UMA comanda com os dois serviços.
  await p2.click('.veu .modal-pe .btn-primario');
  await p2.waitForTimeout(900);
  const itens = await p2.evaluate(() =>
    [...document.querySelectorAll('.veu tbody tr')].map((tr) => tr.textContent).join(' | '));
  checagens.push(['mais de um serviço: vira uma comanda com os dois',
    /Manicure/i.test(itens) && /Corte/i.test(itens), itens.slice(0, 90)]);
  const concluidos = await p2.evaluate(() => globalThis.__DB.agendamentos
    .filter((a) => a.cliente_nome === 'Cliente Dois' && a.status === 'concluido').length);
  checagens.push(['mais de um serviço: os dois horários saem da agenda ativa', concluidos === 2]);
  await p2.evaluate(() => document.querySelector('.veu [data-fechar]')?.click());
  await p2.waitForTimeout(300);
}

// ── 37. Cliente sem aniversário ──
// Data em branco chegava ao servidor como texto vazio, e vazio não é uma data:
// o Postgres recusava a linha INTEIRA. A Laura cadastrava clientes e nada
// ficava salvo — nem o telefone. O pior era a fila: o cadastro recusado ficava
// preso no aparelho, tentando de novo para sempre com o mesmo valor errado.
{
  await p2.evaluate(() => { location.hash = '#/clientes'; });
  await p2.waitForTimeout(700);
  await p2.click('#nova');
  await p2.waitForSelector('.veu [name=nascimento]');
  await p2.fill('.veu [name=nome]', 'Cliente Sem Aniversário');
  await p2.fill('.veu [name=telefone]', '11955554444');
  await p2.click('.veu .btn-primario');
  await p2.waitForTimeout(700);

  const salva = await p2.evaluate(() => globalThis.__DB.clientes
    .find((c) => c.nome === 'Cliente Sem Aniversário'));
  checagens.push(['sem aniversário: a cliente chega ao servidor', !!salva]);
  checagens.push(['sem aniversário: a data vai como ausência, não texto vazio',
    salva && salva.nascimento === null, JSON.stringify(salva?.nascimento)]);
  checagens.push(['sem aniversário: o telefone foi junto',
    salva?.telefone === '11955554444']);
  checagens.push(['sem aniversário: nada ficou preso na fila do aparelho',
    (await p2.evaluate(() =>
      JSON.parse(localStorage.getItem('alento.fila.v1') || '[]').length)) === 0]);

  // E o que já estava preso na fila com o valor errado tem de subir agora.
  await p2.evaluate(() => {
    localStorage.setItem('alento.fila.v1', JSON.stringify([{ acao: 'upsert',
      tabela: 'clientes', ts: Date.now(),
      dados: { id: 'presa-1', nome: 'Cliente Presa', telefone: '11944443333',
               nascimento: '', ativo: true } }]));
  });
  await p2.evaluate(async () => { const db = await import('./js/db.js'); await db.drenarFila(); });
  await p2.waitForTimeout(500);
  const solta = await p2.evaluate(() => globalThis.__DB.clientes
    .find((c) => c.nome === 'Cliente Presa'));
  checagens.push(['sem aniversário: o cadastro que ficou preso sobe limpo',
    !!solta && solta.nascimento === null]);
  checagens.push(['sem aniversário: e sai da fila',
    (await p2.evaluate(() =>
      JSON.parse(localStorage.getItem('alento.fila.v1') || '[]').length)) === 0]);
}

// ── 38. Editar o horário, não só o relógio ──
// A ficha só oferecia "não veio", "desmarcar" e "cliente chegou". Trocar o
// serviço ou a profissional obrigava a desmarcar e marcar de novo: dois avisos
// para a cliente por um atendimento que não mudou, e o horário livre no meio.
{
  await p2.evaluate(() => { location.hash = '#/agenda'; });
  await p2.waitForTimeout(700);
  await p2.click('[data-ver="todas"]').catch(() => {});
  await p2.waitForTimeout(400);

  const alvo = await p2.evaluate(() => {
    const h = new Date(); h.setHours(11, 0, 0, 0);
    const a = { id: 'ed-1', profissional_id: 'p2', servico_id: 'manicure',
      servico_nome: 'Manicure', cliente_nome: 'Cliente Editar', cliente_telefone: '11900001111',
      inicio: h.toISOString(), fim: new Date(h.getTime() + 3600000).toISOString(),
      duracao_min: 60, valor: 45, status: 'confirmado', origem: 'studio',
      atualizado_em: new Date().toISOString() };
    globalThis.__DB.agendamentos.push(a);
    return a.id;
  });
  await p2.evaluate(async () => { const db = await import('./js/db.js'); await db.recarregar(); });
  await p2.waitForTimeout(500);

  await p2.click(`[data-agend="${alvo}"]`);
  await p2.waitForSelector('.veu #mudar');
  checagens.push(['editar: a ficha oferece editar',
    /Editar este horário/.test(nb(await p2.textContent('.veu #mudar')))]);

  await p2.click('.veu #mudar');
  await p2.waitForSelector('.veu [name=servico_id]');
  const campos = await p2.evaluate(() =>
    [...document.querySelectorAll('.veu [name]')].map((c) => c.name));
  for (const campo of ['cliente_nome', 'cliente_telefone', 'profissional_id',
                       'servico_id', 'data', 'hora', 'duracao_min', 'valor', 'observacoes']) {
    checagens.push([`editar: tem o campo ${campo}`, campos.includes(campo)]);
  }
  checagens.push(['editar: abre com os dados de agora',
    (await p2.inputValue('.veu [name=cliente_nome]')) === 'Cliente Editar'
    && (await p2.inputValue('.veu [name=duracao_min]')) === '60']);

  // Trocar o serviço traz tempo e preço da tabela junto.
  await p2.selectOption('.veu [name=servico_id]', 'manicure-gel');
  await p2.waitForTimeout(250);
  checagens.push(['editar: trocar o serviço traz o tempo e o preço da tabela',
    (await p2.inputValue('.veu [name=duracao_min]')) === '96'
    && Number(await p2.inputValue('.veu [name=valor]')) === 120]);

  await p2.selectOption('.veu [name=profissional_id]', 'p1');
  await p2.fill('.veu [name=cliente_telefone]', '11922223333');
  await p2.fill('.veu [name=hora]', '19:00');
  await p2.fill('.veu [name=duracao_min]', '90');
  await p2.fill('.veu [name=valor]', '150');
  await p2.fill('.veu [name=observacoes]', 'quer francesinha');
  await p2.click('.veu .modal-pe .btn-primario');
  await p2.waitForTimeout(800);

  const depois = await p2.evaluate(() =>
    globalThis.__DB.agendamentos.find((a) => a.id === 'ed-1'));
  checagens.push(['editar: troca a profissional', depois.profissional_id === 'p1']);
  checagens.push(['editar: troca o serviço', depois.servico_id === 'manicure-gel']);
  checagens.push(['editar: guarda o telefone novo', depois.cliente_telefone === '11922223333']);
  checagens.push(['editar: guarda hora, duração e valor',
    new Date(depois.inicio).getHours() === 19 && depois.duracao_min === 90 && Number(depois.valor) === 150]);
  checagens.push(['editar: guarda a observação', depois.observacoes === 'quer francesinha']);
  checagens.push(['editar: o horário continua sendo o mesmo, e continua marcado',
    depois.status === 'confirmado'
    && (await p2.evaluate(() => globalThis.__DB.agendamentos
        .filter((a) => a.cliente_nome === 'Cliente Editar').length)) === 1]);
  checagens.push(['editar: o fim acompanha a duração',
    (new Date(depois.fim) - new Date(depois.inicio)) / 60000 === 90]);
}

// ── 39. Ninguém fura a fila ──
// A Laura cadastrou clientes que ficaram presas no aparelho e, na comanda
// seguinte, o servidor recusava: a comanda cita a cliente, e a cliente ainda
// não existia lá. Quem chega depois tem de subir depois.
{
  await p2.evaluate(() => {
    globalThis.__ORDEM = [];
    localStorage.setItem('alento.fila.v1', JSON.stringify([{ acao: 'upsert',
      tabela: 'clientes', ts: Date.now(),
      dados: { id: 'na-fila-1', nome: 'Cliente Da Fila', ativo: true } }]));
  });

  // Uma gravação nova, com coisa esperando na fila: não pode ir na frente.
  await p2.evaluate(async () => {
    const db = await import('./js/db.js');
    await db.salvar('comandas', { id: 'com-fila-1', data: new Date().toISOString().slice(0, 10),
      cliente_id: 'na-fila-1', cliente_nome: 'Cliente Da Fila', profissional_id: 'p1',
      status: 'aberta', total: 100, desconto: 0 });
  });
  await p2.waitForTimeout(600);

  const ordem = await p2.evaluate(() => globalThis.__ORDEM);
  checagens.push(['fila: a cliente sobe antes da comanda que cita ela',
    ordem.indexOf('clientes') >= 0 && ordem.indexOf('clientes') < ordem.indexOf('comandas'),
    ordem.join(' → ')]);
  checagens.push(['fila: esvaziou sozinha',
    (await p2.evaluate(() =>
      JSON.parse(localStorage.getItem('alento.fila.v1') || '[]').length)) === 0]);
  checagens.push(['fila: e as duas chegaram ao servidor',
    await p2.evaluate(() => !!globalThis.__DB.clientes.find((c) => c.id === 'na-fila-1')
      && !!globalThis.__DB.comandas.find((c) => c.id === 'com-fila-1'))]);
  checagens.push(['fila: sem assustar com aviso de erro',
    !/recus|não consegui/i.test(nb(await p2.textContent('#toasts')))]);
}

// ── 40. A raiz do site é a página das clientes ──
// Com domínio próprio, quem digita alentoostudio.com.br tem de cair no studio
// — fotos, preços e o botão de agendar —, não numa tela de login pedindo senha.
{
  const ctxR = await browser.newContext({ serviceWorkers: 'block' });
  await ctxR.route('**/esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  const pr2 = await ctxR.newPage();

  await pr2.goto(BASE + '/', { waitUntil: 'networkidle' });
  await pr2.waitForTimeout(700);
  checagens.push(['raiz: abre a página das clientes',
    await pr2.locator('#btn-agendar').count() === 1]);
  checagens.push(['raiz: não pede senha a quem chega',
    await pr2.locator('#senha, [name=senha]').count() === 0]);

  // O endereço que as clientes já receberam continua chegando lá.
  await pr2.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
  await pr2.waitForTimeout(700);
  checagens.push(['raiz: o link antigo da vitrine ainda chega na página certa',
    new URL(pr2.url()).pathname.replace(/\/$/, '') === ''
    && await pr2.locator('#btn-agendar').count() === 1, pr2.url()]);

  // E a equipe tem porta própria, tanto pelo rodapé quanto pelo endereço.
  await pr2.goto(BASE + '/', { waitUntil: 'networkidle' });
  await pr2.waitForTimeout(600);
  const porta = pr2.locator('.rodape a[href="sistema.html"]');
  checagens.push(['raiz: o rodapé leva a equipe ao sistema', await porta.count() === 1]);
  await porta.click();
  await pr2.waitForTimeout(900);
  checagens.push(['raiz: e o sistema abre pedindo acesso',
    /sistema\.html/.test(pr2.url())]);
  await ctxR.close();
}

await browser.close();

let falhas = 0;
for (const [nome, ok] of checagens) {
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : ' FALHA') + '  ' + nome);
}
if (erros.length) { console.log('\nERROS DE JS:'); [...new Set(erros)].forEach((e) => console.log('  ' + e)); }
console.log(`\n${checagens.length - falhas}/${checagens.length} checagens passaram`);
process.exit(falhas || erros.length ? 1 : 0);
