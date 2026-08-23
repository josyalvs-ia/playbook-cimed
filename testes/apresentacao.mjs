import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const problemas = [];
const EQUIPE = [
  { nome: 'Laura Martins', apelido: 'Laura', funcao: 'cabelo',
    foto: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#7a6a52"/></svg>').toString('base64'),
    bio: 'Cabeleireira. Corte, cor e tratamento.' },
  { nome: 'Julia Souza', apelido: 'Julia', funcao: 'unhas', foto: null,
    bio: 'Nails designer. Alongamento em gel e blindagem.' },
];

for (const [nome, perfil, alvo] of [
  ['desktop', { viewport:{width:1280,height:800} }, '/tmp/dk-pc'],
  ['iPhone 13', devices['iPhone 13'], '/tmp/dk-cel'],
  ['320px', { viewport:{width:320,height:600}, isMobile:true, hasTouch:true }, '/tmp/dk-mini'],
]) {
  const ctx = await b.newContext(perfil);
  await ctx.route('**/rest/v1/equipe_publica**', (r) =>
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(EQUIPE) }));
  const p = await ctx.newPage();
  p.on('pageerror', e => problemas.push(`${nome}: ERRO JS — ${e.message}`));
  await p.goto('http://127.0.0.1:8899/apresentacao-marca.html', { waitUntil:'networkidle' });
  await p.waitForTimeout(1000);

  const n = await p.locator('.slide').count();
  const r = await p.evaluate(() => ({
    rolagemPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    contador: document.getElementById('contador').textContent,
    equipe: document.querySelectorAll('#equipe .pessoa').length,
    // Slide que transborda a própria caixa é o que estraga uma apresentação.
    transborda: [...document.querySelectorAll('.slide')].map((s, i) =>
      s.scrollHeight > s.clientHeight + 2 ? i + 1 : null).filter(Boolean),
  }));
  if (r.rolagemPagina > 1) problemas.push(`${nome}: a página rola de lado`);
  console.log(nome, n, 'slides |', JSON.stringify(r));
  await p.screenshot({ path: alvo + '-1.png' });

  // Navegar por teclado até o fim e voltar.
  for (let i = 0; i < n - 1; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(210); }
  await p.waitForTimeout(500);
  const fim = await p.textContent('#contador');
  if (fim.trim() !== `${n} / ${n}`) problemas.push(`${nome}: teclado parou em ${fim}`);
  await p.screenshot({ path: alvo + '-fim.png' });

  await p.keyboard.press('Home'); await p.waitForTimeout(600);
  if ((await p.textContent('#contador')).trim() !== `1 / ${n}`) problemas.push(`${nome}: Home não volta ao início`);

  if (nome === 'desktop') {
    // O slide da equipe
    await p.evaluate(() => location.hash = '#4'); await p.waitForTimeout(200);
    await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(1200);
    if ((await p.textContent('#contador')).trim() !== `4 / ${n}`) problemas.push('endereço não abre no slide pedido');
    await p.screenshot({ path: '/tmp/dk-equipe.png' });
    if (await p.locator('#equipe img.retrato').count() !== 1) problemas.push('a foto da equipe não apareceu');
    if (await p.locator('#equipe .pessoa').count() !== 2) problemas.push('faltou gente na equipe');

    // Índice
    await p.click('#contador'); await p.waitForTimeout(400);
    if (await p.locator('.indice-item').count() !== n) problemas.push('o índice não lista tudo');
    await p.screenshot({ path: '/tmp/dk-indice.png' });
    await p.click('[data-ir="6"]'); await p.waitForTimeout(700);
    if ((await p.textContent('#contador')).trim() !== `7 / ${n}`) problemas.push('o índice não leva ao slide');
    await p.screenshot({ path: '/tmp/dk-cores.png' });

    // Copiar
    await p.click('.cor'); await p.waitForTimeout(400);
    if (!(await p.textContent('#copiado')).includes('#E8DFC4')) problemas.push('copiar cor não avisou');

    // Logo sobre creme + respiro
    await p.evaluate(() => location.hash = '#5');
    await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(900);
    await p.click('[data-fundo="creme"]'); await p.click('#ver-respiro'); await p.waitForTimeout(700);
    await p.screenshot({ path: '/tmp/dk-logo.png' });
  }
  await ctx.close();
}
console.log(problemas.length ? '\nPROBLEMAS:\n  ' + problemas.join('\n  ') : '\nnenhum problema');
await b.close();
process.exit(problemas.length ? 1 : 0);
