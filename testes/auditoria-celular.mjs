import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:8899';
const problemas = [];
const notas = [];
const browser = await chromium.launch();

// Dois aparelhos reais e um pequeno, que é onde tudo quebra primeiro.
const APARELHOS = [
  ['iPhone 13',        devices['iPhone 13']],
  ['Galaxy S9+',       devices['Galaxy S9+']],
  ['iPhone SE (mini)', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2,
                         isMobile: true, hasTouch: true,
                         userAgent: devices['iPhone SE'] ? devices['iPhone SE'].userAgent : 'Mozilla/5.0 (iPhone)' }],
];

const FAKE = `
const memoria = globalThis.__DB || (globalThis.__DB = {});
if (!memoria.profissionais) memoria.profissionais = [
  { id: 'p1', user_id: 'u1', nome: 'Laura', funcao: 'cabelo', comissao_pct: .5, ativo: true, atende: true },
  { id: 'p2', user_id: 'u2', nome: 'Julia', funcao: 'unhas',  comissao_pct: .5, ativo: true, atende: true },
];
function q(n){const o={
  select(){return Object.assign(Promise.resolve({data:memoria[n]||(memoria[n]=[]),error:null}),o)},
  eq(){return this}, in(){return this}, single(){return this},
  upsert(r){const a=Array.isArray(r)?r:[r];for(const x of a){const t=memoria[n]||(memoria[n]=[]);
    const i=t.findIndex(y=>y.id===x.id||(y.chave&&y.chave===x.chave));if(i>=0)t[i]={...t[i],...x};else t.push({...x})}
    const out={data:a[0],error:null};return Object.assign(Promise.resolve(out),{select:()=>({single:()=>Promise.resolve(out)})})},
  delete(){return{eq:(c,v)=>{memoria[n]=(memoria[n]||[]).filter(x=>x[c]!==v);return Promise.resolve({error:null})}}}};
  return o}
export function createClient(){return{
  from:q,
  rpc: async (nome, args) => {
    if (nome === 'horarios_livres') {
      const out = [];
      for (let h = 0; h < 8; h++) {
        const d = new Date(args.p_data + 'T09:00:00'); d.setHours(9 + h);
        if ((memoria.agendamentos||[]).some(a => a.inicio === d.toISOString())) continue;
        out.push({ quando: d.toISOString(), prof_id: 'p2', prof_nome: 'Julia' });
      }
      return { data: out, error: null };
    }
    if (nome === 'criar_agendamento') {
      const t = memoria.agendamentos || (memoria.agendamentos = []);
      if (String(args.p_telefone).length < 10) return { data: null, error: { message: 'Informe um WhatsApp válido com DDD' } };
      t.push({ id: 'a1', token: 'cod-1', inicio: args.p_inicio, cliente_nome: args.p_nome });
      return { data: [{ novo_id:'a1', codigo:'cod-1', quando: args.p_inicio, prof_nome:'Julia', servico:'Manicure' }], error: null };
    }
    if (nome === 'cancelar_agendamento') { memoria.agendamentos = []; return { data: true, error: null }; }
    return { data: [], error: null };
  },
  auth:{ getSession: async()=>({data:{session:{user:{id:'u1',email:'laura@alento.com',user_metadata:{nome:'Laura'}}}}}),
         signOut: async()=>({}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}) },
  channel:()=>({on(){return this},subscribe(){return this}})}}`;

