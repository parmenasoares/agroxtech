
Objetivo
- Garantir que:
  1) Todo o texto visível ao utilizador (UI + acessibilidade + toasts) está em i18n (sem strings hardcoded nas páginas, incluindo Admin).
  2) O Português passa a ser “pt-PT” (código do idioma e conteúdo PT‑PT neutro).
  3) Datas/horas ficam consistentes e forçadas a pt-PT quando o idioma é pt-PT.

O que já encontrei (exemplos reais no código)
- Idioma atual está como `pt`/`en` e é persistido em `localStorage` na chave `fleet_language`:
  - `src/hooks/useLanguage.tsx` usa `Language = 'pt' | 'en'` e default `'pt'`.
  - `src/lib/i18n.ts` tem `translations.pt` com termos BR misturados com PT (ex.: “Registro”, “Aguardando”, “cadastros”, etc.).
- Há texto hardcoded (PT e EN) espalhado, incluindo Admin:
  - `src/pages/Activity.tsx`: “Cliente”, “Selecione o cliente”, “Get Location”, “Activity started successfully!”, etc.
  - `src/pages/AdminActivitiesValidation.tsx`: cabeçalhos “Cliente / Local”, “Serviço”, “Desempenho” e placeholders “—”.
  - `src/pages/AdminMasterData.tsx`: “Registos”, “Clientes, Locais e Serviços”, “Atualizar”, “Adicionar”, “Nenhum serviço cadastrado.”, aria-label “Back to dashboard”, etc.
  - `src/pages/SuperAdminDashboard.tsx`: grande parte do dashboard está hardcoded (“Visão geral…”, “Total de Utilizadores…”, “Sem dados disponíveis”, etc.).
  - `src/pages/LanguageSelect.tsx`: “Select your language / Selecione o idioma” e botões com texto hardcoded.
  - Módulos “coming soon”: `Orders`, `Maintenance`, `Support`, `Fuel`, `Damages` com “Module coming soon...”.
  - `src/pages/Login.tsx`: mensagens de erro/toast hardcoded (“Account created!…”, “Passwords do not match”), e alt/títulos fixos “AGRO-X CONTROL”.

Decisões já confirmadas consigo (do questionário)
- Código do idioma: mudar para `pt-PT`
- Tom PT‑PT: neutro
- Datas/Horas: padronizar pt-PT
- Escopo: UI + acessibilidade + toasts

Plano de implementação (passos)
1) Atualizar o sistema de idiomas para suportar `pt-PT` (e migrar preferências antigas)
   - Em `src/lib/i18n.ts`:
     - Renomear a chave `translations.pt` para `translations["pt-PT"]`.
     - Ajustar tipos:
       - `export type Language = 'pt-PT' | 'en'`
       - `export type TranslationKey = keyof typeof translations["pt-PT"]`
     - Rever e converter as strings PT para PT‑PT (ver passo 2).
   - Em `src/hooks/useLanguage.tsx`:
     - Alterar o default para `pt-PT`.
     - Adicionar migração transparente:
       - Se `fleet_language` estiver `pt`, mapear para `pt-PT` e gravar de volta (para não “perder” preferências antigas).
   - Em `src/pages/LanguageSelect.tsx`:
     - Atualizar `handleLanguageSelect` para aceitar `Language` (agora `pt-PT`/`en`).
     - Substituir todo o texto hardcoded por `t(...)` (ver passo 3).

2) Rever e normalizar traduções PT para PT‑PT (qualidade linguística)
   - Ajustar termos BR/consistência (exemplos sugeridos):
     - “Registro de Atividade” -> “Registo de atividade”
     - “Suporte TI” -> “Suporte de TI”
     - “Meus Documentos” -> “Os meus documentos”
     - “Aguardando validação” -> “A aguardar validação”
     - “cadastros/cadastrado” -> “registos/registado” (ou “registos base” consoante contexto)
     - Mensagens: “Documento enviado.” ok, mas garantir PT‑PT (“Ficheiro” já está ok)
   - Rever capitalização e consistência (títulos vs labels; pluralização; pontuação).
   - Garantir que as chaves existentes continuam a cobrir o UI atual; criar novas chaves quando necessário.

