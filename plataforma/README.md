# Plataforma de Gestão de Jovens Aprendizes — CIMED

App web (SPA) para gerir o programa Jovem Aprendiz. Acessível em `/plataforma/` após o deploy no Netlify. **Multiusuário**: login individual e dados compartilhados pelo time via Supabase.

## O que tem

- **Login** (Supabase Auth) — cada pessoa entra com e-mail e senha.
- **Dashboard** — KPIs, distribuição por área, situação dos aprendizes e contratos próximos do vencimento.
- **Base de Aprendizes** — cadastro completo, busca, filtros, ficha detalhada e exportação CSV.
- **Contratos** — upload de contratos (PDF/imagem/doc) guardados na nuvem (Supabase Storage), com controle de vigência.
- **Documentos & Assinaturas** — documentos que precisam da assinatura do líder, com prazo, status e aviso por e-mail.
- **Convites** — envio de convites por e-mail a candidatos, com link e acompanhamento.
- **Alertas**, **Relatórios** e **Configurações**.

## Arquitetura

- Frontend: HTML/CSS/JS puro (sem build), servido pelo Netlify.
- Dados + arquivos: **Supabase** (Postgres + Storage), compartilhados e sincronizados em tempo real entre o time.
- Envio de e-mail: **Netlify Function** `enviar-email.js` (Resend).

## Configuração

### 1. Supabase (login + dados)
1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e rode o script `supabase/setup.sql` (cria tabelas, segurança e o armazenamento de contratos).
3. Em **Project Settings → API**, copie a **Project URL** e a chave **`anon`/`publishable`** e preencha as constantes `SUPABASE_URL` e `SUPABASE_KEY` no topo do `<script>` em `plataforma/index.html`.
4. Em **Authentication → Users → Add user**, crie um acesso (e-mail + senha, marcando *Auto Confirm User*) para cada pessoa do time. Todos têm acesso igual.

### 2. E-mail (Resend)
No Netlify (**Site settings → Environment variables**): `RESEND_API_KEY` (obrigatório) e, opcionalmente, `EMAIL_REMETENTE` com um domínio verificado. Sem a chave, a plataforma usa `mailto` como alternativa.

## Segurança

- As tabelas usam Row Level Security: só usuários autenticados leem/escrevem.
- A chave `anon/publishable` do Supabase é pública por natureza (pode ficar no frontend). A chave `service_role`/secret **nunca** deve ir para o repositório.
- As chaves de e-mail ficam em variáveis de ambiente do Netlify, fora do código.
