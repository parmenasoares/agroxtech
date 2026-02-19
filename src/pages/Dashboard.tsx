import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  Fuel,
  Package,
  Headset,
  ShieldCheck,
  Timer,
  Users,
  Database,
  Tractor,
  BarChart3,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardGrid, { type DashboardBtn } from "@/components/dashboard/DashboardGrid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OpenActivityRow = {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
};

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);

  const { data: startedTodayCount } = useQuery({
    queryKey: ["activities-started-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", userId!)
        .gte("start_time", startOfToday.toISOString());

      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: openActivity } = useQuery({
    queryKey: ["open-activity", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, start_time, end_time, status")
        .eq("operator_id", userId!)
        .is("end_time", null)
        .eq("status", "PENDING_VALIDATION")
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as OpenActivityRow | null;
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!openActivity?.start_time) return;

    const tick = () => {
      const start = new Date(openActivity.start_time).getTime();
      setElapsedMs(Date.now() - start);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [openActivity?.start_time]);

  useEffect(() => {
    if (!openActivity) setElapsedMs(0);
  }, [openActivity]);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        toast({
          title: t("error"),
          description: `${t("sessionLoadFailed")}: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || "");

        const [{ data: profile }, { data: adminFlag }, { data: superAdminFlag }, { data: coordinatorFlag }] =
          await Promise.all([
            supabase.from("users").select("first_name, last_name").eq("id", user.id).maybeSingle(),
            supabase.rpc("is_admin_or_super_admin", { _user_id: user.id }),
            supabase.rpc("is_user_role", { _user_id: user.id, _role: "SUPER_ADMIN" }),
            supabase.rpc("is_coordenador_or_above", { _user_id: user.id }),
          ]);

        setIsAdmin(!!adminFlag);
        setIsSuperAdmin(!!superAdminFlag);
        setIsCoordinator(!!coordinatorFlag);

        if (profile) {
          setUserName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "");
        } else {
          setUserName(user.email || "");
        }
      }
    };

    loadUser();
  }, [t, toast]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: t("error"),
        description: `${t("logoutFailed")}: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    navigate("/login");
  };

  const dashboardButtons: DashboardBtn[] = useMemo(() => {
    const base: DashboardBtn[] = [
      {
        icon: ClipboardList,
        label: t("activityRecord"),
        path: "/activity",
        variant: "default",
      },
      {
        icon: Wrench,
        label: t("maintenance"),
        path: "/maintenance",
        variant: "secondary",
      },
      {
        icon: AlertTriangle,
        label: t("damages"),
        path: "/damages",
        variant: "destructive",
      },
      {
        icon: Fuel,
        label: t("fuel"),
        path: "/fuel",
        variant: "secondary",
      },
      {
        icon: Package,
        label: t("orders"),
        path: "/orders",
        variant: "secondary",
      },
      {
        icon: Headset,
        label: t("support"),
        path: "/support",
        variant: "secondary",
      },
      {
        icon: ClipboardList,
        label: t("myDocuments"),
        path: "/my-documents",
        variant: "outline",
      },
    ];

    if (isCoordinator) {
      base.unshift({
        icon: ShieldCheck,
        label: t("approvals"),
        path: "/admin/approvals",
        variant: "outline",
      });
    }

    if (isAdmin) {
      base.unshift({
        icon: Database,
        label: t("masterData"),
        path: "/admin/master-data",
        variant: "outline",
      });

      base.unshift({
        icon: ShieldCheck,
        label: t("adminValidation"),
        path: "/admin/activities",
        variant: "outline",
      });
    }

    if (isSuperAdmin) {
      base.unshift({
        icon: Users,
        label: t("userManagement"),
        path: "/admin/users",
        variant: "outline",
      });

      base.unshift({
        icon: Tractor,
        label: t("machinesManagement"),
        path: "/admin/machines",
        variant: "outline",
      });

      base.unshift({
        icon: BarChart3,
        label: t("adminDashboard"),
        path: "/admin/dashboard",
        variant: "outline",
      });

      base.unshift({
        icon: ShieldCheck,
        label: t("rolesAudit"),
        path: "/admin/roles-audit",
        variant: "outline",
      });
    }

    return base;
  }, [isAdmin, isCoordinator, isSuperAdmin, t]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        userName={userName}
        userEmail={userEmail}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-6 sm:py-8 space-y-4">
        {openActivity && (
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Atividade em andamento</p>
                  <p className="text-xs text-muted-foreground">Cronómetro: {formatElapsed(elapsedMs)}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate("/activity/close")}>Fechar atividade</Button>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-muted-foreground">{t("activitiesStartedToday")}</p>
            <p className="text-3xl font-bold tabular-nums">{startedTodayCount ?? 0}</p>
          </div>
        </Card>

        <DashboardGrid items={dashboardButtons} onNavigate={(path) => navigate(path)} />
      </main>
    </div>
  );
};

export default Dashboard;

