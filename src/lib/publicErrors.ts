import type { TranslationKey } from "@/lib/i18n";

type TFn = (key: TranslationKey) => string;

const safeKey = (key: TranslationKey, t: TFn) => {
  try {
    return t(key);
  } catch {
    return "";
  }
};

/**
 * Map technical errors (DB/RPC/storage/network) to user-facing safe messages.
 * Avoid leaking table/column names, RPC names, constraint names, etc.
 */
export function getPublicErrorMessage(err: unknown, t: TFn): string {
  const generic = safeKey("genericError", t) || "Ocorreu um erro. Tente novamente.";

  if (!err) return generic;

  const anyErr = err as any;
  const msg = String(anyErr?.message ?? anyErr?.error_description ?? "");
  const code = String(anyErr?.code ?? "");
  const lower = msg.toLowerCase();

  // Known business/security cases (prefer translated messages)
  if (lower.includes("not_authorized") || code === "42501") {
    return safeKey("notAuthorized", t) || generic;
  }

  if (lower.includes("invalid_email")) {
    return safeKey("invalidEmail", t) || generic;
  }

  if (lower.includes("cannot_change_self")) {
    return safeKey("cannotChangeSelf", t) || generic;
  }

  // Avoid user enumeration
  if (lower.includes("user_not_found")) {
    return generic;
  }

  // Auth/session issues
  if (lower.includes("not_authenticated") || lower.includes("invalid login") || lower.includes("jwt")) {
    return generic;
  }

  // Storage signed URL issues
  if (lower.includes("signed_url_missing")) {
    return generic;
  }

  // Default: generic message
  return generic;
}

export function isMissingBackendObjectError(err: unknown): boolean {
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const msg = String(anyErr?.message ?? anyErr?.error_description ?? "").toLowerCase();

  const isMissingRelation = msg.includes("relation") && msg.includes("does not exist");
  const isMissingBucket = msg.includes("bucket") && msg.includes("not found");
  const isMissingTableHint = msg.includes("could not find the table");

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    isMissingRelation ||
    isMissingTableHint ||
    isMissingBucket
  );
}

export function isBackendCompatibilityError(err: unknown): boolean {
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const msg = String(anyErr?.message ?? anyErr?.error_description ?? "").toLowerCase();

  const isMissingColumn = code === "42703" || msg.includes("column") && msg.includes("does not exist");
  const isSchemaCacheColumn = code === "PGRST204" || msg.includes("schema cache") && msg.includes("column");

  return isMissingBackendObjectError(err) || isMissingColumn || isSchemaCacheColumn;
}
