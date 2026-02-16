import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Fuel = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [kmHours, setKmHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!token) {
      setMessage("Gere o token primeiro.");
      return;
    }

    setIsSaving(true);

    try {
      let lat: number | null = null;
      let lon: number | null = null;

      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            setLocation({ lat: lat!, lon: lon! });
            resolve();
          },
          () => resolve(),
          { timeout: 5000 }
        );
      });

      let imageUrl: string | null = null;

      if (file) {
        const filePath = `${token}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("fuelings")
          .upload(filePath, file);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("fuelings")
            .getPublicUrl(filePath);

          imageUrl = data.publicUrl;
        }
      }

      const { error } = await supabase.from("fuelings").insert({
        token,
        value,
        km_hours: kmHours,
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
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Gerando..." : "GERAR TOKEN"}
            </Button>
          )}

          {token && (
            <div className="space-y-4">

              <div className="text-center text-xl font-bold text-green-600">
                Token: {token}
              </div>

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
                onChange={(e) =>
                  e.target.files && setFile(e.target.files[0])
                }
                className="w-full"
              />

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Registrar Abastecimento"}
              </Button>
            </div>
          )}

          {message && (
            <div className="text-center text-sm text-muted-foreground">
              {message}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Fuel;
