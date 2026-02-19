import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Camera, Loader2, MapPin, MessageSquareText } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage, isMissingBackendObjectError } from "@/lib/publicErrors";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type DamageRequest = {
  id: string;
  created_at: string;
  description: string;
  location_text: string | null;
  status: string;
  response: string | null;
  responded_at: string | null;
  photo_path: string | null;
};

type DamageAdapter = {
  table: string;
  listSelect: string;
  mapRow: (row: Record<string, unknown>) => DamageRequest;
  buildInsert: (input: {
    userId: string;
    description: string;
    locationText: string;
    latitude: number | null;
    longitude: number | null;
    photoPath: string | null;
  }) => Record<string, unknown>;
};

const DAMAGE_BUCKET_CANDIDATES = ["damage-reports", "damages"];

const DAMAGE_ADAPTERS: DamageAdapter[] = [
  {
    table: "damage_reports",
    listSelect: "id, created_at, description, location_text, status, response, responded_at, photo_path",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      description: String(row.description ?? ""),
      location_text: (row.location_text as string | null) ?? null,
      status: String(row.status ?? "PENDENTE"),
      response: (row.response as string | null) ?? null,
      responded_at: (row.responded_at as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
    }),
    buildInsert: ({ userId, description, locationText, latitude, longitude, photoPath }) => ({
      user_id: userId,
      description,
      location_text: locationText || null,
      latitude,
      longitude,
      photo_path: photoPath,
    }),
  },
  {
    table: "damage_requests",
    listSelect: "id, created_at, problem_description, location_text, status, mechanic_response, responded_at, photo_path",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      description: String(row.problem_description ?? ""),
      location_text: (row.location_text as string | null) ?? null,
      status: String(row.status ?? "PENDENTE"),
      response: (row.mechanic_response as string | null) ?? null,
      responded_at: (row.responded_at as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
    }),
    buildInsert: ({ userId, description, locationText, latitude, longitude, photoPath }) => ({
      user_id: userId,
      problem_description: description,
      location_text: locationText || null,
      latitude,
      longitude,
      photo_path: photoPath,
    }),
  },
  {
    table: "damages",
    listSelect: "id, created_at, description, location_text, status, response, responded_at, photo_path",
    mapRow: (row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      description: String(row.description ?? ""),
      location_text: (row.location_text as string | null) ?? null,
      status: String(row.status ?? "PENDENTE"),
      response: (row.response as string | null) ?? null,
      responded_at: (row.responded_at as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
    }),
    buildInsert: ({ userId, description, locationText, latitude, longitude, photoPath }) => ({
      user_id: userId,
      description,
      location_text: locationText || null,
      latitude,
      longitude,
      photo_path: photoPath,
    }),
  },
];

