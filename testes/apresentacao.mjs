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
// ── Cada slide tem de caber inteiro na tela ────────────────────────────────
// Rolar por dentro de um slide é o contrário de apresentar: quem lê acha que
// o slide acabou e passa adiante sem ver o fim.
for (const [nome, perfil] of [
  ['iPhone 13', devices['iPhone 13']],
  ['iPhone SE', devices['iPhone SE']],
  ['Galaxy S9+', devices['Galaxy S9+']],
  ['320x600', { viewport: { width: 320, height: 600 }, isMobile: true, hasTouch: true }],
]) {
  const ctx = await b.newContext(perfil);
  await ctx.route('**/rest/v1/equipe_publica**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EQUIPE) }));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8899/apresentacao-marca.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  const estouram = await p.evaluate(() => [...document.querySelectorAll('.slide')].map((s, i) => {
    const sobra = s.scrollHeight - s.clientHeight;
    return sobra > 4 ? `${i + 1} (${s.dataset.titulo}) +${sobra}px` : null;
  }).filter(Boolean));
  if (estouram.length) problemas.push(`${nome}: slide não cabe → ${estouram.join(' · ')}`);
  else console.log(`✓ ${nome}: os 14 slides cabem inteiros`);
  await ctx.close();
}

// ── Os cinco destaques não podem encostar uns nos outros ───────────────────
// "TRATAMENTOS" é uma palavra só, e mais larga que o círculo: com caixa de
// largura fixa ela transbordava por cima da vizinha.
for (const [nome, perfil] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['iPhone 13', devices['iPhone 13']],
  ['iPhone SE', devices['iPhone SE']],
  ['320x600', { viewport: { width: 320, height: 600 }, isMobile: true, hasTouch: true }],
]) {
  const ctx = await b.newContext(perfil);
  await ctx.route('**/rest/v1/equipe_publica**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8899/apresentacao-marca.html#9', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const itens = [...document.querySelectorAll('.destaque')];
    const encostam = [];
    // Rótulo maior que a própria caixa é o que invade a vizinha.
    for (const d of itens) {
      const cx = d.getBoundingClientRect();
      const rot = d.querySelector('.rot').getBoundingClientRect();
      if (rot.width > cx.width + 1) encostam.push(`${d.dataset.nome}: rótulo ${Math.round(rot.width)}px numa caixa de ${Math.round(cx.width)}px`);
    }
    // E o teste de verdade: alguma caixa cruza a outra?
    for (let i = 0; i < itens.length; i++)
      for (let j = i + 1; j < itens.length; j++) {
        const a = itens[i].getBoundingClientRect(), c = itens[j].getBoundingClientRect();
        const cruzam = a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
        if (cruzam) encostam.push(`${itens[i].dataset.nome} cruza ${itens[j].dataset.nome}`);
      }
    return encostam;
  });
  if (r.length) problemas.push(`${nome}: destaques encostam → ${r.join(' · ')}`);
  else console.log(`✓ ${nome}: os cinco destaques sem encostar`);
  await ctx.close();
}

// ── O PDF: uma folha A4 deitada por slide, sangrando até a borda ───────────
// Sem `@page { size: landscape; margin: 0 }` o navegador imprime em retrato e
// cerca tudo de branco: o verde da marca vira uma tarja no meio da folha.
{
  const A4 = { width: 1123, height: 794 };   // 297x210mm a 96dpi
  const ctx = await b.newContext({ viewport: A4 });
  await ctx.route('**/rest/v1/equipe_publica**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EQUIPE) }));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8899/apresentacao-marca.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(500);

  const naFolha = await p.evaluate(() => [...document.querySelectorAll('.slide')].map((s, i) => {
    const m = s.querySelector('.meio');
    const sobra = m.scrollHeight - (s.clientHeight - 2 * 53);   // 14mm de folga
    return sobra > 6 ? `${i + 1} (${s.dataset.titulo}) +${Math.round(sobra)}px` : null;
  }).filter(Boolean));
  if (naFolha.length) problemas.push(`PDF: slide não cabe na folha → ${naFolha.join(' · ')}`);
  else console.log('✓ PDF: os 14 slides cabem na folha deitada');

  const vazam = await p.evaluate(() => {
    const fora = [];
    for (const c of document.querySelectorAll('.cor, .cartao, .nao-item, .frase, .aviso, .pessoa')) {
      if (c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2) {
        fora.push(`${c.className.split(' ')[0]}: "${c.textContent.trim().slice(0, 24)}"`);
      }
    }
    return [...new Set(fora)];
  });
  if (vazam.length) problemas.push(`PDF: conteúdo escapa da caixa → ${vazam.join(' · ')}`);
  else console.log('✓ PDF: nada escapa das caixas');

  // E o arquivo em si: uma página por slide, do tamanho de uma A4 deitada.
  const bytes = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const texto = bytes.toString('latin1');
  const paginas = (texto.match(/\/Type \/Page[^s]/g) || []).length;
  if (paginas !== 14) problemas.push(`PDF: saíram ${paginas} páginas, não 14`);
  else console.log('✓ PDF: 14 páginas, uma por slide');
  const folha = texto.match(/\/MediaBox \[[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)\]/);
  const deitada = folha && Number(folha[1]) > Number(folha[2]);
  if (!deitada) problemas.push('PDF: a folha não saiu deitada');
  else console.log(`✓ PDF: folha deitada (${Math.round(folha[1])}x${Math.round(folha[2])}pt)`);
  await ctx.close();
}

console.log(problemas.length ? '\nPROBLEMAS:\n  ' + problemas.join('\n  ') : '\nnenhum problema');
await b.close();
process.exit(problemas.length ? 1 : 0);
