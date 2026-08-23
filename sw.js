// Service worker: guarda a casca do app para ele abrir mesmo sem internet.
// Os dados vêm do Supabase (ou do cache local do próprio app), nunca daqui.
const CACHE = 'alento-2026-08-23.15';
const CASCA = [
  './', './index.html', './vitrine.html', './config.js',
  './css/app.css', './manifest.webmanifest',
  './assets/marca.svg', './assets/selo.svg', './assets/estrela.svg',
  './assets/icone-192.png', './assets/icone-512.png',
  './js/app.js', './js/db.js', './js/ui.js', './js/pricing.js',
  './js/metricas.js', './js/seed.js',
  './js/data/servicos.js', './js/data/materiais.js', './js/data/premissas.js',
  './js/views/painel.js', './js/views/comandas.js', './js/views/clientes.js',
  './js/views/estoque.js', './js/views/caixa.js', './js/views/servicos.js',
  './js/views/precificacao.js', './js/views/comissoes.js',
  './js/views/relatorios.js', './js/views/ajustes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Chamadas ao banco e às fontes nunca saem do cache.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Rede primeiro, cache como rede de segurança: o app nunca fica velho,
  // mas também nunca fica na mão.
  //
  // `cache: 'reload'` é o que faz a diferença: sem ele, o pedido ainda passava
  // pelo cache HTTP do navegador, e o GitHub Pages manda guardar cada arquivo
  // por dez minutos. Publicava-se uma correção, a pessoa recarregava, e
  // continuava vendo a versão antiga sem entender por quê.
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'reload', credentials: 'same-origin' }))
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
