-- Journal d'audit de l'assistant IA agent : trace chaque action proposée et exécutée.
create table if not exists public.ai_agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  status text not null check (status in ('proposed', 'confirmed', 'executed', 'failed', 'rejected')),
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table public.ai_agent_actions enable row level security;

-- Chacun ne voit et n'écrit que ses propres actions d'agent.
create policy "ai_agent_actions_self" on public.ai_agent_actions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Le staff peut consulter l'historique complet à des fins de supervision (lecture seule).
create policy "ai_agent_actions_staff_read" on public.ai_agent_actions for select to authenticated
  using (public.is_staff());

create index if not exists ai_agent_actions_user_idx on public.ai_agent_actions (user_id, created_at desc);
