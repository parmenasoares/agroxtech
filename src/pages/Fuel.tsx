import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fuel as FuelIcon, ImagePlus, Ticket } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import type { TranslationKey } from "@/lib/i18n";

const MAX_IMAGE_SIZE_MB = 10;

type MessageType = "success" | "error" | "info";

const getFuelFriendlyError = (err: unknown, t: (key: TranslationKey) => string): string => {
  const fallback = getPublicErrorMessage(err, t);
  const message = String((err as { message?: string } | null)?.message ?? "").toLowerCase();

  if (message.includes("schema cache") || message.includes("relation") || message.includes("does not exist")) {
    return "Módulo de abastecimento ainda não está configurado no banco. Contacte o administrador.";
  }

  if (message.includes("bucket") && message.includes("not")) {
    return "Armazenamento de imagens não configurado. Contacte o administrador.";
  }

  return fallback;
};

const parseLocalizedNumber = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed.replace(/\s/g, "");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;

  return parsed;
};

const Fuel = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [kmHours, setKmHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<MessageType>("info");

  const canSubmit = useMemo(() => {
    return Boolean(token) && value.trim().length > 0 && kmHours.trim().length > 0;
  }, [token, value, kmHours]);

  const setFeedback = (text: string | null, type: MessageType = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newToken = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      setToken(newToken);
      setFeedback("Token gerado. Complete os dados para registrar o abastecimento.", "info");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setFeedback("Envie apenas arquivos de imagem.", "error");
      setFile(null);
      return;
    }

    const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setFeedback(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB}MB.`, "error");
      setFile(null);
      return;
    }

    setFeedback(null);
    setFile(selectedFile);
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
      let lat: number | null = null;
      let lon: number | null = null;

      if ("geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lon = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }

      setFeedback(null);

      let imageUrl: string | null = null;

      if (file) {
        const extension = file.name.split(".").pop();
        const filePath = `${token}-${Date.now()}${extension ? `.${extension}` : ""}`;

        const { error: uploadError } = await supabase.storage
          .from("fuelings")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          setFeedback(getFuelFriendlyError(uploadError, t), "error");
          return;
        }

        const { data } = supabase.storage.from("fuelings").getPublicUrl(filePath);

        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("fuelings").insert({
        token,
        value: parsedValue,
        km_hours: parsedKmHours,
        image_url: imageUrl,
        latitude: lat,
        longitude: lon,
      });

      if (error) {
        setFeedback(getFuelFriendlyError(error, t), "error");
      } else {
        setFeedback("Abastecimento registrado com sucesso!", "success");
        setToken(null);
        setValue("");
        setKmHours("");
        setFile(null);
      }
    } catch (err) {
      console.error(err);
      setFeedback(getFuelFriendlyError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <BrandMark />
        </div>

        <Card className="border-primary/15 shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <FuelIcon className="h-5 w-5 text-primary" /> Registrar abastecimento
            </CardTitle>
            <CardDescription>
              Gere o token e preencha os dados do abastecimento para enviar o registro.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!token && (
              <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? "Gerando..." : "Gerar token"}
              </Button>
            )}

            {token && (
              <div className="space-y-4">
                <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Ticket className="h-4 w-4" /> Token ativo
                  </div>
                  <p className="text-2xl font-bold tracking-wide text-primary">{token}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-value">Valor abastecido</Label>
                  <Input
                    id="fuel-value"
                    type="text"
                    placeholder="Ex.: 1250,75"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-km-hours">Horas/KM do painel</Label>
                  <Input
                    id="fuel-km-hours"
                    type="text"
                    placeholder="Ex.: 651561"
                    value={kmHours}
                    onChange={(e) => setKmHours(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-image" className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> Foto do abastecimento (opcional)
                  </Label>
                  <Input
                    id="fuel-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  {file && <p className="text-xs text-muted-foreground">Arquivo selecionado: {file.name}</p>}
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={isSaving || !canSubmit}>
                  {isSaving ? "Salvando..." : "Registrar abastecimento"}
                </Button>
              </div>
            )}

            {message && (
              <Alert variant={messageType === "error" ? "destructive" : "default"}>
                <AlertTitle>{messageType === "success" ? "Sucesso" : messageType === "error" ? "Atenção" : "Informação"}</AlertTitle>
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
