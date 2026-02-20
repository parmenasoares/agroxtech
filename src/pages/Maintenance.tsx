import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, MapPin, MessageSquareText, Wrench } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage, isBackendCompatibilityError, isMissingBackendObjectError } from "@/lib/publicErrors";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type MaintenanceRequest = {
  id: string;
  created_at: string;
  problem_description: string;
  location_text: string | null;
  status: string;
  mechanic_response: string | null;
  responded_at: string | null;
  photo_path: string | null;
};

type MaintenanceAdapter = {
  table: string;
  listSelect: string;
  mapRow: (row: Record<string, unknown>) => MaintenanceRequest;
  buildInsert: (input: {
    userId: string;
    problemDescription: string;
    locationText: string;
    latitude: number | null;
    longitude: number | null;
    photoPath: string | null;
  }) => Record<string, unknown>;
};

const MAINTENANCE_BUCKET_CANDIDATES = ["maintenance-requests", "maintenance_requests", "maintenance"];

const MAINTENANCE_ADAPTERS: MaintenanceAdapter[] = [
  {
    table: "maintenance_requests",
    listSelect: "id, created_at, problem_description, location_text, status, mechanic_response, responded_at, photo_path",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      problem_description: String(row.problem_description ?? ""),
      location_text: (row.location_text as string | null) ?? null,
      status: String(row.status ?? "ABERTA"),
      mechanic_response: (row.mechanic_response as string | null) ?? null,
      responded_at: (row.responded_at as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
    }),
    buildInsert: ({ userId, problemDescription, locationText, latitude, longitude, photoPath }) => ({
      user_id: userId,
      problem_description: problemDescription,
      location_text: locationText || null,
      latitude,
      longitude,
      photo_path: photoPath,
    }),
  },
  {
    table: "maintenance",
    listSelect: "id, created_at, description, location_text, status, response, responded_at, photo_path",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      problem_description: String(row.description ?? ""),
      location_text: (row.location_text as string | null) ?? null,
      status: String(row.status ?? "ABERTA"),
      mechanic_response: (row.response as string | null) ?? null,
      responded_at: (row.responded_at as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
    }),
    buildInsert: ({ userId, problemDescription, locationText, latitude, longitude, photoPath }) => ({
      user_id: userId,
      description: problemDescription,
      location_text: locationText || null,
      latitude,
      longitude,
      photo_path: photoPath,
    }),
  },
];

