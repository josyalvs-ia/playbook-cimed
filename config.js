/*
  Conexão com o banco (Supabase).

  Estes dois valores ficam no código de qualquer aplicativo web que usa
  Supabase — é assim que o navegador da cliente fala com o banco. A chave
  publicável não dá acesso a nada sozinha.

  Quem protege os dados é o db/schema.sql: só enxerga o studio quem está
  logada E cadastrada como profissional ativa. Uma conta criada por um
  estranho entra inativa e não lê absolutamente nada.

  Se preferir não comitar, deixe como está: na primeira abertura o app
  pergunta a URL e a chave, e guarda no próprio aparelho.
*/
window.ALENTO_CONFIG = {
  // Falta preencher: Supabase → Settings → Data API → Project URL
  url: 'https://SUA-URL.supabase.co',
  anonKey: 'sb_publishable_hkO6u9gfAIy_4jSYOPISfQ_qTXYWVBM',
};
