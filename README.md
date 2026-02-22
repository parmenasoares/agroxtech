# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Deploy na Vercel com Supabase (sem perder dados)

Se o projeto já está conectado na Vercel e no Supabase, use este fluxo para manter os dados existentes e validar antes de publicar:

1. **Confirme variáveis na Vercel**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

2. **Aplique as migrations no Supabase** (no projeto correto)
   - `supabase/migrations/20260218101500_add_maintenance_requests.sql`
   - `supabase/migrations/20260218104500_add_order_requests.sql`
   - `supabase/migrations/20260219103000_add_damage_reports_and_fuelings.sql`
   - `supabase/migrations/20260220193000_harden_module_compatibility.sql`

3. **Rode validação automática local**

```sh
npm run validate:all
```

4. **Faça redeploy na Vercel** após as migrations.

> Importante: redeploy na Vercel sozinho atualiza apenas frontend. Para corrigir “Módulo em configuração”, o Supabase também precisa estar atualizado com as migrations.

## Ordem exata para SQL Editor (copiar/colar) + checklist OK/FAIL

Para facilitar sua operação, existe um runbook pronto com a sequência completa:

- `supabase/sql_editor_deploy_runbook.sql`

Esse arquivo contém:
- baseline (antes),
- ordem de execução das migrations,
- checklist estrutural,
- checklist por módulo,
- critério objetivo de **OK/FAIL** em cada etapa.

## Garantia de dados existentes (usuários e níveis)

As migrations deste projeto são **não destrutivas** para usuários e níveis:

- Não existe `DROP TABLE` para `public.users` ou `public.user_roles`.
- O backfill de usuários usa `INSERT ... ON CONFLICT DO NOTHING`, ou seja, não sobrescreve usuários existentes.
- As roles (níveis) em `public.user_roles` são preservadas; nada apaga os registros atuais durante o fluxo de deploy normal.

Para auditar isso no seu projeto Supabase antes/depois do deploy, rode:

```sql
-- arquivo pronto no repositório
-- supabase/verify_deploy_readiness.sql
```

Resumo prático:
1. Aplicar migrations no Supabase.
2. Rodar `supabase/verify_deploy_readiness.sql` no SQL Editor.
3. Rodar `npm run validate:all`.
4. Fazer deploy/redeploy na Vercel.


## Validar conexão Supabase + Vercel + GitHub

Use este comando para validar rapidamente se o projeto local está conectado e se as tabelas principais existem no Supabase:

```sh
npm run validate:stack
```

O script verifica:
- remote `origin` do GitHub,
- link local da Vercel (`.vercel/project.json`),
- variáveis Supabase (`VITE_*` ou `NEXT_PUBLIC_*`),
- conectividade REST do Supabase,
- presença das tabelas: `users`, `user_roles`, `maintenance_requests`, `order_requests`, `damage_reports`, `fuelings`.

## Criar tabelas novas no Supabase (sem perder dados)

1. Crie uma migration nova:

```sh
npx supabase migration new create_nome_da_tabela
```

2. Edite o arquivo criado em `supabase/migrations/` com `CREATE TABLE IF NOT EXISTS ...`.

Exemplo seguro:

```sql
CREATE TABLE IF NOT EXISTS public.exemplo_modulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exemplo_modulo ENABLE ROW LEVEL SECURITY;
```

3. Aplique no projeto Supabase correto (SQL Editor ou CLI) e rode os checks do runbook.

