import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE_SIZE_MB = 10;

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

  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [kmHours, setKmHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(token) && value.trim().length > 0 && kmHours.trim().length > 0;
  }, [token, value, kmHours]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newToken = `${Date.now().toString().slice(-6)}${Math.floor(
        Math.random() * 1000
      )}`;
      setToken(newToken);
      setMessage(null);
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
      setMessage("Envie apenas arquivos de imagem.");
      setFile(null);
      return;
    }

    const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setMessage(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB}MB.`);
      setFile(null);
      return;
    }

    setMessage(null);
    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!token) {
      setMessage("Gere o token primeiro.");
      return;
    }

    const parsedValue = parseLocalizedNumber(value);
    const parsedKmHours = parseLocalizedNumber(kmHours);

    if (parsedValue === null || parsedValue <= 0) {
      setMessage("Informe um valor válido para o abastecimento.");
      return;
    }

    if (parsedKmHours === null || parsedKmHours < 0) {
      setMessage("Informe um valor válido para horas ou KM do painel.");
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

      setMessage(null);

      let imageUrl: string | null = null;

      if (file) {
        const extension = file.name.split(".").pop();
        const filePath = `${token}-${Date.now()}${extension ? `.${extension}` : ""}`;

        const { error: uploadError } = await supabase.storage
          .from("fuelings")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          setMessage("Não foi possível enviar a foto do abastecimento.");
          return;
        }

        const { data } = supabase.storage
          .from("fuelings")
          .getPublicUrl(filePath);

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
        setMessage("Erro ao salvar abastecimento.");
      } else {
        setMessage("Abastecimento registrado com sucesso!");
        setToken(null);
        setValue("");
        setKmHours("");
        setFile(null);
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <BrandMark />
        </div>

        <Card className="p-6 space-y-4">
          {!token && (
            <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Gerando..." : "GERAR TOKEN"}
            </Button>
          )}

          {token && (
            <div className="space-y-4">
              <div className="text-center text-xl font-bold text-green-600">Token: {token}</div>

              <input
                type="text"
                placeholder="Valor"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full border rounded p-2"
              />

              <input
                type="text"
                placeholder="Horas ou KM Painel"
                value={kmHours}
                onChange={(e) => setKmHours(e.target.value)}
                className="w-full border rounded p-2"
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                className="w-full"
              />

              <Button className="w-full" onClick={handleSubmit} disabled={isSaving || !canSubmit}>
                {isSaving ? "Salvando..." : "Registrar Abastecimento"}
              </Button>
            </div>
          )}

          {message && <div className="text-center text-sm text-muted-foreground">{message}</div>}
        </Card>
      </div>
    </div>
  );
};

export default Fuel;
