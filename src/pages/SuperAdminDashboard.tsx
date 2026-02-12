import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Activity, Users, Cog, ClipboardList, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";


const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  success: "hsl(142, 71%, 45%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(var(--destructive))",
};

const SuperAdminDashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["superadmin", "dashboard-stats"],
    queryFn: async () => {
      const [
        { data: users, error: usersError },
        { data: machines, error: machinesError },
        { data: activities, error: activitiesError },
        { data: roles, error: rolesError },
      ] = await Promise.all([
        supabase.from("users").select("id, created_at"),
        supabase.from("machines").select("id, name, created_at"),
        supabase.from("activities").select("id, status, machine_id, created_at, start_time"),
        supabase.from("user_roles").select("role"),
      ]);

      if (usersError) throw usersError;
      if (machinesError) throw machinesError;
      if (activitiesError) throw activitiesError;
      if (rolesError) throw rolesError;

      // KPIs básicos
      const totalUsers = users?.length ?? 0;
      const totalMachines = machines?.length ?? 0;
      const totalActivities = activities?.length ?? 0;
      const pendingActivities = activities?.filter((a) => a.status === "PENDING_VALIDATION").length ?? 0;
      const approvedActivities = activities?.filter((a) => a.status === "APPROVED").length ?? 0;
      const rejectedActivities = activities?.filter((a) => a.status === "REJECTED").length ?? 0;

      // Atividades por status (para gráfico de pizza)
      const activityByStatus = [
        { name: "Pendente", value: pendingActivities, color: COLORS.warning },
        { name: "Aprovada", value: approvedActivities, color: COLORS.success },
        { name: "Rejeitada", value: rejectedActivities, color: COLORS.destructive },
      ].filter((item) => item.value > 0);

      // Top 5 máquinas por número de atividades
      const machineActivityCount = new Map<string, { name: string; count: number }>();
      activities?.forEach((a) => {
        const machine = machines?.find((m) => m.id === a.machine_id);
        const machineName = machine?.name ?? "Unknown";
        const current = machineActivityCount.get(a.machine_id) ?? { name: machineName, count: 0 };
        machineActivityCount.set(a.machine_id, { name: machineName, count: current.count + 1 });
      });

      const topMachines = Array.from(machineActivityCount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Atividades ao longo do tempo (últimos 7 dias)
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });

      const activitiesByDay = last7Days.map((day) => {
        const count = activities?.filter((a) => a.start_time?.startsWith(day)).length ?? 0;
        return { day: new Date(day).toLocaleDateString("pt-PT", { weekday: "short" }), count };
      });

      // Distribuição de roles
      const roleDistribution = [
        { name: "OPERADOR", value: roles?.filter((r) => r.role === "OPERADOR").length ?? 0, color: COLORS.secondary },
        { name: "COORDENADOR", value: roles?.filter((r) => r.role === "COORDENADOR").length ?? 0, color: COLORS.accent },
        { name: "ADMIN", value: roles?.filter((r) => r.role === "ADMIN").length ?? 0, color: COLORS.primary },
        {
          name: "SUPER_ADMIN",
          value: roles?.filter((r) => r.role === "SUPER_ADMIN").length ?? 0,
          color: COLORS.warning,
        },
      ].filter((item) => item.value > 0);

      return {
        totalUsers,
        totalMachines,
        totalActivities,
        pendingActivities,
        approvedActivities,
        rejectedActivities,
        activityByStatus,
        topMachines,
        activitiesByDay,
        roleDistribution,
      };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Dashboard SUPER_ADMIN
            </h1>
            <p className="text-sm text-muted-foreground">Visão geral do sistema e métricas</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">A carregar estatísticas...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Utilizadores</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Máquinas</CardTitle>
                  <Cog className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalMachines ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Atividades</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalActivities ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.pendingActivities ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Aguardam validação</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Atividades por Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Atividades por Status</CardTitle>
                  <CardDescription>Distribuição atual</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {stats?.activityByStatus && stats.activityByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.activityByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.activityByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 Máquinas */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 5 Máquinas</CardTitle>
                  <CardDescription>Por número de atividades</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {stats?.topMachines && stats.topMachines.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.topMachines}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill={COLORS.primary} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Atividades ao longo do tempo */}
              <Card>
                <CardHeader>
                  <CardTitle>Atividades (Últimos 7 Dias)</CardTitle>
                  <CardDescription>Tendência de uso</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {stats?.activitiesByDay && stats.activitiesByDay.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.activitiesByDay}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke={COLORS.accent} name="Atividades" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição de Roles */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Roles</CardTitle>
                  <CardDescription>Permissões atribuídas</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {stats?.roleDistribution && stats.roleDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.roleDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.roleDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
