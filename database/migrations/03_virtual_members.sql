-- Database Migration: Enable Virtual Members (Collabix)
-- Drops the strict auth.users foreign key constraint on the profiles table.
-- This allows workspaces to contain manually created/custom virtual teammates 
-- so that team members can collaborate and assign tasks under a single credential.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
