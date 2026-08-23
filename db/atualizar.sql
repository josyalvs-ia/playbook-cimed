-- ═══════════════════════════════════════════════════════════════════════════
-- ATUALIZAÇÃO DO BANCO
--
-- Foto e apresentação da equipe, e a conferência dos horários da cliente.
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


-- ── O horário que a cliente guardou ainda existe? ──────────────────────────
-- A página das clientes guardava o horário só no celular. Se ele fosse
-- cancelado do lado do studio, o cartão continuava lá e o botão de desmarcar
-- respondia "não consegui" para sempre, sem explicar nada.
--
-- Esta função devolve a situação de cada código que a cliente tem no aparelho.
-- Não abre nada: só responde sobre o horário de quem já tem o código dele.
create or replace function public.situacao_agendamentos(p_tokens uuid[])
returns table (codigo uuid, quando timestamptz, servico text, prof_nome text, situacao text)
language sql security definer set search_path = public stable as $$
  select a.token, a.inicio, a.servico_nome, split_part(p.nome, ' ', 1), a.status
    from agendamentos a
    join profissionais p on p.id = a.profissional_id
   where a.token = any(p_tokens)
$$;

revoke all on function public.situacao_agendamentos(uuid[]) from public;
grant execute on function public.situacao_agendamentos(uuid[]) to anon, authenticated;