3) Mover strings hardcoded para i18n (UI + aria-labels + toasts)
   - Estratégia:
     - Fazer uma “varredura” por strings literais relevantes nas páginas e componentes (principalmente `src/pages/**` e `src/components/dashboard/**`).
     - Para cada string visível/aria/toast:
       - Criar uma chave em i18n (nome descritivo e estável).
       - Substituir o literal por `t("...")`.
     - Evitar i18n para valores puramente técnicos (por ex., IDs) ou nomes vindos do backend (ex.: nome do cliente/máquina).
   - Ficheiros prioritários (com itens concretos):
     - `src/pages/Activity.tsx`
       - Labels “Cliente”, “Herdade / Local”, “Serviço”, “Área realizada”, “Como classifica…”
       - Placeholders “Selecione o cliente”, “Selecione o local”, “Selecione o cliente primeiro”, “Selecione o serviço”, “Ex: 12.5”, “Unidade (ha, m²...)”, “Observações (opcional)”, “Selecione (1–5)”
       - Botão “Get Location”
       - Toasts:
         - “Location captured”
         - “Could not get location: …”
         - “Please capture location first”
         - “Selecione a classificação de desempenho (1–5).”
         - “Activity started successfully!”
         - “Activity completed! Awaiting admin validation.”
       - Erro “Not authenticated” (não deve vazar como texto técnico; mapear para mensagem pública em i18n ou usar `getPublicErrorMessage` com fallback traduzido)
       - Texto de aviso do odómetro (se ainda fizer sentido no fluxo atual) para i18n.
     - `src/pages/AdminActivitiesValidation.tsx`
       - Cabeçalhos “Cliente / Local”, “Serviço”, “Desempenho”
       - Placeholder “—” para algo como `t("dash")` ou `t("notAvailable")`
     - `src/pages/AdminMasterData.tsx`
       - Título/subtítulo (“Registos”, “Clientes, Locais e Serviços”)
       - Botões (“Atualizar”, “Adicionar”, “Remover”)
       - Labels/placeholders (“Novo cliente”, “Ex: Cliente X”, etc.)
       - Textos vazios (“Nenhum serviço …”, “Nenhum local …”, etc.)
       - aria-labels “Back to dashboard”, “Cadastros”
       - Toasts “Cliente criado/removido”, “Local criado/removido”, “Serviço criado/removido”
     - `src/pages/SuperAdminDashboard.tsx`
       - Todos os títulos/descrições (“Visão geral…”, “A carregar…”, “Sem dados disponíveis”, “Atividades por Status”, etc.)
       - Nomes de status/labels que aparecem em gráficos (“Pendente”, “Aprovada”, “Rejeitada”, “Atividades”)
       - “Unknown” -> i18n (ex.: `t("unknown")`)
       - Nota: manter valores de roles (“OPERADOR”, etc.) como constantes internas, mas o label exibido pode ser i18n se quiserem (opcional).
     - `src/pages/Login.tsx`
       - Toast “Account created! Please check your email to verify.”
       - Erro “Passwords do not match”
       - “AGRO-X CONTROL” e/ou tagline já usa `t("appTagline")`; alinhar tudo para i18n onde fizer sentido.
     - `src/pages/LanguageSelect.tsx`
       - Subtítulo “Select your language / Selecione o idioma”
       - (Opcional) manter nomes dos idiomas como texto fixo, mas recomendado i18n para consistência.
     - Páginas “coming soon”: `Orders`, `Maintenance`, `Support`, `Fuel`, `Damages`
       - “Module coming soon...” -> `t("moduleComingSoon")` (PT‑PT: “Módulo disponível em breve.” / neutro)
     - `src/components/dashboard/DashboardHeader.tsx`
       - aria-label “Super admin dashboard”, “Máquinas”, “Cadastros”
     - `src/pages/AdminApprovals.tsx` e `src/pages/MyDocuments.tsx`
       - Já estão bem i18n em muitos sítios, mas ainda há hardcoded: “Back to dashboard”, “NIF/NISS/IBAN” e alguns hífens “-”.
       - Converter labels de dados sensíveis (NIF/NISS/IBAN) para i18n (mesmo que o acrónimo seja igual, fica consistente).
   - Garantir que também cobrimos:
     - `aria-label`
     - placeholders
     - textos de estado/empty states
     - mensagens de toast e erros mostrados ao utilizador

