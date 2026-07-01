-- Migration: Add password reset token columns to public.users table
alter table public.users
  add column reset_token text unique,
  add column reset_token_expires_at timestamp with time zone;
