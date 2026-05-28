create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gemini','openai','deepseek')),
  encrypted_key_iv text not null,
  encrypted_key_ciphertext text not null,
  encrypted_key_tag text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);
alter table public.user_api_keys enable row level security;
-- Users can only access their own keys
create policy "user_api_keys_own" on public.user_api_keys
  for all using (auth.uid() = user_id);