/** Mede tudo o que costuma quebrar em tela pequena. */
async function auditar(p, onde, aparelho) {
  const r = await p.evaluate(() => {
    const larguraTela = document.documentElement.clientWidth;
    const out = { vazaLateral: document.documentElement.scrollWidth > larguraTela + 1,
                  larguraTela, sobrando: document.documentElement.scrollWidth - larguraTela,
                  culpados: [], toqueMiudo: [], textoMiudo: [], cortado: [] };

    if (out.vazaLateral) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > larguraTela + 1 && !el.closest('.tabela-wrap, .ag-dias, [style*="overflow"]')) {
          out.culpados.push((el.tagName + '.' + (el.className || '')).slice(0, 60) + ` (até ${Math.round(b.right)}px)`);
          if (out.culpados.length > 4) break;
        }
      }
    }
    // Alvos de toque: mínimo recomendado é 44px.
    for (const el of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), .pilula, .nav-item')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (!el.offsetParent && cs.position !== 'fixed') continue;   // dentro de algo escondido
      // O dedo acerta o rótulo, não só a caixinha: mede a área real de toque.
      const alvo = el.closest('label') || el.parentElement?.closest('td') || el;
      const a = alvo.getBoundingClientRect();
      const alt = Math.max(b.height, a.height), larg = Math.max(b.width, a.width);
      if (alt < 34 || larg < 26) {
        out.toqueMiudo.push(`${el.tagName}.${String(el.className).slice(0, 26)} ${Math.round(larg)}×${Math.round(alt)}`);
      }
    }
    // Texto pequeno demais para ler no celular.
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length || el.textContent.trim().length <= 12) continue;
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;  // não está na tela
      const t = parseFloat(getComputedStyle(el).fontSize);
      if (t && t < 11) out.textoMiudo.push(`${Math.round(t)}px: "${el.textContent.trim().slice(0, 34)}"`);
    }
    // Conteúdo cortado dentro da própria caixa.
    for (const el of document.querySelectorAll('.kpi .valor, .passo h2, h1, h2, .ag-preco, .selo')) {
      if (el.scrollWidth > el.clientWidth + 2) {
        out.cortado.push(`"${el.textContent.trim().slice(0, 30)}"`);
      }
    }
    return out;
  });

  const rot = `${aparelho} · ${onde}`;
  if (r.vazaLateral) problemas.push(`${rot}: rola de lado (+${r.sobrando}px) → ${r.culpados.join(' | ') || '?'}`);
  const toques = [...new Set(r.toqueMiudo)];
  if (toques.length) notas.push(`${rot}: ${toques.length} alvo(s) de toque pequeno(s) → ${toques.slice(0, 3).join(' | ')}`);
  const textos = [...new Set(r.textoMiudo)];
  if (textos.length) notas.push(`${rot}: texto miúdo → ${textos.slice(0, 2).join(' | ')}`);
  if (r.cortado.length) problemas.push(`${rot}: texto cortado → ${[...new Set(r.cortado)].slice(0, 3).join(' | ')}`);
  return r;
}

