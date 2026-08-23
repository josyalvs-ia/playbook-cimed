import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const problemas = [];

for (const [nome, perfil, alvo] of [
  ['desktop', { viewport:{width:1280,height:900} }, '/tmp/man-pc'],
  ['iPhone 13', devices['iPhone 13'], '/tmp/man-cel'],
  ['320px', { viewport:{width:320,height:640}, isMobile:true, hasTouch:true }, '/tmp/man-mini'],
]) {
  const ctx = await b.newContext(perfil);
  const p = await ctx.newPage();
  p.on('pageerror', e => problemas.push(`${nome}: ERRO JS — ${e.message}`));
  await p.goto('http://127.0.0.1:8899/manual-da-marca.html', { waitUntil:'networkidle' });
  await p.waitForTimeout(900);

  const r = await p.evaluate(() => {
    const L = document.documentElement.clientWidth;
    const vaza = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > L + 1 && !el.closest('.sumario')) {
        vaza.push(el.tagName + '.' + (el.className || '').toString().slice(0, 30));
      }
    }
    return { rolagem: document.documentElement.scrollWidth - L,
             vaza: [...new Set(vaza)].slice(0, 4),
             secoes: document.querySelectorAll('.secao').length,
             cores: document.querySelectorAll('.cor').length,
             destaques: document.querySelectorAll('.destaque').length,
             altura: document.body.scrollHeight };
  });
  if (r.rolagem > 1) problemas.push(`${nome}: rola de lado +${r.rolagem}px → ${r.vaza.join(' | ')}`);
  console.log(nome, JSON.stringify(r));
  await p.screenshot({ path: alvo + '-capa.png' });

  if (nome === 'desktop') {
    // Interações
    await p.click('[data-fundo="creme"]'); await p.waitForTimeout(700);
    await p.click('#ver-respiro'); await p.waitForTimeout(600);
    await p.locator('#logo').scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/man-logo.png' });

    await p.locator('#cores').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.screenshot({ path: '/tmp/man-cores.png' });
    await p.click('.cor'); await p.waitForTimeout(400);
    const copiou = await p.locator('#copiado').isVisible() && (await p.textContent('#copiado')).includes('#E8DFC4');
    if (!copiou) problemas.push('copiar cor não avisou');

    await p.locator('#destaques').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.screenshot({ path: '/tmp/man-destaques.png' });
    await p.locator('#tipografia').scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/man-tipo.png' });
    await p.locator('#voz').scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/man-voz.png' });

    // O sumário acompanha
    const ativo = await p.locator('.sumario a.ativo').textContent();
    console.log('sumário aponta para:', ativo);
  }
  await ctx.close();
}
console.log(problemas.length ? '\nPROBLEMAS:\n  ' + problemas.join('\n  ') : '\nnenhum problema');
await b.close();
process.exit(problemas.length ? 1 : 0);
