-- Mission Control (Supabase) schema + RLS policies
-- Apply in Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;

-- =========================================================
-- Enums
-- =========================================================

-- Human roles (Supabase-auth users only)
-- MVP: only ADMIN is active. OPERATOR is reserved for later.
do $$ begin
  create type public.human_role as enum ('ADMIN','OPERATOR');
exception when duplicate_object then null; end $$;

-- Subagent identities/entities (DO NOT log in)
do $$ begin
  create type public.subagent as enum ('CORE','VECTOR','KERNEL','SHIELD');
exception when duplicate_object then null; end $$;

-- Mission workflow

do $$ begin
  create type public.mission_status as enum ('BACKLOG','READY','IN_PROGRESS','REVIEW','APPROVED','SCHEDULED','DONE','BLOCKED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.run_status as enum ('QUEUED','RUNNING','PASS','REVISE','FAIL','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deliverable_status as enum ('pending','drafted','in_review','approved');
exception when duplicate_object then null; end $$;

-- =========================================================
-- Profiles (humans only)
-- =========================================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.human_role not null,
  created_at timestamptz not null default now()
);

-- Helper: current human role (defaults to NULL-like sentinel)
create or replace function public.current_human_role() returns text language sql stable as $$
  select (select role::text from public.profiles where user_id = auth.uid());
$$;

-- =========================================================
-- Missions
-- =========================================================

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status public.mission_status not null default 'BACKLOG',

  -- Assignment to a subagent identity (not a human)
  assigned_to public.subagent,

  -- strict language separation:
  internal_notes_en text,                 -- always English
  audience text,
  objective text,
  cta text,
  external_language text not null default 'es',

  due_date date,

  -- scheduling metadata only (no background jobs)
  scheduled_for timestamptz,
  timezone text not null default 'America/Chicago',
  schedule_notes text,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missions_status_idx on public.missions(status);
create index if not exists missions_assigned_to_idx on public.missions(assigned_to);
create index if not exists missions_due_date_idx on public.missions(due_date);
create index if not exists missions_scheduled_for_idx on public.missions(scheduled_for);

-- =========================================================
-- Typed deliverables
-- =========================================================

create table if not exists public.mission_deliverables (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,

  type text not null,            -- blog/newsletter/social_post/internal_doc/engineering_task/...
  channel text,
  format text,

  language text not null default 'es',
  due_date date,
  status public.deliverable_status not null default 'pending',

  -- Assigned subagent entity (not a human)
  assigned_to public.subagent not null,

  link text,
  notes text,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deliverables_language_governance check (
    -- internal deliverables must be English
    (type in ('internal_doc','engineering_task') and language = 'en')
    or
    -- everything else may be any language (default es)
    (type not in ('internal_doc','engineering_task'))
  )
);

create index if not exists mission_deliverables_mission_id_idx on public.mission_deliverables(mission_id);
create index if not exists mission_deliverables_assigned_to_idx on public.mission_deliverables(assigned_to);

-- =========================================================
-- Comments / thread
-- =========================================================

create table if not exists public.mission_comments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists mission_comments_mission_id_idx on public.mission_comments(mission_id);

-- =========================================================
-- Attachments/links
-- =========================================================

create table if not exists public.mission_attachments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  url text not null,
  label text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists mission_attachments_mission_id_idx on public.mission_attachments(mission_id);

-- =========================================================
-- Activity timeline (audit)
-- Note: actor is ALWAYS a human auth user for MVP.
-- Subagent references can be embedded in `after`/`before` JSON.
-- =========================================================

create table if not exists public.mission_activity (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  kind text not null,
  before jsonb,
  after jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists mission_activity_mission_id_idx on public.mission_activity(mission_id);

-- =========================================================
-- Runs + logs
-- =========================================================

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id) on delete set null,

  -- run executed by a subagent identity
  executor public.subagent not null,

  status public.run_status not null default 'QUEUED',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  started_at timestamptz,
  finished_at timestamptz,

  -- created/recorded by a human
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists runs_created_at_idx on public.runs(created_at desc);
create index if not exists runs_executor_idx on public.runs(executor);
create index if not exists runs_status_idx on public.runs(status);

create table if not exists public.run_logs (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  meta jsonb,
  ts timestamptz not null default now()
);

create index if not exists run_logs_run_id_idx on public.run_logs(run_id, ts);

-- =========================================================
-- updated_at triggers
-- =========================================================

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create trigger missions_set_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger deliverables_set_updated_at
  before update on public.mission_deliverables
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- =========================================================
-- Workflow RPCs (server-side enforcement)
-- =========================================================

