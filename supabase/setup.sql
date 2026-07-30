-- ============================================================
-- Gestão de Jovens Aprendizes — CIMED
-- Script de configuração do banco no Supabase.
--
-- Como usar:
--   1. No painel do Supabase, abra "SQL Editor".
--   2. Clique em "New query", cole TODO este arquivo e clique "Run".
--   3. Pronto: tabelas, segurança e o armazenamento de contratos criados.
--
-- Modelo de acesso: as pessoas do time têm acesso IGUAL. Qualquer
-- usuário autenticado pode ver e editar todos os dados.
--
-- Guardamos cada registro como JSON (coluna "data"), o que mantém o
-- app simples e flexível. O "id" é o mesmo gerado pelo aplicativo.
-- ============================================================

-- ---------- TABELAS ----------

create table if not exists public.aprendizes (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.contratos (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.documentos (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.convites (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.app_config (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.app_config (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- ---------- SEGURANÇA (Row Level Security) ----------
-- Todas as tabelas exigem login. Usuário autenticado tem acesso total.

alter table public.aprendizes enable row level security;
alter table public.contratos  enable row level security;
alter table public.documentos enable row level security;
alter table public.convites   enable row level security;
alter table public.app_config enable row level security;

do $$
declare t text;
begin
  foreach t in array array['aprendizes','contratos','documentos','convites','app_config']
  loop
    execute format('drop policy if exists "acesso_time" on public.%I;', t);
    execute format(
      'create policy "acesso_time" on public.%I
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;

-- ---------- STORAGE (arquivos de contrato) ----------

insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

drop policy if exists "contratos_time_select" on storage.objects;
drop policy if exists "contratos_time_insert" on storage.objects;
drop policy if exists "contratos_time_update" on storage.objects;
drop policy if exists "contratos_time_delete" on storage.objects;

create policy "contratos_time_select" on storage.objects
  for select to authenticated using (bucket_id = 'contratos');
create policy "contratos_time_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'contratos');
create policy "contratos_time_update" on storage.objects
  for update to authenticated using (bucket_id = 'contratos');
create policy "contratos_time_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'contratos');

-- ---------- REALTIME (atualização ao vivo entre o time) ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.aprendizes'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.contratos';  exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.documentos'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.convites';   exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.app_config'; exception when others then null; end;
end $$;

-- Fim. 🎉
