import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { getPublicErrorMessage } from "@/lib/publicErrors";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/BrandMark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";


type ClientRow = { id: string; name: string };
type LocationRow = { id: string; name: string; client_id: string };
type ServiceRow = { id: string; name: string };

const AdminMasterData = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [busy, setBusy] = useState<string | null>(null);

  // Clients
  const [newClientName, setNewClientName] = useState("");

  // Locations
  const [locationClientId, setLocationClientId] = useState<string>("");
  const [newLocationName, setNewLocationName] = useState("");

  // Services
  const [newServiceName, setNewServiceName] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "master-data"],
    queryFn: async () => {
      const [{ data: clients, error: cErr }, { data: locations, error: lErr }, { data: services, error: sErr }] =
        await Promise.all([
          supabase.from("clients").select("id, name").order("name"),
          supabase.from("locations").select("id, name, client_id").order("name"),
          supabase.from("services").select("id, name").order("name"),
        ]);

      if (cErr) throw cErr;
      if (lErr) throw lErr;
      if (sErr) throw sErr;

      return {
        clients: (clients ?? []) as ClientRow[],
        locations: (locations ?? []) as LocationRow[],
        services: (services ?? []) as ServiceRow[],
      };
    },
  });

  useEffect(() => {
    if (!locationClientId && (data?.clients?.length ?? 0) > 0) {
      setLocationClientId(data!.clients[0].id);
    }
  }, [data?.clients, locationClientId]);

  const clientById = useMemo(() => {
    const map = new Map<string, ClientRow>();
    (data?.clients ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [data?.clients]);

  const locationsForSelectedClient = useMemo(() => {
    return (data?.locations ?? []).filter((l) => l.client_id === locationClientId);
  }, [data?.locations, locationClientId]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "master-data"] });
    await qc.invalidateQueries({ queryKey: ["clients"] });
    await qc.invalidateQueries({ queryKey: ["locations"] });
    await qc.invalidateQueries({ queryKey: ["services"] });
  };

  const createClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    if (busy) return;
    setBusy("client:create");
    try {
      const { error } = await supabase.from("clients").insert({ name });
      if (error) throw error;
      setNewClientName("");
      toast({ title: t("success"), description: "Cliente criado." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const deleteClient = async (id: string) => {
    if (busy) return;
    setBusy(`client:delete:${id}`);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("success"), description: "Cliente removido." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const createLocation = async () => {
    const name = newLocationName.trim();
    if (!name || !locationClientId) return;
    if (busy) return;
    setBusy("location:create");
    try {
      const { error } = await supabase.from("locations").insert({ name, client_id: locationClientId });
      if (error) throw error;
      setNewLocationName("");
      toast({ title: t("success"), description: "Local criado." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const deleteLocation = async (id: string) => {
    if (busy) return;
    setBusy(`location:delete:${id}`);
    try {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("success"), description: "Local removido." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const createService = async () => {
    const name = newServiceName.trim();
    if (!name) return;
    if (busy) return;
    setBusy("service:create");
    try {
      const { error } = await supabase.from("services").insert({ name });
      if (error) throw error;
      setNewServiceName("");
      toast({ title: t("success"), description: "Serviço criado." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const deleteService = async (id: string) => {
    if (busy) return;
    setBusy(`service:delete:${id}`);
    try {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("success"), description: "Serviço removido." });
      await invalidate();
    } catch (err: any) {
      console.error(err);
      toast({ title: t("error"), description: getPublicErrorMessage(err, t), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold">Registos</h1>
              <p className="text-sm text-muted-foreground">Clientes, Locais e Serviços</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || !!busy}>
            {isLoading || busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6">
          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clients">Clientes</TabsTrigger>
              <TabsTrigger value="locations">Locais</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
            </TabsList>

            <TabsContent value="clients" className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div className="space-y-2">
                  <Label htmlFor="newClient">Novo cliente</Label>
                  <Input
                    id="newClient"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: Cliente X"
                  />
                </div>
                <Button type="button" onClick={createClient} disabled={!!busy || !newClientName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              <div className="divide-y rounded-md border">
                {(data?.clients ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3">
                    <div className="font-medium">{c.name}</div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteClient(c.id)}
                      disabled={!!busy}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                ))}
                {!isLoading && (data?.clients?.length ?? 0) === 0 && (
                  <div className="p-6 text-center text-muted-foreground">Nenhum cliente cadastrado.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="locations" className="mt-6 space-y-4">
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={locationClientId} onValueChange={setLocationClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                  <div className="space-y-2">
                    <Label htmlFor="newLocation">Novo local</Label>
                    <Input
                      id="newLocation"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="Ex: Herdade A / Talhão 3"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={createLocation}
                    disabled={!!busy || !newLocationName.trim() || !locationClientId}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {locationClientId ? `Locais de: ${clientById.get(locationClientId)?.name ?? ""}` : "Selecione um cliente"}
              </div>

              <div className="divide-y rounded-md border">
                {locationsForSelectedClient.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3">
                    <div className="font-medium">{l.name}</div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLocation(l.id)}
                      disabled={!!busy}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                ))}
                {!isLoading && locationsForSelectedClient.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground">Nenhum local para este cliente.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="services" className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div className="space-y-2">
                  <Label htmlFor="newService">Novo serviço</Label>
                  <Input
                    id="newService"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="Ex: Gradagem"
                  />
                </div>
                <Button type="button" onClick={createService} disabled={!!busy || !newServiceName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              <div className="divide-y rounded-md border">
                {(data?.services ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3">
                    <div className="font-medium">{s.name}</div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteService(s.id)}
                      disabled={!!busy}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                ))}
                {!isLoading && (data?.services?.length ?? 0) === 0 && (
                  <div className="p-6 text-center text-muted-foreground">Nenhum serviço cadastrado.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
};

export default AdminMasterData;
