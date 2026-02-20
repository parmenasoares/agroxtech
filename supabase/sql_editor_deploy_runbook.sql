-- AGROX - SQL Editor Runbook (copy/paste)
-- Objetivo: aplicar correções no Supabase SEM apagar dados existentes
-- e validar cada módulo com checklist OK/FAIL.

-- =========================================================
-- PASSO 0) BASELINE (antes de aplicar migrations)
-- =========================================================
-- Esperado: apenas auditoria. Não altera dados.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.users) as public_users,
  (select count(*) from public.user_roles) as user_roles;

select role, count(*) as total
from public.user_roles
group by role
order by role;

-- OK: consulta roda sem erro e você guarda os números para comparar depois.
-- FAIL: erro de permissão/schema -> revisar acesso no projeto Supabase correto.

-- =========================================================
-- PASSO 1) APLICAR MIGRATIONS (na ordem)
-- =========================================================
-- 1.1) maintenance
-- Cole e execute o conteúdo de:
-- supabase/migrations/20260218101500_add_maintenance_requests.sql

-- 1.2) orders
-- Cole e execute o conteúdo de:
-- supabase/migrations/20260218104500_add_order_requests.sql

-- 1.3) damages + fuel
-- Cole e execute o conteúdo de:
-- supabase/migrations/20260219103000_add_damage_reports_and_fuelings.sql

-- 1.4) hardening/compatibilidade
-- Cole e execute o conteúdo de:
-- supabase/migrations/20260220193000_harden_module_compatibility.sql

-- OK: cada script termina sem erro.
-- FAIL: erro em qualquer script -> parar e corrigir antes de deploy.

-- =========================================================
-- PASSO 2) CHECKLIST ESTRUTURAL (após migrations)
-- =========================================================
-- 2.1) tabelas obrigatórias
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users',
    'user_roles',
    'maintenance_requests',
    'order_requests',
    'damage_reports',
    'fuelings'
  )
order by table_name;

-- OK: retorna as 6 tabelas.
-- FAIL: faltou tabela -> migration não aplicada no projeto correto.

-- 2.2) usuários e níveis preservados
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.users) as public_users,
  (select count(*) from public.user_roles) as user_roles;

select role, count(*) as total
from public.user_roles
group by role
order by role;

-- OK: user_roles se mantém (não zera) e public.users >= baseline.
-- FAIL: contagens inesperadas -> validar projeto/ambiente errado.

-- 2.3) buckets esperados
select id, name, public
from storage.buckets
where id in (
  'maintenance-requests',
  'maintenance_requests',
  'maintenance',
  'damage-reports',
  'damages',
  'fuelings',
  'fuel-records'
)
order by id;

-- OK: retorna buckets usados pelos módulos.
-- FAIL: bucket faltando -> migration hardening não aplicada.

-- 2.4) políticas RLS presentes
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    'maintenance_requests',
    'order_requests',
    'damage_reports',
    'fuelings',
    'users',
    'user_roles'
  )
order by tablename, policyname;

-- OK: lista políticas para as tabelas.
-- FAIL: vazio/ausente em módulo -> revisar migration correspondente.

-- =========================================================
-- PASSO 3) CHECKLIST POR MÓDULO (dados rápidos)
-- =========================================================
select 'maintenance' as module, count(*) as total from public.maintenance_requests
union all
select 'orders' as module, count(*) as total from public.order_requests
union all
select 'damages' as module, count(*) as total from public.damage_reports
union all
select 'fuel' as module, count(*) as total from public.fuelings;

-- OK: consulta roda sem erro para todos os módulos.
-- FAIL: erro em um módulo indica estrutura incompleta daquele módulo.

-- =========================================================
-- PASSO 4) PRONTO PARA DEPLOY
-- =========================================================
-- Se todos os passos acima estiverem OK:
-- 1) Rode local: npm run validate:all
-- 2) Faça deploy/redeploy na Vercel
-- 3) Teste login + envio nos módulos com usuário OPERADOR
