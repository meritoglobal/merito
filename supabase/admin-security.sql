-- ════════════════════════════════════════════════════════════════
-- Merito: admin security for Supabase
-- Run in Supabase Dashboard → SQL Editor. Safe to run more than once.
--
-- STEP 1 adds an is_admin() check and gives the admin account full
-- access to every app table. It only ADDS permissions for the admin;
-- it does not remove or change any existing policy, so the student
-- site keeps working exactly as before.
--
-- STEP 2 is a read-only audit. Run it and share the result so we can
-- tighten any table that is open to everyone.
-- ════════════════════════════════════════════════════════════════

-- ── STEP 1: admin check + admin policies ─────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'meritoglobalbd@gmail.com', false);
$$;

do $$
declare
  t text;
  tables text[] := array[
    'blogs','books','course_content','course_enrollments','courses',
    'exam_question_categories','exam_question_map','exam_questions',
    'exam_submissions','exams','instructors','notifications','orders',
    'profiles','site_settings','store_links','store_pdfs',
    'store_pictures','store_videos'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "admin full access" on public.%I', t);
      execute format(
        'create policy "admin full access" on public.%I
           for all to authenticated
           using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;

-- ── STEP 2: audit (read-only) ────────────────────────────────────
-- Tables with RLS OFF are readable/writable by anyone with the public key.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by rls_enabled, table_name;

-- Every policy, so we can spot ones that allow everyone (qual = 'true').
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
