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

-- ── O WhatsApp de cada uma ─────────────────────────────────────────────────
-- Serviço de cabelo que se combina por mensagem vai para o zap de quem faz
-- cabelo; unha, para o de quem faz unha. Vazio, vale o número do studio.
alter table public.profissionais add column if not exists whatsapp text;

-- A view precisa ser recriada para passar a entregar as colunas novas.
drop view if exists public.equipe_publica;
create view public.equipe_publica
with (security_invoker = off) as
  select id, nome, apelido, funcao, foto, bio, recado, whatsapp
  from public.profissionais
  where ativo and atende;

grant select on public.equipe_publica to anon, authenticated;

-- ── Serviços que não se marcam sozinha ─────────────────────────────────────
-- Cor exige ver o cabelo antes: o mesmo "mechas" leva quatro horas num cabelo
-- e sete noutro, e um horário errado atrasa o dia inteiro. Estes serviços
-- continuam à vista na página — com preço e descrição —, mas em vez do
-- horário abrem um recado e o WhatsApp do studio.
--
-- A marcação inicial só acontece quando a coluna nasce. Rodar este arquivo de
-- novo não desfaz o que elas escolherem depois na tabela de preços.
do $$
declare nasceu boolean;
begin
  nasceu := not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'servicos'
       and column_name = 'agenda_online');

  alter table public.servicos add column if not exists agenda_online boolean not null default true;
  alter table public.servicos add column if not exists recado_agenda text;

  if nasceu then
    update public.servicos set agenda_online = false
     where id in ('cab-mechas', 'cab-morena', 'cab-correcao', 'cab-fantasia');
  end if;
end $$;

-- A trava de verdade é aqui: as duas funções são públicas, e recusar só na
-- tela deixaria o horário aberto para quem chamasse a função direto.
create or replace function public.horarios_livres(p_servico_id text, p_data date)
returns table (quando timestamptz, prof_id uuid, prof_nome text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dur      int;
  v_tipo     text;
  v_passo    int := 15;    -- de quanto em quanto tempo um atendimento pode começar
  v_antecede int := 120;   -- minutos mínimos entre agora e o atendimento
  v_tz       text := public.fuso();
begin
  select greatest(15, round(coalesce(s.tempo, 1) * 60)::int), coalesce(s.profissional, 'unhas')
    into v_dur, v_tipo
    from servicos s
   where s.id = p_servico_id and s.ativo and coalesce(s.agenda_online, true);
  if v_dur is null then return; end if;
  if p_data < (now() at time zone v_tz)::date then return; end if;

  return query
  with gente as (
    select p.id, p.nome
    from profissionais p
    where p.ativo and p.atende
      and (v_tipo = 'ambos' or p.funcao = 'ambos' or p.funcao = v_tipo)
  ),
  candidatos as (
    select g.id, g.nome, h.pausa_inicio, h.pausa_fim,
           t::time as hora,
           (t at time zone v_tz) as ini
    from gente g
    join horarios h on h.profissional_id = g.id and h.ativo
                   and h.dia_semana = extract(dow from p_data)::int
    cross join lateral generate_series(
      (p_data + h.abre)::timestamp,
      (p_data + h.fecha)::timestamp - make_interval(mins => v_dur),
      make_interval(mins => v_passo)
    ) as t
  )
  select c.ini, c.id, split_part(c.nome, ' ', 1)
  from candidatos c
  where c.ini > now() + make_interval(mins => v_antecede)
    and not (c.pausa_inicio is not null and c.pausa_fim is not null
             and (c.hora, c.hora + make_interval(mins => v_dur))
                 overlaps (c.pausa_inicio, c.pausa_fim))
    and not exists (
      select 1 from agendamentos a
      where a.profissional_id = c.id
        and a.status in ('confirmado', 'concluido')
        and tstzrange(a.inicio, a.fim) && tstzrange(c.ini, c.ini + make_interval(mins => v_dur))
    )
    and not exists (
      select 1 from bloqueios b
      where (b.profissional_id is null or b.profissional_id = c.id)
        and tstzrange(b.inicio, b.fim) && tstzrange(c.ini, c.ini + make_interval(mins => v_dur))
    )
  order by c.ini, c.nome;
end $$;

create or replace function public.criar_agendamento(
  p_servico_id text, p_profissional_id uuid, p_inicio timestamptz,
  p_nome text, p_telefone text, p_observacoes text default null
) returns table (novo_id uuid, codigo uuid, quando timestamptz, prof_nome text, servico text)
language plpgsql security definer set search_path = public as $$
declare
  v_dur   int;
  v_nome  text;
  v_preco numeric;
  v_prof  text;
  v_id    uuid;
  v_token uuid;
  v_tel   text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe seu nome';
  end if;
  if length(v_tel) not between 10 and 13 then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;

  if (select count(*) from agendamentos a
      where a.cliente_telefone = v_tel and a.status = 'confirmado' and a.inicio > now()) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com o studio para marcar mais.';
  end if;

  select greatest(15, round(coalesce(s.tempo, 1) * 60)::int), s.nome, s.preco
    into v_dur, v_nome, v_preco
    from servicos s
   where s.id = p_servico_id and s.ativo and coalesce(s.agenda_online, true);
  if v_dur is null then
    raise exception 'Este serviço é marcado pelo WhatsApp. Fale com o studio.';
  end if;

  if not exists (
    select 1 from public.horarios_livres(p_servico_id, (p_inicio at time zone public.fuso())::date) h
    where h.quando = p_inicio and h.prof_id = p_profissional_id
  ) then
    raise exception 'Esse horário acabou de ser preenchido. Escolha outro, por favor.';
  end if;

  select split_part(p.nome, ' ', 1) into v_prof from profissionais p where p.id = p_profissional_id;

  insert into agendamentos (profissional_id, servico_id, servico_nome, cliente_nome,
                            cliente_telefone, inicio, duracao_min, valor, origem, observacoes)
  values (p_profissional_id, p_servico_id, v_nome, trim(p_nome), v_tel, p_inicio, v_dur,
          coalesce(v_preco, 0), 'site', nullif(trim(coalesce(p_observacoes, '')), ''))
  returning agendamentos.id, agendamentos.token into v_id, v_token;

  return query select v_id, v_token, p_inicio, v_prof, v_nome;
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser preenchido. Escolha outro, por favor.';
end $$;

-- ── Encaixe: um horário dentro de outro, de propósito ──────────────────────
-- Enquanto a cor da cliente processa, dá para cortar o cabelo de outra — é
-- assim que o dia rende. A trava contra choque recusava isso junto com o erro
-- de digitação, e as duas coisas não são a mesma: agora quem marca decide,
-- e o horário fica registrado como encaixe.
alter table public.agendamentos add column if not exists encaixe boolean not null default false;

alter table public.agendamentos drop constraint if exists agendamentos_sem_choque;
alter table public.agendamentos add constraint agendamentos_sem_choque
  exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status in ('confirmado', 'concluido') and not encaixe);
