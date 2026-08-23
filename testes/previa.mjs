// Gera assets/previa.png (1200×630): o cartão que o WhatsApp mostra ao mandar
// o link. Renderiza a própria marca.svg do site sobre o verde e o pattern de
// estrelas do manual — o mesmo desenho que a pessoa vê ao abrir a página.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const RAIZ = '/home/user/playbook-cimed';
// Se o arquivo original do logo estiver em assets/logo.png, é ele que vai para
// o cartão — nenhuma fonte reproduz o lettering da marca com fidelidade total.
// Sem ele, cai no marca.svg do próprio site.
const ORIGINAL = RAIZ + '/assets/logo.png';
const temOriginal = fs.existsSync(ORIGINAL);
const marca = temOriginal
  ? `<img src="data:image/png;base64,${fs.readFileSync(ORIGINAL).toString('base64')}" alt="">`
  : fs.readFileSync(RAIZ + '/assets/marca.svg', 'utf8');
console.log(temOriginal ? 'usando o logo original (assets/logo.png)'
                        : 'usando marca.svg — coloque assets/logo.png para fidelidade total');
const css = fs.readFileSync(RAIZ + '/css/app.css', 'utf8');
const pattern = css.match(/--pattern-estrelas: (url\("[^"]+"\));/)[1];

const alvos = [
  { arquivo: 'previa.png',        titulo: 'sistema' },
  { arquivo: 'previa-vitrine.png', titulo: 'vitrine' },
];

const html = (legenda) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1200px; height:630px; background:#2E3322; overflow:hidden;
         font-family: 'Jost','DejaVu Sans',sans-serif; }
  .fundo { position:absolute; inset:0; background-image:${pattern};
           background-size:300px 300px; opacity:.5 }
  .meio { position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:34px }
  .meio svg { width:720px; height:auto }
  .meio img { max-width:640px; max-height:400px; object-fit:contain }
  .legenda { font-size:21px; letter-spacing:.30em; text-transform:uppercase;
             color:#E8DFC4; opacity:.62 }
</style></head><body>
  <div class="fundo"></div>
  <div class="meio">${marca.replace(/<!--[\s\S]*?-->/g, '')}
    <div class="legenda">${legenda}</div>
  </div>
</body></html>`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const a of alvos) {
  await p.setContent(html(a.titulo === 'vitrine' ? 'Tabela de valores e agendamento' : 'Cotia · SP'),
                     { waitUntil: 'load' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${RAIZ}/assets/${a.arquivo}` });
  console.log(a.arquivo, fs.statSync(`${RAIZ}/assets/${a.arquivo}`).size, 'bytes');
}
await b.close();
