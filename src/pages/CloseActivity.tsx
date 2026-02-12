import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, MapPin, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type ActivityRow = {
  id: string;
  client_id: string | null;
  location_id: string | null;
  service_id: string | null;
  machine_id: string;
  start_time: string;
  start_odometer: number;
  notes: string | null;
  status: string;
  end_time: string | null;
};

type SimpleRow = { id: string; name: string };

type MachineRow = {
  id: string;
  name: string;
  model: string | null;
  brand: string | null;
  plate: string | null;
  internal_id: string | null;
};

const ratingOptions = [1, 2, 3, 4, 5] as const;

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const CloseActivity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [formData, setFormData] = useState({
    endOdometer: "",
    areaValue: "",
    areaUnit: "ha",
    areaNotes: "",
    performanceRating: "",
    notes: "",
  });

  const { data: openActivity, isLoading: openLoading, refetch } = useQuery({
    queryKey: ["open-activity-details"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("activities")
        .select(
          "id, client_id, location_id, service_id, machine_id, start_time, start_odometer, notes, status, end_time",
        )
        .eq("operator_id", user.id)
        .is("end_time", null)
        .eq("status", "PENDING_VALIDATION")
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as ActivityRow | null;
    },
    staleTime: 5_000,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as SimpleRow[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as SimpleRow[];
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, model, brand, plate, internal_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as MachineRow[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    enabled: !!openActivity?.client_id,
    queryFn: async () => {
      if (!openActivity?.client_id) return [] as SimpleRow[];
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("client_id", openActivity.client_id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SimpleRow[];
    },
  });

  const selectedClientName = useMemo(() => {
    if (!openActivity?.client_id) return "";
    return clients?.find((c) => c.id === openActivity.client_id)?.name ?? "";
  }, [clients, openActivity?.client_id]);

  const selectedServiceName = useMemo(() => {
    if (!openActivity?.service_id) return "";
    return services?.find((s) => s.id === openActivity.service_id)?.name ?? "";
  }, [services, openActivity?.service_id]);

  const selectedLocationName = useMemo(() => {
    if (!openActivity?.location_id) return "";
    return locations?.find((l) => l.id === openActivity.location_id)?.name ?? "";
  }, [locations, openActivity?.location_id]);

  const selectedMachineLabel = useMemo(() => {
    if (!openActivity?.machine_id) return "";
    const m = machines?.find((x) => x.id === openActivity.machine_id);
    if (!m) return "";
    return `${m.internal_id ? `${m.internal_id} - ` : ""}${m.brand ? `${m.brand} ` : ""}${m.name}${m.model ? ` ${m.model}` : ""}${m.plate ? ` (${m.plate})` : ""}`;
  }, [machines, openActivity?.machine_id]);

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
    if (!openLoading && !openActivity) navigate("/activity", { replace: true });
  }, [openActivity, openLoading, navigate]);

  const getLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast({
          title: t("success"),
          description: "Localização capturada.",
        });
      },
      (error) => {
        toast({
          title: t("error"),
          description: "Não foi possível obter localização: " + error.message,
          variant: "destructive",
        });
      },
    );
  };

  const validate = () => {
    if (!formData.performanceRating) {
      toast({
        title: t("error"),
        description: "Selecione a classificação de desempenho (1–5).",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.endOdometer.trim()) {
      toast({
        title: t("error"),
        description: "Preencha o odómetro de fim.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openActivity) return;

    if (!location) {
      toast({
        title: t("error"),
        description: "Por favor, capture a localização primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!validate()) return;

    setLoading(true);

    try {
      const areaValue = formData.areaValue.trim() ? Number(formData.areaValue) : null;
      const performanceRating = Number(formData.performanceRating);

      const { error } = await supabase
        .from("activities")
        .update({
          end_time: new Date().toISOString(),
          end_odometer: parseFloat(formData.endOdometer),
          end_gps: location,
          notes: formData.notes,
          performance_rating: performanceRating,
          area_value: Number.isFinite(areaValue as any) ? areaValue : null,
          area_unit: formData.areaUnit?.trim() || null,
          area_notes: formData.areaNotes?.trim() || null,
        } as any)
        .eq("id", openActivity.id);

      if (error) throw error;

      toast({
        title: t("success"),
        description: "Atividade fechada! Aguardando validação.",
      });

      await refetch();
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error(error);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            aria-label="Voltar ao dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">Fechar atividade</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span>Cronómetro</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatElapsed(elapsedMs)}</p>
          </div>
        </Card>

        <Card className="p-6">
          {openLoading ? (
            <p className="text-sm text-muted-foreground">A carregar atividade aberta…</p>
          ) : !openActivity ? (
            <p className="text-sm text-muted-foreground">Sem atividade aberta.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campos “bloqueados” (só leitura) */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={openActivity.client_id ?? ""} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedClientName || "—"} />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Herdade / Local</Label>
                <Select value={openActivity.location_id ?? ""} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedLocationName || "—"} />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={openActivity.service_id ?? ""} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedServiceName || "—"} />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("selectMachine")}</Label>
                <Select value={openActivity.machine_id ?? ""} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedMachineLabel || "—"} />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Odómetro INÍCIO</Label>
                <Input value={String(openActivity.start_odometer ?? "")} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endOdometer">Odómetro FIM</Label>
                <Input
                  id="endOdometer"
                  type="number"
                  step="0.01"
                  value={formData.endOdometer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endOdometer: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Atenção: o valor final deve ser superior ao inicial; durações acima de 18h serão rejeitadas.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Área realizada</Label>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.areaValue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, areaValue: e.target.value }))}
                    placeholder="Ex: 12.5"
                  />
                  <Input
                    value={formData.areaUnit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, areaUnit: e.target.value }))}
                    placeholder="Unidade (ha, m²...)"
                  />
                </div>
                <Textarea
                  value={formData.areaNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, areaNotes: e.target.value }))}
                  rows={2}
                  placeholder="Observações (opcional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Como classifica o seu desempenho?</Label>
                <Select
                  value={formData.performanceRating}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, performanceRating: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (1–5)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingOptions.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("location")}</Label>
                <Button type="button" variant="outline" className="w-full" onClick={getLocation}>
                  <MapPin className="mr-2 h-4 w-4" />
                  {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Capturar localização"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t("notes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fechar atividade
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default CloseActivity;
