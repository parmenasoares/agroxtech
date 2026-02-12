/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function last4(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/\s+/g, "").trim();
  if (!v) return null;
  return v.slice(-4);
}

async function importKeyFromSecret(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToByteaHex(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return `\\x${toHex(out)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSecret = Deno.env.get("RYROX_PII_ENCRYPTION_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Only SUPER_ADMIN can migrate
    const { data: roleRow, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "SUPER_ADMIN")
      .maybeSingle();

    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: "not_authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const key = await importKeyFromSecret(encryptionSecret);

    // Batch migrate (idempotent) - do not pull everything at once
    const { data: rows, error: listErr } = await adminClient
      .from("user_compliance")
      .select("user_id,nif,niss,iban,nif_enc,niss_enc,iban_enc")
      .or("nif.not.is.null,niss.not.is.null,iban.not.is.null")
      .limit(500);

    if (listErr) throw listErr;

    let migrated = 0;
    for (const r of rows ?? []) {
      const needsNif = r.nif && !r.nif_enc;
      const needsNiss = r.niss && !r.niss_enc;
      const needsIban = r.iban && !r.iban_enc;
      if (!needsNif && !needsNiss && !needsIban) continue;

      const patch: Record<string, unknown> = {
        nif_last4: last4(r.nif),
        niss_last4: last4(r.niss),
        iban_last4: last4(r.iban),
        // clear legacy plaintext
        nif: null,
        niss: null,
        iban: null,
      };

      if (needsNif) patch.nif_enc = await encryptToByteaHex(r.nif, key);
      if (needsNiss) patch.niss_enc = await encryptToByteaHex(r.niss, key);
      if (needsIban) patch.iban_enc = await encryptToByteaHex(r.iban, key);

      const { error: upErr } = await adminClient.from("user_compliance").update(patch).eq("user_id", r.user_id);
      if (upErr) throw upErr;
      migrated++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: (rows ?? []).length, migrated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