for (const [nomeAparelho, perfil] of APARELHOS) {
  // ── A equipe ───────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ ...perfil });
  await ctx.route('**/esm.sh/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  await ctx.addInitScript(() => localStorage.setItem('alento.supabase',
    JSON.stringify({ url: 'https://t.supabase.co', anonKey: 'x'.repeat(50) })));
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(`${nomeAparelho}: ${e.message}`));

  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.waitForSelector('.shell', { timeout: 9000 });
  await p.waitForTimeout(900);
  if (await p.locator('.veu').count()) { await p.click('text=Instalar dados iniciais'); await p.waitForTimeout(1600); }

  for (const tela of ['painel','agenda','comandas','clientes','estoque','caixa','servicos','precificacao','comissoes','relatorios','ajustes']) {
    await p.evaluate((t) => { location.hash = '#/' + t; }, tela);
    await p.waitForTimeout(650);
    await auditar(p, tela, nomeAparelho);
    if (tela === 'agenda' && nomeAparelho === 'iPhone 13') await p.screenshot({ path: '/tmp/cel-agenda.png' });
    if (tela === 'painel' && nomeAparelho === 'iPhone 13') await p.screenshot({ path: '/tmp/cel-painel.png' });
  }

  // A barra de baixo precisa alcançar tudo
  const tabs = await p.$$eval('.tabbar button', (b) => b.map((x) => x.textContent.trim()));
  if (tabs.length < 5) problemas.push(`${nomeAparelho}: barra de baixo com só ${tabs.length} atalhos`);

  // Um modal cheio, que é onde falta espaço
  await p.evaluate(() => { location.hash = '#/agenda'; });
  await p.waitForTimeout(600);
  await p.click('#novo');
  await p.waitForSelector('.veu');
  await p.waitForTimeout(400);
  await auditar(p, 'modal encaixar', nomeAparelho);
  const botoesVisiveis = await p.evaluate(() => {
    const pe = document.querySelector('.modal-pe');
    if (!pe) return true;
    const b = pe.getBoundingClientRect();
    return b.bottom <= window.innerHeight + 1 && b.top >= 0;
  });
  if (!botoesVisiveis) problemas.push(`${nomeAparelho}: botão do modal fora da tela`);
  if (nomeAparelho === 'iPhone 13') await p.screenshot({ path: '/tmp/cel-modal.png' });
  await p.keyboard.press('Escape');

  // ── A cliente ──────────────────────────────────────────────────────────
  const ctxC = await browser.newContext({ ...perfil });
  await ctxC.route('**/esm.sh/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  const c = await ctxC.newPage();
  c.on('pageerror', (e) => erros.push(`${nomeAparelho} vitrine: ${e.message}`));

  await c.goto(BASE + '/vitrine.html', { waitUntil: 'networkidle' });
  await c.waitForTimeout(800);
  await auditar(c, 'vitrine', nomeAparelho);
  if (nomeAparelho === 'iPhone 13') await c.screenshot({ path: '/tmp/cel-vitrine.png' });

  // O botão de agendar tem que estar ao alcance sem caçar
  const ctaOk = await c.evaluate(() => {
    const b = document.getElementById('btn-agendar');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.height >= 40 && r.bottom <= window.innerHeight + 2;
  });
  if (!ctaOk) problemas.push(`${nomeAparelho} vitrine: botão de agendar fora de alcance`);

  await c.click('#btn-agendar');
  await c.waitForSelector('.ag-tela');
  await c.waitForTimeout(400);
  await auditar(c, 'agendar/serviço', nomeAparelho);

  await c.click('[data-serv="manicure"]');
  await c.waitForTimeout(500);
  await c.locator('.ag-dia').nth(3).click();
  await c.waitForSelector('.ag-hora', { timeout: 8000 });
  await auditar(c, 'agendar/horário', nomeAparelho);
  if (nomeAparelho === 'iPhone 13') await c.screenshot({ path: '/tmp/cel-agendar.png' });

  await c.locator('.ag-hora').first().click();
  await c.waitForSelector('#ag-nome');
  await auditar(c, 'agendar/dados', nomeAparelho);
  await c.fill('#ag-nome', 'Josianny Alves');
  await c.fill('#ag-tel', '11999998888');
  await c.click('#ag-confirmar');
  await c.waitForSelector('.ag-pronto', { timeout: 8000 });
  await c.waitForTimeout(400);
  await auditar(c, 'agendar/pronto', nomeAparelho);
  if (nomeAparelho === 'iPhone 13') await c.screenshot({ path: '/tmp/cel-pronto.png' });

  await c.reload({ waitUntil: 'networkidle' });
  await c.waitForTimeout(700);
  await auditar(c, 'vitrine c/ horário', nomeAparelho);

  problemas.push(...erros);
  await ctx.close(); await ctxC.close();
}

await browser.close();
console.log('\n══════ PROBLEMAS ══════');
console.log(problemas.length ? [...new Set(problemas)].map((p) => '  ✗ ' + p).join('\n') : '  nenhum');
console.log('\n══════ PONTOS DE ATENÇÃO ══════');
console.log(notas.length ? [...new Set(notas)].map((n) => '  · ' + n).join('\n') : '  nenhum');
process.exit(problemas.length ? 1 : 0);
