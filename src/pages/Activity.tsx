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
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type ClientRow = { id: string; name: string };
type LocationRow = { id: string; name: string; client_id: string };
type ServiceRow = { id: string; name: string };

type MachineRow = {
  id: string;
  name: string;
  model: string | null;
  brand: string | null;
  plate: string | null;
  internal_id: string | null;
  status: string | null;
};

type OpenActivityRow = {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
};

const Activity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState({
    clientId: "",
    locationId: "",
    serviceId: "",

    machineId: "",
    odometer: "",
    notes: "",
  });

  const { data: openActivity, isLoading: openLoading } = useQuery({
    queryKey: ["open-activity"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("activities")
        .select("id, start_time, end_time, status")
        .eq("operator_id", user.id)
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
    if (openActivity) navigate("/activity/close", { replace: true });
  }, [openActivity, navigate]);

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as MachineRow[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", formData.clientId],
    enabled: !!formData.clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, client_id")
        .eq("client_id", formData.clientId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
  });

  const machineOptions = useMemo(() => {
    return (machines ?? []).filter((m) => m.status === "ACTIVE" || !m.status);
  }, [machines]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (openActivity) {
      navigate("/activity/close");
      return;
    }

    if (!location) {
      toast({
        title: t("error"),
        description: "Por favor, capture a localização primeiro.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("activities").insert({
        client_id: formData.clientId || null,
        location_id: formData.locationId || null,
        service_id: formData.serviceId || null,

        machine_id: formData.machineId,
        operator_id: user.id,
        start_odometer: parseFloat(formData.odometer),
        start_gps: location,
        notes: formData.notes,

        performance_rating: null,
        area_value: null,
        area_unit: null,
        area_notes: null,
      } as any);

      if (error) throw error;

      toast({
        title: t("success"),
        description: "Atividade iniciada com sucesso!",
      });

      navigate("/activity/close", { replace: true });
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
            aria-label="Voltar ao dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{t("startActivity")}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6">
          {openLoading ? (
            <p className="text-sm text-muted-foreground">A verificar atividade aberta…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientId: value,
                      locationId: "",
                    }))
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Herdade / Local</Label>
                <Select
                  value={formData.locationId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, locationId: value }))}
                  required
                  disabled={!formData.clientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.clientId ? "Selecione o local" : "Selecione o cliente primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(locations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceId: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("selectMachine")}</Label>
                <Select
                  value={formData.machineId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, machineId: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectMachine")} />
                  </SelectTrigger>
                  <SelectContent>
                    {machineOptions.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.internal_id ? `${machine.internal_id} - ` : ""}
                        {machine.brand ? `${machine.brand} ` : ""}
                        {machine.name}
                        {machine.model ? ` ${machine.model}` : ""}
                        {machine.plate ? ` (${machine.plate})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odometer">Odómetro INÍCIO</Label>
                <Input
                  id="odometer"
                  type="number"
                  step="0.01"
                  value={formData.odometer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, odometer: e.target.value }))}
                  required
                />
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
                {t("register")}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Activity;
