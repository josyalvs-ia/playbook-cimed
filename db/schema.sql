-- ═══════════════════════════════════════════════════════════════════════════
-- ALENTO — STUDIO DE BELEZA · Banco de dados
--
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Roda quantas vezes quiser (é idempotente). Os DADOS iniciais (catálogo de
-- serviços, 176 insumos, premissas) são carregados depois, pelo próprio app,
-- em Ajustes → Instalar dados iniciais.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Profissionais ──────────────────────────────────────────────────────────
create table if not exists profissionais (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete set null,
  nome         text not null,
  apelido      text,
  funcao       text not null default 'unhas',      -- unhas | cabelo | ambos
  comissao_pct numeric not null default 0.5,       -- fração: 0.5 = 50%
  cor          text default '#4A5236',
  ativo        boolean not null default true,   -- pode entrar no sistema
  atende       boolean not null default true,   -- aparece como profissional nos atendimentos
  criado_em    timestamptz not null default now()
);

-- Bancos criados antes destas colunas existirem também ficam em dia:
alter table profissionais add column if not exists atende boolean not null default true;
-- A foto vai como data URL já reduzida pelo próprio app (256px, JPEG). Fica
-- na linha e não exige configurar armazenamento de arquivos no Supabase.
alter table profissionais add column if not exists foto text;
alter table profissionais add column if not exists bio  text;
-- A frase que fecha o agendamento. Vazia, vale a do studio (em `config`).
alter table profissionais add column if not exists recado text;

-- ── Clientes ───────────────────────────────────────────────────────────────
create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  nascimento  date,
  indicacao   text,
  alergias    text,
  observacoes text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_clientes_nome on clientes (lower(nome));

-- ── Catálogo de serviços ───────────────────────────────────────────────────
create table if not exists servicos (
  id        text primary key,
  categoria text not null,
  nome      text not null,
  tipo      text not null default 'servico',       -- servico | adicional
  preco     numeric not null default 0,
  preco_tipo text not null default 'fixo',        -- fixo | a_partir | avaliacao
  custo     numeric not null default 0,            -- material por atendimento
  tempo     numeric not null default 0,            -- horas
  unidade   text,
  profissional text default 'unhas',
  estimado  boolean not null default false,
  nota      text,
  ordem     int not null default 0,
  ativo     boolean not null default true
);

-- Bancos criados antes destas colunas existirem também ficam em dia:
alter table servicos add column if not exists preco_tipo text not null default 'fixo';

-- Nem todo serviço pode ser marcado pela cliente sozinha. Cor exige ver o
-- cabelo antes: o mesmo "mechas" leva quatro horas num cabelo e sete noutro,
-- e um horário errado atrasa o dia inteiro. Estes serviços continuam à vista
-- na página — com preço e descrição —, mas em vez do horário abrem um recado
-- e o WhatsApp do studio. Quem liga e desliga são elas, na tabela de preços.
alter table servicos add column if not exists agenda_online boolean not null default true;
alter table servicos add column if not exists recado_agenda text;

-- ── Materiais e insumos / estoque ──────────────────────────────────────────

