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
function tabela(nome){ return memoria[nome] || (memoria[nome] = []); }
function query(nome){
  const q = {
    _rows: () => tabela(nome),
    select(){ return Object.assign(Promise.resolve({data: tabela(nome), error:null}), q); },
    eq(){ return this; }, in(){ return this; }, single(){ return this; },
    upsert(r){ const arr = Array.isArray(r)?r:[r];
      // O teste pode mandar o banco recusar, para exercitar o caminho do erro.
      const recusa = globalThis.__RECUSAR;
      if (recusa && recusa.tabela === nome) {
        const out = { data: null, error: recusa.erro };
        return Object.assign(Promise.resolve(out), {select:()=>({single:()=>Promise.resolve(out)})}); }
      for (const x of arr){ const t=tabela(nome); const i=t.findIndex(y=>y.id===x.id||(y.chave&&y.chave===x.chave));
        if(i>=0) t[i]={...t[i],...x}; else t.push({...x}); }
      const out = {data: arr[0], error:null};
      return Object.assign(Promise.resolve(out), {select:()=>({single:()=>Promise.resolve(out)})}); },
    delete(){ return { eq:(c,v)=>{ memoria[nome]=tabela(nome).filter(x=>x[c]!==v); return Promise.resolve({error:null}); } }; },
  };
  return q;
}
export function createClient(){
  return {
    from: (n) => query(n),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'laura@alento.com', user_metadata:{nome:'Laura'} } } } }),
      signInWithPassword: async () => ({ data: {}, error: null }),
      signOut: async () => ({}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
      resetPasswordForEmail: async () => ({}),
    },
    rpc: async (nome, args) => {
      if (nome === 'horarios_livres') {
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
await page.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
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
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
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
await pCfg.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
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
await pCfg.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
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
await p2.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
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
await mob.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await mob.waitForSelector('.shell', { timeout: 8000 });
await mob.waitForTimeout(900);
checagens.push(['mobile: barra inferior visível', await mob.locator('.tabbar').isVisible()]);
checagens.push(['mobile: sem rolagem lateral',
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)]);
await mob.screenshot({ path: '/tmp/shot-mobile.png' });
await mob.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
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
  await ctx.route('**/esm.sh/**', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: FAKE.replace(
      "getSession: async () => ({ data: { session: { user: { id: 'u1'",
      "getSession: async () => ({ data: { session: { user: { id: globalThis.__INTRUSO ? 'estranho' : 'u1'"),
  }));
  await p3.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
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
    (await p2.inputValue('.veu [name=profissional_id]')) === '']);
  checagens.push(['agenda: serviço bloqueado até escolher a profissional',
    await p2.locator('.veu [name=servico_id]').isDisabled()]);
  await p2.fill('[name=cliente_nome]', 'Cliente da Agenda');
  await p2.click('text=Marcar');
  await p2.waitForTimeout(300);
  checagens.push(['agenda: recusa sem escolher a profissional',
    nb(await p2.textContent('#toasts')).includes('quem vai atender')]);
  await p2.selectOption('.veu [name=profissional_id]', 'p2');
  await p2.waitForTimeout(250);
  await p2.selectOption('.veu [name=servico_id]', 'manicure');
  await p2.fill('[name=hora]', '10:00');
  await p2.click('text=Marcar');
  await p2.waitForTimeout(900);
  const ag = await p2.evaluate(() => globalThis.__DB?.agendamentos || []);
  checagens.push(['agenda: horário gravado', ag.length === 1 && ag[0].cliente_nome === 'Cliente da Agenda']);
  checagens.push(['agenda: duração veio do serviço escolhido', ag[0]?.duracao_min === 60]);
  const t2 = nb(await p2.textContent('#conteudo'));
  checagens.push(['agenda: aparece na coluna', t2.includes('Cliente da Agenda')]);
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
  await pv.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
  const semStorage = await pv.evaluate(() => !localStorage.getItem('alento.supabase'));
  const temConfig = await pv.evaluate(() => !!window.ALENTO_CONFIG?.url);
  checagens.push(['vitrine: navegador limpo, sem configuração guardada', semStorage]);
  checagens.push(['vitrine: carrega o config.js', temConfig]);
  await pv.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
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
  await pv.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
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
  await pv.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
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
  await p2.waitForSelector('.veu [name=profissional_id]');

  // Confere pelo dado, não pelo nome: cada opção da lista tem que pertencer a
  // quem está selecionada. Adivinhar pelo texto do serviço é frágil.
  const tiposOferecidos = async () => p2.evaluate(() => {
    const servicos = globalThis.__DB?.servicos || [];
    return [...document.querySelectorAll('.veu [name=servico_id] option')]
      .map((o) => servicos.find((s) => s.id === o.value)?.profissional)
      .filter(Boolean);
  });
  const nomes = async () => p2.$$eval('.veu [name=servico_id] option', (os) => os.map((o) => o.textContent.trim()));

  await p2.selectOption('.veu [name=profissional_id]', 'p1');   // Laura, cabelo
  await p2.waitForTimeout(250);
  const tiposLaura = await tiposOferecidos();
  const daLaura = await nomes();
  checagens.push(['agenda: Laura recebe só serviços de cabelo',
    tiposLaura.length > 0 && tiposLaura.every((t) => t === 'cabelo' || t === 'ambos')]);
  checagens.push(['agenda: Laura não vê manicure', !daLaura.some((n) => /^Manicure$/.test(n))]);

  await p2.selectOption('.veu [name=profissional_id]', 'p2');   // Julia, unhas
  await p2.waitForTimeout(250);
  const tiposJulia = await tiposOferecidos();
  const daJulia = await nomes();
  checagens.push(['agenda: Julia recebe só serviços de unha',
    tiposJulia.length > 0 && tiposJulia.every((t) => t === 'unhas' || t === 'ambos')]);
  checagens.push(['agenda: Julia não vê escova', !daJulia.some((n) => /Escova/i.test(n))]);
  checagens.push(['agenda: as listas são diferentes', daLaura.join() !== daJulia.join()]);
  checagens.push(['agenda: as duas profissionais continuam na lista',
    (await p2.$$eval('.veu [name=profissional_id] option',
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

  for (const arq of ['index.html', 'vitrine.html']) {
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

// ── 24. Todo campo editável tem contraste real ──
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


await browser.close();

let falhas = 0;
for (const [nome, ok] of checagens) {
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : ' FALHA') + '  ' + nome);
}
if (erros.length) { console.log('\nERROS DE JS:'); [...new Set(erros)].forEach((e) => console.log('  ' + e)); }
console.log(`\n${checagens.length - falhas}/${checagens.length} checagens passaram`);
process.exit(falhas || erros.length ? 1 : 0);
