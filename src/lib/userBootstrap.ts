import { supabase } from "@/integrations/supabase/client";

const isRecoverableBootstrapError = (err: unknown) => {
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const message = String(anyErr?.message ?? anyErr?.error_description ?? "").toLowerCase();

  return (
    code === "42883" || // function does not exist
    code === "PGRST202" || // rpc not found in schema cache
    code === "42501" || // insufficient privileges
    (message.includes("function") && message.includes("does not exist"))
  );
};

export async function ensureCurrentUserRowBestEffort() {
  const { error } = await supabase.rpc("ensure_current_user_row");
  if (error && !isRecoverableBootstrapError(error)) {
    throw error;
  }
}
