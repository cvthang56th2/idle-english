-- AI Coach chat threads + active thread pointer (per user)

create table public.coach_chat_threads (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) >= 4 and char_length(id) <= 80),
  title text not null default 'New chat',
  topic_id text not null,
  custom_topic text not null default '',
  level learner_level not null default 'intermediate',
  draft text not null default '',
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index coach_chat_threads_user_updated_idx
  on public.coach_chat_threads (user_id, updated_at desc);

alter table public.coach_chat_threads enable row level security;

create policy "Users manage own coach threads"
  on public.coach_chat_threads for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.coach_chat_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_thread_id text,
  updated_at timestamptz not null default now()
);

alter table public.coach_chat_prefs enable row level security;

create policy "Users manage own coach prefs"
  on public.coach_chat_prefs for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
