// Carimba a versão em js/versao.js, no index.html e na vitrine.html.
// Rode antes de cada publicação: node testes/publicar.mjs
import fs from 'fs';

const RAIZ = new URL('..', import.meta.url).pathname;
const agora = new Date();
const dia = agora.toISOString().slice(0, 10);

const atual = fs.readFileSync(RAIZ + 'js/versao.js', 'utf8').match(/VERSAO = '([^']+)'/)[1];
const [diaAntigo, n] = atual.split('.');
const nova = diaAntigo === dia ? `${dia}.${Number(n || 0) + 1}` : `${dia}.1`;

fs.writeFileSync(RAIZ + 'js/versao.js',
  fs.readFileSync(RAIZ + 'js/versao.js', 'utf8').replace(/VERSAO = '[^']+'/, `VERSAO = '${nova}'`));

for (const arquivo of ['index.html', 'vitrine.html']) {
  const caminho = RAIZ + arquivo;
  let html = fs.readFileSync(caminho, 'utf8');
  html = html
    .replace(/(href="css\/app\.css)(\?v=[^"]*)?"/g, `$1?v=${nova}"`)
    .replace(/(src="config\.js)(\?v=[^"]*)?"/g, `$1?v=${nova}"`)
    .replace(/(src="js\/app\.js)(\?v=[^"]*)?"/g, `$1?v=${nova}"`)
    .replace(/(assets\/previa[a-z-]*\.png)(\?v=[^"]*)?"/g, `$1?v=${nova}"`);
  fs.writeFileSync(caminho, html);
}

// O service worker precisa de um balde novo, senão serve o antigo.
const sw = RAIZ + 'sw.js';
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8')
  .replace(/const CACHE = '[^']+'/, `const CACHE = 'alento-${nova}'`));

console.log(`versão ${atual} → ${nova}`);
