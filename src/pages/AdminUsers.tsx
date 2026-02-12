import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ArrowLeft, Loader2, Shield, Trash2 } from "lucide-react";


const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "COORDENADOR", "OPERADOR"]);

const formSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .email(),
  role: roleSchema,
});

type FormValues = z.infer<typeof formSchema>;

type KnownRpcError =
  | "not_authorized"
  | "invalid_email"
  | "user_not_found"
  | "cannot_change_self";

const normalizeRpcError = (message: string | undefined): KnownRpcError | null => {
  const m = (message ?? "").toLowerCase();
  if (m.includes("not_authorized")) return "not_authorized";
  if (m.includes("invalid_email")) return "invalid_email";
  if (m.includes("user_not_found")) return "user_not_found";
  if (m.includes("cannot_change_self")) return "cannot_change_self";
  return null;
};

const AdminUsers = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      role: "OPERADOR",
    },
  });

  const role = watch("role");

  const roleOptions = useMemo(
    () => [
      { value: "OPERADOR" as const, label: "OPERADOR" },
      { value: "COORDENADOR" as const, label: "COORDENADOR" },
      { value: "ADMIN" as const, label: "ADMIN" },
      { value: "SUPER_ADMIN" as const, label: "SUPER_ADMIN" },
    ],
    [],
  );

  const showRpcError = (err: any) => {
    const known = normalizeRpcError(err?.message);

    const description =
      known === "not_authorized"
        ? t("notAuthorized")
        : known === "invalid_email"
          ? t("invalidEmail")
          : known === "user_not_found"
            ? t("genericError")
            : known === "cannot_change_self"
              ? t("cannotChangeSelf")
              : t("genericError");

    toast({
      title: t("error"),
      description,
      variant: "destructive",
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (submitting || removing) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_set_user_role_by_email", {
        _email: values.email,
        _role: values.role,
      });
      if (error) throw error;

      toast({
        title: t("success"),
        description: t("userRoleUpdated"),
      });
    } catch (err: any) {
      showRpcError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveRole = async () => {
    if (submitting || removing) return;
    const email = String(watch("email") ?? "").trim();

    // validação mínima client-side
    const parsed = z.string().trim().min(1).max(320).email().safeParse(email);
    if (!parsed.success) {
      toast({
        title: t("error"),
        description: t("invalidEmail"),
        variant: "destructive",
      });
      return;
    }

    setRemoving(true);
    try {
      const { error } = await supabase.rpc("admin_remove_user_role_by_email", {
        _email: email,
      });
      if (error) throw error;

      toast({
        title: t("success"),
        description: t("userRoleRemoved"),
      });
    } catch (err: any) {
      showRpcError(err);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("userManagement")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("manageRoles")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("targetEmail")}</Label>
              <Input id="email" type="email" placeholder="email@dominio.com" {...register("email")} />
              {errors.email?.message && (
                <p className="text-sm font-medium text-destructive">{t("invalidEmail")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select
                value={role}
                onValueChange={(v) => setValue("role", v as FormValues["role"], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("role")} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" className="sm:flex-1" disabled={submitting || removing}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("setRole")}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="sm:flex-1"
                onClick={onRemoveRole}
                disabled={submitting || removing}
              >
                {removing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("removeRole")}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default AdminUsers;
