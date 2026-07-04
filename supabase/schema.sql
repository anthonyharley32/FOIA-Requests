-- Unredacted MVP schema
-- Run this in the Supabase SQL Editor after creating the project.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('citizen', 'employee')) default 'citizen',
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('clarifying', 'submitted', 'under_review', 'fulfilled')) default 'clarifying',
  intent_text text not null,
  final_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  sender text not null check (sender in ('user', 'ai', 'employee')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Row Level Security
-- NOTE: The FastAPI backend uses the service-role key for all reads/writes,
-- which bypasses RLS entirely. These policies exist as a safety net in case
-- the frontend ever queries Supabase directly (it shouldn't for MVP — the
-- frontend only uses Supabase for auth and talks to FastAPI for all data).

alter table profiles enable row level security;
alter table requests enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

create policy "requests_select" on requests for select using (
  citizen_id = auth.uid()
  or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'employee')
);

create policy "messages_select" on messages for select using (
  exists (
    select 1 from requests
    where requests.id = messages.request_id
    and (
      requests.citizen_id = auth.uid()
      or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'employee')
    )
  )
);

create policy "documents_select" on documents for select using (
  exists (
    select 1 from requests
    where requests.id = documents.request_id
    and (
      requests.citizen_id = auth.uid()
      or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'employee')
    )
  )
);

-- Auto-create a profile row on signup. The frontend passes the desired role
-- via signUp's options.data.role ('citizen' or 'employee').
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'role', 'citizen'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
