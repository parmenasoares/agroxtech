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

  // Store iv + ciphertext as bytea
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return `\\x${toHex(out)}`;
}

function requireString(input: unknown, max: number): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
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

    // Validate JWT using anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));

    const payload = {
      nif: requireString(body?.nif, 64),
      niss: requireString(body?.niss, 64),
      iban: requireString(body?.iban, 128),
      address_line1: requireString(body?.address_line1, 200),
      address_line2: requireString(body?.address_line2, 200),
      city: requireString(body?.city, 120),
      postal_code: requireString(body?.postal_code, 32),
      country: requireString(body?.country, 80),
    };

    const key = await importKeyFromSecret(encryptionSecret);

    const nifLast4 = last4(payload.nif);
    const nissLast4 = last4(payload.niss);
    const ibanLast4 = last4(payload.iban);

    const row: Record<string, unknown> = {
      user_id: userData.user.id,

      // Encrypted storage
      nif_enc: payload.nif ? await encryptToByteaHex(payload.nif, key) : null,
      niss_enc: payload.niss ? await encryptToByteaHex(payload.niss, key) : null,
      iban_enc: payload.iban ? await encryptToByteaHex(payload.iban, key) : null,
      nif_last4: nifLast4,
      niss_last4: nissLast4,
      iban_last4: ibanLast4,

      // Non-PII fields stored as plaintext
      address_line1: payload.address_line1,
      address_line2: payload.address_line2,
      city: payload.city,
      postal_code: payload.postal_code,
      country: payload.country,

      // Stop storing plaintext PII (defense-in-depth)
      nif: null,
      niss: null,
      iban: null,
    };

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error } = await adminClient.from("user_compliance").upsert(row, { onConflict: "user_id" });
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, masked: { nif_last4: nifLast4, niss_last4: nissLast4, iban_last4: ibanLast4 } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
