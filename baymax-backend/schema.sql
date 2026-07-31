-- Run this in the Supabase SQL editor.
--
-- Auth is handled entirely by Supabase Auth (the managed `auth.users` table),
-- so we do NOT define a users table here. We only own the `sessions` table,
-- whose user_id references the Supabase auth user.

create table if not exists sessions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    title      text not null,
    task       text not null,
    created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions(user_id);

-- The backend uses the service_role key and scopes every query by user_id in
-- code, so Row-Level Security is not strictly required for it. Enable RLS only
-- if the frontend ever queries this table directly with the anon key:
--
-- alter table sessions enable row level security;
-- create policy "users manage own sessions"
--   on sessions for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

-- One outcome (success/fail) per guide step per session. All reads/writes go
-- through the FastAPI backend (POST /feedback, POST /feedback/completion,
-- admin-only GET /feedback) — same access-control convention as `sessions`.
create table if not exists public.guide_feedback (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users(id)
    on delete cascade,

  session_id uuid
    references public.sessions(id)
    on delete set null,

  guide_id text not null,
  guide_title text not null,

  step_index integer not null
    check (step_index >= 1),

  step_title text not null,

  status text not null
    check (status in ('success', 'fail')),

  created_at timestamptz not null default now()
);

create index if not exists guide_feedback_status_idx
  on public.guide_feedback(status);

create index if not exists guide_feedback_guide_id_idx
  on public.guide_feedback(guide_id);

create index if not exists guide_feedback_created_at_idx
  on public.guide_feedback(created_at desc);

create index if not exists guide_feedback_guide_status_idx
  on public.guide_feedback(guide_id, status);

-- One final outcome per step per session — enforced only when a session
-- exists (offline/trial runs with a null session_id are exempt).
create unique index if not exists guide_feedback_one_outcome_per_session_step_idx
  on public.guide_feedback(session_id, guide_id, step_index)
  where session_id is not null;
