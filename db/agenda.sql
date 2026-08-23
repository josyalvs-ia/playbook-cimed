-- ═══════════════════════════════════════════════════════════════════════════
-- ALENTO — ACRÉSCIMO: quem administra sem atender, e a AGENDA
--
-- Este arquivo é só o que falta num banco que já rodou o schema.sql antes.
-- Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar quantas vezes quiser: não duplica nem apaga nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- Separa "usa o sistema" de "atende clientes": quem só administra o studio
-- mantém acesso a tudo, mas some dos atendimentos e das comissões.
alter table profissionais add column if not exists atende boolean not null default true;

-- ═══════════════════════════════════════════════════════════════════════════
-- AGENDA
--
-- A cliente marca sozinha pela página pública e o horário já fica fechado.
-- Isso cria dois problemas que só o banco resolve:
--
-- 1. Duas clientes podem clicar no mesmo horário no mesmo segundo. Quem
--    garante que só uma entra é a restrição de exclusão — o Postgres recusa
--    a segunda. Checagem feita no navegador não resolve isso.
-- 2. A página pública não pode ler a agenda: seria expor nome e telefone de
--    todas as clientes. Por isso quem não está logada não enxerga a tabela;
--    fala apenas com três funções, que devolvem só o necessário.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;

-- Horário de funcionamento de cada profissional, por dia da semana.
create table if not exists horarios (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais(id) on delete cascade,
  dia_semana      int not null check (dia_semana between 0 and 6),  -- 0 = domingo
  abre            time not null,
  fecha           time not null,
  pausa_inicio    time,
  pausa_fim       time,
  ativo           boolean not null default true,
  unique (profissional_id, dia_semana),
  check (fecha > abre)
);

-- Folga, férias, curso, médico: qualquer buraco na agenda.
create table if not exists bloqueios (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid references profissionais(id) on delete cascade,  -- nulo = studio inteiro
  inicio          timestamptz not null,
  fim             timestamptz not null,
  motivo          text,
  criado_em       timestamptz not null default now(),
  check (fim > inicio)
);
create index if not exists idx_bloqueios_periodo on bloqueios (inicio, fim);

create table if not exists agendamentos (
  id               uuid primary key default gen_random_uuid(),
  profissional_id  uuid not null references profissionais(id) on delete cascade,
  servico_id       text references servicos(id) on delete set null,
  servico_nome     text not null,
  cliente_id       uuid references clientes(id) on delete set null,
  cliente_nome     text not null,
  cliente_telefone text,
  inicio           timestamptz not null,
  duracao_min      int not null check (duracao_min > 0),
  fim              timestamptz not null,   -- preenchido pelo gatilho abaixo
  valor            numeric not null default 0,
  status           text not null default 'confirmado',  -- confirmado | concluido | cancelado | faltou
  origem           text not null default 'site',        -- site | studio
  observacoes      text,
  comanda_id       uuid references comandas(id) on delete set null,
  token            uuid not null default gen_random_uuid(),  -- a cliente desmarca por este código
  criado_em        timestamptz not null default now()
);
-- `fim` não pode ser coluna gerada: somar intervalo a timestamptz depende do
-- fuso da sessão, então o Postgres não considera a expressão imutável e recusa.
-- Um gatilho resolve, e ainda deixa `fim` utilizável no índice de exclusão.
create or replace function public.calcular_fim()
returns trigger language plpgsql as $$
begin
  new.fim := new.inicio + make_interval(mins => new.duracao_min);
  return new;
end $$;

drop trigger if exists agendamento_fim on agendamentos;
create trigger agendamento_fim before insert or update of inicio, duracao_min
  on agendamentos for each row execute function public.calcular_fim();

create index if not exists idx_agendamentos_inicio on agendamentos (inicio);
create index if not exists idx_agendamentos_prof on agendamentos (profissional_id, inicio);

-- A trava contra dois agendamentos no mesmo horário.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agendamentos_sem_choque') then
    alter table agendamentos add constraint agendamentos_sem_choque
      exclude using gist (
        profissional_id with =,
        tstzrange(inicio, fim) with &&
      ) where (status in ('confirmado', 'concluido'));
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['horarios', 'bloqueios', 'agendamentos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe" on %I', t);
    execute format($f$
      create policy "equipe" on %I for all to authenticated
        using (public.e_da_equipe()) with check (public.e_da_equipe())
    $f$, t);
  end loop;
end $$;

create or replace function public.fuso()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select valor->>'fuso' from public.config where chave = 'studio'),
                  'America/Sao_Paulo');
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- O que a página pública pode perguntar. Nada além disto.
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Horários livres para um serviço num dia.
 * Devolve o instante, quem atende e o primeiro nome — nunca a agenda.
 */
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
    from servicos s where s.id = p_servico_id and s.ativo;
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
    -- generate_series não trabalha com `time`; por isso a série é montada
    -- sobre timestamps do dia e só depois recebe o fuso do studio.
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

/**
 * Marca o horário. Revalida tudo aqui dentro: entre carregar a lista e clicar
 * podem ter passado minutos, e outra cliente pode ter pegado o horário.
 */
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

  -- Freio contra brincadeira: um telefone não segura a agenda inteira.
  if (select count(*) from agendamentos a
      where a.cliente_telefone = v_tel and a.status = 'confirmado' and a.inicio > now()) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com o studio para marcar mais.';
  end if;

  select greatest(15, round(coalesce(s.tempo, 1) * 60)::int), s.nome, s.preco
    into v_dur, v_nome, v_preco
    from servicos s where s.id = p_servico_id and s.ativo;
  if v_dur is null then raise exception 'Serviço indisponível'; end if;

  -- O horário ainda existe? Pergunta à mesma função que a página consultou.
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

/** A cliente desmarca pelo código que recebeu, sem precisar de login. */
create or replace function public.cancelar_agendamento(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update agendamentos set status = 'cancelado'
   where token = p_token and status = 'confirmado' and inicio > now()
   returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

revoke all on function public.horarios_livres(text, date) from public;
revoke all on function public.criar_agendamento(text, uuid, timestamptz, text, text, text) from public;
revoke all on function public.cancelar_agendamento(uuid) from public;
grant execute on function public.horarios_livres(text, date) to anon, authenticated;
grant execute on function public.criar_agendamento(text, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.cancelar_agendamento(uuid) to anon, authenticated;

-- ── Tempo real ─────────────────────────────────────────────────────────────
-- Tabela nova não entra sozinha na publicação do Realtime, e sem isso o app de
-- uma não fica sabendo do que a outra fez. O app também confere sozinho de
-- tempos em tempos, então isto é o que deixa a notícia instantânea.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['agendamentos', 'comandas', 'caixa', 'bloqueios'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Horário inicial para quem ainda não configurou: terça a sábado, 9h às 19h,
-- com uma hora de almoço. Editável em Ajustes → Horários.
insert into horarios (profissional_id, dia_semana, abre, fecha, pausa_inicio, pausa_fim)
select p.id, d, '09:00', '19:00', '12:00', '13:00'
from profissionais p, generate_series(2, 6) d
where p.ativo and p.atende
on conflict (profissional_id, dia_semana) do nothing;
