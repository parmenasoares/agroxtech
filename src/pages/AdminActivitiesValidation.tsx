import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";

type ActivityRow = {
  id: string;
  machine_id: string;
  operator_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  start_odometer: number;
  end_odometer: number | null;
  notes: string | null;
  client_id: string | null;
  location_id: string | null;
  service_id: string | null;
  performance_rating: number | null;
  area_value: number | null;
  area_unit: string | null;
};

type MachineRow = { id: string; name: string; model: string | null };

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type ClientRow = { id: string; name: string };
type LocationRow = { id: string; name: string };
type ServiceRow = { id: string; name: string };

const statusVariant = (status: string): "secondary" | "destructive" | "default" => {
  if (status === "PENDING_VALIDATION") return "secondary";
  if (status === "REJECTED") return "destructive";
  return "default";
};

const AdminActivitiesValidation = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setIsSuperAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_user_role", {
        _user_id: session.user.id,
        _role: "SUPER_ADMIN",
      });

      if (cancelled) return;
      setIsSuperAdmin(!error && !!data);
    };

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "pending-activities"],
    queryFn: async () => {
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select(
          "id, machine_id, operator_id, start_time, end_time, status, start_odometer, end_odometer, notes, client_id, location_id, service_id, performance_rating, area_value, area_unit",
        )
        .eq("status", "PENDING_VALIDATION")
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;

      const machineIds = Array.from(new Set((activities ?? []).map((a) => a.machine_id)));
      const operatorIds = Array.from(new Set((activities ?? []).map((a) => a.operator_id)));
      const clientIds = Array.from(new Set((activities ?? []).map((a) => a.client_id).filter(Boolean) as string[]));
      const locationIds = Array.from(new Set((activities ?? []).map((a) => a.location_id).filter(Boolean) as string[]));
      const serviceIds = Array.from(new Set((activities ?? []).map((a) => a.service_id).filter(Boolean) as string[]));

      const [
        { data: machines, error: machinesError },
        { data: users, error: usersError },
        { data: clients, error: clientsError },
        { data: locations, error: locationsError },
        { data: services, error: servicesError },
      ] = await Promise.all([
        machineIds.length
          ? supabase.from("machines").select("id, name, model").in("id", machineIds)
          : Promise.resolve({ data: [] as MachineRow[], error: null }),
        operatorIds.length
          ? supabase.from("users").select("id, email, first_name, last_name").in("id", operatorIds)
          : Promise.resolve({ data: [] as UserRow[], error: null }),
        clientIds.length
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : Promise.resolve({ data: [] as ClientRow[], error: null }),
        locationIds.length
          ? supabase.from("locations").select("id, name").in("id", locationIds)
          : Promise.resolve({ data: [] as LocationRow[], error: null }),
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : Promise.resolve({ data: [] as ServiceRow[], error: null }),
      ]);

      if (machinesError) throw machinesError;
      if (usersError) throw usersError;
      if (clientsError) throw clientsError;
      if (locationsError) throw locationsError;
      if (servicesError) throw servicesError;

      return {
        activities: (activities ?? []) as ActivityRow[],
        machines: (machines ?? []) as MachineRow[],
        users: (users ?? []) as UserRow[],
        clients: (clients ?? []) as ClientRow[],
        locations: (locations ?? []) as LocationRow[],
        services: (services ?? []) as ServiceRow[],
      };
    },
  });

  const machineById = useMemo(() => {
    const map = new Map<string, MachineRow>();
    (data?.machines ?? []).forEach((m) => map.set(m.id, m));
    return map;
  }, [data?.machines]);

  const userById = useMemo(() => {
    const map = new Map<string, UserRow>();
    (data?.users ?? []).forEach((u) => map.set(u.id, u));
    return map;
  }, [data?.users]);

  const clientById = useMemo(() => {
    const map = new Map<string, ClientRow>();
    (data?.clients ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [data?.clients]);

  const locationById = useMemo(() => {
    const map = new Map<string, LocationRow>();
    (data?.locations ?? []).forEach((l) => map.set(l.id, l));
    return map;
  }, [data?.locations]);

  const serviceById = useMemo(() => {
    const map = new Map<string, ServiceRow>();
    (data?.services ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [data?.services]);

  const updateStatus = async (activityId: string, status: "APPROVED" | "REJECTED") => {
    try {
      const { error } = await supabase.from("activities").update({ status }).eq("id", activityId);
      if (error) throw error;

      toast({
        title: t("success"),
        description: status === "APPROVED" ? t("activityApproved") : t("activityRejected"),
      });

      await qc.invalidateQueries({ queryKey: ["admin", "pending-activities"] });
    } catch (err: any) {
      toast({
        title: t("error"),
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}> 
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold">{t("adminValidation")}</h1>
              <p className="text-sm text-muted-foreground">{t("pendingActivities")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin/users")}
                aria-label={t("userManagement")}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {t("userManagement")}
              </Button>
            )}

            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {t("refresh")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t("activities")}</h2>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? t("loading") : `${data?.activities.length ?? 0} ${t("pending")}`}
                </p>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("machine")}</TableHead>
                <TableHead>Cliente / Local</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Desempenho</TableHead>
                <TableHead>{t("operator")}</TableHead>
                <TableHead>{t("startTime")}</TableHead>
                <TableHead>{t("endTime")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.activities ?? []).map((a) => {
                const machine = machineById.get(a.machine_id);
                const user = userById.get(a.operator_id);
                const client = a.client_id ? clientById.get(a.client_id) : null;
                const loc = a.location_id ? locationById.get(a.location_id) : null;
                const service = a.service_id ? serviceById.get(a.service_id) : null;

                const operatorLabel = user
                  ? `${(user.first_name ?? "").trim()} ${(user.last_name ?? "").trim()}`.trim() || user.email
                  : a.operator_id;

                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant={statusVariant(a.status)}>{t("pendingValidation")}</Badge>
                    </TableCell>

                    <TableCell>
                      {machine ? (
                        <div className="leading-tight">
                          <div className="font-medium">{machine.name}</div>
                          {machine.model && <div className="text-xs text-muted-foreground">{machine.model}</div>}
                        </div>
                      ) : (
                        a.machine_id
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="leading-tight">
                        <div className="font-medium">{client?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{loc?.name ?? "—"}</div>
                      </div>
                    </TableCell>

                    <TableCell>{service?.name ?? "—"}</TableCell>

                    <TableCell>{a.performance_rating ?? "—"}</TableCell>

                    <TableCell>{operatorLabel}</TableCell>
                    <TableCell>{new Date(a.start_time).toLocaleString()}</TableCell>
                    <TableCell>{a.end_time ? new Date(a.end_time).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateStatus(a.id, "APPROVED")}> 
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {t("approve")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => updateStatus(a.id, "REJECTED")}> 
                          <XCircle className="mr-2 h-4 w-4" />
                          {t("reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!isLoading && (data?.activities?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    {t("noPendingActivities")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
};

export default AdminActivitiesValidation;
