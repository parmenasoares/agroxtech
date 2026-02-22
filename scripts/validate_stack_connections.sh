#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  # Load local env vars for validation commands.
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}"

ok() { echo "OK   - $1"; }
fail() { echo "FAIL - $1"; }
warn() { echo "WARN - $1"; }

# 1) GitHub remote check
if git remote get-url origin >/dev/null 2>&1; then
  ok "GitHub remote configurado: $(git remote get-url origin)"
else
  fail "GitHub remote origin não configurado"
fi

# 2) Vercel linkage check (created by vercel link)
if [[ -f .vercel/project.json ]]; then
  ok "Vercel link encontrado em .vercel/project.json"
else
  warn "Projeto não linkado localmente à Vercel (.vercel/project.json ausente)"
fi

# 3) Supabase env check
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  fail "Variáveis Supabase ausentes. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_*)"
  exit 1
fi
ok "Variáveis Supabase detectadas"

# 4) Supabase API reachability
root_status=$(curl -sS -o /tmp/supa_root.out -w "%{http_code}" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/" || true)

if [[ "$root_status" == "200" || "$root_status" == "404" ]]; then
  ok "Supabase REST acessível (HTTP $root_status)"
else
  fail "Supabase REST inacessível (HTTP $root_status)"
  exit 1
fi

# 5) Required tables check by endpoint status
check_table() {
  local table="$1"
  local status
  status=$(curl -sS -o /tmp/supa_${table}.out -w "%{http_code}" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    "$SUPABASE_URL/rest/v1/${table}?select=*&limit=1" || true)

  if [[ "$status" == "200" || "$status" == "206" ]]; then
    ok "Tabela '${table}' disponível (HTTP $status)"
  elif [[ "$status" == "404" ]]; then
    fail "Tabela '${table}' ausente no Supabase (HTTP 404)"
  elif [[ "$status" == "401" || "$status" == "403" ]]; then
    warn "Tabela '${table}' respondeu $status (verifique RLS/permissões)"
  else
    fail "Tabela '${table}' com retorno inesperado (HTTP $status)"
  fi
}

for t in users user_roles maintenance_requests order_requests damage_reports fuelings; do
  check_table "$t"
done

echo "\nValidação concluída."
