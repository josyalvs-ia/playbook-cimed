-- ═══════════════════════════════════════════════════════════════════════════
-- FOTO E APRESENTAÇÃO DA EQUIPE
--
-- Rode este arquivo no SQL Editor do Supabase se o seu banco já foi criado
-- antes desta parte existir. Quem for criar o banco do zero não precisa: já
-- está tudo no schema.sql.
--
-- Como rodar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Rodar duas vezes não faz mal.
-- ═══════════════════════════════════════════════════════════════════════════

-- A foto vai como data URL já reduzida pelo próprio app (256px, JPEG). Fica
-- na linha e não exige configurar armazenamento de arquivos no Supabase.
alter table public.profissionais add column if not exists foto text;
alter table public.profissionais add column if not exists bio  text;

-- Quem atende também aparece para a cliente: nome, foto e apresentação. Não
-- pode ser uma policy em `profissionais` — a policy libera a LINHA inteira, e
-- a linha carrega a comissão. A view entrega só as colunas de vitrine.
create or replace view public.equipe_publica
with (security_invoker = off) as
  select id, nome, apelido, funcao, foto, bio
  from public.profissionais
  where ativo and atende;

grant select on public.equipe_publica to anon, authenticated;
