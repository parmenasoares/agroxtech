import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fuel as FuelIcon, ImagePlus, Loader2, MapPin, Ticket } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { getPublicErrorMessage, isBackendCompatibilityError, isMissingBackendObjectError } from "@/lib/publicErrors";

type MessageType = "success" | "error" | "info";

const FUEL_TABLE_CANDIDATES = ["fuelings", "fuel_records"];
const FUEL_BUCKET_CANDIDATES = ["fuelings", "fuel-records"];

const parseLocalizedNumber = (input: string): number | null => {
  const value = input.trim();
  if (!value) return null;
  const normalized = value.includes(",") && value.includes(".")
    ? value.replace(/\./g, "").replace(",", ".")
    : value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const Fuel = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [kmHours, setKmHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(token) && value.trim().length > 0 && kmHours.trim().length > 0,
    [token, value, kmHours]
  );

  const setFeedback = (next: string | null, type: MessageType = "info") => {
    setMessage(next);
    setMessageType(type);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const nextToken = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
    setToken(nextToken);
    setFeedback("Token gerado. Complete os dados para registrar o abastecimento.", "info");
    setIsGenerating(false);
  };

  const uploadImage = async () => {
    if (!file || !token) return null;

    const ext = file.name.split(".").pop();
    const filePath = `${token}-${Date.now()}${ext ? `.${ext}` : ""}`;

    for (const bucket of FUEL_BUCKET_CANDIDATES) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
      if (!error) {
        return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
      }
      if (!isMissingBackendObjectError(error)) {
        throw error;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!token) {
      setFeedback("Gere o token primeiro.", "error");
      return;
    }

    const parsedValue = parseLocalizedNumber(value);
    const parsedKmHours = parseLocalizedNumber(kmHours);
    if (parsedValue === null || parsedValue <= 0) {
      setFeedback("Informe um valor válido para o abastecimento.", "error");
      return;
    }
    if (parsedKmHours === null || parsedKmHours < 0) {
      setFeedback("Informe um valor válido para horas ou KM do painel.", "error");
      return;
    }

    setIsSaving(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if ("geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 8000 }
          );
        });
      }

      const imageUrl = await uploadImage();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let insertError: unknown = null;
      for (const table of FUEL_TABLE_CANDIDATES) {
        const { error } = await (supabase as any).from(table).insert({
          user_id: user?.id ?? null,
          token,
          value: parsedValue,
          km_hours: parsedKmHours,
          image_url: imageUrl,
          latitude,
          longitude,
        });

        if (!error) {
          insertError = null;
          break;
        }

        insertError = error;
        if (!isBackendCompatibilityError(error)) {
          throw error;
        }
      }

      if (insertError) throw insertError;

      setFeedback("Abastecimento registrado com sucesso!", "success");
      setToken(null);
      setValue("");
      setKmHours("");
      setFile(null);
    } catch (error) {
      setFeedback(getPublicErrorMessage(error, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <BrandMark />
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FuelIcon className="h-5 w-5 text-primary" /> Registrar abastecimento
            </CardTitle>
            <CardDescription>Token, valor, KM/H e foto opcional do abastecimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token && (
              <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? "Gerando..." : "Gerar token"}
              </Button>
            )}

            {token && (
              <>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Ticket className="h-4 w-4" /> Token ativo</p>
                  <p className="text-2xl font-bold text-primary">{token}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-value">Valor</Label>
                  <Input id="fuel-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: 125,70" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-km">Horas/KM painel</Label>
                  <Input id="fuel-km" value={kmHours} onChange={(e) => setKmHours(e.target.value)} placeholder="Ex.: 6512" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-photo" className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Foto (opcional)</Label>
                  <Input id="fuel-photo" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit || isSaving}>
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : <><MapPin className="mr-2 h-4 w-4" /> Registrar abastecimento</>}
                </Button>
              </>
            )}

            {message && (
              <Alert variant={messageType === "error" ? "destructive" : "default"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Fuel;
