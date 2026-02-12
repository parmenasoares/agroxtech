import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";


type RoleAuditRow = {
  id: string;
  role: string;
  created_at: string;
  user_id: string;
  created_by: string | null;
  target?: { email: string } | null;
  actor?: { email: string } | null;
};

const RolesAudit = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [emailFilter, setEmailFilter] = useState("");

  const {
    data: rows,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["roles-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(
          `id, role, created_at, user_id, created_by,
           target:users!user_roles_user_id_fkey(email),
           actor:users!user_roles_created_by_fkey(email)`
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as RoleAuditRow[];
    },
  });

  const filteredRows = useMemo(() => {
    const q = emailFilter.trim().toLowerCase();
    if (!q) return rows ?? [];

    return (rows ?? []).filter((r) => {
      const target = (r.target?.email ?? "").toLowerCase();
      const actor = (r.actor?.email ?? "").toLowerCase();
      return target.includes(q) || actor.includes(q);
    });
  }, [rows, emailFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t("roleAuditTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("roleAuditDescription")}</p>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={"mr-2 h-4 w-4" + (isFetching ? " animate-spin" : "")} />
            {t("refresh")}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="emailFilter">{t("filterByEmail")}</Label>
              <Input
                id="emailFilter"
                type="text"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="ex: nome@dominio.com"
              />
            </div>

            {error ? (
              <div className="text-sm text-destructive">{t("error")}</div>
            ) : null}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("loading")}</div>
            ) : filteredRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("noRoleChanges")}</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("targetUser")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead>{t("changedBy")}</TableHead>
                      <TableHead className="whitespace-nowrap">{t("changedAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.target?.email ?? "—"}
                        </TableCell>
                        <TableCell>{r.role}</TableCell>
                        <TableCell>{r.actor?.email ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default RolesAudit;
