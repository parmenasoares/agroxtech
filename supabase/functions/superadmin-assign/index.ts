/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

type Payload = {
  emails?: string[];
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "missing_env" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const callerId = userData.user.id;

  const { data: callerRoleRows, error: callerRoleErr } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "SUPER_ADMIN")
    .limit(1);

  if (callerRoleErr || !callerRoleRows || callerRoleRows.length === 0) {
    return json({ error: "not_authorized" }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const emails = Array.from(new Set((payload.emails ?? []).map(normalizeEmail))).filter(Boolean);
  if (emails.length === 0) {
    return json({ error: "missing_emails" }, { status: 400 });
  }

  // Find target users in auth via admin listUsers pagination.
  const foundByEmail = new Map<string, { id: string; email: string }>();
  const notFound: string[] = [];

  const targetSet = new Set(emails);

  // page starts at 1 in supabase-js
  for (let page = 1; page <= 20 && foundByEmail.size < targetSet.size; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return json({ error: "list_users_failed", details: error.message }, { status: 500 });
    }

    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      const e = (u.email ?? "").toLowerCase();
      if (targetSet.has(e) && !foundByEmail.has(e)) {
        foundByEmail.set(e, { id: u.id, email: u.email ?? e });
      }
    }
  }

  for (const e of emails) {
    if (!foundByEmail.has(e)) notFound.push(e);
  }

  if (notFound.length > 0) {
    return json(
      {
        error: "user_not_found",
        notFound,
        hint: "Confirme que essas contas já existem no /login e que os emails foram verificados.",
      },
      { status: 404 },
    );
  }

  const results: Array<{ email: string; user_id: string; status: "ok" | "error"; error?: string }> = [];

  for (const [email, target] of foundByEmail.entries()) {
    try {
      // Ensure row exists in public.users
      const { error: upsertUserErr } = await service
        .from("users")
        .upsert(
          {
            id: target.id,
            email: target.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
      if (upsertUserErr) throw upsertUserErr;

      // Replace any existing role with SUPER_ADMIN
      const { error: delErr } = await service.from("user_roles").delete().eq("user_id", target.id);
      if (delErr) throw delErr;

      const { error: insErr } = await service.from("user_roles").insert({
        user_id: target.id,
        role: "SUPER_ADMIN",
        created_by: callerId,
      });
      if (insErr) throw insErr;

      results.push({ email, user_id: target.id, status: "ok" });
    } catch (e: any) {
      results.push({
        email,
        user_id: target.id,
        status: "error",
        error: e?.message ?? String(e),
      });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const err = results.filter((r) => r.status === "error").length;

  return json({ ok, err, results });
});
