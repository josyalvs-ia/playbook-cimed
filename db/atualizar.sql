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
-- (a view é criada mais abaixo, junto da frase de cada profissional)


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

-- ── Sincronização incremental ──────────────────────────────────────────────
-- O app recarregava TUDO do servidor a cada 45 segundos. Depois de um ano de
-- studio isso é mais de 1 MB baixado a cada volta, para descobrir que quase
-- nada mudou — era o que fazia a agenda travar no celular.
--
-- Com um carimbo de "mexido pela última vez em", o app passa a pedir só o que
-- mudou desde a última conferida. O gatilho existe porque `default now()` só
-- vale na criação: mudar o status de um agendamento não mexeria na coluna.
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profissionais','clientes','servicos','materiais','ficha_tecnica',
                           'estoque_mov','comandas','comanda_itens','caixa','config',
                           'horarios','bloqueios','agendamentos'] loop
    execute format(
      'alter table public.%I add column if not exists atualizado_em timestamptz not null default now()', t);
    execute format('create index if not exists idx_%s_atualizado on public.%I (atualizado_em)', t, t);
    execute format('drop trigger if exists %I_atualizado on public.%I', t, t);
    execute format(
      'create trigger %I_atualizado before update on public.%I
       for each row execute function public.marcar_atualizacao()', t, t);
  end loop;
end $$;

-- ── A frase que fecha o agendamento ────────────────────────────────────────
-- Existe uma frase do studio, que é a padrão, e cada profissional pode ter a
-- sua. Quem marca com a Julia lê a da Julia; sem frase própria, lê a do
-- studio. A frase do studio mora em `config`, junto do resto.
alter table public.profissionais add column if not exists recado text;

-- A view precisa ser recriada para passar a entregar a coluna nova.
drop view if exists public.equipe_publica;
create view public.equipe_publica
with (security_invoker = off) as
  select id, nome, apelido, funcao, foto, bio, recado
  from public.profissionais
  where ativo and atende;

grant select on public.equipe_publica to anon, authenticated;