4) Padronizar datas/horas com locale baseado no idioma
   - Criar uma pequena utilidade (ex.: `src/lib/formatters.ts`) ou função local por enquanto:
     - Mapear `language` -> locale:
       - `pt-PT` -> `"pt-PT"`
       - `en` -> `"en-US"` (ou `"en-GB"` se preferirem; eu manteria `en-US` a menos que queira padrão europeu)
     - Funções típicas:
       - `formatDate(date, language)` (ex.: dd/MM/yyyy)
       - `formatDateTime(date, language)` (ex.: dd/MM/yyyy HH:mm)
   - Substituir ocorrências:
     - `AdminActivitiesValidation`: `toLocaleString()` -> `Intl.DateTimeFormat(locale, options).format(date)` para ficar consistente.
     - `MyDocuments`: `toLocaleDateString()` -> formatter.
     - `SuperAdminDashboard`: já usa `toLocaleDateString("pt-PT")`, mas deve usar o locale derivado do idioma (para também funcionar em EN).
     - Onde existe `date-fns format(...)` (ex.: `RolesAudit`): decidir se:
       - mantemos `date-fns` para formato fixo (dd/MM/yyyy HH:mm) independentemente do idioma, ou
       - migramos para o formatter por idioma.
     - Como pediu “Padronizar pt-PT”, vou garantir consistência no pt-PT; para EN, também ficará consistente (mesmo que formato seja diferente).

5) Checklist de regressão (manual)
   - Trocar idioma no ecrã inicial e confirmar que:
     - persiste em `localStorage` como `pt-PT`/`en`
     - um utilizador antigo com `pt` não “quebra” e passa a `pt-PT`
   - Percorrer páginas principais e Admin:
     - `/login`, `/dashboard`, `/activity`, `/my-documents`
     - `/admin/approvals`, `/admin/activities`, `/admin/master-data`, `/admin/dashboard` (SuperAdmin)
     - Confirmar que não sobra texto hardcoded (principalmente em PT) e que os toasts aparecem traduzidos.
   - Confirmar datas/horas:
     - em pt-PT: formato consistente
     - em en: formato coerente (não necessariamente igual ao pt-PT)

Riscos e cuidados
- Mudar o código do idioma para `pt-PT` implica migração (vou implementar para não haver “reset” involuntário para utilizadores existentes).
- A pesquisa por strings literais dá muitos falsos positivos (classes Tailwind, etc.). Vou focar:
  - `src/pages/**`
  - `src/components/dashboard/**`
  - e qualquer componente que renderize texto ao utilizador.
- Algumas strings “técnicas” não devem ir para i18n (ex.: `DocType` enum exibido como `dt` em `AdminApprovals` pode ser mantido como está se for um identificador fixo; se isso é user-facing, podemos mapear para labels traduzidos).

Entregáveis (o que será alterado)
- Atualização de idioma:
  - `src/lib/i18n.ts`
  - `src/hooks/useLanguage.tsx`
  - `src/pages/LanguageSelect.tsx`
- Migração de strings para i18n e revisão PT‑PT:
  - `src/pages/Activity.tsx`
  - `src/pages/AdminActivitiesValidation.tsx`
  - `src/pages/AdminMasterData.tsx`
  - `src/pages/SuperAdminDashboard.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Orders.tsx`
  - `src/pages/Maintenance.tsx`
  - `src/pages/Support.tsx`
  - `src/pages/Fuel.tsx`
  - `src/pages/Damages.tsx`
  - `src/components/dashboard/DashboardHeader.tsx`
  - `src/pages/MyDocuments.tsx`
  - `src/pages/RolesAudit.tsx` (apenas se alinharmos datas/placeholder)
  - `src/pages/AdminApprovals.tsx` (aria-labels e labels hardcoded)
- Padronização de datas/horas:
  - Criar/usar utilitário de formatação e substituir `toLocale*` onde aplicável.

Critérios de aceitação
- Em PT:
  - Linguagem PT‑PT (neutra) em todas as páginas, incluindo Admin.
  - Zero strings hardcoded relevantes (UI + aria-label + toasts).
  - Datas/horas formatadas com pt-PT de forma consistente.
- Em EN:
  - Nada “parte” com a alteração `pt -> pt-PT`.
  - Textos continuam traduzidos e sem regressões óbvias.
