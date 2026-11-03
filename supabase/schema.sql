-- Run this once in the Supabase SQL editor (dashboard → SQL Editor → New query)

create table if not exists public.characters (
  id          text        primary key,
  name        text        not null,
  source      text        not null,
  creator     text        not null default '',
  year        integer,
  medium      text        not null,
  house       text        not null check (house in ('Gryffindor','Slytherin','Ravenclaw','Hufflepuff')),
  scores      jsonb       not null,
  traits      text[]      not null default '{}',
  background  text        not null default '',
  reasoning   text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Full-text search index on name + source + creator
create index if not exists characters_fts
  on public.characters
  using gin (to_tsvector('english', name || ' ' || source || ' ' || coalesce(creator, '')));

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at on public.characters;
create trigger set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- Row-level security: anyone can read, only service role can write
alter table public.characters enable row level security;

drop policy if exists "public read" on public.characters;
create policy "public read" on public.characters
  for select using (true);
