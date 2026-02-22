-- AGROX deploy readiness check (non-destructive)
-- Run in Supabase SQL Editor after applying migrations.

-- 1) Required module tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('users', 'user_roles', 'maintenance_requests', 'order_requests', 'damage_reports', 'fuelings')
order by table_name;

-- 2) Existing users and user levels/roles are preserved
select
  (select count(*) from public.users) as users_count,
  (select count(*) from public.user_roles) as user_roles_count;

select role, count(*) as total
from public.user_roles
group by role
order by role;

-- 3) Required buckets used by modules
select id, name, public
from storage.buckets
where id in ('maintenance-requests', 'maintenance_requests', 'maintenance', 'damage-reports', 'damages', 'fuelings', 'fuel-records')
order by id;

-- 4) RLS policy presence for module tables (quick audit)
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('maintenance_requests', 'order_requests', 'damage_reports', 'fuelings', 'users', 'user_roles')
order by tablename, policyname;
