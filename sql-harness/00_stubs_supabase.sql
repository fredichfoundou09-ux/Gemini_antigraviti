create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists "uuid-ossp";
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(), last_sign_in_at timestamptz, phone text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