const Maintenance = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [activeAdapter, setActiveAdapter] = useState<MaintenanceAdapter | null>(null);
  const [moduleUnavailable, setModuleUnavailable] = useState(false);

  const canSubmit = useMemo(() => problemDescription.trim().length > 0 && !!userId, [problemDescription, userId]);

  const loadRequests = async (uid: string) => {
    setIsLoadingRequests(true);
    try {
      for (const adapter of MAINTENANCE_ADAPTERS) {
        const { data, error } = await (supabase as any)
          .from(adapter.table)
          .select(adapter.listSelect)
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (!error) {
          setActiveAdapter(adapter);
          setModuleUnavailable(false);
          setRequests(((data ?? []) as Record<string, unknown>[]).map(adapter.mapRow));
          return;
        }

        if (!isBackendCompatibilityError(error)) {
          throw error;
        }
      }

      setModuleUnavailable(true);
      setRequests([]);
    } catch (error) {
      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        toast({
          title: t("error"),
          description: error ? getPublicErrorMessage(error, t) : t("sessionLoadFailed"),
          variant: "destructive",
        });
        return;
      }

      setUserId(user.id);
      await loadRequests(user.id);
    };

    loadUser();
  }, []);

  const handleCaptureLocation = async () => {
    if (!("geolocation" in navigator)) {
      toast({ title: t("error"), description: "Geolocalização não disponível neste dispositivo.", variant: "destructive" });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocationCoords(nextCoords);
        if (!locationText.trim()) {
          setLocationText(`${nextCoords.latitude.toFixed(6)}, ${nextCoords.longitude.toFixed(6)}`);
        }
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: t("error"),
          description: error.message || "Não foi possível obter sua localização.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const uploadPhoto = async (uid: string) => {
    if (!photoFile) return null;

    const extension = photoFile.name.split(".").pop();
    const filePath = `${uid}/${Date.now()}${extension ? `.${extension}` : ""}`;

    for (const bucket of MAINTENANCE_BUCKET_CANDIDATES) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, photoFile, { upsert: true });
      if (!error) return filePath;
      if (!isMissingBackendObjectError(error)) throw error;
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!userId || !canSubmit) return;

    setIsSubmitting(true);
    try {
      const photoPath = await uploadPhoto(userId);

      const baseInput = {
        userId,
        problemDescription: problemDescription.trim(),
        locationText: locationText.trim(),
        latitude: locationCoords?.latitude ?? null,
        longitude: locationCoords?.longitude ?? null,
        photoPath,
      };

      const adaptersToTry = activeAdapter
        ? [activeAdapter, ...MAINTENANCE_ADAPTERS.filter((adapter) => adapter.table !== activeAdapter.table)]
        : MAINTENANCE_ADAPTERS;

      let insertError: unknown = null;
      for (const adapter of adaptersToTry) {
        const { error } = await (supabase as any).from(adapter.table).insert(adapter.buildInsert(baseInput));

        if (!error) {
          setActiveAdapter(adapter);
          setModuleUnavailable(false);
          insertError = null;
          break;
        }

        insertError = error;
        if (!isBackendCompatibilityError(error)) {
          throw error;
        }
      }

      if (insertError) {
        setModuleUnavailable(true);
        toast({
          title: t("error"),
          description: "Módulo de manutenção em configuração. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("success"), description: "Solicitação de manutenção enviada com sucesso." });
      setProblemDescription("");
      setLocationText("");
      setLocationCoords(null);
      setPhotoFile(null);
      await loadRequests(userId);
    } catch (error) {
      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPhotoUrl = (path: string) => {
    for (const bucket of MAINTENANCE_BUCKET_CANDIDATES) {
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      if (url) return url;
    }
    return "#";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{t("maintenance")}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="request" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">Solicitar manutenção</TabsTrigger>
            <TabsTrigger value="track">Acompanhar solicitação</TabsTrigger>
          </TabsList>

          <TabsContent value="request">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" /> Informe o problema
                </CardTitle>
                <CardDescription>Descreva o problema, envie uma foto e informe a localização.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="problem-description">Problema</Label>
                  <Textarea
                    id="problem-description"
                    value={problemDescription}
                    onChange={(event) => setProblemDescription(event.target.value)}
                    placeholder="Ex.: Máquina sem força, fumaça no motor, vazamento de óleo..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo-upload">Foto do problema (opcional)</Label>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location-text">Localização</Label>
                  <Input
                    id="location-text"
                    value={locationText}
                    onChange={(event) => setLocationText(event.target.value)}
                    placeholder="Ex.: Talhão Norte, Linha 4"
                  />
                  <Button type="button" variant="outline" onClick={handleCaptureLocation} disabled={isGettingLocation}>
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Capturando localização...
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" /> Usar localização atual
                      </>
                    )}
                  </Button>
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar solicitação"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="track">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5" /> Respostas do mecânico
                </CardTitle>
                <CardDescription>Aqui você acompanha o retorno para cada solicitação enviada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {moduleUnavailable && (
                  <p className="text-sm text-muted-foreground">
                    Módulo de manutenção em configuração. Solicite ao suporte a atualização da base de dados.
                  </p>
                )}

                {isLoadingRequests && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

                {!moduleUnavailable && !isLoadingRequests && requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma solicitação enviada até o momento.</p>
                )}

                {requests.map((request) => (
                  <Card key={request.id} className="border-muted">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{new Date(request.created_at).toLocaleString()}</p>
                        <Badge variant={request.mechanic_response ? "default" : "secondary"}>{request.status}</Badge>
                      </div>

                      <p className="text-sm">{request.problem_description}</p>

                      {request.location_text && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Local:</strong> {request.location_text}
                        </p>
                      )}

                      {request.photo_path && (
                        <a href={getPhotoUrl(request.photo_path)} target="_blank" rel="noreferrer" className="inline-flex">
                          <Button type="button" size="sm" variant="outline">
                            <Camera className="mr-2 h-4 w-4" /> Ver foto enviada
                          </Button>
                        </a>
                      )}

                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Resposta do mecânico</p>
                        <p className="mt-1 text-sm">
                          {request.mechanic_response || "Ainda sem resposta. Aguarde retorno da equipe de manutenção."}
                        </p>
                        {request.responded_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Respondido em: {new Date(request.responded_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Maintenance;
