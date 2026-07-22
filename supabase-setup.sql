-- Sage Wealth — Supabase setup
-- Run this once in Supabase Dashboard → SQL Editor → New query

create extension if not exists pgcrypto;
grant usage on schema public to authenticated;

-- ── PROFILES ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  photo_url text,
  money_reason text,
  money_use text,
  pin text default '1467',
  is_admin boolean not null default false,
  withdrawal_message text,
  balance numeric not null default 40000,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

-- ── NOTIFICATIONS (deposit/withdrawal history) ────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text,
  amount numeric,
  time text,
  status text not null default 'success',
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

grant select, insert on public.notifications to authenticated;

-- ── ADMIN ──────────────────────────────────────────────────
-- Is the currently authenticated user flagged as an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Admins can see & edit every profile (user search, balance edits)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- Admins can see, insert (custom-dated deposits) and update
-- (status changes) any user's notifications
create policy "Admins can view all notifications"
  on public.notifications for select
  using (public.is_admin());

create policy "Admins can insert notifications for any user"
  on public.notifications for insert
  with check (public.is_admin());

create policy "Admins can update notifications"
  on public.notifications for update
  using (public.is_admin());

-- ── ALERTS (admin broadcast banner, shown app-wide) ───────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create policy "Signed-in users can view alerts"
  on public.alerts for select
  using (true);

create policy "Admins can insert alerts"
  on public.alerts for insert
  with check (public.is_admin());

create policy "Admins can update alerts"
  on public.alerts for update
  using (public.is_admin());

grant select on public.alerts to authenticated;
grant insert, update on public.alerts to authenticated;

-- ── AVATAR STORAGE ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