const Damages = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [requests, setRequests] = useState<DamageRequest[]>([]);
  const [activeAdapter, setActiveAdapter] = useState<DamageAdapter | null>(null);
  const [moduleUnavailable, setModuleUnavailable] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const canSubmit = useMemo(() => description.trim().length > 0 && !!userId, [description, userId]);

  const loadRequests = async (uid: string) => {
    setIsLoadingRequests(true);
    try {
      for (const adapter of DAMAGE_ADAPTERS) {
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

        if (!isMissingBackendObjectError(error)) {
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

  const handleCaptureLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: t("error"), description: "Geolocalização não disponível neste dispositivo.", variant: "destructive" });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocationCoords(nextCoords);
        if (!locationText.trim()) {
          setLocationText(`${nextCoords.latitude.toFixed(6)}, ${nextCoords.longitude.toFixed(6)}`);
        }
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        toast({ title: t("error"), description: error.message || "Não foi possível obter sua localização.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const uploadPhoto = async (uid: string) => {
    if (!photoFile) return null;

    const extension = photoFile.name.split(".").pop();
    const filePath = `${uid}/${Date.now()}${extension ? `.${extension}` : ""}`;

    for (const bucket of DAMAGE_BUCKET_CANDIDATES) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, photoFile, { upsert: true });
      if (!error) {
        return filePath;
      }
      if (!isMissingBackendObjectError(error)) {
        throw error;
      }
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
        description: description.trim(),
        locationText: locationText.trim(),
        latitude: locationCoords?.latitude ?? null,
        longitude: locationCoords?.longitude ?? null,
        photoPath,
      };

      const adaptersToTry = activeAdapter ? [activeAdapter, ...DAMAGE_ADAPTERS.filter((item) => item.table !== activeAdapter.table)] : DAMAGE_ADAPTERS;

      for (const adapter of adaptersToTry) {
        const { error } = await (supabase as any).from(adapter.table).insert(adapter.buildInsert(baseInput));

        if (!error) {
          setActiveAdapter(adapter);
          setModuleUnavailable(false);
          toast({ title: t("success"), description: "Relato de danos enviado com sucesso." });
          setDescription("");
          setLocationText("");
          setLocationCoords(null);
          setPhotoFile(null);
          await loadRequests(userId);
          return;
        }

        if (!isMissingBackendObjectError(error)) {
          throw error;
        }
      }

      setModuleUnavailable(true);
      toast({ title: t("error"), description: "Módulo de danos em configuração. Tente novamente mais tarde.", variant: "destructive" });
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
    for (const bucket of DAMAGE_BUCKET_CANDIDATES) {
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      if (publicUrl) return publicUrl;
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
          <h1 className="text-2xl font-bold">{t("damages")}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="request" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">Relatar danos</TabsTrigger>
            <TabsTrigger value="track">Acompanhar</TabsTrigger>
          </TabsList>

          <TabsContent value="request">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Informe o dano
                </CardTitle>
                <CardDescription>Descreva o dano, envie foto e localização.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="damage-description">Descrição do dano</Label>
                  <Textarea
                    id="damage-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: Vidro partido, mangueira rompida, painel danificado..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="damage-photo">Foto (opcional)</Label>
                  <Input id="damage-photo" type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="damage-location">Localização</Label>
                  <Input id="damage-location" value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Ex.: Talhão B, frente do galpão" />
                  <Button type="button" variant="outline" onClick={handleCaptureLocation} disabled={isGettingLocation}>
                    {isGettingLocation ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Capturando localização...</>
                    ) : (
                      <><MapPin className="mr-2 h-4 w-4" /> Usar localização atual</>
                    )}
                  </Button>
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar relato"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="track">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5" /> Retorno da coordenação
                </CardTitle>
                <CardDescription>Acompanhe status e resposta dos relatos de danos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {moduleUnavailable && (
                  <p className="text-sm text-muted-foreground">Módulo de danos em configuração. Solicite ao suporte a atualização da base de dados.</p>
                )}

                {isLoadingRequests && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

                {!moduleUnavailable && !isLoadingRequests && requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum relato de dano enviado até o momento.</p>
                )}

                {requests.map((request) => (
                  <Card key={request.id} className="border-muted">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{new Date(request.created_at).toLocaleString()}</p>
                        <Badge variant={request.response ? "default" : "secondary"}>{request.status}</Badge>
                      </div>

                      <p className="text-sm">{request.description}</p>

                      {request.location_text && (
                        <p className="text-xs text-muted-foreground"><strong>Local:</strong> {request.location_text}</p>
                      )}

                      {request.photo_path && (
                        <a href={getPhotoUrl(request.photo_path)} target="_blank" rel="noreferrer" className="inline-flex">
                          <Button type="button" size="sm" variant="outline">
                            <Camera className="mr-2 h-4 w-4" /> Ver foto enviada
                          </Button>
                        </a>
                      )}

                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Resposta</p>
                        <p className="mt-1 text-sm">{request.response || "Ainda sem resposta. Aguarde retorno da coordenação."}</p>
                        {request.responded_at && (
                          <p className="mt-1 text-xs text-muted-foreground">Atualizado em: {new Date(request.responded_at).toLocaleString()}</p>
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

export default Damages;