-- Submit for review: ADMIN only (MVP), and only IN_PROGRESS -> REVIEW
create or replace function public.submit_mission_for_review(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  m record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  r := public.current_human_role();
  if r <> 'ADMIN' then
    raise exception 'forbidden';
  end if;

  select id, status into m
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'not_found';
  end if;

  if m.status <> 'IN_PROGRESS'::public.mission_status then
    raise exception 'invalid_transition';
  end if;

  update public.missions
  set status = 'REVIEW'::public.mission_status
  where id = p_mission_id;

  insert into public.mission_activity (mission_id, kind, after, created_by)
  values (p_mission_id, 'workflow.submit_for_review', jsonb_build_object('status','REVIEW'), auth.uid());
end $$;

grant execute on function public.submit_mission_for_review(uuid) to authenticated;

-- Approve: ADMIN only
create or replace function public.approve_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  r := public.current_human_role();
  if r <> 'ADMIN' then
    raise exception 'forbidden';
  end if;

  update public.missions
  set status = 'APPROVED'::public.mission_status
  where id = p_mission_id;

  insert into public.mission_activity (mission_id, kind, after, created_by)
  values (p_mission_id, 'workflow.approve', jsonb_build_object('status','APPROVED'), auth.uid());
end $$;

grant execute on function public.approve_mission(uuid) to authenticated;

-- Schedule: ADMIN only (metadata only)
create or replace function public.schedule_mission(
  p_mission_id uuid,
  p_scheduled_for timestamptz,
  p_timezone text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  r := public.current_human_role();
  if r <> 'ADMIN' then
    raise exception 'forbidden';
  end if;

  update public.missions
  set
    status = 'SCHEDULED'::public.mission_status,
    scheduled_for = p_scheduled_for,
    timezone = coalesce(nullif(trim(p_timezone),''), 'America/Chicago'),
    schedule_notes = nullif(trim(p_notes), '')
  where id = p_mission_id;

  insert into public.mission_activity (mission_id, kind, after, created_by)
  values (
    p_mission_id,
    'workflow.schedule',
    jsonb_build_object('status','SCHEDULED','scheduled_for',p_scheduled_for,'timezone',p_timezone),
    auth.uid()
  );
end $$;

grant execute on function public.schedule_mission(uuid, timestamptz, text, text) to authenticated;

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.mission_deliverables enable row level security;
alter table public.mission_comments enable row level security;
alter table public.mission_attachments enable row level security;
alter table public.mission_activity enable row level security;
alter table public.runs enable row level security;
alter table public.run_logs enable row level security;

-- Drop old policies (safe if they don't exist)
drop policy if exists "profiles: self read" on public.profiles;
drop policy if exists "profiles: admin read" on public.profiles;
drop policy if exists "profiles: admin upsert" on public.profiles;
drop policy if exists "profiles: admin update" on public.profiles;

drop policy if exists "missions: read" on public.missions;
drop policy if exists "missions: create" on public.missions;
drop policy if exists "missions: update admin/core" on public.missions;
drop policy if exists "missions: update vector assigned" on public.missions;
drop policy if exists "missions: delete" on public.missions;

drop policy if exists "deliverables: read" on public.mission_deliverables;
drop policy if exists "deliverables: create admin/core" on public.mission_deliverables;
drop policy if exists "deliverables: update admin/core" on public.mission_deliverables;
drop policy if exists "deliverables: update vector assigned" on public.mission_deliverables;
drop policy if exists "deliverables: update kernel engineering only" on public.mission_deliverables;
drop policy if exists "deliverables: delete admin" on public.mission_deliverables;

drop policy if exists "comments: read" on public.mission_comments;
drop policy if exists "comments: create" on public.mission_comments;

drop policy if exists "attachments: read" on public.mission_attachments;
drop policy if exists "attachments: create" on public.mission_attachments;

drop policy if exists "activity: read" on public.mission_activity;
drop policy if exists "activity: create" on public.mission_activity;

drop policy if exists "runs: read" on public.runs;
drop policy if exists "runs: create" on public.runs;
drop policy if exists "runs: update" on public.runs;

drop policy if exists "run_logs: read" on public.run_logs;
drop policy if exists "run_logs: create" on public.run_logs;

-- Profiles policies
create policy "profiles: self read" on public.profiles
for select using (user_id = auth.uid());

create policy "profiles: admin read" on public.profiles
for select using (public.current_human_role() = 'ADMIN');

create policy "profiles: admin upsert" on public.profiles
for insert with check (public.current_human_role() = 'ADMIN');

create policy "profiles: admin update" on public.profiles
for update using (public.current_human_role() = 'ADMIN');

-- Missions policies
create policy "missions: read" on public.missions
for select using (public.current_human_role() = 'ADMIN');

create policy "missions: create" on public.missions
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

-- Update:
-- ADMIN: full update (MVP). Everyone else: default deny.
create policy "missions: update admin" on public.missions
for update using (public.current_human_role() = 'ADMIN');

-- Delete: admin only
create policy "missions: delete" on public.missions
for delete using (public.current_human_role() = 'ADMIN');

-- Deliverables policies
create policy "deliverables: read" on public.mission_deliverables
for select using (public.current_human_role() = 'ADMIN');

create policy "deliverables: create" on public.mission_deliverables
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

create policy "deliverables: update" on public.mission_deliverables
for update using (public.current_human_role() = 'ADMIN');

create policy "deliverables: delete" on public.mission_deliverables
for delete using (public.current_human_role() = 'ADMIN');

-- Comments policies
create policy "comments: read" on public.mission_comments
for select using (public.current_human_role() = 'ADMIN');

-- MVP: ADMIN-only writes (deny-by-default for any future non-admin)
create policy "comments: create" on public.mission_comments
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

-- Attachments policies
create policy "attachments: read" on public.mission_attachments
for select using (public.current_human_role() = 'ADMIN');

create policy "attachments: create" on public.mission_attachments
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

-- Activity policies (audit events)
create policy "activity: read" on public.mission_activity
for select using (public.current_human_role() = 'ADMIN');

create policy "activity: create" on public.mission_activity
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

-- Runs
create policy "runs: read" on public.runs
for select using (public.current_human_role() = 'ADMIN');

create policy "runs: create" on public.runs
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
  and created_by = auth.uid()
);

create policy "runs: update" on public.runs
for update using (public.current_human_role() = 'ADMIN');

-- Run logs
create policy "run_logs: read" on public.run_logs
for select using (public.current_human_role() = 'ADMIN');

create policy "run_logs: create" on public.run_logs
for insert with check (
  auth.role() = 'authenticated'
  and public.current_human_role() = 'ADMIN'
);
