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
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

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
  custo     numeric not null default 0,            -- material por atendimento
  tempo     numeric not null default 0,            -- horas
  unidade   text,
  profissional text default 'unhas',
  estimado  boolean not null default false,
  nota      text,
  ordem     int not null default 0,
  ativo     boolean not null default true
);

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
-- Segurança: o studio tem duas profissionais, ambas com acesso total ao que
-- está logado. Nada é público. Quem não estiver autenticado não lê nada.
-- ═══════════════════════════════════════════════════════════════════════════
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
        using (true) with check (true)
    $f$, t);
  end loop;
end $$;

-- A tabela de preços e os dados de contato são públicos por natureza: é o que
-- a vitrine mostra para quem ainda não é cliente. Só leitura, só isso.
drop policy if exists "vitrine_servicos" on servicos;
create policy "vitrine_servicos" on servicos
  for select to anon using (ativo);

drop policy if exists "vitrine_config" on config;
create policy "vitrine_config" on config
  for select to anon using (chave in ('studio', 'categorias'));

-- Cria automaticamente o registro de profissional quando alguém é convidado.
create or replace function public.novo_profissional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profissionais (user_id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.novo_profissional();
