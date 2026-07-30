-- ============================================================
-- Gestão de Jovens Aprendizes — CIMED
-- Script de configuração do banco no Supabase.
--
-- Como usar:
--   1. No painel do Supabase, abra "SQL Editor".
--   2. Clique em "New query", cole TODO este arquivo e clique "Run".
--   3. Pronto: tabelas, segurança e o armazenamento de contratos criados.
--
-- Modelo de acesso: as 3 pessoas do time têm acesso IGUAL. Qualquer
-- usuário autenticado pode ver e editar todos os dados.
-- ============================================================

-- ---------- TABELAS ----------

create table if not exists public.aprendizes (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  cpf               text,
  matricula         text,
  email             text,
  telefone          text,
  data_nascimento   date,
  area              text,
  lider             text,
  lider_email       text,
  instituicao       text,
  curso             text,
  carga_horaria     text,
  data_admissao     date,
  data_fim_contrato date,
  status            text default 'ativo',
  observacoes       text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.contratos (
  id           uuid primary key default gen_random_uuid(),
  aprendiz_id  uuid references public.aprendizes(id) on delete cascade,
  tipo         text default 'Contrato de Aprendizagem',
  data_inicio  date,
  data_fim     date,
  arquivo_path text,   -- caminho do arquivo no Storage
  arquivo_nome text,
  created_at   timestamptz default now()
);

create table if not exists public.documentos (
  id          uuid primary key default gen_random_uuid(),
  aprendiz_id uuid references public.aprendizes(id) on delete set null,
  titulo      text not null,
  tipo        text,
  lider       text,
  lider_email text,
  status      text default 'pendente',
  prazo       date,
  assinado_em date,
  created_at  timestamptz default now()
);

create table if not exists public.convites (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  email      text not null,
  area       text,
  status     text default 'pendente',
  enviado_em date,
  token      text,
  created_at timestamptz default now()
);

create table if not exists public.app_config (
  id                integer primary key default 1 check (id = 1),
  empresa           text default 'CIMED',
  responsavel       text,
  responsavel_email text,
  alerta_dias       integer default 30
);

insert into public.app_config (id) values (1) on conflict (id) do nothing;

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
drop policy if exists "contratos_time_delete" on storage.objects;

create policy "contratos_time_select" on storage.objects
  for select to authenticated using (bucket_id = 'contratos');
create policy "contratos_time_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'contratos');
create policy "contratos_time_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'contratos');

-- ---------- REALTIME (atualização ao vivo entre o time) ----------
alter publication supabase_realtime add table public.aprendizes;
alter publication supabase_realtime add table public.contratos;
alter publication supabase_realtime add table public.documentos;
alter publication supabase_realtime add table public.convites;

-- Fim. 🎉