create table if not exists materiais (
  id             text primary key,
  categoria      text not null,
  nome           text not null,
  apresentacao   text,
  tipo           text default 'consumível',        -- consumível | descartável | reutilizável | equipamento
  preco_ref      numeric default 0,                -- referência de mercado
  preco_pago     numeric,                          -- o que você realmente paga
  qtd_embalagem  numeric,
  unidade        text,
  estoque        numeric not null default 0,
  estoque_minimo numeric not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_materiais_cat on materiais (categoria);

create table if not exists estoque_mov (
  id              uuid primary key default gen_random_uuid(),
  material_id     text not null references materiais(id) on delete cascade,
  tipo            text not null,                   -- entrada | saida | ajuste | perda
  qtd             numeric not null,
  custo_unit      numeric,
  motivo          text,
  comanda_id      uuid,
  profissional_id uuid references profissionais(id) on delete set null,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_mov_material on estoque_mov (material_id, criado_em desc);

-- ── Comandas (atendimentos) ────────────────────────────────────────────────
create table if not exists comandas (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id) on delete set null,
  cliente_nome    text,                            -- preservado mesmo se a cliente for removida
  profissional_id uuid references profissionais(id) on delete set null,
  data            date not null default current_date,
  status          text not null default 'aberta',  -- aberta | fechada | cancelada
  forma_pagamento text,
  desconto        numeric not null default 0,
  total           numeric not null default 0,
  custo_total     numeric not null default 0,
  tempo_total     numeric not null default 0,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  fechada_em      timestamptz
);
create index if not exists idx_comandas_data on comandas (data desc);
create index if not exists idx_comandas_cliente on comandas (cliente_id);

create table if not exists comanda_itens (
  id           uuid primary key default gen_random_uuid(),
  comanda_id   uuid not null references comandas(id) on delete cascade,
  servico_id   text,
  nome         text not null,
  tipo         text not null default 'servico',
  qtd          numeric not null default 1,
  valor        numeric not null default 0,         -- unitário
  custo        numeric not null default 0,
  tempo        numeric not null default 0,
  comissao_pct numeric
);
create index if not exists idx_itens_comanda on comanda_itens (comanda_id);

-- ── Ficha técnica: quanto de cada insumo sai por serviço ───────────────────
-- É o que permite a baixa automática de estoque ao fechar a comanda.
-- A planilha original não trazia consumo por atendimento, então começa vazia
-- e é preenchida dentro do app, em Estoque → Ficha técnica.
create table if not exists ficha_tecnica (
  id          uuid primary key default gen_random_uuid(),
  servico_id  text not null references servicos(id) on delete cascade,
  material_id text not null references materiais(id) on delete cascade,
  qtd         numeric not null default 0,
  unique (servico_id, material_id)
);
create index if not exists idx_ficha_servico on ficha_tecnica (servico_id);

-- ── Caixa ──────────────────────────────────────────────────────────────────
create table if not exists caixa (
  id              uuid primary key default gen_random_uuid(),
  data            date not null default current_date,
  tipo            text not null,                   -- entrada | saida
  categoria       text not null,
  descricao       text,
  valor           numeric not null,
  forma_pagamento text,
  profissional_id uuid references profissionais(id) on delete set null,
  comanda_id      uuid references comandas(id) on delete cascade,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_caixa_data on caixa (data desc);

-- ── Configuração (premissas, link do Trinks, etc.) ─────────────────────────
create table if not exists config (
  chave      text primary key,
  valor      jsonb not null,
  atualizado timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA
--
-- Estar logado NÃO basta. O Supabase permite auto-cadastro por padrão, e o
-- endereço do projeto mais a chave pública ficam visíveis no código do app —
-- é assim que qualquer aplicativo web funciona. Se a regra fosse apenas
-- "usuário autenticado", bastaria alguém criar uma conta para ler a agenda,
-- os clientes e o caixa do studio.
--
-- Então o acesso exige estar cadastrada como profissional ATIVA. E só entra
-- como ativa quem foi convidada pelo painel do Supabase (ou a primeira pessoa
-- a acessar, que é quem está instalando). Quem se cadastrar sozinha depois
-- entra inativa e não enxerga absolutamente nada.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.e_da_equipe()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profissionais
    where user_id = auth.uid() and ativo
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['profissionais','clientes','servicos','materiais','ficha_tecnica',
                           'estoque_mov','comandas','comanda_itens','caixa','config']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe" on %I', t);
    execute format($f$
      create policy "equipe" on %I
        for all to authenticated
        using (public.e_da_equipe()) with check (public.e_da_equipe())
    $f$, t);
  end loop;
end $$;

-- Exceção necessária: quem acabou de logar precisa conseguir ler a PRÓPRIA
-- linha para o app saber quem ela é — inclusive para descobrir que está
-- inativa e mostrar "acesso não liberado" em vez de uma tela quebrada.
drop policy if exists "minha_linha" on profissionais;
create policy "minha_linha" on profissionais
  for select to authenticated
  using (user_id = auth.uid());

-- A tabela de preços e os dados de contato são públicos por natureza: é o que
-- a vitrine mostra para quem ainda não é cliente. Só leitura, só isso.
drop policy if exists "vitrine_servicos" on servicos;
create policy "vitrine_servicos" on servicos
  for select to anon using (ativo);

drop policy if exists "vitrine_config" on config;
create policy "vitrine_config" on config
  for select to anon using (chave in ('studio', 'categorias'));

-- Quem atende também aparece para a cliente: nome, foto e apresentação. Não
-- pode ser uma policy em `profissionais` — a policy libera a LINHA inteira, e
-- a linha carrega a comissão. A view entrega só as colunas de vitrine.
create or replace view public.equipe_publica
with (security_invoker = off) as
  select id, nome, apelido, funcao, foto, bio, recado
  from public.profissionais
  where ativo and atende;

grant select on public.equipe_publica to anon, authenticated;

-- Cria automaticamente o registro de profissional quando alguém é convidado.
create or replace function public.novo_profissional()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nome_novo text;
  primeira  boolean;
  liberada  boolean;
  adotado   uuid;
begin
  nome_novo := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  select not exists (select 1 from public.profissionais where user_id is not null) into primeira;

  -- Ativa se foi convidada pelo painel, ou se é a primeira pessoa do studio
  -- (quem está instalando). Cadastro espontâneo entra inativo.
  liberada := new.invited_at is not null or primeira;

  -- Se a conta desta pessoa já foi apagada e recriada, existe um cadastro
  -- órfão com o histórico dela. Adotar esse cadastro em vez de criar outro é
  -- o que impede a lista de profissionais de encher de duplicados.
  update public.profissionais
     set user_id = new.id, ativo = liberada
   where user_id is null
     and lower(trim(nome)) = lower(trim(nome_novo))
   returning id into adotado;

  if adotado is null then
    insert into public.profissionais (user_id, nome, ativo)
    values (new.id, nome_novo, liberada)
    on conflict (user_id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.novo_profissional();

-- Quem já tinha conta antes deste arquivo rodar não passou pelo gatilho e
-- ficaria trancada do lado de fora. Cadastra essas pessoas agora, como ativas:
-- na hora da instalação, os únicos usuários que existem são os do studio.
insert into public.profissionais (user_id, nome, ativo)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
       true
from auth.users u
left join public.profissionais p on p.user_id = u.id
where p.id is null
on conflict (user_id) do nothing;

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
    from servicos s
   where s.id = p_servico_id and s.ativo and coalesce(s.agenda_online, true);
  -- Serviço fora do agendamento online não tem horário nenhum para oferecer.
  -- A trava é aqui e não só na tela: a função é pública.
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
    from servicos s
   where s.id = p_servico_id and s.ativo and coalesce(s.agenda_online, true);
  if v_dur is null then
    raise exception 'Este serviço é marcado pelo WhatsApp. Fale com o studio.';
  end if;

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

-- ── O horário que a cliente guardou ainda existe? ──────────────────────────
-- A página das clientes guarda o horário no próprio celular. Sem esta
-- conferência, um horário cancelado do lado do studio continuaria no cartão
-- dela para sempre, com o botão de desmarcar respondendo "não consegui".
--
-- Não abre nada: só responde sobre o horário de quem já tem o código dele.
create or replace function public.situacao_agendamentos(p_tokens uuid[])
returns table (codigo uuid, quando timestamptz, servico text, prof_nome text, situacao text)
language sql security definer set search_path = public stable as $$
  select a.token, a.inicio, a.servico_nome, split_part(p.nome, ' ', 1), a.status
    from agendamentos a
    join profissionais p on p.id = a.profissional_id
   where a.token = any(p_tokens)
$$;

revoke all on function public.horarios_livres(text, date) from public;
revoke all on function public.criar_agendamento(text, uuid, timestamptz, text, text, text) from public;
revoke all on function public.cancelar_agendamento(uuid) from public;
grant execute on function public.horarios_livres(text, date) to anon, authenticated;
grant execute on function public.criar_agendamento(text, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.cancelar_agendamento(uuid) to anon, authenticated;
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
