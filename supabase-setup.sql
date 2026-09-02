-- "Sig ikke ordet" — skema til rum og ordpuljer.
-- Kør hele filen i Supabase: SQL Editor -> New query -> Run.

create table if not exists public.rooms (
  code         text primary key,
  status       text        not null default 'lobby',
  host         text        not null,
  turn_seconds integer     not null default 60,
  active       integer     not null default 0,
  teams        jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists public.words (
  id         uuid primary key default gen_random_uuid(),
  room       text        not null references public.rooms(code) on delete cascade,
  text       text        not null,
  added_by   text        not null,
  created_at timestamptz not null default now()
);

create index if not exists words_room_idx on public.words (room);

-- Spillerne har ingen konti, så alt sker med den offentlige anon-nøgle.
-- Rækkerne er med vilje åbne: der ligger kun ord til et selskabsspil her.
alter table public.rooms enable row level security;
alter table public.words enable row level security;

drop policy if exists "spil: rum" on public.rooms;
create policy "spil: rum" on public.rooms
  for all to anon using (true) with check (true);

drop policy if exists "spil: ord" on public.words;
create policy "spil: ord" on public.words
  for all to anon using (true) with check (true);

-- Live-opdateringer til de andre telefoner.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.words;

-- Ryd gamle spil op. Kør engang imellem, eller læg det i en cron.
-- delete from public.rooms where created_at < now() - interval '1 day';
